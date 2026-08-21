/**
 * Freinage des tentatives de connexion, par COMPTE et non par adresse IP.
 *
 * ── Pourquoi le limiteur par IP ne suffit pas ──
 *
 * En Algérie, la majorité des connexions mobiles passent par le NAT de
 * l'opérateur : des milliers d'abonnés partagent la même adresse publique. Un
 * plafond par IP y produit les deux erreurs à la fois. D'un côté il punit les
 * innocents — trente tentatives consommées par des inconnus, et un patient qui
 * se trompe une fois de mot de passe se retrouve bloqué. De l'autre il ne
 * gêne pas l'attaquant, qui change d'adresse à volonté et repart à zéro.
 *
 * Le compteur porte donc sur la CIBLE : cet identifiant précis. Peu importe
 * d'où viennent les tentatives, c'est le compte visé qui se ferme. L'attaquant
 * ne gagne rien à changer d'adresse, et les autres usagers du même opérateur
 * ne subissent rien.
 *
 * ── Verrouillage progressif, jamais définitif ──
 *
 * Un blocage permanent transforme l'attaque en déni de service : il suffit de
 * quelques essais ratés pour fermer le compte de quelqu'un. Le délai croît
 * donc à chaque échec puis se relâche seul, et une connexion réussie efface
 * l'ardoise.
 *
 * ── Stockage ──
 *
 * En mémoire du processus, ou dans Redis quand il est configuré. Avec
 * plusieurs instances et sans Redis, chacune compte de son côté : le freinage
 * reste réel mais plus lâche. C'est un compromis assumé — il ne doit jamais
 * empêcher le service de démarrer.
 */
import { clientRedisPartage } from '../config/redis.js';

/** Palier de temporisation selon le nombre d'échecs consécutifs. */
const PALIERS = [
  { seuil: 5, attente: 30 },     // 5 échecs  → 30 secondes
  { seuil: 8, attente: 300 },    // 8 échecs  → 5 minutes
  { seuil: 12, attente: 900 },   // 12 échecs → 15 minutes
  { seuil: 20, attente: 3600 },  // 20 échecs → 1 heure
];

/** Au-delà de cette durée sans échec, le compteur repart de zéro. */
const OUBLI_SECONDES = 3600;

/** Repli mémoire : Map clé → { echecs, dernier } */
const memoire = new Map();

/* Ménage périodique du repli mémoire : sans cela, chaque identifiant essayé
   une fois resterait en mémoire jusqu'au redémarrage — un simple script
   suffirait à la faire grossir indéfiniment. */
setInterval(() => {
  const limite = Date.now() - OUBLI_SECONDES * 1000;
  for (const [cle, v] of memoire) {
    if (v.dernier < limite) memoire.delete(cle);
  }
}, 10 * 60 * 1000).unref();

const cleRedis = (portee, cible) => `chifak:echecs:${portee}:${cible}`;

async function lire(portee, cible) {
  if (clientRedisPartage) {
    try {
      const n = await clientRedisPartage.get(cleRedis(portee, cible));
      return { echecs: Number(n) || 0 };
    } catch { /* Redis indisponible : on retombe sur la mémoire. */ }
  }
  const v = memoire.get(`${portee}:${cible}`);
  if (!v) return { echecs: 0 };
  if (v.dernier < Date.now() - OUBLI_SECONDES * 1000) return { echecs: 0 };
  return { echecs: v.echecs };
}

/**
 * Combien de secondes ce compte doit-il encore attendre ?
 * Renvoie 0 s'il peut tenter sa chance.
 */
export async function attenteRequise(portee, cible) {
  if (!cible) return 0;
  const { echecs } = await lire(portee, String(cible).toLowerCase());
  let attente = 0;
  for (const p of PALIERS) {
    if (echecs >= p.seuil) attente = p.attente;
  }
  return attente;
}

/** Enregistre un échec. Le compteur expire seul après une heure sans tentative. */
export async function noterEchec(portee, cible) {
  if (!cible) return;
  const c = String(cible).toLowerCase();
  if (clientRedisPartage) {
    try {
      const k = cleRedis(portee, c);
      await clientRedisPartage.incr(k);
      await clientRedisPartage.expire(k, OUBLI_SECONDES);
      return;
    } catch { /* repli mémoire */ }
  }
  const cle = `${portee}:${c}`;
  const v = memoire.get(cle);
  const frais = !v || v.dernier < Date.now() - OUBLI_SECONDES * 1000;
  memoire.set(cle, { echecs: frais ? 1 : v.echecs + 1, dernier: Date.now() });
}

/** Efface l'ardoise après une connexion réussie. */
export async function oublierEchecs(portee, cible) {
  if (!cible) return;
  const c = String(cible).toLowerCase();
  if (clientRedisPartage) {
    try {
      await clientRedisPartage.del(cleRedis(portee, c));
      return;
    } catch { /* repli mémoire */ }
  }
  memoire.delete(`${portee}:${c}`);
}

/**
 * Garde à placer en tête d'une route de connexion.
 * Renvoie `true` si la requête a été refusée — l'appelant s'arrête alors.
 *
 * Le message annonce le délai plutôt que « trop de tentatives » : quelqu'un
 * qui s'est trompé deux fois de mot de passe a besoin de savoir quand
 * réessayer, pas d'être soupçonné.
 */
export async function refuseSiFreine(res, portee, cible) {
  const attente = await attenteRequise(portee, cible);
  if (attente <= 0) return false;
  res.set('Retry-After', String(attente));
  res.status(429).json({
    error: attente >= 60
      ? `Trop de tentatives sur ce compte. Réessayez dans ${Math.ceil(attente / 60)} minutes.`
      : `Trop de tentatives sur ce compte. Réessayez dans ${attente} secondes.`,
  });
  return true;
}
