/**
 * Annuler un rendez-vous — par qui, et comment.
 *
 * ── Ce qui manquait ──
 *
 * Il existait UNE route d'annulation dans tout le serveur, et elle exigeait un
 * jeton patient. Trois trous en découlaient, tous visibles dès le premier jour
 * d'exploitation :
 *
 *   · un visiteur ayant réservé SANS COMPTE — un parcours que l'application
 *     propose délibérément — n'avait aucun moyen de se décommander. Le créneau
 *     restait bloqué et le praticien attendait quelqu'un qui ne viendrait pas ;
 *   · le praticien ne pouvait pas annuler. Malade un matin, il ne pouvait ni
 *     libérer ses créneaux ni prévenir ses patients, qui se déplaçaient pour
 *     rien ;
 *   · l'administration non plus.
 *
 * ── Comment chacun s'authentifie ──
 *
 * Le patient connecté par son jeton, le praticien par le sien, le personnel
 * par le sien. L'invité, lui, par un jeton d'annulation tiré au sort à la
 * réservation et envoyé dans son e-mail de confirmation : il ne se devine pas,
 * et il n'ouvre QUE ce rendez-vous — ni un compte, ni un dossier.
 *
 * ── La règle commune ──
 *
 * Annuler prévient toujours l'autre partie. Une annulation silencieuse déplace
 * simplement le problème : le patient qui vient pour rien, ou le praticien qui
 * attend pour rien.
 */
import express from 'express';
import db from '../database.js';
import { cleanString, isValidId } from '../security.js';
import {
  authenticateToken, authenticatePatientToken, authenticateDoctorToken,
} from '../middleware/auth.js';
import { envoyerCourrier } from '../emailService.js';
import { courrierRendezVousAnnule } from '../lib/courriers.js';
import { ficheRendezVousPatient } from '../lib/publicData.js';

const router = express.Router();

/** Le rendez-vous, avec le nom du praticien — de quoi écrire le courrier. */
async function lireRendezVous(id) {
  return db.prepare(`
    SELECT a.id, a.doctor_id, a.patient_name, a.patient_email, a.status,
           a.appointment_date, a.appointment_time, a.language,
           d.name AS doctor_name
    FROM appointments a JOIN doctors d ON a.doctor_id = d.id
    WHERE a.id = ?
  `).get(id);
}

/**
 * Annule, puis prévient.
 *
 * `status <> 'cancelled'` dans la clause WHERE plutôt qu'un contrôle préalable :
 * deux annulations simultanées ne doivent produire qu'un seul courrier. La
 * base tranche, la seconde requête ne trouve plus de ligne à modifier.
 *
 * La salle de visioconférence est effacée au passage : sans cela, le lien
 * continuait d'ouvrir une salle valide après l'annulation.
 */
async function annuler({ rendezVous, parQui, motif }) {
  const maj = await db.prepare(`
    UPDATE appointments
    SET status = 'cancelled', video_room = NULL, cancel_token = NULL,
        cancelled_by = ?, cancel_reason = ?
    WHERE id = ? AND status <> 'cancelled'
    RETURNING id
  `).get(parQui, motif || null, rendezVous.id);

  if (!maj) return false;

  /* Le patient n'est prévenu que si l'annulation ne vient pas de lui : lui
     écrire « votre rendez-vous a été annulé » alors qu'il vient de cliquer
     dessus n'apprend rien à personne. */
  if (parQui !== 'patient' && parQui !== 'invite') {
    await envoyerCourrier(rendezVous.patient_email, courrierRendezVousAnnule({
      patientName: rendezVous.patient_name,
      doctorName: rendezVous.doctor_name,
      date: rendezVous.appointment_date,
      heure: rendezVous.appointment_time,
      motif,
      parQui,
      langue: rendezVous.language === 'ar' ? 'ar' : 'fr',
    }));
  }

  return true;
}

/**
 * GET /api/appointments/by-token/:token — relire son rendez-vous sans compte.
 *
 * Le lien du courrier de confirmation ouvre cette page. On ne renvoie que ce
 * qui s'affiche à l'écran : ni notes du praticien, ni identifiants.
 */
