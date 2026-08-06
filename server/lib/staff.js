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
export async function genererIdentifiant() {
  for (let essai = 0; essai < 30; essai += 1) {
    const premier = crypto.randomInt(1, 10);
    const reste = String(crypto.randomInt(0, 10_000_000)).padStart(7, '0');
    const candidat = `${premier}${reste}`;
    const pris = await db.prepare('SELECT id FROM users WHERE username = ?').get(candidat);
    if (!pris) return candidat;
  }
  // 30 collisions d'affilée sur 90 millions de combinaisons est impossible en
  // pratique : si on arrive ici, mieux vaut échouer franchement que boucler.
  throw new Error('Impossible de générer un identifiant unique.');
}

/** Matricule lisible : EMP-2026-0007. Le compteur repart de la base pour
 *  rester continu même après une suppression. */
export async function genererMatricule() {
  const annee = new Date().getFullYear();
  const row = await db.prepare(
    "SELECT COUNT(*) AS n FROM users WHERE staff_code LIKE ?"
  ).get(`EMP-${annee}-%`);
  const suivant = Number(row?.n || 0) + 1;
  return `EMP-${annee}-${String(suivant).padStart(4, '0')}`;
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

