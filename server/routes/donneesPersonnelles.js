/**
 * Droits du patient sur ses propres données.
 *
 * ── Ce qui manquait ──
 *
 * Rien. Aucun moyen d'obtenir ses données, aucun moyen de supprimer son
 * compte. Sur un service qui traite des données de SANTÉ — la catégorie la
 * plus sensible qui soit — c'était le seul domaine où l'application ne
 * proposait strictement aucun geste.
 *
 * ── Pourquoi l'effacement n'est pas une suppression ──
 *
 * Un rendez-vous n'appartient pas qu'au patient : il appartient aussi au
 * dossier du praticien, qui a ses propres obligations de conservation. Le
 * supprimer d'autorité effacerait la trace d'un acte de soin dans le dossier
 * de quelqu'un d'autre.
 *
 * On ANONYMISE donc : tout ce qui identifie la personne disparaît — nom,
 * adresse, téléphone, mot de passe, identifiants sociaux — et il reste une
 * ligne qui dit qu'une consultation a eu lieu ce jour-là, sans dire avec qui.
 * Le courrier de confirmation le formule exactement ainsi : promettre une
 * suppression totale alors que les rendez-vous restent serait une promesse
 * fausse, et c'est la seule chose qu'on ne peut pas se permettre ici.
 *
 * ── Pourquoi le mot de passe est exigé ──
 *
 * L'effacement est définitif. Un jeton volé ne doit pas suffire à détruire le
 * compte de quelqu'un, et une personne connectée sur un poste partagé ne doit
 * pas pouvoir le faire d'un clic malheureux.
 */
import express from 'express';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import db from '../database.js';
import { authenticatePatientToken } from '../middleware/auth.js';
import { envoyerCourrier } from '../emailService.js';
import { courrierCompteEfface } from '../lib/courriers.js';

const router = express.Router();

/**
 * GET /api/patient/mes-donnees — tout ce que le service détient sur moi.
 *
 * Renvoyé en JSON, lisible, sans mise en forme : c'est un export, pas un
 * écran. Les remarques privées du praticien n'en font PAS partie — elles sont
 * son appréciation professionnelle, versée à son dossier, et le reste du
 * serveur s'applique déjà à ne jamais les laisser sortir vers le patient.
 */
router.get('/api/patient/mes-donnees', authenticatePatientToken, async (req, res) => {
  try {
    const compte = await db.prepare(`
      SELECT id, email, name, phone, is_verified, consent_at, created_at, updated_at,
             (google_id IS NOT NULL) AS compte_google,
             (facebook_id IS NOT NULL) AS compte_facebook
      FROM patients WHERE email = ? AND deleted_at IS NULL
    `).get(req.user.email);

    if (!compte) return res.status(404).json({ error: 'Compte introuvable' });

    const rendezVous = await db.prepare(`
      SELECT a.appointment_date, a.appointment_time, a.reason, a.status,
             a.consultation_type, a.created_at,
             a.child_first_name, a.child_last_name, a.child_age,
             d.name AS praticien, d.specialty AS specialite, d.city AS ville
      FROM appointments a JOIN doctors d ON a.doctor_id = d.id
      WHERE a.patient_email = ?
      ORDER BY a.appointment_date DESC
      LIMIT 1000
    `).all(req.user.email);

    const avis = await db.prepare(`
      SELECT r.rating, r.comment, r.created_at, d.name AS praticien
      FROM reviews r JOIN doctors d ON r.doctor_id = d.id
      WHERE r.patient_email = ?
      ORDER BY r.created_at DESC
    `).all(req.user.email);

    res.json({
      genere_le: new Date().toISOString(),
      compte,
      rendez_vous: rendezVous,
      avis,
      note: 'Les remarques du praticien vous concernant relèvent de son dossier '
        + 'médical et ne figurent pas dans cet export. Adressez-vous à lui pour y accéder.',
    });
  } catch (error) {
    console.error('Erreur export des données:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * DELETE /api/patient/mon-compte — effacer son compte.
 *
 * Les rendez-vous À VENIR sont annulés au passage : les laisser tenir
 * enverrait le praticien attendre quelqu'un qui n'existe plus dans le service
 * et qu'il ne peut plus joindre.
 */
router.delete('/api/patient/mon-compte', authenticatePatientToken, async (req, res) => {
  try {
    const motDePasse = typeof req.body?.password === 'string' ? req.body.password : '';

    const patient = await db.prepare(
      'SELECT id, email, name, password FROM patients WHERE email = ? AND deleted_at IS NULL',
    ).get(req.user.email);
    if (!patient) return res.status(404).json({ error: 'Compte introuvable' });

    /* Un compte social n'a pas de mot de passe. On exige alors une
       confirmation explicite tapée à la main : le geste doit rester
       délibéré, même sans secret à vérifier. */
    if (patient.password) {
      if (!motDePasse || !(await bcrypt.compare(motDePasse, patient.password))) {
        return res.status(401).json({ error: 'Mot de passe incorrect.' });
      }
    } else if (req.body?.confirmation !== 'SUPPRIMER') {
      return res.status(400).json({
        error: 'Ce compte n\'a pas de mot de passe. Tapez SUPPRIMER pour confirmer.',
        confirmationRequise: true,
      });
    }

    const aujourdhui = new Date().toISOString().slice(0, 10);

    // Les rendez-vous à venir sont annulés : personne n'attend plus personne.
    await db.prepare(`
      UPDATE appointments
      SET status = 'cancelled', video_room = NULL, cancel_token = NULL,
          cancelled_by = 'patient', cancel_reason = 'Compte supprimé'
      WHERE patient_email = ? AND status = 'confirmed' AND appointment_date >= ?
    `).run(patient.email, aujourdhui);

    /* Les rendez-vous passés perdent ce qui identifie la personne, et gardent
       l'acte de soin. `patient_email` reçoit une valeur unique et opaque : la
       colonne sert de clé un peu partout, la vider casserait les jointures. */
    const opaque = `supprime-${crypto.randomBytes(12).toString('hex')}@chifak.invalid`;
    await db.prepare(`
      UPDATE appointments
      SET patient_name = 'Patient supprimé', patient_email = ?, patient_phone = '',
          child_first_name = NULL, child_last_name = NULL
      WHERE patient_email = ?
    `).run(opaque, patient.email);

    /* Les avis deviennent anonymes plutôt que de disparaître : ils informent
       les futurs patients, et les retirer réécrirait la note d'un praticien
       sur un geste qui ne le concerne pas. */
    await db.prepare(
      "UPDATE reviews SET patient_name = 'Patient supprimé', patient_email = ? WHERE patient_email = ?",
    ).run(opaque, patient.email);

    const adresseOrigine = patient.email;
    await db.prepare(`
      UPDATE patients
      SET email = ?, name = 'Patient supprimé', phone = NULL, password = NULL,
          google_id = NULL, facebook_id = NULL, is_verified = 0,
          deleted_at = CURRENT_TIMESTAMP, password_changed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(opaque, patient.id);

    // Les codes en attente n'ont plus d'objet.
    await db.prepare('DELETE FROM verification_codes WHERE email = ?').run(adresseOrigine);

    /* Dernier courrier, envoyé à l'adresse d'origine — la seule occasion de
       dire ce qui a été effacé et ce qui est conservé. */
    await envoyerCourrier(adresseOrigine, courrierCompteEfface({
      langue: req.body?.language === 'ar' ? 'ar' : 'fr',
    }));

    res.json({ message: 'Votre compte a été supprimé.' });
  } catch (error) {
    console.error('Erreur suppression de compte:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
