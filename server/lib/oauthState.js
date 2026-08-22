/**
 * Le paramètre « state » d'OAuth, et à quoi il sert vraiment.
 *
 * ── Le problème ──
 *
 * Il portait « app » ou « web » : la destination du retour, et rien d'autre.
 * Or `state` a une fonction de sécurité — c'est la seule protection que le
 * protocole offre contre la falsification de requête. Une valeur devinable ne
 * protège de rien : un tiers pouvait forger une adresse de retour complète et
 * la faire ouvrir à quelqu'un, qui se retrouvait connecté au compte de
 * l'attaquant sans s'en apercevoir. Il y saisissait ensuite ses coordonnées,
 * ses motifs de consultation, et prenait ses rendez-vous — dans un dossier
 * qui ne lui appartenait pas.
 *
 * ── La règle ──
 *
 * Le `state` porte deux choses : un aléa imprévisible, et la destination.
 * L'aléa est déposé en parallèle dans un témoin de connexion, et les deux
 * doivent concorder au retour. Un tiers ne peut pas écrire de témoin dans le
 * navigateur de sa victime : il ne peut donc pas fabriquer de retour recevable.
 *
 * ── Pourquoi un témoin plutôt que la session ──
 *
 * La session vit en mémoire tant que Redis n'est pas configuré. Avec deux
 * instances derrière un répartiteur, le retour d'OAuth atterrit une fois sur
 * deux sur celle qui ne connaît pas la session, et la connexion échouerait
 * sans raison visible. Le témoin voyage avec le navigateur et ne dépend
 * d'aucun stockage partagé.
 */
import crypto from 'node:crypto';

export const NOM_TEMOIN_OAUTH = 'chifak.oauth';

export const optionsTemoinOAuth = () => ({
  httpOnly: true,
  sameSite: 'lax', // le retour du fournisseur est une navigation de premier plan
  secure: process.env.NODE_ENV === 'production',
  maxAge: 10 * 60 * 1000, // la poignée de main dure une minute, pas dix
  path: '/',
});

/**
 * Lit un témoin depuis l'en-tête brut, sans analyseur externe.
 *
 * Les valeurs sont percent-encodées par Express à l'écriture ; on les décode
 * ici. Un décodage impossible — en-tête tronqué, valeur bricolée à la main —
 * rend null plutôt que de lever : cette fonction est appelée sur une entrée
 * que n'importe qui peut écrire.
 */
export function lireTemoin(enTeteCookie, nom) {
  if (!enTeteCookie) return null;
  for (const morceau of String(enTeteCookie).split(';')) {
    const separateur = morceau.indexOf('=');
    if (separateur === -1) continue;
    if (morceau.slice(0, separateur).trim() !== nom) continue;
    try {
      return decodeURIComponent(morceau.slice(separateur + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

/** Fabrique un `state` : un aléa de 24 octets, puis la destination. */
export function fabriquerState(destinationDemandee) {
  const alea = crypto.randomBytes(24).toString('base64url');
  const cible = destinationDemandee === 'app' ? 'app' : 'web';
  return { alea, state: `${alea}.${cible}` };
}

/**
 * Le `state` reçu correspond-il à ce navigateur ?
 *
 * Rend la destination ('app' ou 'web'), ou null si le contrôle échoue.
 *
 * `timingSafeEqual` plutôt que `===` : la comparaison d'un secret ne doit pas
 * révéler, par sa durée, combien de caractères sont déjà justes. La différence
 * est infime sur une requête réseau, mais elle ne coûte rien à supprimer.
 */
export function verifierState(stateRecu, aleaAttendu) {
  if (typeof stateRecu !== 'string' || typeof aleaAttendu !== 'string' || !aleaAttendu) {
    return null;
  }
  const separateur = stateRecu.indexOf('.');
  if (separateur === -1) return null;

  const alea = stateRecu.slice(0, separateur);
  const cible = stateRecu.slice(separateur + 1);

  const a = Buffer.from(alea);
  const b = Buffer.from(aleaAttendu);
  // Les longueurs diffèrent : timingSafeEqual lèverait. On tranche avant.
  if (a.length !== b.length || a.length === 0) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;

  return cible === 'app' ? 'app' : 'web';
}
