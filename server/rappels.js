import db from './database.js';
import { sendAppointmentReminder } from './emailService.js';

/**
 * Rappels de rendez-vous, envoyés la veille au soir.
 *
 * ── Le point délicat : ne jamais envoyer deux fois ──
 *
 * Un patient qui reçoit trois fois le même rappel cesse de lire nos courriers,
 * et le quatrième — celui qui compte — finit dans les indésirables. La tâche
 * doit donc être rejouable sans dommage : un redémarrage du serveur, un
 * déclenchement manuel après le passage automatique, deux instances derrière
 * un répartiteur.
 *
 * La solution n'est pas de « vérifier avant d'envoyer » : entre la lecture et
 * l'envoi, une autre exécution passe. C'est la base qui tranche, en marquant
 * la ligne AVANT l'envoi, dans un seul ordre SQL. Celui qui obtient la ligne
 * envoie ; les autres ne trouvent plus rien à marquer.
 *
 * Conséquence assumée : si l'envoi échoue après la réservation, le rappel est
 * perdu plutôt que dupliqué. On remet donc la marque à zéro en cas d'échec —
 * le prochain passage réessaiera.
 */

const TZ = process.env.AGENDA_TIMEZONE || 'Africa/Algiers';

/** Date du jour dans le fuseau algérien, au format AAAA-MM-JJ. */
function jourIso(decalageJours = 0, maintenant = new Date()) {
  const d = new Date(maintenant.getTime() + decalageJours * 86400000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

/**
 * Envoie les rappels pour une journée donnée.
 *
 * @param {object} opts
 * @param {string} [opts.date]  Journée concernée (défaut : demain).
 * @param {number} [opts.appointmentId]  Un seul rendez-vous, pour éprouver l'envoi.
 * @param {boolean} [opts.forcer]  Renvoyer même si un rappel est déjà parti.
 * @returns {object} { date, envoyes, ignores, echecs, details[] }
 */
export async function envoyerRappels(opts = {}) {
  const date = opts.date || jourIso(1);
  const resume = { date, envoyes: 0, ignores: 0, echecs: 0, details: [] };

  /* Réservation ET lecture dans le même ordre.
     `reminder_sent_at` est posé au moment où la ligne est sélectionnée : une
     seconde exécution ne verra plus ces rendez-vous. Les annulés sont exclus
     — rappeler un rendez-vous annulé ferait revenir quelqu'un pour rien. */
  const clauseForcee = opts.forcer ? '' : 'AND a.reminder_sent_at IS NULL';
  const clauseUnique = opts.appointmentId ? 'AND a.id = ?' : '';
  const parametres = opts.appointmentId ? [date, opts.appointmentId] : [date];

  const lignes = await db.prepare(`
    UPDATE appointments SET reminder_sent_at = CURRENT_TIMESTAMP
    WHERE id IN (
      SELECT a.id FROM appointments a
      WHERE a.appointment_date = ?
        AND a.status <> 'cancelled'
        ${clauseForcee}
        ${clauseUnique}
      ORDER BY a.appointment_time
      LIMIT 500
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, patient_name, patient_email, appointment_time,
              consultation_type, child_first_name, child_last_name, language, doctor_id
  `).all(...parametres);

  if (lignes.length === 0) {
    console.log(`🔔 Rappels du ${date} : aucun à envoyer.`);
    return resume;
  }

  /* Les fiches praticiens sont lues une seule fois, pas une par rendez-vous :
     une même matinée chez le même médecin, c'est vingt rendez-vous et une
     seule fiche. */
  const idsMedecins = [...new Set(lignes.map((l) => l.doctor_id))];
  const medecins = new Map();
  for (const id of idsMedecins) {
    const m = await db.prepare('SELECT id, name, specialty, address, city FROM doctors WHERE id = ?').get(id);
    if (m) medecins.set(id, m);
  }

  for (const rdv of lignes) {
    const medecin = medecins.get(rdv.doctor_id);
    if (!medecin || !rdv.patient_email) {
      resume.ignores++;
      resume.details.push({ id: rdv.id, raison: medecin ? 'sans e-mail' : 'praticien introuvable' });
      continue;
    }

    const enfant = rdv.child_first_name
      ? `${rdv.child_first_name} ${rdv.child_last_name || ''}`.trim()
      : null;

    const parti = await sendAppointmentReminder(rdv.patient_email, {
      patientName: rdv.patient_name,
      doctorName: medecin.name,
      specialty: medecin.specialty,
      date,
      time: rdv.appointment_time,
      address: `${medecin.address}, ${medecin.city}`,
      consultationType: rdv.consultation_type || 'cabinet',
      childName: enfant,
      language: rdv.language === 'ar' ? 'ar' : 'fr',
    }).catch(() => false);

    if (parti) {
      resume.envoyes++;
    } else {
      /* Échec d'envoi : on retire la marque pour que le prochain passage
         réessaie. Sans cela, une panne momentanée de messagerie ferait
         disparaître définitivement le rappel — le patient ne saurait jamais
         qu'il devait venir. */
      await db.prepare('UPDATE appointments SET reminder_sent_at = NULL WHERE id = ?')
        .run(rdv.id).catch(() => {});
      resume.echecs++;
      resume.details.push({ id: rdv.id, raison: 'envoi impossible, sera réessayé' });
    }
  }

  console.log(`🔔 Rappels du ${date} : ${resume.envoyes} envoyés, ${resume.ignores} ignorés, ${resume.echecs} en échec`);
  return resume;
}
