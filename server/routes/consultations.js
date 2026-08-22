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
import { authenticateDoctorToken } from '../middleware/auth.js';

const router = express.Router();

// ==================== ROUTES CONSULTATIONS ====================

// POST /api/consultations - Créer une consultation (réservé aux médecins)
router.post('/api/consultations', authenticateDoctorToken, async (req, res) => {
  try {
    const doctorId = req.user.id;

    /* Toutes les entrées étaient reprises telles quelles : ni nettoyage, ni
       bornes. Un champ de deux mégaoctets partait donc en base à chaque appel,
       et les caractères de contrôle avec. Le reste de l'application passe par
       cleanString ; il n'y a aucune raison que le dossier médical — la donnée
       la plus sensible du service — soit le seul endroit sans contrôle. */
    const patientName = cleanString(req.body.patientName, 120);
    const patientPhone = cleanString(req.body.patientPhone, 20);
    const patientEmail = normalizeEmail(req.body.patientEmail);
    const stateDescription = cleanString(req.body.stateDescription, 5000);
    const progressNotes = cleanString(req.body.progressNotes, 5000);

    if (!patientName || patientName.length < 2) {
      return res.status(400).json({ error: 'Nom du patient requis' });
    }
    if (patientPhone && !isValidPhone(patientPhone)) {
      return res.status(400).json({ error: 'Numéro de téléphone invalide' });
    }
    if (patientEmail && !isValidEmail(patientEmail)) {
      return res.status(400).json({ error: 'Adresse e-mail invalide' });
    }

    /* Le rendez-vous rattaché doit appartenir à CE praticien.
       L'identifiant venait du client sans aucun contrôle : un médecin pouvait
       lier son dossier au rendez-vous d'un confrère, et la lecture ci-dessous
       — qui joint la table des rendez-vous — lui renvoyait alors la date et
       l'heure d'une consultation qui ne le concernait pas. */
    let nextAppointmentId = null;
    if (req.body.nextAppointmentId !== undefined && req.body.nextAppointmentId !== null && req.body.nextAppointmentId !== '') {
      if (!isValidId(req.body.nextAppointmentId)) {
        return res.status(400).json({ error: 'Rendez-vous lié invalide' });
      }
      const candidat = Number(req.body.nextAppointmentId);
      const appt = await db.prepare('SELECT id FROM appointments WHERE id = ? AND doctor_id = ?')
        .get(candidat, doctorId);
      if (!appt) {
        return res.status(403).json({ error: 'Ce rendez-vous ne figure pas dans votre agenda.' });
      }
      nextAppointmentId = candidat;
    }

    const result = await db.prepare(`
      INSERT INTO consultations (doctor_id, patient_name, patient_phone, patient_email, state_description, progress_notes, next_appointment_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(doctorId, patientName, patientPhone || null, patientEmail || null, stateDescription || null, progressNotes || null, nextAppointmentId);

    res.status(201).json({ id: result.lastInsertRowid, message: 'Consultation enregistrée' });
  } catch (error) {
    console.error('Erreur création consultation:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/consultations - Récupérer les consultations du médecin connecté
router.get('/api/consultations', authenticateDoctorToken, async (req, res) => {
  try {
    /* Colonnes nommées une à une, comme partout ailleurs dans ce serveur.
       C'était le dernier « SELECT * » du projet, et il portait sur les
       dossiers de consultation — la donnée la plus sensible du service.

       La requête est bien filtrée par praticien, donc rien ne fuitait. Mais
       l'argument vaut ici comme ailleurs : ce qu'on ne sélectionne pas ne
       peut pas sortir, aujourd'hui comme après la prochaine colonne ajoutée
       à la table. */
    const consultations = await db.prepare(`
      SELECT c.id, c.doctor_id, c.patient_name, c.patient_phone, c.patient_email,
             c.state_description, c.progress_notes, c.next_appointment_id, c.created_at,
             a.appointment_date AS next_date, a.appointment_time AS next_time
      FROM consultations c
      LEFT JOIN appointments a ON c.next_appointment_id = a.id
      WHERE c.doctor_id = ?
      ORDER BY c.created_at DESC LIMIT 500
    `).all(req.user.id);

    res.json(consultations);
  } catch (error) {
    console.error('Erreur récupération consultations:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
