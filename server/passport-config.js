import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import db from './database.js';
import { normalizeEmail, isValidEmail } from './security.js';
import './env.js';

/**
 * Connexion par compte social.
 *
 * ── Le rattachement par adresse e-mail est le point sensible ──
 *
 * L'ancienne logique était : « ce compte social porte une adresse déjà connue,
 * donc c'est la même personne ». C'était une prise de contrôle de compte en
 * trois étapes : créer un compte Facebook au nom de victime@exemple.com, se
 * connecter à chifak avec, et repartir avec un jeton valide sur le dossier
 * médical de la victime. Facebook ne garantit pas que l'adresse déclarée
 * appartienne à son titulaire.
 *
 * Nouvelle règle : on ne rattache un compte social à un compte existant QUE si
 * le fournisseur atteste lui-même que l'adresse est vérifiée. Sinon, on refuse
 * la connexion et on invite la personne à se connecter par mot de passe — ce
 * qui, si c'est bien elle, ne lui coûte rien.
 */

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  // Jamais SELECT * ici : l'objet ressort dans req.user à chaque requête de
  // session, et l'ancienne version y plaçait le hachage du mot de passe.
  try {
    const user = await db.prepare(
      'SELECT id, email, name, is_verified, balance FROM patients WHERE id = ?'
    ).get(id);
    done(null, user || false);
  } catch (e) {
    done(e);
  }
});

/**
 * Le fournisseur atteste-t-il que cette adresse est vérifiée ?
 *
 * Google renseigne `verified` (ou `email_verified` dans le profil brut) et le
 * respecte. Facebook ne fournit rien d'équivalent : on considère donc ses
 * adresses comme non attestées, ce qui interdit tout rattachement automatique.
 */
function adresseAttestee(profile) {
  const email = profile?.emails?.[0];
  if (!email) return false;
  if (email.verified === true || email.verified === 'true') return true;
  const brut = profile?._json;
  return brut?.email_verified === true || brut?.email_verified === 'true';
}

/**
 * Retrouve ou crée le compte patient correspondant à un profil social.
 *
 * `colonne` vaut 'google_id' ou 'facebook_id'. Le nom de colonne n'est jamais
 * construit à partir d'une entrée utilisateur : il est écrit en dur par les
 * deux seuls appelants ci-dessous.
 */
async function resoudreCompte({ colonne, profile, nomParDefaut }) {
  const identifiant = String(profile.id);

  // 1. Ce compte social est-il déjà rattaché ? C'est le cas normal, et le seul
  //    qui ne pose aucune question : l'identifiant vient du fournisseur.
  const dejaLie = await db.prepare(
    `SELECT id, email, name FROM patients WHERE ${colonne} = ?`
  ).get(identifiant);
  if (dejaLie) return { user: dejaLie };

  /* 2. Adresse normalisée. Sans cela, « Karim@Gmail.com » et
        « karim@gmail.com » créent deux comptes distincts — l'unicité de
        PostgreSQL sur du texte distingue la casse — et les rendez-vous se
        répartissent au hasard entre les deux. */
  const email = normalizeEmail(profile?.emails?.[0]?.value || '');
  if (!isValidEmail(email)) {
    return { erreur: 'Ce compte ne fournit pas d\'adresse e-mail utilisable.' };
  }

  const existant = await db.prepare('SELECT id, email, name FROM patients WHERE email = ?').get(email);

  if (existant) {
    // 3. Rattachement : uniquement sur adresse attestée par le fournisseur.
    if (!adresseAttestee(profile)) {
      return {
        erreur: 'Un compte existe déjà avec cette adresse. Connectez-vous avec votre mot de passe, '
          + 'puis rattachez ce service depuis votre compte.',
      };
    }
    await db.prepare(`UPDATE patients SET ${colonne} = ?, is_verified = 1 WHERE id = ?`)
      .run(identifiant, existant.id);
    return { user: existant };
  }

  /* 4. Création. `ON CONFLICT` plutôt qu'un simple INSERT : deux connexions
        simultanées du même nouvel utilisateur — deux onglets, ou un double
        appui — passaient toutes deux le contrôle « l'adresse existe-t-elle ? »
        avant que l'une ait écrit. La seconde violait alors la contrainte
        d'unicité et la connexion échouait sans explication. Ici, la seconde
        retombe simplement sur la ligne créée par la première. */
  const nom = profile.displayName || nomParDefaut;
  await db.prepare(`
    INSERT INTO patients (email, name, ${colonne}, is_verified)
    VALUES (?, ?, ?, 1)
    ON CONFLICT (email) DO UPDATE
      SET ${colonne} = COALESCE(patients.${colonne}, EXCLUDED.${colonne})
  `).run(email, nom, identifiant);

  const cree = await db.prepare('SELECT id, email, name FROM patients WHERE email = ?').get(email);
  return { user: cree };
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id') {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.BACKEND_URL}/api/auth/google/callback`,
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const { user, erreur } = await resoudreCompte({
        colonne: 'google_id', profile, nomParDefaut: 'Utilisateur Google',
      });
      if (erreur) return done(null, false, { message: erreur });
      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }));
}

if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_ID !== 'your_facebook_app_id') {
  passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: `${process.env.BACKEND_URL}/api/auth/facebook/callback`,
    profileFields: ['id', 'emails', 'name'],
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      /* Le repli « id@facebook.com » a été retiré. Il fabriquait une adresse
         qui n'existe pas, sur laquelle aucune confirmation de rendez-vous ne
         pouvait arriver : le patient réservait, et n'était jamais prévenu de
         rien. Mieux vaut refuser la connexion et le dire. */
      const nom = profile.name
        ? `${profile.name.givenName || ''} ${profile.name.familyName || ''}`.trim()
        : '';
      const { user, erreur } = await resoudreCompte({
        colonne: 'facebook_id',
        profile: { ...profile, displayName: nom || profile.displayName },
        nomParDefaut: 'Utilisateur Facebook',
      });
      if (erreur) return done(null, false, { message: erreur });
      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }));
}

export default passport;
