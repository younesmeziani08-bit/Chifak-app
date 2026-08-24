/**
 * Liste d'attente d'un praticien.
 *
 * ── Le manque auquel elle répond ──
 *
 * Un patient ouvrait la fiche d'un praticien complet pour trois semaines,
 * lisait « aucun créneau », et ne revenait jamais. Pendant ce temps, des
 * créneaux se libéraient — quelqu'un annule toujours — et repartaient
 * silencieusement dans le tas, à qui passait par là.
 *
 * ── Aucun compte n'est exigé ──
 *
 * Quelqu'un qui vient de lire « complet » ne va pas créer un compte pour
 * espérer. Le jeton envoyé par courrier tient lieu d'authentification, comme
 * pour l'annulation d'un rendez-vous : il n'ouvre que cette inscription-là.
 */
import express from 'express';
import crypto from 'node:crypto';
import db from '../database.js';
import {
  cleanString, isValidEmail, normalizeEmail, isValidPhone, isValidId,
} from '../security.js';
import { envoyerCourrier } from '../emailService.js';
import { courrierInscritEnAttente } from '../lib/courriers.js';
import { HEURES_DE_REPONSE, prevenirSuivant } from '../lib/listeAttente.js';
import { bookingLimiter } from '../config/limiters.js';
import { adresseFront } from '../config/adresses.js';

const router = express.Router();



/**
 * POST /api/doctors/:id/liste-attente — s'inscrire.
 *
 * Le même plafond que la réservation : la route écrit en base et envoie un
 * courrier, exactement les deux choses qu'un script chercherait à répéter.
 */