router.get('/api/appointments/by-token/:token', async (req, res) => {
  try {
    const token = cleanString(req.params.token, 64);
    if (!token) return res.status(404).json({ error: 'Lien invalide ou expiré.' });

    const rdv = await db.prepare(`
      SELECT a.id, a.patient_name, a.appointment_date, a.appointment_time,
             a.status, a.consultation_type,
             d.name AS doctor_name, d.specialty, d.address, d.city
      FROM appointments a JOIN doctors d ON a.doctor_id = d.id
      WHERE a.cancel_token = ?
    `).get(token);

    if (!rdv) return res.status(404).json({ error: 'Lien invalide ou expiré.' });
    res.json(rdv);
  } catch (error) {
    console.error('Erreur lecture par jeton:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/appointments/by-token/:token/cancel — annulation par un invité.
 *
 * Le jeton EST l'authentification. Il est retiré à l'annulation : le lien ne
 * resservira pas, et il ne donne de toute façon accès à rien d'autre.
 */
router.post('/api/appointments/by-token/:token/cancel', async (req, res) => {
  try {
    const token = cleanString(req.params.token, 64);
    if (!token) return res.status(404).json({ error: 'Lien invalide ou expiré.' });

    const ligne = await db.prepare('SELECT id FROM appointments WHERE cancel_token = ?').get(token);
    if (!ligne) return res.status(404).json({ error: 'Lien invalide ou expiré.' });

    const rdv = await lireRendezVous(ligne.id);
    if (rdv.status === 'cancelled') {
      return res.json({ message: 'Ce rendez-vous était déjà annulé.', deja: true });
    }

    await annuler({ rendezVous: rdv, parQui: 'invite', motif: null });
    res.json({ message: 'Rendez-vous annulé.' });
  } catch (error) {
    console.error('Erreur annulation par jeton:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * PATCH /api/doctor/appointments/:id/cancel — annulation par le praticien.
 *
 * Le motif est facultatif mais fortement souhaitable : sans lui, le patient ne
 * sait pas s'il doit reprendre rendez-vous ailleurs ou attendre qu'on le
 * rappelle.
 */
router.patch('/api/doctor/appointments/:id/cancel', authenticateDoctorToken, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }
    const rdv = await lireRendezVous(Number(req.params.id));
    if (!rdv) return res.status(404).json({ error: 'Rendez-vous non trouvé' });
    if (rdv.doctor_id !== req.user.id) {
      return res.status(403).json({ error: 'Ce rendez-vous ne figure pas dans votre agenda.' });
    }
    if (rdv.status === 'cancelled') {
      return res.status(409).json({ error: 'Ce rendez-vous est déjà annulé.' });
    }

    const motif = cleanString(req.body.reason, 500);
    await annuler({ rendezVous: rdv, parQui: 'doctor', motif });
    res.json({ message: 'Rendez-vous annulé, le patient a été prévenu.' });
  } catch (error) {
    console.error('Erreur annulation par le praticien:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * PATCH /api/admin/appointments/:id/cancel — annulation par le cabinet.
 *
 * Ouverte à tout le personnel, pas seulement aux administrateurs : c'est
 * l'accueil qui reçoit l'appel « je ne pourrai pas venir », et lui refuser ce
 * geste reviendrait à ne pas l'annuler du tout.
 */
router.patch('/api/admin/appointments/:id/cancel', authenticateToken, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }
    const rdv = await lireRendezVous(Number(req.params.id));
    if (!rdv) return res.status(404).json({ error: 'Rendez-vous non trouvé' });
    if (rdv.status === 'cancelled') {
      return res.status(409).json({ error: 'Ce rendez-vous est déjà annulé.' });
    }

    const motif = cleanString(req.body.reason, 500);
    await annuler({ rendezVous: rdv, parQui: 'staff', motif });
    res.json({ message: 'Rendez-vous annulé, le patient a été prévenu.' });
  } catch (error) {
    console.error('Erreur annulation par le personnel:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * PATCH /api/doctor/appointments/:id/attendance — qui s'est présenté.
 *
 * ── Pourquoi cette route existe ──
 *
 * Un rendez-vous n'avait que deux états : « confirmé » et « annulé ». Rien ne
 * disait si la consultation avait eu lieu. Le praticien ne pouvait pas noter
 * qui s'était présenté, les compteurs de l'administration ne reflétaient rien
 * de réel, et l'autorisation de laisser un avis se déclenchait sur « la date
 * est passée » plutôt que sur « la consultation a eu lieu ».
 *
 * Deux issues seulement : honoré, ou absent. On ne revient pas sur une
 * annulation par ce chemin — annuler et constater une absence sont deux actes
 * différents, et les confondre effacerait la raison pour laquelle le créneau
 * s'est libéré.
 */
router.patch('/api/doctor/appointments/:id/attendance', authenticateDoctorToken, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }
    const etat = req.body.status;
    if (!['completed', 'no_show'].includes(etat)) {
      return res.status(400).json({ error: 'État attendu : « completed » ou « no_show ».' });
    }

    const rdv = await lireRendezVous(Number(req.params.id));
    if (!rdv) return res.status(404).json({ error: 'Rendez-vous non trouvé' });
    if (rdv.doctor_id !== req.user.id) {
      return res.status(403).json({ error: 'Ce rendez-vous ne figure pas dans votre agenda.' });
    }
    if (rdv.status === 'cancelled') {
      return res.status(409).json({ error: 'Ce rendez-vous a été annulé.' });
    }

    /* On ne constate pas la présence à un rendez-vous qui n'a pas encore eu
       lieu : ce serait une erreur de saisie, et elle bloquerait la
       réservation du créneau pour de mauvaises raisons. */
    const aujourdhui = new Date().toISOString().slice(0, 10);
    if (rdv.appointment_date > aujourdhui) {
      return res.status(400).json({ error: 'Ce rendez-vous n\'a pas encore eu lieu.' });
    }

    await db.prepare(`
      UPDATE appointments
      SET status = ?, attendance_marked_at = CURRENT_TIMESTAMP, cancel_token = NULL
      WHERE id = ?
    `).run(etat, rdv.id);

    res.json({ message: etat === 'completed' ? 'Consultation notée comme honorée.' : 'Absence notée.' });
  } catch (error) {
    console.error('Erreur constat de présence:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
