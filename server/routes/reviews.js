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
import { authenticateToken, authenticatePatientToken } from '../middleware/auth.js';

const router = express.Router();

// ==================== ROUTES AVIS (REVIEWS) ====================

// GET /api/doctors/:id/reviews - Avis d'un médecin
router.get('/api/doctors/:id/reviews', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }
    const doctorId = Number(req.params.id);

    /* Deux requêtes plutôt qu'une. La moyenne et la répartition par étoile
       étaient calculées côté navigateur à partir de la liste complète : sur un
       praticien à trois mille avis, cela voulait dire trois mille lignes
       envoyées à chaque ouverture de fiche. On agrège en base — un index sur
       doctor_id suffit — et on ne renvoie que les cent avis les plus récents,
       les seuls qu'un lecteur parcourt réellement. */
    const [resume, reviews] = await Promise.all([
      db.prepare(`
        SELECT COUNT(*)::int AS total,
               COALESCE(AVG(rating), 0)::float AS moyenne,
               COUNT(*) FILTER (WHERE rating = 5)::int AS n5,
               COUNT(*) FILTER (WHERE rating = 4)::int AS n4,
               COUNT(*) FILTER (WHERE rating = 3)::int AS n3,
               COUNT(*) FILTER (WHERE rating = 2)::int AS n2,
               COUNT(*) FILTER (WHERE rating = 1)::int AS n1
        FROM reviews WHERE doctor_id = ?
      `).get(doctorId),
      db.prepare(`
        SELECT id, patient_name, rating, comment, created_at
        FROM reviews WHERE doctor_id = ? ORDER BY created_at DESC LIMIT 100
      `).all(doctorId),
    ]);

    res.json({
      total: resume ? resume.total : 0,
      moyenne: resume ? Math.round(resume.moyenne * 10) / 10 : 0,
      repartition: {
        5: resume ? resume.n5 : 0,
        4: resume ? resume.n4 : 0,
        3: resume ? resume.n3 : 0,
        2: resume ? resume.n2 : 0,
        1: resume ? resume.n1 : 0,
      },
      reviews,
    });
  } catch (error) {
    console.error('Erreur récupération avis:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/doctors/:id/reviews - Laisser (ou mettre à jour) son avis
router.post('/api/doctors/:id/reviews', authenticatePatientToken, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }
    const doctorId = Number(req.params.id);
    const rating = toBoundedInt(req.body.rating, { min: 1, max: 5, fallback: null });

    /* `cleanString` plutôt qu'un simple `.trim()`.
       Le commentaire n'avait AUCUNE borne : un avis de cinquante mille
       caractères — vérifié — s'enregistrait puis repartait dans la fiche
       publique du praticien, donc vers chaque visiteur, indéfiniment. Les
       caractères de contrôle passaient avec.

       Deux mille caractères, comme les avis du personnel dans staff.js.
       C'est déjà très au-delà de ce que quiconque écrit sur un médecin. */
    const comment = cleanString(req.body.comment, 2000);

    if (!rating) {
      return res.status(400).json({ error: 'Note invalide (1 à 5)' });
    }

    const doctor = await db.prepare('SELECT id FROM doctors WHERE id = ?').get(doctorId);
    if (!doctor) {
      return res.status(404).json({ error: 'Médecin non trouvé' });
    }

    // On ne peut laisser un avis qu'APRÈS la consultation (rendez-vous passé)
    const today = new Date().toISOString().split('T')[0];
    const hadAppt = await db.prepare(`
      SELECT id FROM appointments
      WHERE doctor_id = ? AND patient_email = ? AND status != 'cancelled' AND appointment_date <= ?
    `).get(doctorId, req.user.email, today);
    if (!hadAppt) {
      return res.status(403).json({ error: 'Vous pourrez laisser un avis après votre consultation.' });
    }

    const patient = await db.prepare('SELECT name FROM patients WHERE email = ?').get(req.user.email);

    await db.prepare(`
      INSERT INTO reviews (doctor_id, patient_email, patient_name, rating, comment)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (doctor_id, patient_email)
      DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, patient_name = EXCLUDED.patient_name, created_at = CURRENT_TIMESTAMP
    `).run(doctorId, req.user.email, patient ? patient.name : null, rating, comment);

    /* Note moyenne recalculée PAR la base, en un seul ordre.
       La séquence « lire les statistiques, puis écrire dans doctors » laissait
       deux avis déposés au même instant écrire chacun une valeur calculée sans
       connaître l'autre : la seconde écrasait la première, et la note affichée
       ne correspondait plus aux avis réellement enregistrés. Ici, le calcul et
       l'écriture ne font qu'un — le résultat est toujours celui de la table
       des avis à cet instant. */
    const maj = await db.prepare(`
      UPDATE doctors d
      SET rating = ROUND(COALESCE(s.moyenne, 0)::numeric, 1),
          review_count = COALESCE(s.total, 0)
      FROM (
        SELECT COUNT(*)::int AS total, AVG(rating)::float AS moyenne
        FROM reviews WHERE doctor_id = ?
      ) s
      WHERE d.id = ?
      RETURNING d.rating, d.review_count
    `).get(doctorId, doctorId);

    res.status(201).json({
      rating: Number(maj?.rating ?? 0),
      reviewCount: maj?.review_count ?? 0,
    });
  } catch (error) {
    console.error('Erreur enregistrement avis:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/patient/reviews - Médecins déjà notés par le patient connecté
router.get('/api/patient/reviews', authenticatePatientToken, async (req, res) => {
  try {
    const rows = await db.prepare('SELECT doctor_id FROM reviews WHERE patient_email = ? LIMIT 500').all(req.user.email);
    res.json(rows);
  } catch (error) {
    console.error('Erreur récupération avis patient:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/reviews - Tous les avis (espace admin/personnel)
router.get('/api/reviews', authenticateToken, async (req, res) => {
  try {
    const rows = await db.prepare(`
      SELECT r.id, r.doctor_id, r.patient_name, r.rating, r.comment, r.created_at,
             d.name AS doctor_name, d.specialty
      FROM reviews r JOIN doctors d ON r.doctor_id = d.id
      ORDER BY r.created_at DESC
      LIMIT 500
    `).all();
    res.json(rows);
  } catch (error) {
    console.error('Erreur récupération avis (admin):', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/* La suppression d'un avis a été retirée volontairement.
   Un avis publié par un patient ne doit pas pouvoir disparaître : une note
   effaçable sur demande ne vaut rien pour le patient suivant. Les avis sont
   désormais affichés sous la fiche du praticien, sans possibilité de retrait. */


// ==================== ROUTES APPOINTMENTS ====================
export default router;
