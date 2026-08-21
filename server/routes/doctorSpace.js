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
import { authenticateToken, authenticateDoctorToken } from '../middleware/auth.js';

const router = express.Router();

// ==================== ESPACE MÉDECIN ====================

// GET /api/doctor/profile - Profil du médecin connecté
router.get('/api/doctor/profile', authenticateDoctorToken, async (req, res) => {
  try {
    // La photo n'est pas affichée sur cet écran : inutile d'aller la lire.
    const d = await db.prepare(`
      SELECT id, name, email, phone, address, city, specialty, doctor_code,
             description, bio, slot_duration, off_days, blocked_slots,
             accepts_video, video_slots, available_slots, working_days
      FROM doctors WHERE id = ?
    `).get(req.user.id);
    if (!d) return res.status(404).json({ error: 'Médecin non trouvé' });
    res.json({
      id: d.id,
      name: d.name,
      email: d.email || '',
      phone: d.phone || '',
      address: d.address || '',
      city: d.city || '',
      specialty: d.specialty,
      doctorCode: d.doctor_code,
      description: d.description || '',
      bio: d.bio || '',
      slotDuration: d.slot_duration || 30,
      offDays: d.off_days ? JSON.parse(d.off_days) : [],
      blockedSlots: d.blocked_slots ? JSON.parse(d.blocked_slots) : [],
      acceptsVideo: !!d.accepts_video,
      videoSlots: d.video_slots ? JSON.parse(d.video_slots) : [],
      availableSlots: d.available_slots ? JSON.parse(d.available_slots) : [],
      workingDays: d.working_days ? JSON.parse(d.working_days) : [1, 2, 3, 4, 5],
    });
  } catch (error) {
    console.error('Erreur profil médecin:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/doctor/profile - Modifier UNIQUEMENT descriptif, parcours, durée créneau, jours off
router.put('/api/doctor/profile', authenticateDoctorToken, async (req, res) => {
  try {
    const current = await db.prepare(`
      SELECT id, description, bio, slot_duration, off_days, blocked_slots,
             accepts_video, video_slots, available_slots, working_days
      FROM doctors WHERE id = ?
    `).get(req.user.id);
    if (!current) return res.status(404).json({ error: 'Médecin non trouvé' });

    const { description, bio, slotDuration, offDays, blockedSlots, acceptsVideo, videoSlots } = req.body;
    const dur = Number(slotDuration);
    const newDescription = typeof description === 'string' ? description : (current.description || null);
    const newBio = typeof bio === 'string' ? bio : (current.bio || null);
    const newDuration = dur >= 5 && dur <= 120 ? dur : (current.slot_duration || 30);

    // Jours d'indisponibilité : uniquement des dates valides (max 400 entrées)
    const newOff = Array.isArray(offDays)
      ? JSON.stringify(offDays.filter((d) => isValidDate(d)).slice(0, 400))
      : (current.off_days || '[]');

    // Créneaux bloqués. Deux formats acceptés :
    //  - « AAAA-MM-JJ HH:MM » (simple)
    //  - { slot, patientName, patientPhone, patientEmail, note } (réservé à un patient)
    const newBlocked = Array.isArray(blockedSlots)
      ? JSON.stringify(
          blockedSlots
            .map((entry) => {
              const raw = typeof entry === 'string' ? entry : entry && entry.slot;
              if (typeof raw !== 'string') return null;
              const [d, t] = raw.split(' ');
              if (!isValidDate(d) || !isValidTime(t)) return null;
              if (typeof entry === 'string') return raw;

              const cleaned = { slot: raw };
              const name = cleanString(entry.patientName, 120);
              const phone = cleanString(entry.patientPhone, 20);
              const email = normalizeEmail(entry.patientEmail);
              const note = cleanString(entry.note, 500);
              if (name) cleaned.patientName = name;
              if (phone && isValidPhone(phone)) cleaned.patientPhone = phone;
              if (email && isValidEmail(email)) cleaned.patientEmail = email;
              if (note) cleaned.note = note;
              return cleaned;
            })
            .filter(Boolean)
            .slice(0, 2000)
        )
      : (current.blocked_slots || '[]');

    /* Heures vidéo : on ne garde que des « HH:MM » valides, dédoublonnés et
       triés. Le client ne décide pas du format stocké.

       Champ absent = champ inchangé, comme pour le descriptif et les jours
       d'indisponibilité juste au-dessus. Il retombait ici sur une liste vide :
       un écran qui enregistrait le profil sans renvoyer les heures vidéo
       effaçait toutes les plages de téléconsultation du praticien, sans le
       prévenir et sans moyen de les retrouver. */
    const newVideoSlots = Array.isArray(videoSlots)
      ? JSON.stringify(
          [...new Set(videoSlots.filter((t) => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t)))]
            .sort().slice(0, 200)
        )
      : (current.video_slots || '[]');

    // Même règle pour l'activation de la vidéo : ne rien envoyer ne doit pas
    // valoir « je la désactive ».
    const newAcceptsVideo = acceptsVideo === undefined
      ? (current.accepts_video || 0)
      : (acceptsVideo ? 1 : 0);

    await db.prepare('UPDATE doctors SET description = ?, bio = ?, slot_duration = ?, off_days = ?, blocked_slots = ?, accepts_video = ?, video_slots = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newDescription, newBio, newDuration, newOff, newBlocked, newAcceptsVideo, newVideoSlots, req.user.id);

    /* available_slots et working_days sont relus ici parce que la réponse les
       renvoie. Ils manquaient : la réponse annonçait donc « aucun créneau » et
       « lundi à vendredi » après chaque enregistrement, écrasant dans l'écran
       les horaires réels du praticien — et les jours de ceux qui consultent le
       samedi. */
    const d = await db.prepare(`
      SELECT description, bio, slot_duration, off_days, blocked_slots,
             accepts_video, video_slots, available_slots, working_days
      FROM doctors WHERE id = ?
    `).get(req.user.id);
    res.json({
      description: d.description || '',
      bio: d.bio || '',
      slotDuration: d.slot_duration || 30,
      offDays: d.off_days ? JSON.parse(d.off_days) : [],
      blockedSlots: d.blocked_slots ? JSON.parse(d.blocked_slots) : [],
      acceptsVideo: !!d.accepts_video,
      videoSlots: d.video_slots ? JSON.parse(d.video_slots) : [],
      availableSlots: d.available_slots ? JSON.parse(d.available_slots) : [],
      workingDays: d.working_days ? JSON.parse(d.working_days) : [1, 2, 3, 4, 5],
    });
  } catch (error) {
    console.error('Erreur mise à jour profil médecin:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/doctor/appointments - Rendez-vous du médecin + coordonnées patients + remarques
router.get('/api/doctor/appointments', authenticateDoctorToken, async (req, res) => {
  try {
    const rows = await db.prepare(`
      SELECT id, patient_name, patient_email, patient_phone, appointment_date, appointment_time, reason, status, doctor_notes,
             consultation_type, video_room,
             -- Le praticien doit savoir qui il reçoit réellement : un rendez-vous
             -- pris par un parent pour son enfant porte le nom de l'enfant.
             child_first_name, child_last_name, child_age
      FROM appointments
      WHERE doctor_id = ?
      ORDER BY appointment_date DESC, appointment_time DESC
      LIMIT 1000
    `).all(req.user.id);
    res.json(rows);
  } catch (error) {
    console.error('Erreur rendez-vous médecin:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /api/doctor/appointments/:id/notes - Remarques privées du médecin
router.patch('/api/doctor/appointments/:id/notes', authenticateDoctorToken, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }
    const id = Number(req.params.id);
    const appt = await db.prepare('SELECT doctor_id FROM appointments WHERE id = ?').get(id);
    if (!appt) return res.status(404).json({ error: 'Rendez-vous non trouvé' });
    if (appt.doctor_id !== req.user.id) return res.status(403).json({ error: 'Non autorisé' });
    const notes = typeof req.body.notes === 'string' ? req.body.notes : null;
    await db.prepare('UPDATE appointments SET doctor_notes = ? WHERE id = ?').run(notes, id);
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur remarques médecin:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== STATS ====================

// GET /api/stats - Statistiques (authentification requise)
router.get('/api/stats', authenticateToken, async (req, res) => {
  try {
    const doctorCount = await db.prepare('SELECT COUNT(*)::int as count FROM doctors').get();
    const appointmentCount = await db.prepare('SELECT COUNT(*)::int as count FROM appointments').get();
    const specialties = await db.prepare('SELECT COUNT(DISTINCT specialty)::int as count FROM doctors').get();

    res.json({
      totalDoctors: doctorCount.count,
      totalAppointments: appointmentCount.count,
      totalSpecialties: specialties.count
    });
  } catch (error) {
    console.error('Erreur récupération stats:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
