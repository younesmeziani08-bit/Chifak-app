import db from './database.js';
import { sendDoctorDailyAgenda } from './emailService.js';

const TZ = process.env.AGENDA_TIMEZONE || 'Africa/Algiers';

// Date du jour (YYYY-MM-DD) dans le fuseau algérien
function todayIso(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

// Libellé lisible (ex : « lundi 5 août 2026 »)
function dateLabel(iso) {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch { return iso; }
}

function safeParse(json, fallback) {
  try { return JSON.parse(json); } catch { return fallback; }
}

/**
 * Construit et envoie à chaque médecin l'agenda d'une journée donnée.
 * @param {object} opts { date?: 'YYYY-MM-DD', doctorId?: number }
 * @returns {object} résumé { date, sent, skipped, details[] }
 */
export async function sendDailyAgendas(opts = {}) {
  const date = opts.date || todayIso();
  const weekday = new Date(date + 'T12:00:00').getDay(); // 0=dim .. 6=sam
  const label = dateLabel(date);

  const doctors = opts.doctorId
    ? await db.prepare('SELECT * FROM doctors WHERE id = ?').all(opts.doctorId)
    : await db.prepare('SELECT * FROM doctors').all();

  const summary = { date, sent: 0, skipped: 0, details: [] };

  for (const doctor of doctors) {
    const email = doctor.email;
    if (!email) { summary.skipped++; summary.details.push({ doctor: doctor.name, reason: 'sans e-mail' }); continue; }

    // Jours travaillés + jours d'indisponibilité
    const workingDays = safeParse(doctor.working_days, [1, 2, 3, 4, 5]);
    const offDays = safeParse(doctor.off_days, []);
    if (!workingDays.includes(weekday) || offDays.includes(date)) {
      summary.skipped++; summary.details.push({ doctor: doctor.name, reason: 'ne travaille pas ce jour' });
      continue;
    }

    // Créneaux de base
    const baseSlots = safeParse(doctor.available_slots, []);

    // Rendez-vous du jour (hors annulés)
    const appts = await db.prepare(
      `SELECT patient_name, patient_phone, patient_email, appointment_time, reason
       FROM appointments
       WHERE doctor_id = ? AND appointment_date = ? AND status != 'cancelled'`
    ).all(doctor.id, date);

    const byTime = new Map();
    for (const a of appts) byTime.set(a.appointment_time, a);

    // Union des créneaux de base et des heures réservées, triée
    const times = Array.from(new Set([...baseSlots, ...byTime.keys()])).sort();

    const slots = times.map((time) => {
      const a = byTime.get(time);
      return a
        ? { time, reserved: true, patient: { name: a.patient_name, phone: a.patient_phone, email: a.patient_email, reason: a.reason } }
        : { time, reserved: false };
    });

    await sendDoctorDailyAgenda(email, doctor.name, label, slots);
    summary.sent++;
    summary.details.push({ doctor: doctor.name, reserved: slots.filter((s) => s.reserved).length, free: slots.filter((s) => !s.reserved).length });
  }

  console.log(`📅 Agendas du ${date} : ${summary.sent} envoyés, ${summary.skipped} ignorés`);
  return summary;
}
