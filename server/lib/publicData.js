/**
 * Réduction des données au strict nécessaire avant toute sortie publique.
 * C'est ici que se joue la protection des patients : ces fonctions sont la
 * SEULE porte par laquelle blocked_slots et les fiches de rendez-vous quittent
 * le serveur.
 */
import db from '../database.js';

/**
 * Créneaux bloqués, réduits à leurs seuls horaires.
 *
 * En base, une entrée peut contenir le patient auquel le médecin réserve la
 * plage : nom, téléphone, e-mail, note. Ces informations ne doivent JAMAIS
 * sortir sur une route publique — n'importe qui aurait pu récupérer la liste
 * des patients habitués d'un praticien avec leurs coordonnées.
 * Le navigateur n'a besoin que de l'horaire pour masquer le créneau.
 */
export function horairesBloquesPublics(raw) {
  let liste;
  try {
    liste = JSON.parse(raw || '[]');
  } catch {
    return [];
  }
  if (!Array.isArray(liste)) return [];
  return liste
    .map((e) => (typeof e === 'string' ? e : e && typeof e.slot === 'string' ? e.slot : null))
    .filter(Boolean);
}

/**
 * Fiche d'un rendez-vous telle qu'un patient a le droit de la voir.
 *
 * Les routes d'annulation et de report renvoyaient « a.* » joint à
 * « d.blocked_slots » : le patient recevait les notes privées que son médecin
 * prend sur lui, et les nom, téléphone et e-mail des autres patients à qui ce
 * médecin réserve des créneaux. Une seule fonction, pour que la correction
 * tienne aux deux endroits — et aux suivants.
 */
export async function ficheRendezVousPatient(id) {
  const brut = await db.prepare(`
    SELECT a.id, a.doctor_id, a.patient_name, a.patient_email, a.patient_phone,
           a.appointment_date, a.appointment_time, a.reason, a.status,
           a.consultation_type, a.video_room, a.created_at,
           d.name AS doctor_name, d.specialty, d.address, d.city,
           d.slot_duration, d.available_slots, d.working_days, d.off_days,
           d.blocked_slots, d.accepts_video, d.video_slots
    FROM appointments a JOIN doctors d ON a.doctor_id = d.id WHERE a.id = ?
  `).get(id);
  if (!brut) return null;
  const { blocked_slots, ...reste } = brut;
  return { ...reste, blocked_slots: JSON.stringify(horairesBloquesPublics(blocked_slots)) };
}
