import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import db from '../database.js';
import {
  cleanString, isValidEmail, normalizeEmail, isValidDate, isValidTime,
  isValidPhone, isValidId, toBoundedInt, passwordStrengthError,
  isTooSimilar, isValidDoctorImage,
} from '../security.js';
import passport from '../passport-config.js';
import { generateVerificationCode, sendVerificationEmail } from '../emailService.js';
import {
  EMPREINTE_FACTICE, authenticateToken, authenticatePatientToken,
  authenticateDoctorToken,
} from '../middleware/auth.js';
import { refuseSiFreine, noterEchec, oublierEchecs } from '../lib/tentatives.js';
import {
  NOM_TEMOIN_OAUTH, optionsTemoinOAuth, lireTemoin, fabriquerState, verifierState,
} from '../lib/oauthState.js';

const router = express.Router();

// ==================== ROUTES AUTH ====================

// POST /api/auth/login - Connexion employé
router.post('/api/auth/login', async (req, res) => {
  try {
    const username = cleanString(req.body.username, 64);
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    // Bornes : bcrypt sur une chaîne d'un mégaoctet est un déni de service
    // gratuit ; aucun mot de passe légitime ne dépasse 200 caractères.
    if (!username || !password || password.length > 200) {
      return res.status(400).json({ error: 'Username et password requis' });
    }

    // Freinage par compte : voir lib/tentatives.js. Le plafond par IP seul ne
    // protège rien derrière le NAT d'un opérateur mobile.
    if (await refuseSiFreine(res, 'staff', username)) return;

    // Colonnes nommées : « SELECT * » plaçait le hachage du mot de passe et
    // toute la fiche administrative de l'employé dans une variable de portée
    // large, à deux lignes de la construction de la réponse.
    const user = await db.prepare(
      'SELECT id, username, password, role, totp_enabled FROM users WHERE username = ?'
    ).get(username);

    /* Compte inexistant : on compare quand même, contre une empreinte factice.
       Sans cela, la réponse « identifiant inconnu » revenait en 2 ms et la
       réponse « mot de passe faux » en 80 ms — un chronomètre suffisait à
       dresser la liste des identifiants valides. */
    if (!user) {
      await bcrypt.compare(password, EMPREINTE_FACTICE);
      await noterEchec('staff', username);
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      await noterEchec('staff', username);
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    /* ── Deuxième facteur ──
       Le mot de passe est juste, mais il ne suffit plus. On renvoie un jeton
       INTERMÉDIAIRE, de type « staff-pending » : aucun middleware ne
       l'accepte, il ne donne accès à rien. Il ne sert qu'à rattacher le code
       à venir à cette tentative-ci, et il expire en cinq minutes.

       L'ardoise des échecs n'est effacée qu'après le code : sinon, un
       attaquant qui trouve le mot de passe remettrait le compteur à zéro à
       chaque essai et pourrait ensuite forcer le code à l'infini. */
    if (user.totp_enabled) {
      const jetonIntermediaire = jwt.sign(
        { id: user.id, username: user.username, type: 'staff-pending' },
        process.env.JWT_SECRET,
        { expiresIn: '5m' }
      );
      return res.json({ deuxiemeFacteurRequis: true, jetonIntermediaire });
    }

    await oublierEchecs('staff', username);

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, type: 'staff' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      },
      /* Un compte d'administration sans second facteur est signalé, pas
         bloqué : couper l'accès du jour au lendemain enfermerait dehors
         l'équipe entière. L'écran le rappelle jusqu'à l'activation. */
      deuxiemeFacteurAbsent: user.role === 'admin',
    });
  } catch (error) {
    console.error('Erreur login:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/login-doctor - Connexion médecin (code + mot de passe)
router.post('/api/auth/login-doctor', async (req, res) => {
  try {
    const doctorCode = cleanString(req.body.doctorCode, 64);
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!doctorCode) {
      return res.status(400).json({ error: 'Code médecin requis' });
    }

    if (await refuseSiFreine(res, 'doctor', doctorCode)) return;

    const doctor = await db.prepare(`
      SELECT id, name, specialty, doctor_code, email, password, must_change_password
      FROM doctors WHERE doctor_code = ?
    `).get(doctorCode);

    // Message volontairement identique pour ne pas révéler si le code existe
    if (!doctor) {
      await bcrypt.compare(password || 'x', EMPREINTE_FACTICE);
      await noterEchec('doctor', doctorCode);
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    /* Un compte sans mot de passe ne peut PAS se connecter. L'ancien code
       laissait entrer sur le seul code médecin — un identifiant attribué par
       l'administration, ni secret ni aléatoire. Le tableau de bord admin
       signale ces comptes ; l'admin doit définir un mot de passe initial. */
    if (!doctor.password) {
      await bcrypt.compare(password || 'x', EMPREINTE_FACTICE);
      return res.status(401).json({
        error: 'Compte non activé. Demandez à l\'administration de définir votre mot de passe initial.',
      });
    }

    if (!password || password.length > 200) {
      await noterEchec('doctor', doctorCode);
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }
    const ok = await bcrypt.compare(password, doctor.password);
    if (!ok) {
      await noterEchec('doctor', doctorCode);
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    await oublierEchecs('doctor', doctorCode);

    const token = jwt.sign(
      {
        id: doctor.id,
        name: doctor.name,
        type: 'doctor',
        mustChangePassword: !!doctor.must_change_password,
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: doctor.id,
        name: doctor.name,
        type: 'doctor'
      },
      mustChangePassword: !!doctor.must_change_password
    });
  } catch (error) {
    console.error('Erreur login médecin:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/doctor/change-password - Le médecin change son mot de passe (obligatoire à la 1re connexion)
router.post('/api/doctor/change-password', authenticateDoctorToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ error: 'Nouveau mot de passe requis' });
    }

    const doctor = await db.prepare('SELECT * FROM doctors WHERE id = ?').get(req.user.id);
    if (!doctor) {
      return res.status(404).json({ error: 'Médecin non trouvé' });
    }

    // Si un mot de passe existe déjà, vérifier l'actuel
    if (doctor.password) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Mot de passe actuel requis' });
      }
      if (!await bcrypt.compare(currentPassword, doctor.password)) {
        return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
      }
    }

    // Robustesse
    const strengthErr = passwordStrengthError(newPassword);
    if (strengthErr) {
      return res.status(400).json({ error: strengthErr });
    }

    // Le nouveau mot de passe ne doit pas ressembler à l'ancien
    if (currentPassword && isTooSimilar(currentPassword, newPassword)) {
      return res.status(400).json({ error: 'Le nouveau mot de passe est trop proche de l\'ancien. Choisissez-en un différent.' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    /* `password_changed_at` scelle les jetons émis avant ce changement.
       Sans elle, changer son mot de passe parce qu'on le sait compromis ne
       délogeait personne : le jeton volé gardait l'agenda et les dossiers
       jusqu'au lendemain. */
    await db.prepare('UPDATE doctors SET password = ?, must_change_password = 0, password_changed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(hashed, req.user.id);

    // Nouveau jeton sans le drapeau « changement requis » : l'ancien reste bloqué.
    const token = jwt.sign(
      { id: doctor.id, name: doctor.name, type: 'doctor', mustChangePassword: false },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ message: 'Mot de passe mis à jour avec succès', token });
  } catch (error) {
    console.error('Erreur changement mot de passe médecin:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/auth/verify - Vérifier le token
router.get('/api/auth/verify', authenticateToken, async (req, res) => {
  res.json({ user: req.user });
});

// ==================== ROUTES PATIENTS (EMAIL + OAUTH) ====================

// POST /api/auth/register - Inscription avec email (envoie code de vérification)
router.post('/api/auth/register', async (req, res) => {
  try {
    const { language } = req.body;
    const email = normalizeEmail(req.body.email);
    const name = cleanString(req.body.name, 120);
    const phone = cleanString(req.body.phone, 20);
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Adresse e-mail invalide' });
    }
    if (!name || name.length < 2) {
      return res.status(400).json({ error: 'Nom invalide' });
    }
    /* ── Le téléphone est demandé dès l'inscription ──
       Il n'était collecté nulle part : ni ici, ni par Google, ni par Facebook.
       Or la réservation exige un numéro valide, et les coordonnées sont
       relues sur le compte — le patient arrivait donc au bout du parcours
       devant un bouton qui ne répondait pas, sans champ pour se corriger.
       C'est aussi le seul moyen qu'a le cabinet de rappeler quelqu'un. */
    if (!isValidPhone(phone || '')) {
      return res.status(400).json({ error: 'Numéro de téléphone invalide' });
    }
    // Le mot de passe doit être robuste dès l'inscription
    const pwdError = passwordStrengthError(password);
    if (pwdError) {
      return res.status(400).json({ error: pwdError });
    }

    /* ── On ne dit pas si l'adresse est déjà inscrite ──
       « Cet email est déjà utilisé » faisait de cette route publique un
       annuaire : en la soumettant adresse par adresse, on établissait qui
       possède un compte chifak — donc qui se soigne via la plateforme. Sur un
       service de santé, c'est une information sensible en soi.

       Un compte déjà VÉRIFIÉ reçoit donc la même réponse que n'importe qui,
       sans qu'aucun code ne parte ni qu'aucune ligne ne soit écrite. La
       personne qui a réellement oublié son inscription se retrouve devant
       l'écran de saisie du code sans jamais le recevoir ; c'est le prix de
       cette protection, et l'écran de connexion reste à un clic.

       Un compte NON vérifié, en revanche, peut être repris : c'est une
       inscription abandonnée, il n'y a pas de titulaire établi. */
    const existant = await db.prepare(
      'SELECT id, is_verified FROM patients WHERE email = ?'
    ).get(email);

    const reponseNeutre = {
      message: 'Si cette adresse peut être inscrite, un code de vérification vient d\'être envoyé.',
      email,
    };

    if (existant && existant.is_verified) {
      return res.json(reponseNeutre);
    }

    /* ── L'expiration se calcule DANS la base, jamais ici ──
       Elle était produite en JavaScript puis écrite telle quelle :
       `new Date(...).toISOString()` rend une heure UTC, que PostgreSQL range
       sans broncher dans une colonne « sans fuseau ». La comparaison suivante
       se fait pourtant contre NOW(), qui rend l'heure LOCALE du serveur.

       Sur un serveur à l'heure d'Alger, le code naissait donc avec deux heures
       de retard sur l'horloge qui le juge : il était périmé à la seconde même
       de son écriture, et PERSONNE ne pouvait valider son inscription. Le
       défaut ne se voyait pas en production — Render tourne en UTC, où les
       deux horloges coïncident par accident — mais il rendait tout le parcours
       d'inscription intestable en local, et il aurait suffi d'un changement
       d'hébergeur pour couper les inscriptions du jour au lendemain.

       `NOW() + INTERVAL` supprime la question : une seule horloge, celle de la
       base, des deux côtés de la comparaison. */
    const code = generateVerificationCode();
    await db.prepare(`
      INSERT INTO verification_codes (email, code, expires_at)
      VALUES (?, ?, NOW() + INTERVAL '10 minutes')
    `).run(email, code);

    // Envoyer l'email — s'il ne part pas, on ne crée pas un compte que
    // personne ne pourra jamais vérifier.
    const envoye = await sendVerificationEmail(email, code, language || 'fr');
    if (!envoye) {
      return res.status(502).json({ error: 'Impossible d\'envoyer le code de vérification. Réessayez dans quelques minutes.' });
    }

    /* Compte non vérifié : on écrit ou on réécrit.
       `ON CONFLICT` couvre deux cas d'un coup. La concurrence d'abord : deux
       inscriptions simultanées sur la même adresse passaient toutes deux le
       contrôle d'existence ci-dessus, et la seconde échouait sur une violation
       d'unicité renvoyée en « Erreur serveur ». La reprise ensuite : une
       inscription abandonnée avant la saisie du code doit pouvoir être
       recommencée, éventuellement avec un autre mot de passe.

       La clause `WHERE patients.is_verified = 0` est la garde essentielle :
       elle interdit d'écraser un compte vérifié. Sans elle, cette route
       permettrait de réécrire le mot de passe de n'importe quel patient en
       connaissant sa seule adresse. */
    /* Consentement au traitement des données de santé, horodaté.
       Sans cette date, on ne peut pas démontrer qu'il a été recueilli — et un
       consentement qu'on ne peut pas démontrer n'en est pas un. L'écran
       d'inscription porte la case et les liens vers les conditions et la
       politique de confidentialité. */
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.prepare(`
      INSERT INTO patients (email, name, phone, password, is_verified, consent_at)
      VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
      ON CONFLICT (email) DO UPDATE
        SET name = EXCLUDED.name,
            phone = EXCLUDED.phone,
            password = EXCLUDED.password,
            consent_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE patients.is_verified = 0
    `).run(email, name, phone, hashedPassword);

    res.json(reponseNeutre);
  } catch (error) {
    console.error('Erreur inscription:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/verify-code - Vérifier le code
router.post('/api/auth/verify-code', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const code = typeof req.body.code === 'string' ? req.body.code.trim() : '';

    if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Email ou code invalide' });
    }

    /* ── Freinage par compte ──
       C'était la seule vérification de code du projet qui ne l'appliquait pas.
       La connexion, la double authentification et la réinitialisation du mot de
       passe passent toutes par ce compteur ; l'inscription s'en remettait au
       seul plafond par adresse IP.

       Un code à six chiffres vaut 900 000 possibilités et vit dix minutes. Le
       plafond par IP freine une machine, pas un parc : la seule borne qui
       compte est celle qui suit la CIBLE, quel que soit l'endroit d'où l'on
       frappe. */
    if (await refuseSiFreine(res, 'inscription', email)) return;

    /* ── Consommation atomique du code ──
       La lecture, le contrôle d'expiration et le marquage « utilisé » étaient
       trois opérations distinctes. Entre la première et la troisième, le même
       code passait plusieurs fois : un script qui envoie cent requêtes
       simultanées avec le même code obtenait cent jetons valides, et le
       « à usage unique » n'existait que sur le papier.

       Ici, un seul ordre SQL sélectionne et consomme. PostgreSQL sérialise les
       écritures sur une même ligne : la première requête obtient la ligne, les
       suivantes ne trouvent plus rien à marquer. L'expiration est vérifiée
       dans la même clause, pour la même raison. */
    const consomme = await db.prepare(`
      UPDATE verification_codes
      SET is_used = 1
      WHERE id = (
        SELECT id FROM verification_codes
        WHERE email = ? AND code = ? AND is_used = 0 AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id
    `).get(email, code);

    if (!consomme) {
      await noterEchec('inscription', email);
      // Message unique pour « inconnu », « déjà utilisé » et « périmé » : les
      // distinguer indiquerait à qui tâtonne s'il approche d'un code réel.
      return res.status(400).json({ error: 'Code invalide ou expiré.' });
    }

    await oublierEchecs('inscription', email);

    // Activer le compte
    await db.prepare('UPDATE patients SET is_verified = 1 WHERE email = ?')
      .run(email);

    // Colonnes nommées : « SELECT * » ramenait le hachage du mot de passe et
    // les identifiants sociaux dans une variable qui sert à bâtir la réponse.
    const patient = await db.prepare(
      'SELECT id, email, name FROM patients WHERE email = ?'
    ).get(email);

    if (!patient) {
      return res.status(400).json({ error: 'Code invalide ou expiré.' });
    }

    // Générer un token
    const token = jwt.sign(
      { id: patient.id, email: patient.email, type: 'patient' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Compte vérifié avec succès',
      token,
      user: {
        id: patient.id,
        email: patient.email,
        name: patient.name,
      }
    });
  } catch (error) {
    console.error('Erreur vérification:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/login-patient - Connexion patient avec email
router.post('/api/auth/login-patient', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!isValidEmail(email) || !password || password.length > 200) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    if (await refuseSiFreine(res, 'patient', email)) return;

    /* Compte de démonstration : développement UNIQUEMENT. En production,
       cette recréation automatique était une porte dérobée permanente — un
       mot de passe publié dans le dépôt, impossible à désactiver puisque le
       compte renaissait à chaque tentative. */
    if (process.env.NODE_ENV !== 'production') {
      const demoEmail = 'demo.patient@chifak.dz';
      if (email === demoEmail && password === 'patient123') {
        const existingDemo = await db.prepare('SELECT id FROM patients WHERE email = ?').get(demoEmail);
        if (!existingDemo) {
          const hashed = await bcrypt.hash(password, 10);
          await db.prepare(`
            INSERT INTO patients (email, name, password, is_verified)
            VALUES (?, ?, ?, 1)
          `).run(demoEmail, 'Patient Demo', hashed);
        }
      }
    }

    const patient = await db.prepare(
      'SELECT id, email, name, password, is_verified FROM patients WHERE email = ?'
    ).get(email);

    if (!patient || !patient.password) {
      // Même durée de réponse qu'un mot de passe faux : voir la connexion employé.
      await bcrypt.compare(password, EMPREINTE_FACTICE);
      await noterEchec('patient', email);
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    const validPassword = await bcrypt.compare(password, patient.password);

    if (!validPassword) {
      await noterEchec('patient', email);
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    /* Le contrôle « compte vérifié » vient APRÈS le mot de passe.
       Placé avant, il répondait « compte non vérifié » à qui saisissait
       n'importe quel mot de passe : la route confirmait ainsi l'existence
       d'une adresse à un inconnu, ce que tout le reste du fichier s'applique
       à éviter. */
    if (!patient.is_verified) {
      return res.status(401).json({ error: 'Compte non vérifié. Vérifiez votre email.' });
    }

    await oublierEchecs('patient', email);

    const token = jwt.sign(
      { id: patient.id, email: patient.email, type: 'patient' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: patient.id,
        email: patient.email,
        name: patient.name,
      }
    });
  } catch (error) {
    console.error('Erreur login patient:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/resend-code - Renvoyer le code
router.post('/api/auth/resend-code', async (req, res) => {
  try {
    const { language } = req.body;
    const email = normalizeEmail(req.body.email);

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Email requis' });
    }

    const patient = await db.prepare('SELECT id, is_verified FROM patients WHERE email = ?').get(email);

    /* Réponse identique que le compte existe, soit déjà vérifié, ou n'existe
       pas : cette route est publique, elle ne doit pas servir d'annuaire des
       inscrits. On n'envoie évidemment de code qu'au compte réel non vérifié. */
    if (!patient || patient.is_verified) {
      return res.json({ message: 'Si un compte non vérifié existe pour cette adresse, un code a été envoyé.' });
    }

    // Expiration calculée par la base : voir la note dans /api/auth/register.
    const code = generateVerificationCode();
    await db.prepare(`
      INSERT INTO verification_codes (email, code, expires_at)
      VALUES (?, ?, NOW() + INTERVAL '10 minutes')
    `).run(email, code);

    await sendVerificationEmail(email, code, language || 'fr');

    res.json({ message: 'Si un compte non vérifié existe pour cette adresse, un code a été envoyé.' });
  } catch (error) {
    console.error('Erreur renvoi code:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/patient/profile - Profil patient connecté
router.get('/api/patient/profile', authenticatePatientToken, async (req, res) => {
  try {
    const patient = await db.prepare('SELECT id, email, name, phone FROM patients WHERE email = ?').get(req.user.email);
    if (!patient) {
      return res.status(404).json({ error: 'Patient non trouvé' });
    }
    res.json({ ...patient, phone: patient.phone || '' });
  } catch (error) {
    console.error('Erreur récupération profil patient:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/patient/profile - Modifier ses informations (nom, téléphone)
router.put('/api/patient/profile', authenticatePatientToken, async (req, res) => {
  try {
    const name = cleanString(req.body.name, 120);
    const phone = cleanString(req.body.phone, 20);
    const current = await db.prepare('SELECT * FROM patients WHERE email = ?').get(req.user.email);
    if (!current) {
      return res.status(404).json({ error: 'Patient non trouvé' });
    }
    if (phone && !isValidPhone(phone)) {
      return res.status(400).json({ error: 'Numéro de téléphone invalide' });
    }
    const newName = name && name.length >= 2 ? name : current.name;
    const newPhone = phone !== null ? phone : (current.phone || '');
    await db.prepare('UPDATE patients SET name = ?, phone = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?')
      .run(newName, newPhone, req.user.email);

    const patient = await db.prepare('SELECT id, email, name, phone FROM patients WHERE email = ?').get(req.user.email);
    res.json({ ...patient, phone: patient.phone || '' });
  } catch (error) {
    console.error('Erreur mise à jour profil patient:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/* La route /api/patient/recharge a été supprimée.

   Elle créditait un compte SANS aucun paiement : elle additionnait le montant
   que le navigateur lui envoyait. N'importe quel patient connecté pouvait
   donc se créditer la somme de son choix, indéfiniment, avec une requête.
   Elle n'était appelée par aucun écran — c'était une porte ouverte sur rien.

   Le jour où le rechargement existera, il ne ressemblera pas à ceci : le
   solde ne devra augmenter qu'après confirmation reçue DU prestataire de
   paiement, jamais sur la parole du client.

   La colonne `balance` a cessé de sortir dans les réponses. Elle était lue,
   renvoyée au navigateur et affichée, alors que RIEN ne l'alimentait : le
   service promettait par là un solde qui ne pouvait jamais bouger. Elle reste
   en base — la retirer ferait perdre les valeurs héritées sans rien gagner —
   mais elle ne quitte plus le serveur tant qu'un paiement n'existe pas.

   Repérée par scripts/contrats.mjs — « déclarée, jamais appelée ». */

// ==================== ROUTES OAUTH ====================

const frontendUrl = () => process.env.FRONTEND_URL || 'http://localhost:5173';

const isGoogleOAuthReady = () =>
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id';

const isFacebookOAuthReady = () =>
  process.env.FACEBOOK_APP_ID &&
  process.env.FACEBOOK_APP_ID !== 'your_facebook_app_id';

/* Le contrôle anti-falsification du retour OAuth vit dans lib/oauthState.js :
   c'est de la logique pure, sans base ni réseau, et elle mérite ses propres
   cas de test plutôt que d'être noyée au milieu des routes. */

/** Prépare la poignée de main : pose l'aléa dans un témoin, rend le `state`. */
const preparerState = (req, res) => {
  const { alea, state } = fabriquerState(req.query.redirect);
  res.cookie(NOM_TEMOIN_OAUTH, alea, optionsTemoinOAuth());
  return state;
};

/** Contrôle le retour. Rend la destination, ou null si ce n'est pas ce navigateur. */
const controlerRetour = (req, res) => {
  const attendu = lireTemoin(req.headers.cookie, NOM_TEMOIN_OAUTH);
  res.clearCookie(NOM_TEMOIN_OAUTH, { path: '/' });
  return verifierState(req.query.state, attendu);
};

// Google OAuth
router.get('/api/auth/google', (req, res, next) => {
  if (!isGoogleOAuthReady()) {
    return res.redirect(`${frontendUrl()}/?oauth=unconfigured&provider=google`);
  }
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state: preparerState(req, res),
  })(req, res, next);
});

/**
 * Adresse de retour vers l'application.
 *
 * ── Le jeton voyage dans le FRAGMENT, jamais dans la chaîne de requête ──
 *
 * Une chaîne de requête est journalisée partout : par l'hébergeur du site, par
 * les caches et relais intermédiaires, et elle repart dans l'en-tête Referer
 * de la première ressource chargée par la page. Le jeton de session d'un
 * patient — qui ouvre son dossier médical pendant vingt-quatre heures — s'y
 * retrouvait donc en clair, dans des journaux que personne ne surveille et
 * que personne ne purge.
 *
 * Le fragment, lui, ne quitte jamais le navigateur : il n'est pas transmis au
 * serveur, n'apparaît dans aucun journal d'accès et ne fuit par aucun Referer.
 *
 * L'adresse et le nom ont été retirés : l'application les ignorait déjà — elle
 * lit le profil auprès du serveur, la seule source qui ne se réécrit pas d'un
 * clic — et les publier ne servait qu'à exposer l'e-mail d'un patient dans une
 * barre d'adresse.
 */
const buildOAuthRedirect = (token, isApp) => {
  const fragment = new URLSearchParams({ token }).toString();
  if (isApp) {
    // Retour dans l'app native via un lien profond (custom URL scheme)
    const scheme = process.env.MOBILE_REDIRECT_URL || 'chifak://auth/callback';
    return `${scheme}#${fragment}`;
  }
  const frontend = process.env.FRONTEND_URL || 'http://localhost:5173';
  return `${frontend}/auth/callback#${fragment}`;
};

/**
 * Retour d'un fournisseur OAuth.
 *
 * Passport est appelé à la main plutôt que par `failureRedirect` : le refus a
 * désormais une RAISON — « un compte existe déjà avec cette adresse,
 * connectez-vous par mot de passe » — et cette raison doit parvenir au
 * patient. Une redirection muette vers « échec de la connexion » le laisserait
 * devant une porte close sans indication de la clé.
 *
 * Le motif transite en clair dans l'adresse ; il ne contient donc rien de
 * confidentiel, seulement la marche à suivre.
 */
const traiterRetourOAuth = (fournisseur) => (req, res, next) => {
  const front = process.env.FRONTEND_URL || 'http://localhost:5173';

  /* Le contrôle du `state` vient AVANT tout le reste : avant de parler au
     fournisseur, avant de toucher la base, avant de signer quoi que ce soit.
     Un retour qui n'a pas été initié depuis ce navigateur n'a rien à faire
     ici, et le message le dit sans détour — « recommencez depuis
     l'application » — parce que c'est aussi ce que voit quelqu'un dont le
     navigateur a simplement effacé ses témoins entre-temps. */
  const cible = controlerRetour(req, res);
  if (!cible) {
    return res.redirect(
      `${front}/?auth_error=1&motif=${encodeURIComponent(
        'Connexion expirée ou non initiée depuis cet appareil. Recommencez depuis l\'application.',
      )}`,
    );
  }

  passport.authenticate(fournisseur, { session: false }, (err, user, info) => {
    if (err) {
      console.error(`Erreur OAuth ${fournisseur}:`, err);
      return res.redirect(`${front}/?auth_error=1`);
    }
    if (!user) {
      const motif = info && info.message ? info.message : '';
      return res.redirect(
        `${front}/?auth_error=1${motif ? `&motif=${encodeURIComponent(motif)}` : ''}`
      );
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, type: 'patient' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    return res.redirect(buildOAuthRedirect(token, cible === 'app'));
  })(req, res, next);
};

router.get('/api/auth/google/callback', traiterRetourOAuth('google'));

// Facebook OAuth
router.get('/api/auth/facebook', (req, res, next) => {
  if (!isFacebookOAuthReady()) {
    return res.redirect(`${frontendUrl()}/?oauth=unconfigured&provider=facebook`);
  }
  passport.authenticate('facebook', {
    scope: ['email'],
    state: preparerState(req, res),
  })(req, res, next);
});

router.get('/api/auth/facebook/callback', traiterRetourOAuth('facebook'));

export default router;