router.post('/api/doctors/:id/liste-attente', bookingLimiter, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: 'Praticien invalide' });
    }
    const doctorId = Number(req.params.id);

    const nom = cleanString(req.body.patientName, 120);
    const email = normalizeEmail(req.body.patientEmail);
    const telephone = cleanString(req.body.patientPhone, 20);
    const langue = req.body.language === 'ar' ? 'ar' : 'fr';

    if (!nom || nom.length < 2) return res.status(400).json({ error: 'Nom invalide' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Adresse e-mail invalide' });
    if (!isValidPhone(telephone || '')) return res.status(400).json({ error: 'Numéro de téléphone invalide' });

    const medecin = await db.prepare('SELECT id, name FROM doctors WHERE id = ?').get(doctorId);
    if (!medecin) return res.status(404).json({ error: 'Praticien non trouvé' });

    /* Déjà inscrit : on renvoie la même réponse que pour une inscription
       réussie, sans écrire ni écrire deux fois. Répondre « vous y êtes déjà »
       ferait de cette route publique un moyen de savoir qui attend chez quel
       praticien — donc qui cherche à voir quel spécialiste. */
    const jeton = crypto.randomBytes(24).toString('base64url');
    const inscrit = await db.prepare(`
      INSERT INTO liste_attente (doctor_id, patient_name, patient_email, patient_phone, language, jeton)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT DO NOTHING
      RETURNING id, jeton
    `).get(doctorId, nom, email, telephone, langue, jeton);

    if (inscrit) {
      await envoyerCourrier(email, courrierInscritEnAttente({
        patientName: nom,
        doctorName: medecin.name,
        lienSortie: `${adresseFront()}/attente/${inscrit.jeton}`,
        langue,
      }));
    }

    res.status(201).json({
      message: 'Vous êtes sur la liste d\'attente. Nous vous préviendrons dès qu\'une place se libère.',
      heuresDeReponse: HEURES_DE_REPONSE,
    });
  } catch (error) {
    console.error('Erreur inscription liste d\'attente:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/liste-attente/:jeton — voir son inscription.
 *
 * Ne renvoie que ce que l'écran affiche : le praticien et l'état. Ni la
 * position dans la file — elle bouge à chaque inscription et n'aiderait
 * personne — ni les coordonnées des autres.
 */
router.get('/api/liste-attente/:jeton', async (req, res) => {
  try {
    const jeton = cleanString(req.params.jeton, 64);
    if (!jeton) return res.status(404).json({ error: 'Lien invalide ou expiré.' });

    const ligne = await db.prepare(`
      SELECT a.statut, d.name AS doctor_name, d.specialty, d.city
      FROM liste_attente a JOIN doctors d ON a.doctor_id = d.id
      WHERE a.jeton = ?
    `).get(jeton);

    if (!ligne) return res.status(404).json({ error: 'Lien invalide ou expiré.' });
    res.json(ligne);
  } catch (error) {
    console.error('Erreur lecture liste d\'attente:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/** DELETE /api/liste-attente/:jeton — se retirer. */
router.delete('/api/liste-attente/:jeton', async (req, res) => {
  try {
    const jeton = cleanString(req.params.jeton, 64);
    if (!jeton) return res.status(404).json({ error: 'Lien invalide ou expiré.' });

    const parti = await db.prepare(
      "UPDATE liste_attente SET statut = 'parti' WHERE jeton = ? AND statut IN ('waiting', 'notified') RETURNING id",
    ).get(jeton);

    if (!parti) return res.json({ message: 'Vous n\'êtes plus sur cette liste.' });
    res.json({ message: 'Vous avez été retiré de la liste d\'attente.' });
  } catch (error) {
    console.error('Erreur retrait liste d\'attente:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/place/:jeton — la place retenue pour moi.
 *
 * Le lien du courrier « une place s'est libérée » ouvre cette page. Elle dit
 * quel créneau, et jusqu'à quand il est gardé.
 */
router.get('/api/place/:jeton', async (req, res) => {
  try {
    const jeton = cleanString(req.params.jeton, 64);
    if (!jeton) return res.status(404).json({ error: 'Lien invalide ou expiré.' });

    const place = await db.prepare(`
      SELECT a.id, a.appointment_date, a.appointment_time, a.status,
             a.consultation_type, a.hold_expire_le,
             d.name AS doctor_name, d.specialty, d.address, d.city
      FROM appointments a JOIN doctors d ON a.doctor_id = d.id
      WHERE a.hold_jeton = ?
    `).get(jeton);

    if (!place) return res.status(404).json({ error: 'Cette place n\'est plus disponible.' });

    /* La date d'expiration part avec : l'écran affiche un décompte, et sans
       elle il ne pourrait qu'annoncer « deux heures » sans savoir depuis
       quand. */
    res.json({
      ...place,
      expiree: place.status !== 'hold' || new Date(place.hold_expire_le) < new Date(),
    });
  } catch (error) {
    console.error('Erreur lecture de la place:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/place/:jeton/confirmer — je prends cette place.
 *
 * La condition `status = 'hold' AND hold_expire_le > NOW()` est dans la clause
 * WHERE, pas dans un contrôle préalable : entre la lecture et l'écriture, la
 * tâche d'expiration peut passer. La base tranche.
 */
router.post('/api/place/:jeton/confirmer', async (req, res) => {
  try {
    const jeton = cleanString(req.params.jeton, 64);
    if (!jeton) return res.status(404).json({ error: 'Lien invalide ou expiré.' });

    const confirme = await db.prepare(`
      UPDATE appointments
      SET status = 'confirmed', hold_expire_le = NULL, hold_jeton = NULL,
          cancel_token = ?
      WHERE hold_jeton = ? AND status = 'hold' AND hold_expire_le > NOW()
      RETURNING id, doctor_id, appointment_date, appointment_time, patient_name,
                patient_email, language, consultation_type
    `).get(crypto.randomBytes(24).toString('base64url'), jeton);

    if (!confirme) {
      return res.status(409).json({
        error: 'Cette place n\'est plus disponible. Vous restez sur la liste d\'attente.',
      });
    }

    await db.prepare("UPDATE liste_attente SET statut = 'converti' WHERE appointment_id = ?")
      .run(confirme.id);

    /* Confirmation classique, avec le lien d'annulation : à partir d'ici,
       c'est un rendez-vous comme un autre. */
    const medecin = await db.prepare(
      'SELECT name, specialty, address, city FROM doctors WHERE id = ?',
    ).get(confirme.doctor_id);

    const { sendAppointmentConfirmation } = await import('../emailService.js');
    const lienAnnulation = await db.prepare('SELECT cancel_token FROM appointments WHERE id = ?')
      .get(confirme.id);

    await sendAppointmentConfirmation(confirme.patient_email, {
      patientName: confirme.patient_name,
      doctorName: medecin.name,
      specialty: medecin.specialty,
      date: confirme.appointment_date,
      time: confirme.appointment_time,
      address: `${medecin.address}, ${medecin.city}`,
      consultationType: confirme.consultation_type || 'cabinet',
      cancelUrl: `${adresseFront()}/rdv/${lienAnnulation?.cancel_token}`,
    }, confirme.language === 'ar' ? 'ar' : 'fr').catch(() => false);

    res.json({
      message: 'Votre rendez-vous est confirmé.',
      date: confirme.appointment_date,
      heure: confirme.appointment_time,
      doctorName: medecin.name,
    });
  } catch (error) {
    console.error('Erreur confirmation de place:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/place/:jeton/refuser — cette place ne me convient pas.
 *
 * Le créneau repart au suivant immédiatement, sans attendre les deux heures.
 * Et la personne RESTE sur la liste : refuser un créneau qui ne convient pas
 * n'est pas renoncer à en chercher un.
 */
router.post('/api/place/:jeton/refuser', async (req, res) => {
  try {
    const jeton = cleanString(req.params.jeton, 64);
    if (!jeton) return res.status(404).json({ error: 'Lien invalide ou expiré.' });

    const libere = await db.prepare(`
      UPDATE appointments
      SET status = 'cancelled', hold_expire_le = NULL, hold_jeton = NULL,
          cancelled_by = 'systeme', cancel_reason = 'Place déclinée'
      WHERE hold_jeton = ? AND status = 'hold'
      RETURNING id, doctor_id, appointment_date, appointment_time, consultation_type
    `).get(jeton);

    if (!libere) return res.status(409).json({ error: 'Cette place n\'est plus disponible.' });

    /* Il retourne en attente en GARDANT sa place dans la file — refuser un
       créneau qui ne convient pas n'est pas renoncer à en chercher un. */
    const remisEnAttente = await db.prepare(
      "UPDATE liste_attente SET statut = 'waiting', notifie_le = NULL, appointment_id = NULL WHERE appointment_id = ? RETURNING id",
    ).get(libere.id);

    /* Au suivant, tout de suite — mais pas à celui qui vient de refuser.
       Étant le plus ancien de la file, il se verrait sinon reproposer
       à l'instant le créneau qu'il vient de décliner. */
    await prevenirSuivant({
      doctorId: libere.doctor_id,
      date: libere.appointment_date,
      heure: libere.appointment_time,
      consultationType: libere.consultation_type || 'cabinet',
      exclure: remisEnAttente?.id ?? null,
    });

    res.json({ message: 'La place a été proposée à quelqu\'un d\'autre. Vous restez sur la liste.' });
  } catch (error) {
    console.error('Erreur refus de place:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
