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
    const { patientName, patientPhone, patientEmail, stateDescription, progressNotes, nextAppointmentId } = req.body;
    const doctorId = req.user.id;

    if (!patientName) {
      return res.status(400).json({ error: 'Nom du patient requis' });
    }

    const result = await db.prepare(`
      INSERT INTO consultations (doctor_id, patient_name, patient_phone, patient_email, state_description, progress_notes, next_appointment_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(doctorId, patientName, patientPhone || null, patientEmail || null, stateDescription || null, progressNotes || null, nextAppointmentId || null);

    res.status(201).json({ id: result.lastInsertRowid, message: 'Consultation enregistrée' });
  } catch (error) {
    console.error('Erreur création consultation:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/consultations - Récupérer les consultations du médecin connecté
router.get('/api/consultations', authenticateDoctorToken, async (req, res) => {
  try {
    const consultations = await db.prepare(`
      SELECT c.*, a.appointment_date as next_date, a.appointment_time as next_time
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
