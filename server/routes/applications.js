import express from 'express';
import bcrypt from 'bcrypt';
import db from '../database.js';
import {
  cleanString, isValidEmail, normalizeEmail, isValidPhone, isValidId,
  passwordStrengthError,
} from '../security.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { applicationLimiter } from '../config/limiters.js';
import { journaliser } from '../lib/staff.js';

/**
 * Demandes d'inscription des praticiens.
 *
 * Un médecin ne devient pas visible parce qu'il l'a décidé : il dépose une
 * demande, un administrateur l'examine, et c'est l'acceptation qui crée la
 * fiche. Cette étape humaine est la seule barrière réelle — rien dans le code
 * ne peut vérifier qu'une personne est bien cardiologue.
 *
 * Conséquence à ne jamais contourner : tant qu'une demande est en attente,
 * elle n'existe pas dans la table `doctors`. Aucun patient ne peut tomber
 * dessus, ni prendre rendez-vous.
 */
const router = express.Router();

const SPECIALITES = [
  'Médecin généraliste', 'Dentiste', 'Ophtalmologue', 'Dermatologue',
  'Cardiologue', 'Pédiatre', 'Gynécologue', 'ORL', 'Kinésithérapeute',
  'Psychologue', 'Ostéopathe', 'Sage-femme',
];

/** Code de connexion du praticien : MED-XXXXXX, tiré au sort, jamais deviné. */
async function genererCodeMedecin() {
  const crypto = await import('node:crypto');
  for (let essai = 0; essai < 30; essai += 1) {
    const candidat = `MED-${String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')}`;
    const pris = await db.prepare('SELECT id FROM doctors WHERE doctor_code = ?').get(candidat);
    if (!pris) return candidat;
  }
  throw new Error('Impossible de générer un code médecin unique.');
}

