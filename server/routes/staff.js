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
import { sendDailyAgendas } from '../dailyAgenda.js';
import { envoyerRappels } from '../rappels.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { authLimiter } from '../config/limiters.js';
import { tirerIdentifiant, prochainMatricule, insererAvecUnicite, journaliser } from '../lib/staff.js';

const router = express.Router();

router.get('/api/admin/employees', authenticateToken, requireAdmin, async (req, res) => {
  try {
    /* Quatre sous-requêtes corrélées par ligne — soit deux mille exécutions
       pour cinq cents employés — devenaient le point lent de la page dès que
       le journal d'actions grossissait. Deux agrégats calculés une seule fois
       puis joints donnent le même résultat en un seul parcours de chaque
       table. */
    const rows = await db.prepare(`
      WITH actions AS (
        SELECT user_id,
               COUNT(*) FILTER (WHERE action = 'doctor_created') AS created_count,
               COUNT(*) FILTER (WHERE action = 'doctor_deleted') AS deleted_count
        FROM staff_actions GROUP BY user_id
      ),
      avis AS (
        SELECT user_id,
               COUNT(*) AS feedback_count,
               ROUND(AVG(rating)::numeric, 1) AS avg_rating
        FROM employee_feedback GROUP BY user_id
      )
      SELECT u.id, u.username, u.full_name, u.first_name, u.last_name, u.role,
             u.staff_code, u.feedback_token, u.active, u.created_at,
             u.birth_date, u.birth_place, u.phone, u.address, u.email,
             u.position, u.hired_at, u.emergency_contact, u.notes,
             COALESCE(actions.created_count, 0)::int AS created_count,
             COALESCE(actions.deleted_count, 0)::int AS deleted_count,
             COALESCE(avis.feedback_count, 0)::int AS feedback_count,
             avis.avg_rating
      FROM users u
      LEFT JOIN actions ON actions.user_id = u.id
      LEFT JOIN avis ON avis.user_id = u.id
      ORDER BY u.role DESC, u.created_at DESC
      LIMIT 500
    `).all();
    res.json(rows);
  } catch (error) {
    console.error('Erreur liste personnel:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/admin/employees - Créer un compte employé
router.post('/api/admin/employees', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const firstName = cleanString(req.body.firstName, 60);
    const lastName = cleanString(req.body.lastName, 60);
    const { password } = req.body;

    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'Nom et prénom obligatoires.' });
    }
    const pwdError = passwordStrengthError(password);
    if (pwdError) return res.status(400).json({ error: pwdError });

    const email = req.body.email ? normalizeEmail(req.body.email) : '';
    if (email && !isValidEmail(email)) {
      return res.status(400).json({ error: 'Adresse e-mail invalide.' });
    }
    const phone = cleanString(req.body.phone, 20);
    if (phone && !isValidPhone(phone)) {
      return res.status(400).json({ error: 'Numéro de téléphone invalide.' });
    }
    const birthDate = req.body.birthDate ? cleanString(req.body.birthDate, 10) : '';
    if (birthDate && !isValidDate(birthDate)) {
      return res.status(400).json({ error: 'Date de naissance invalide.' });
    }
    const hiredAt = req.body.hiredAt ? cleanString(req.body.hiredAt, 10) : '';
    if (hiredAt && !isValidDate(hiredAt)) {
      return res.status(400).json({ error: 'Date d\'entrée invalide.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const fullName = `${firstName} ${lastName}`.trim();

    /* Identifiant, matricule et jeton du QR sont tous soumis à une contrainte
       d'unicité. On tente l'insertion et on retire de nouvelles valeurs si la
       base refuse : deux administrateurs qui créent un employé au même instant
       lisaient auparavant le même matricule libre, et la seconde création
       échouait sur « Erreur serveur ».

       L'identifiant est tiré au sort — ni saisi, ni dérivé du nom. L'admin le
       communique à l'employé après création : il ne peut pas le retrouver en
       devinant, c'est précisément le but. */
    const created = await insererAvecUnicite(async () => {
      const username = tirerIdentifiant();
      const staffCode = await prochainMatricule();
      const feedbackToken = crypto.randomBytes(18).toString('base64url');

      const result = await db.prepare(`
        INSERT INTO users (
          username, password, role, staff_code, full_name, first_name, last_name,
          birth_date, birth_place, phone, address, email, position, hired_at,
          emergency_contact, notes, feedback_token, active
        )
        VALUES (?, ?, 'employee', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(
        username, hashed, staffCode, fullName, firstName, lastName,
        birthDate || null,
        cleanString(req.body.birthPlace, 120) || null,
        phone || null,
        cleanString(req.body.address, 200) || null,
        email || null,
        cleanString(req.body.position, 80) || null,
        hiredAt || null,
        cleanString(req.body.emergencyContact, 120) || null,
        cleanString(req.body.notes, 1000) || null,
        feedbackToken
      );

      return db.prepare(
        `SELECT id, username, full_name, first_name, last_name, role, staff_code,
                birth_date, birth_place, phone, address, email, position, hired_at,
                emergency_contact, notes, feedback_token, active, created_at
         FROM users WHERE id = ?`
      ).get(result.lastInsertRowid);
    });

    res.status(201).json(created);
  } catch (error) {
    /* Le message technique n'est plus renvoyé au client. Il exposait le nom
       des contraintes, des colonnes et des tables — une carte de la base
       offerte à quiconque provoque une erreur, fût-il authentifié. Il reste
       entier dans les journaux du serveur, où il sert vraiment. */
    console.error('Erreur création employé:', error);
    res.status(500).json({ error: 'Création impossible.' });
  }
});

// DELETE /api/admin/employees/:id - Supprimer un compte employé
router.delete('/api/admin/employees/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Identifiant invalide' });
    const id = Number(req.params.id);

    const target = await db.prepare('SELECT id, role FROM users WHERE id = ?').get(id);
    if (!target) return res.status(404).json({ error: 'Compte introuvable' });
    if (target.role === 'admin') {
      return res.status(400).json({ error: 'Un compte administrateur ne peut pas être supprimé ici.' });
    }
    if (Number(req.user.id) === id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' });
    }

    // Le compte disparaît, mais NI son journal NI les avis le concernant :
    // effacer l'historique d'activité à chaque départ rendrait tout suivi
    // impossible. Les lignes conservent le matricule pour rester lisibles.
    await db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ message: 'Compte supprimé. Son historique est conservé.' });
  } catch (error) {
    console.error('Erreur suppression employé:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/admin/employees/:id/regenerate-login - Nouveau numéro de connexion
// Deux usages : rattraper un compte créé avant le passage au tirage aléatoire,
// et remplacer un numéro qui aurait circulé. L'ancien cesse aussitôt de
// fonctionner, l'employé doit donc recevoir le nouveau.
router.post('/api/admin/employees/:id/regenerate-login', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Identifiant invalide' });
    const id = Number(req.params.id);

    const target = await db.prepare('SELECT id, role FROM users WHERE id = ?').get(id);
    if (!target) return res.status(404).json({ error: 'Compte introuvable' });
    if (target.role !== 'employee') {
      return res.status(400).json({ error: 'Réservé aux comptes employés.' });
    }

    // Même règle qu'à la création : on tente, et on retire un autre numéro si
    // celui-ci vient d'être attribué ailleurs.
    const username = await insererAvecUnicite(async () => {
      const candidat = tirerIdentifiant();
        /* On régénère un numéro précisément quand on soupçonne le compte
           d'être compromis. Sans cette date, la session ouverte avec
           l'ancien numéro survivait au geste censé la couper. */
        await db.prepare(
          'UPDATE users SET username = ?, password_changed_at = CURRENT_TIMESTAMP WHERE id = ?',
        ).run(candidat, id);
      return candidat;
    });
    res.json({ username });
  } catch (error) {
    console.error('Erreur régénération identifiant:', error);
    res.status(500).json({ error: 'Régénération impossible.' });
  }
});

// GET /api/admin/employees/:id/stats?from=&to= - Activité sur une période
router.get('/api/admin/employees/:id/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Identifiant invalide' });
    const id = Number(req.params.id);

    // Période par défaut : les 30 derniers jours.
    const to = isValidDate(req.query.to) ? req.query.to : new Date().toISOString().slice(0, 10);
    const from = isValidDate(req.query.from)
      ? req.query.from
      : new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

    // Comptage agrégé en base : le serveur ne rapatrie jamais les lignes.
    const counts = await db.prepare(`
      SELECT action, COUNT(*) AS n
      FROM staff_actions
      WHERE user_id = ? AND created_at >= ?::date AND created_at < (?::date + INTERVAL '1 day')
      GROUP BY action
    `).all(id, from, to);

    const parAction = Object.fromEntries(counts.map((r) => [r.action, Number(r.n)]));

    const recent = await db.prepare(`
      SELECT action, doctor_name, created_at
      FROM staff_actions
      WHERE user_id = ? AND created_at >= ?::date AND created_at < (?::date + INTERVAL '1 day')
      ORDER BY created_at DESC
      LIMIT 50
    `).all(id, from, to);

    res.json({
      from,
      to,
      created: parAction.doctor_created || 0,
      deleted: parAction.doctor_deleted || 0,
      recent,
    });
  } catch (error) {
    console.error('Erreur statistiques employé:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== AVIS DES MÉDECINS SUR LE PERSONNEL ====================

// GET /api/feedback/:token - Identité de l'employé derrière le QR code (public)
// Ne renvoie que le nom : ni identifiant de connexion, ni avis déjà déposés.
router.get('/api/feedback/:token', async (req, res) => {
  try {
    const token = cleanString(req.params.token, 64);
    const staff = await db.prepare(
      "SELECT full_name, username, staff_code FROM users WHERE feedback_token = ? AND role = 'employee'"
    ).get(token);
    if (!staff) return res.status(404).json({ error: 'Lien invalide ou expiré.' });
    res.json({ name: staff.full_name || staff.username, staffCode: staff.staff_code });
  } catch (error) {
    console.error('Erreur lecture lien avis:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/feedback/:token - Dépôt d'un avis par un médecin (public, limité)
router.post('/api/feedback/:token', authLimiter, async (req, res) => {
  try {
    const token = cleanString(req.params.token, 64);
    const staff = await db.prepare(
      "SELECT id, staff_code FROM users WHERE feedback_token = ? AND role = 'employee'"
    ).get(token);
    if (!staff) return res.status(404).json({ error: 'Lien invalide ou expiré.' });

    const rating = toBoundedInt(req.body.rating, { min: 1, max: 5, fallback: null });
    if (!rating) return res.status(400).json({ error: 'Note requise (1 à 5).' });

    const doctorName = cleanString(req.body.doctorName, 120);
    const doctorCode = cleanString(req.body.doctorCode, 40);
    const comment = cleanString(req.body.comment, 2000);
    const suggestion = cleanString(req.body.suggestion, 2000);

    await db.prepare(`
      INSERT INTO employee_feedback (user_id, staff_code, doctor_name, doctor_code, rating, comment, suggestion)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(staff.id, staff.staff_code, doctorName || null, doctorCode || null, rating, comment || null, suggestion || null);

    res.status(201).json({ message: 'Merci, votre avis a bien été transmis.' });
  } catch (error) {
    console.error('Erreur dépôt avis:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/admin/feedback - Avis et suggestions (admin uniquement)
router.get('/api/admin/feedback', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const rows = await db.prepare(`
      SELECT f.id, f.staff_code, f.doctor_name, f.doctor_code, f.rating,
             f.comment, f.suggestion, f.created_at,
             COALESCE(u.full_name, u.username) AS employee_name
      FROM employee_feedback f
      LEFT JOIN users u ON u.id = f.user_id
      ORDER BY f.created_at DESC
      LIMIT 500
    `).all();
    res.json(rows);
  } catch (error) {
    console.error('Erreur lecture avis:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/admin/daily-agendas - Déclenche manuellement l'envoi des agendas (test)
// Body optionnel : { date: 'YYYY-MM-DD', doctorId: number }
router.post('/api/admin/daily-agendas', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { date, doctorId } = req.body || {};
    const summary = await sendDailyAgendas({ date, doctorId: doctorId ? Number(doctorId) : undefined });
    res.json(summary);
  } catch (error) {
    console.error('Erreur envoi agendas (manuel):', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/admin/rappels — déclenche les rappels à la main.
 *
 * Pour éprouver l'envoi sans attendre 18h. Corps facultatif :
 *   { date: 'AAAA-MM-JJ', appointmentId: 12, forcer: true }
 *
 * `forcer` renvoie un rappel déjà parti — utile pour vérifier la mise en page,
 * dangereux en exploitation : sans lui, la tâche est rejouable autant de fois
 * qu'on veut sans qu'aucun patient ne reçoive deux fois le même message.
 */
router.post('/api/admin/rappels', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { date, appointmentId, forcer } = req.body || {};
    if (date && !isValidDate(date)) {
      return res.status(400).json({ error: 'Date invalide (format AAAA-MM-JJ).' });
    }
    if (appointmentId !== undefined && !isValidId(appointmentId)) {
      return res.status(400).json({ error: 'Identifiant de rendez-vous invalide.' });
    }
    const resume = await envoyerRappels({
      date,
      appointmentId: appointmentId ? Number(appointmentId) : undefined,
      forcer: forcer === true,
    });
    res.json(resume);
  } catch (error) {
    console.error('Erreur envoi des rappels (manuel):', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
