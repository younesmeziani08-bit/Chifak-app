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
import { sendAppointmentConfirmation } from '../emailService.js';
import { authenticateToken, authenticatePatientToken } from '../middleware/auth.js';
import { bookingLimiter } from '../config/limiters.js';
import { horairesBloquesPublics, ficheRendezVousPatient } from '../lib/publicData.js';

const router = express.Router();

// GET /api/appointments/upcoming-stats - Comptes de rendez-vous à venir (personnel)
/* Le tableau de bord et la liste des médecins affichaient chacun un compteur
   de rendez-vous à venir. Pour l'obtenir, ils téléchargeaient la totalité des
   rendez-vous — jusqu'à mille lignes avec nom, téléphone et e-mail de chaque
   patient — et les comptaient dans le navigateur. Deux écrans, deux fois la
   même liste, pour afficher deux nombres. PostgreSQL les compte ici, et rien
   d'identifiable ne quitte le serveur. */
router.get('/api/appointments/upcoming-stats', authenticateToken, async (req, res) => {
  try {
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const lignes = await db.prepare(`
      SELECT doctor_id, COUNT(*)::int AS n
      FROM appointments
      WHERE status <> 'cancelled' AND appointment_date >= ?
      GROUP BY doctor_id
    `).all(aujourdhui);

    const parMedecin = {};
    let total = 0;
    for (const l of lignes) {
      parMedecin[l.doctor_id] = l.n;
      total += l.n;
    }
    res.json({ total, parMedecin });
  } catch (error) {
    console.error('Erreur statistiques rendez-vous:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


// POST /api/appointments - Créer un rendez-vous
router.post('/api/appointments', bookingLimiter, async (req, res) => {
  try {
    const { doctorId, appointmentDate, appointmentTime, language } = req.body;

    // ── Validation stricte de toutes les entrées (endpoint public) ──
    let patientName = cleanString(req.body.patientName, 120);
    let patientEmail = normalizeEmail(req.body.patientEmail);
    let patientPhone = cleanString(req.body.patientPhone, 20);
    const reason = cleanString(req.body.reason, 1000);

    /* ── Le compte fait foi ──
       Pour un visiteur connecté, les coordonnées ne viennent PAS du
       formulaire : elles sont relues en base à partir de son jeton. Le
       navigateur ne peut donc plus les décider, quoi qu'il envoie.

       C'est ce qui rend le compte réellement personnel. Un compte qui
       permettrait de saisir librement le nom, l'adresse et le téléphone de
       n'importe qui serait un carnet d'adresses partagé, pas un dossier
       médical : le praticien ne saurait jamais qui il reçoit, et l'historique
       d'un patient se remplirait de consultations qui ne sont pas les
       siennes. */
    const enTete = req.headers['authorization'];
    const jetonBrut = enTete && enTete.split(' ')[1];
    let titulaire = null;
    if (jetonBrut) {
      try {
        const porteur = jwt.verify(jetonBrut, process.env.JWT_SECRET, { algorithms: ['HS256'] });
        if (porteur.type === 'patient' && porteur.email) {
          titulaire = await db.prepare(
            'SELECT name, email, phone FROM patients WHERE email = ?'
          ).get(normalizeEmail(porteur.email));
        }
      } catch {
        /* Jeton absent ou périmé : la réservation reste possible en invité. */
      }
    }
    if (titulaire) {
      patientName = titulaire.name || patientName;
      patientEmail = normalizeEmail(titulaire.email);
      patientPhone = titulaire.phone || patientPhone;
    }

    /* ── Rendez-vous pour un enfant mineur ──
       Le rendez-vous reste rattaché au compte du parent — c'est lui qui le
       retrouve et qui reçoit les confirmations — mais le praticien voit le
       nom de l'enfant. Réservé aux comptes connectés : un invité ne peut pas
       déclarer un mineur, il n'y aurait aucun adulte responsable identifié
       derrière la réservation. */
    let childFirstName = null;
    let childLastName = null;
    let childAge = null;
    if (titulaire && req.body.forChild) {
      childFirstName = cleanString(req.body.childFirstName, 60);
      childLastName = cleanString(req.body.childLastName, 60);
      childAge = toBoundedInt(req.body.childAge, { min: 0, max: 17, fallback: null });

      if (!childFirstName || !childLastName) {
        return res.status(400).json({ error: 'Nom et prénom de l\'enfant requis.' });
      }
      if (childAge === null) {
        // 18 et au-delà : la personne prend rendez-vous avec son propre compte.
        return res.status(400).json({
          error: 'Âge de l\'enfant requis, et inférieur à 18 ans. Au-delà, la personne doit créer son propre compte.',
        });
      }
    }

    if (!isValidId(doctorId)) {
      return res.status(400).json({ error: 'Médecin invalide' });
    }
    if (!patientName || patientName.length < 2) {
      return res.status(400).json({ error: 'Nom du patient invalide' });
    }
    if (!isValidEmail(patientEmail)) {
      return res.status(400).json({ error: 'Adresse e-mail invalide' });
    }
    if (!isValidPhone(patientPhone)) {
      return res.status(400).json({ error: 'Numéro de téléphone invalide' });
    }
    if (!isValidDate(appointmentDate)) {
      return res.status(400).json({ error: 'Date invalide' });
    }
    if (!isValidTime(appointmentTime)) {
      return res.status(400).json({ error: 'Heure invalide' });
    }

    // On ne réserve pas dans le passé, ni au-delà d'un an
    const todayIso = new Date().toISOString().slice(0, 10);
    const maxIso = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    if (appointmentDate < todayIso || appointmentDate > maxIso) {
      return res.status(400).json({ error: 'Date hors de la période autorisée' });
    }

    /* Chemin le plus sollicité de l'application : c'est ici que passent toutes
       les réservations. « SELECT * » y chargeait la photo du praticien —
       jusqu'à 200 Ko lus en base pour une prise de rendez-vous qui n'en fait
       rien. On ne demande que les champs réellement consultés plus bas. */
    const doctor = await db.prepare(`
      SELECT id, name, specialty, address, city, email, phone,
             available_slots, working_days, off_days, blocked_slots,
             slot_duration, accepts_video, video_slots
      FROM doctors WHERE id = ?
    `).get(doctorId);

    if (!doctor) {
      return res.status(404).json({ error: 'Médecin non trouvé' });
    }

    // ── Le créneau demandé doit être réellement proposé par le médecin ──
    // (sinon on pourrait forcer un rendez-vous à 3h du matin ou un jour de fermeture)
    const parseJson = (raw, fallback) => { try { return JSON.parse(raw); } catch { return fallback; } };
    const workingDays = parseJson(doctor.working_days, [1, 2, 3, 4, 5]);
    const offDays = parseJson(doctor.off_days, []);
    const slots = parseJson(doctor.available_slots, []);
    const weekday = new Date(`${appointmentDate}T12:00:00Z`).getUTCDay();

    if (!workingDays.includes(weekday) || offDays.includes(appointmentDate)) {
      return res.status(400).json({ error: 'Le médecin ne consulte pas à cette date.' });
    }
    if (!slots.includes(appointmentTime)) {
      return res.status(400).json({ error: 'Créneau horaire non proposé par ce médecin.' });
    }

    // Créneau réservé par le médecin (patient habitué, urgence, etc.)
    const blocked = parseJson(doctor.blocked_slots, [])
      .map((e) => (typeof e === 'string' ? e : e && e.slot))
      .filter(Boolean);
    if (blocked.includes(`${appointmentDate} ${appointmentTime}`)) {
      return res.status(409).json({ error: 'Ce créneau n\'est pas disponible.' });
    }

    // Anti-spam : un même e-mail ne peut pas réserver en masse
    const recent = await db.prepare(`
      SELECT COUNT(*)::int AS count FROM appointments
      WHERE patient_email = ? AND status != 'cancelled' AND created_at > NOW() - INTERVAL '1 hour'
    `).get(patientEmail);
    if (recent && recent.count >= 5) {
      return res.status(429).json({ error: 'Trop de réservations récentes. Réessayez plus tard.' });
    }

    // Anti-double réservation : ce créneau est-il déjà pris (hors annulés) ?
    const existing = await db.prepare(`
      SELECT id FROM appointments
      WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ? AND status != 'cancelled'
    `).get(doctorId, appointmentDate, appointmentTime);

    if (existing) {
      return res.status(409).json({ error: 'Ce créneau vient d\'être réservé. Choisissez-en un autre.' });
    }

    // ── Mode de consultation ──
    // La visioconsultation n'est possible que si le médecin l'a activée sur
    // son compte. On ne fait pas confiance au client : un patient pourrait
    // envoyer « video » pour un praticien qui ne la pratique pas.
    const wantsVideo = req.body.consultationType === 'video';
    if (wantsVideo && !doctor.accepts_video) {
      return res.status(400).json({ error: 'Ce praticien ne propose pas la téléconsultation.' });
    }
    // L'horaire demandé doit figurer parmi les heures que le praticien a
    // explicitement ouvertes à la vidéo. Sans ce contrôle, un patient pourrait
    // forcer une téléconsultation sur un créneau réservé au cabinet.
    if (wantsVideo) {
      const videoHours = parseJson(doctor.video_slots, []);
      if (!videoHours.includes(appointmentTime)) {
        return res.status(400).json({ error: 'Ce créneau n\'est pas ouvert à la téléconsultation.' });
      }
    }
    const consultationType = wantsVideo ? 'video' : 'cabinet';

    // Salle tirée au sort, jamais dérivée de l'identifiant du rendez-vous :
    // 24 octets aléatoires, donc impossible à deviner ou à énumérer.
    const videoRoom = consultationType === 'video'
      ? `chifak-${crypto.randomBytes(24).toString('base64url')}`
      : null;

    /* L'insertion peut encore échouer ici, et c'est voulu : le contrôle
       ci-dessus ne protège pas de deux réservations simultanées. L'index
       unique de la base est le seul arbitre possible, et son refus se traduit
       par le code 23505. */
    let result;
    try {
      /* La langue est conservée avec le rendez-vous.
         Elle servait à envoyer la confirmation puis était jetée. Le rappel de
         la veille, envoyé des semaines plus tard, serait donc parti en
         français à quelqu'un qui a fait toute sa réservation en arabe. */
      result = await db.prepare(`
        INSERT INTO appointments (doctor_id, patient_name, patient_email, patient_phone, appointment_date, appointment_time, reason, consultation_type, video_room, child_first_name, child_last_name, child_age, language)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(doctorId, patientName, patientEmail, patientPhone, appointmentDate, appointmentTime,
        reason || null, consultationType, videoRoom, childFirstName, childLastName, childAge,
        language === 'ar' ? 'ar' : 'fr');
    } catch (e) {
      if (e && e.code === '23505') {
        return res.status(409).json({ error: 'Ce créneau vient d\'être réservé. Choisissez-en un autre.' });
      }
      throw e;
    }

    /* Colonnes nommées une à une. « SELECT * » renvoyait la ligne brute, donc
       la colonne doctor_notes — les remarques privées du praticien sur son
       patient. Elle est vide à la création, mais la route ne doit pas être la
       seule chose qui empêche la fuite : ce qu'on ne sélectionne pas ne peut
       pas sortir, aujourd'hui comme après la prochaine modification. */
    const appointment = await db.prepare(`
      SELECT id, doctor_id, patient_name, patient_email, patient_phone,
             appointment_date, appointment_time, reason, status,
             consultation_type, video_room, created_at,
             child_first_name, child_last_name, child_age
      FROM appointments WHERE id = ?
    `).get(result.lastInsertRowid);

    // Envoyer un email de confirmation
    try {
      await sendAppointmentConfirmation(patientEmail, {
        patientName,
        doctorName: doctor.name,
        specialty: doctor.specialty,
        date: appointmentDate,
        time: appointmentTime,
        address: `${doctor.address}, ${doctor.city}`,
        consultationType,
      }, language || 'fr');
    } catch (emailError) {
      console.error('Erreur envoi email confirmation:', emailError);
      // Ne pas bloquer la création du rendez-vous si l'email échoue
    }

    res.status(201).json(appointment);
  } catch (error) {
    console.error('Erreur création rendez-vous:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/booked-slots?date=YYYY-MM-DD - Créneaux déjà pris ce jour-là (tous médecins)
router.get('/api/booked-slots', async (req, res) => {
  try {
    const { date } = req.query;
    if (!isValidDate(date)) {
      return res.status(400).json({ error: 'Paramètre date invalide (format AAAA-MM-JJ)' });
    }
    const rows = await db.prepare(`
      SELECT doctor_id, appointment_time
      FROM appointments
      WHERE appointment_date = ? AND status != 'cancelled'
      LIMIT 20000
    `).all(date);
    res.json(rows);
  } catch (error) {
    console.error('Erreur récupération créneaux pris:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/patient/appointments - Récupérer les rendez-vous du patient connecté
router.get('/api/patient/appointments', authenticatePatientToken, async (req, res) => {
  try {
    /* Champs listés explicitement. « a.* » renvoyait doctor_notes — les
       remarques privées que le médecin prend sur son patient — directement à
       ce patient. Et « d.blocked_slots » contenait le nom, le téléphone et
       l'e-mail des patients habitués du praticien : chaque patient pouvait
       lire la liste des autres. */
    const rows = await db.prepare(`
      SELECT a.id, a.doctor_id, a.patient_name, a.patient_email, a.patient_phone,
             a.appointment_date, a.appointment_time, a.reason, a.status,
             a.consultation_type, a.video_room, a.created_at,
             a.child_first_name, a.child_last_name, a.child_age,
             d.name AS doctor_name, d.specialty, d.address, d.city,
             d.slot_duration, d.available_slots, d.working_days, d.off_days,
             d.blocked_slots, d.accepts_video, d.video_slots
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      WHERE a.patient_email = ?
      ORDER BY a.appointment_date DESC, a.appointment_time DESC
      LIMIT 500
    `).all(req.user.email);

    const appointments = rows.map(({ blocked_slots, ...reste }) => ({
      ...reste,
      blocked_slots: JSON.stringify(horairesBloquesPublics(blocked_slots)),
    }));

    res.json(appointments);
  } catch (error) {
    console.error('Erreur récupération rendez-vous patient:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});
// PATCH /api/patient/appointments/:id/cancel - Annuler son rendez-vous
router.patch('/api/patient/appointments/:id/cancel', authenticatePatientToken, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }
    const id = Number(req.params.id);
    const appt = await db.prepare('SELECT id, doctor_id, patient_email FROM appointments WHERE id = ?').get(id);
    if (!appt) {
      return res.status(404).json({ error: 'Rendez-vous non trouvé' });
    }
    if (appt.patient_email !== req.user.email) {
      return res.status(403).json({ error: 'Ce rendez-vous ne vous appartient pas' });
    }
    /* La salle de visioconférence est effacée en même temps. Sans cela, le
       lien continuait d'ouvrir une salle valide après l'annulation : deux
       personnes ayant reçu ce lien un jour pouvaient s'y retrouver, hors de
       tout rendez-vous. */
    await db.prepare("UPDATE appointments SET status = 'cancelled', video_room = NULL WHERE id = ?").run(id);
    res.json(await ficheRendezVousPatient(id));
  } catch (error) {
    console.error('Erreur annulation rendez-vous:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/* La reprogrammation a été retirée volontairement.

   Déplacer un rendez-vous d'un geste laissait le patient choisir une date et
   une heure sans voir l'agenda réel du praticien : il découvrait « ce créneau
   est déjà pris » après coup, et recommençait à l'aveugle. Surtout, le
   créneau qu'il libérait ne repartait jamais dans le circuit normal — un
   autre patient qui cherchait ce jour-là ne le voyait pas.

   Le parcours est désormais explicite : annuler, puis reprendre rendez-vous
   depuis la recherche, avec les disponibilités à jour sous les yeux. Un
   déplacement est un nouveau rendez-vous, pas une retouche.

   Ne pas réintroduire cette route sans reprendre d'abord la question de la
   remise en circulation du créneau libéré. */

// GET /api/appointments - Récupérer tous les rendez-vous (authentification requise)
router.get('/api/appointments', authenticateToken, async (req, res) => {
  try {
    const appointments = await db.prepare(`
      SELECT a.id, a.doctor_id, a.patient_name, a.patient_email, a.patient_phone,
             a.appointment_date, a.appointment_time, a.reason, a.status,
             a.consultation_type, a.created_at,
             a.child_first_name, a.child_last_name, a.child_age,
             d.name AS doctor_name, d.specialty, d.address, d.city
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      ORDER BY a.appointment_date DESC, a.appointment_time DESC
      LIMIT 1000
    `).all();

    // La salle de visio n'est pas sélectionnée du tout : seuls le patient
    // concerné et son médecin peuvent y entrer. L'administration voit
    // seulement qu'un rendez-vous est en visio.
    res.json(appointments);
  } catch (error) {
    console.error('Erreur récupération rendez-vous:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