// POST /api/professional-applications — dépôt d'une demande (public, limité)
router.post('/api/professional-applications', applicationLimiter, async (req, res) => {
  try {
    const kind = req.body.kind === 'demo' ? 'demo' : 'registration';
    const fullName = cleanString(req.body.fullName, 120);
    const specialty = cleanString(req.body.specialty, 80);
    const city = cleanString(req.body.city, 80);
    const address = cleanString(req.body.address, 200);
    const phone = cleanString(req.body.phone, 40);
    const email = normalizeEmail(req.body.email);
    const licenseNumber = cleanString(req.body.licenseNumber, 60);
    const message = cleanString(req.body.message, 2000);
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    /* Contrôle facial : on n'accepte QUE le verdict et le score. Si une
       requête forgée tentait de nous envoyer une image ou un gabarit, on la
       refuse — ce serveur n'a aucune raison de recevoir de la biométrie, et
       ne doit pas pouvoir en stocker par accident un jour. */
    for (const champ of ['idImage', 'faceImage', 'embedding', 'descriptor', 'photo', 'selfie']) {
      if (req.body[champ] !== undefined) {
        return res.status(400).json({
          error: 'Aucune image ni donnée biométrique n\'est acceptée sur cette route.',
        });
      }
    }
    const identityChecked = typeof req.body.identityChecked === 'boolean'
      ? req.body.identityChecked
      : null;
    const identityScore = Number.isFinite(Number(req.body.identityScore))
      ? Math.max(0, Math.min(1, Number(req.body.identityScore)))
      : null;

    if (!fullName || fullName.length < 3) {
      return res.status(400).json({ error: 'Nom complet requis.' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Adresse e-mail invalide.' });
    }
    if (!isValidPhone(phone)) {
      return res.status(400).json({ error: 'Numéro de téléphone invalide.' });
    }
    /* Spécialité choisie dans une liste fermée, jamais en texte libre : c'est
       le champ sur lequel les patients filtrent. Une saisie libre produirait
       « Cardiologue », « cardio », « Cardiologie » — trois praticiens
       introuvables par la même recherche. */
    if (!SPECIALITES.includes(specialty)) {
      return res.status(400).json({ error: 'Spécialité invalide.' });
    }
    if (!city) {
      return res.status(400).json({ error: 'Wilaya requise.' });
    }

    /* Une demande d'inscription porte le mot de passe que le praticien
       utilisera. Une demande de démonstration, non : il n'y a pas de compte au
       bout. */
    let hache = null;
    if (kind === 'registration') {
      const pwdError = passwordStrengthError(password);
      if (pwdError) return res.status(400).json({ error: pwdError });
      // Haché immédiatement : une demande en attente, voire refusée, ne doit
      // jamais conserver de secret en clair.
      hache = await bcrypt.hash(password, 10);
    }

    // Ce praticien exerce-t-il déjà ?
    const dejaMedecin = await db.prepare('SELECT id FROM doctors WHERE email = ?').get(email);
    const dejaDemande = await db.prepare(
      "SELECT id FROM doctor_applications WHERE email = ? AND status = 'pending'"
    ).get(email);

    /* Réponse volontairement identique dans les trois cas. Distinguer
       « déjà inscrit » de « nouvelle demande » transformerait cette route
       publique en annuaire : on saurait, adresse par adresse, quels médecins
       travaillent avec chifak. */
    if (dejaMedecin || dejaDemande) {
      return res.status(201).json({
        message: 'Demande enregistrée. Notre équipe revient vers vous après examen du dossier.',
      });
    }

    await db.prepare(`
      INSERT INTO doctor_applications
        (kind, full_name, specialty, city, address, phone, email, license_number,
         message, password, identity_checked, identity_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(kind, fullName, specialty, city, address || null, phone, email,
      licenseNumber || null, message || null, hache, identityChecked, identityScore);

    res.status(201).json({
      message: 'Demande enregistrée. Notre équipe revient vers vous après examen du dossier.',
    });
  } catch (error) {
    console.error('Erreur dépôt de demande praticien:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/admin/applications — file d'examen (admin uniquement)
router.get('/api/admin/applications', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const statut = ['pending', 'approved', 'rejected'].includes(req.query.status)
      ? req.query.status
      : 'pending';

    // Le mot de passe haché n'est jamais sélectionné : l'administration n'a
    // aucune raison de le voir, même sous forme d'empreinte.
    const rows = await db.prepare(`
      SELECT a.id, a.kind, a.full_name, a.specialty, a.city, a.address, a.phone,
             a.email, a.license_number, a.message,
             a.identity_checked, a.identity_score, a.status, a.review_note,
             a.reviewed_at, a.doctor_id, a.created_at,
             COALESCE(u.full_name, u.username) AS reviewed_by_name
      FROM doctor_applications a
      LEFT JOIN users u ON u.id = a.reviewed_by
      WHERE a.status = ?
      ORDER BY a.created_at DESC
      LIMIT 200
    `).all(statut);

    res.json(rows);
  } catch (error) {
    console.error('Erreur lecture des demandes:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/admin/applications/:id/approve — accepter et créer la fiche
router.post('/api/admin/applications/:id/approve', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }
    const id = Number(req.params.id);
    const demande = await db.prepare(
      "SELECT * FROM doctor_applications WHERE id = ? AND status = 'pending'"
    ).get(id);

    if (!demande) {
      return res.status(404).json({ error: 'Demande introuvable ou déjà traitée.' });
    }
    if (demande.kind !== 'registration') {
      return res.status(400).json({ error: 'Une demande de démonstration ne crée pas de compte.' });
    }

    const doctorCode = await genererCodeMedecin();
    const slots = JSON.stringify(['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00']);

    /* Le mot de passe est celui que le praticien a choisi lors de sa demande,
       déjà haché. On ne le régénère pas : il le connaît, il peut se connecter
       tout de suite. `must_change_password` reste à 0 pour la même raison —
       ce n'est pas un mot de passe provisoire attribué par un tiers. */
    const result = await db.prepare(`
      INSERT INTO doctors
        (name, specialty, address, city, phone, email, doctor_code, image,
         available_slots, next_available, slot_duration, working_days,
         password, must_change_password)
      VALUES (?, ?, ?, ?, ?, ?, ?, '👨‍⚕️', ?, 'Disponible maintenant', 30, '[1,2,3,4,5]', ?, 0)
    `).run(
      demande.full_name, demande.specialty, demande.address || demande.city,
      demande.city, demande.phone, demande.email, doctorCode, slots, demande.password
    );

    const doctorId = result.lastInsertRowid;

    /* Le mot de passe est effacé de la demande une fois la fiche créée : il
       vit désormais dans `doctors`, il n'a plus rien à faire ici. */
    await db.prepare(`
      UPDATE doctor_applications
      SET status = 'approved', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP,
          doctor_id = ?, password = NULL, review_note = ?
      WHERE id = ?
    `).run(req.user.id, doctorId, cleanString(req.body.note, 500) || null, id);

    // Trace : l'acceptation compte comme une inscription au journal du personnel.
    await journaliser(req.user, 'doctor_created', { id: doctorId, name: demande.full_name });

    res.json({
      message: 'Demande acceptée, la fiche du praticien est créée.',
      doctorId,
      doctorCode,
    });
  } catch (error) {
    console.error('Erreur acceptation de demande:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/admin/applications/:id/reject — refuser, avec motif
router.post('/api/admin/applications/:id/reject', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }
    const note = cleanString(req.body.note, 500);
    if (!note) {
      // Un refus sans motif ne laisse aucune trace exploitable : ni pour
      // répondre au praticien, ni pour comprendre la décision six mois après.
      return res.status(400).json({ error: 'Motif de refus requis.' });
    }

    const maj = await db.prepare(`
      UPDATE doctor_applications
      SET status = 'rejected', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP,
          review_note = ?, password = NULL
      WHERE id = ? AND status = 'pending'
    `).run(req.user.id, note, Number(req.params.id));

    if (!maj.changes) {
      return res.status(404).json({ error: 'Demande introuvable ou déjà traitée.' });
    }

    res.json({ message: 'Demande refusée.' });
  } catch (error) {
    console.error('Erreur refus de demande:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
