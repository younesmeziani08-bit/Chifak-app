/** Comptes du personnel : identifiants tirés au sort, matricules, journal d'actions. */
import crypto from 'node:crypto';
import db from '../database.js';

/**
 * Identifiant de connexion : suite de 8 chiffres tirée au sort.
 *
 * Un identifiant dérivé du nom se devine, et permet donc d'énumérer le
 * personnel puis de tenter des mots de passe sur des comptes existants.
 * Une suite aléatoire supprime cette prise : il faut connaître le numéro,
 * qui n'est communiqué qu'à l'employé concerné.
 *
 * `randomInt` plutôt que `Math.random` : ce dernier est prédictible, et un
 * identifiant devinable annulerait tout l'intérêt de la mesure.
 * Le premier chiffre n'est jamais 0, sinon un zéro de tête disparaît dès que
 * le numéro passe par un tableur ou un champ numérique.
 */
export function tirerIdentifiant() {
  const premier = crypto.randomInt(1, 10);
  const reste = String(crypto.randomInt(0, 10_000_000)).padStart(7, '0');
  return `${premier}${reste}`;
}

/**
 * Prochain matricule lisible : EMP-2026-0007.
 *
 * Il était calculé par COUNT(*), ce qui était faux deux fois. D'abord après
 * une suppression : sept employés dont un parti donnent six, et le suivant
 * reprend EMP-2026-0006 — un matricule déjà porté, déjà cité dans le journal
 * d'actions. Ensuite en cas de créations simultanées : deux requêtes lisent
 * le même compte et fabriquent le même matricule.
 *
 * MAX du numéro déjà attribué corrige le premier point. Le second ne peut pas
 * se corriger ici : seule la base voit les deux requêtes, et c'est son index
 * unique qui tranche — voir la boucle de réessai dans la route de création.
 */
export async function prochainMatricule() {
  const annee = new Date().getFullYear();
  const row = await db.prepare(`
    SELECT COALESCE(MAX(NULLIF(regexp_replace(staff_code, '^EMP-\\d{4}-', ''), '')::int), 0) AS n
    FROM users
    WHERE staff_code ~ ?
  `).get(`^EMP-${annee}-[0-9]+$`);
  return `EMP-${annee}-${String(Number(row?.n || 0) + 1).padStart(4, '0')}`;
}

/**
 * Exécute une écriture qui peut heurter une contrainte d'unicité, en
 * réessayant avec de nouvelles valeurs.
 *
 * C'est le seul schéma correct face à la concurrence : vérifier qu'une valeur
 * est libre puis l'insérer laisse toujours un intervalle pendant lequel une
 * autre requête peut la prendre. On tente, et on retente si la base refuse.
 *
 * 23505 est le code PostgreSQL d'une violation d'unicité. Toute autre erreur
 * remonte immédiatement : elle ne se résoudra pas en réessayant.
 */
export async function insererAvecUnicite(tentative, essais = 6) {
  for (let i = 0; i < essais; i += 1) {
    try {
      return await tentative(i);
    } catch (e) {
      if (e?.code !== '23505' || i === essais - 1) throw e;
    }
  }
  throw new Error('Impossible d\'obtenir un identifiant unique.');
}

/**
 * Trace une action du personnel. Volontairement silencieuse en cas d'échec :
 * un journal indisponible ne doit jamais empêcher l'inscription d'un médecin.
 */
export async function journaliser(user, action, doctor) {
  try {
    const staff = await db.prepare('SELECT staff_code FROM users WHERE id = ?').get(user.id);
    await db.prepare(`
      INSERT INTO staff_actions (user_id, staff_code, action, doctor_id, doctor_name)
      VALUES (?, ?, ?, ?, ?)
    `).run(user.id, staff?.staff_code || null, action, doctor?.id || null, doctor?.name || null);
  } catch (e) {
    console.error('Journalisation impossible:', e.message);
  }
}
