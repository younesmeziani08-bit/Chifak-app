/**
 * Mot de passe des patients : oubli, réinitialisation, changement.
 *
 * ── Pourquoi ce fichier a dû être écrit ──
 *
 * Il n'existait AUCUN moyen de récupérer un compte. Un patient qui oubliait
 * son mot de passe perdait son compte et tout son historique de rendez-vous,
 * définitivement. Il ne pouvait pas davantage le changer : `change-password`
 * n'existait que pour les praticiens. Sur un service grand public, une
 * personne sur cinq oubliera son mot de passe ; c'était donc, en pratique, un
 * cinquième des comptes voués à être abandonnés.
 *
 * ── Les trois règles qui gouvernent ces routes ──
 *
 * 1. Une route publique ne dit JAMAIS si une adresse est inscrite. Sur un
 *    service de santé, savoir qui possède un compte est déjà une information
 *    sensible : c'est savoir qui se soigne par cette plateforme. La demande
 *    d'oubli répond donc la même chose à tout le monde.
 *
 * 2. Le code se consomme en un seul ordre SQL. Lire, vérifier puis marquer
 *    « utilisé » laisse passer le même code cent fois si cent requêtes
 *    arrivent ensemble — c'est exactement la faille qu'avait la vérification
 *    d'inscription, et il n'y a pas de raison de la réintroduire ici.
 *
 * 3. Changer un mot de passe déconnecte les autres sessions. Sinon, quelqu'un
 *    qui reprend la main sur son compte laisse l'intrus dedans pour les
 *    vingt-quatre heures que dure son jeton — ce qui vide la manœuvre de tout
 *    son sens.
 */
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from '../database.js';
import {
  cleanString, isValidEmail, normalizeEmail, passwordStrengthError, isTooSimilar,
} from '../security.js';
import { generateVerificationCode, envoyerCourrier } from '../emailService.js';
import { courrierMotDePasseOublie, courrierMotDePasseChange } from '../lib/courriers.js';
import { authenticatePatientToken } from '../middleware/auth.js';
import { refuseSiFreine, noterEchec, oublierEchecs } from '../lib/tentatives.js';

const router = express.Router();

/** Un code de réinitialisation vaut quinze minutes. */
const VALIDITE_MINUTES = 15;

/**
 * Réponse volontairement identique dans tous les cas : adresse inconnue,
 * compte non vérifié, compte social sans mot de passe, ou envoi réussi.
 */
const REPONSE_NEUTRE = {
  message: 'Si un compte existe pour cette adresse, un code vient d\'être envoyé.',
};

/**
 * POST /api/auth/forgot-password — demander un code.
 *
 * On n'envoie de code qu'à un compte vérifié qui possède déjà un mot de passe.
 * Un compte créé par Google ou Facebook n'en a pas : lui en fabriquer un ici
 * ouvrirait une seconde porte d'entrée sur un compte dont le propriétaire n'a
 * jamais voulu de mot de passe.
 */
router.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const langue = req.body.language === 'ar' ? 'ar' : 'fr';

    if (!isValidEmail(email)) {
      // Même réponse : une adresse mal formée ne doit pas se distinguer non plus.
      return res.json(REPONSE_NEUTRE);
    }

    /* Freinage par compte visé. Sans lui, cette route devient un moyen
       d'inonder la boîte de quelqu'un : une requête, un e-mail, à volonté. */
    if (await refuseSiFreine(res, 'oubli', email)) return;
    await noterEchec('oubli', email);

    const patient = await db.prepare(
      'SELECT id, password, is_verified, deleted_at FROM patients WHERE email = ?',
    ).get(email);

    if (!patient || !patient.password || !patient.is_verified || patient.deleted_at) {
      return res.json(REPONSE_NEUTRE);
    }

    /* Les demandes précédentes sont annulées : deux codes valides en même
       temps doublent la surface d'attaque sans rien apporter à personne. */
    await db.prepare(
      "UPDATE verification_codes SET is_used = 1 WHERE email = ? AND purpose = 'reset' AND is_used = 0",
    ).run(email);

    /* L'expiration est calculée par la base — une seule horloge des deux
       côtés de la comparaison. Voir la note dans /api/auth/register. */
    const code = generateVerificationCode();
    await db.prepare(`
      INSERT INTO verification_codes (email, code, expires_at, purpose)
      VALUES (?, ?, NOW() + INTERVAL '${VALIDITE_MINUTES} minutes', 'reset')
    `).run(email, code);

    await envoyerCourrier(email, courrierMotDePasseOublie({ code, langue }));

    res.json(REPONSE_NEUTRE);
  } catch (error) {
    console.error('Erreur demande de nouveau mot de passe:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/auth/reset-password — poser le nouveau mot de passe.
 *
 * Rend directement une session : la personne vient de prouver qu'elle lit les
 * courriers de cette adresse ET a choisi un mot de passe. La renvoyer vers
 * l'écran de connexion pour retaper ce qu'elle vient d'écrire n'ajouterait
 * aucune sécurité, seulement une occasion d'abandonner.
 */
router.post('/api/auth/reset-password', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const code = typeof req.body.code === 'string' ? req.body.code.trim() : '';
    const nouveau = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';

    if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Code invalide ou expiré.' });
    }

    const erreurForce = passwordStrengthError(nouveau);
    if (erreurForce) return res.status(400).json({ error: erreurForce });

    if (await refuseSiFreine(res, 'oubli', email)) return;

    /* Consommation atomique : un seul ordre sélectionne et marque. Cent
       requêtes simultanées portant le même code n'en verront passer qu'une. */
    const consomme = await db.prepare(`
      UPDATE verification_codes SET is_used = 1
      WHERE id = (
        SELECT id FROM verification_codes
        WHERE email = ? AND code = ? AND purpose = 'reset'
          AND is_used = 0 AND expires_at > NOW()
        ORDER BY created_at DESC LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id
    `).get(email, code);

    if (!consomme) {
      await noterEchec('oubli', email);
      // Message unique pour « inconnu », « déjà utilisé » et « périmé ».
      return res.status(400).json({ error: 'Code invalide ou expiré.' });
    }

    const patient = await db.prepare(
      'SELECT id, email, name, password, deleted_at FROM patients WHERE email = ?',
    ).get(email);
    if (!patient || patient.deleted_at) {
      return res.status(400).json({ error: 'Code invalide ou expiré.' });
    }

    /* Le nouveau mot de passe ne doit pas être l'ancien. On le vérifie contre
       l'empreinte, jamais contre une valeur en clair — on n'en a aucune. */
    if (patient.password && await bcrypt.compare(nouveau, patient.password)) {
      return res.status(400).json({
        error: 'Ce mot de passe est déjà le vôtre. Choisissez-en un autre.',
      });
    }

    /* `password_changed_at` invalide les jetons émis avant. Voir le
       middleware d'authentification : c'est ce qui met dehors quelqu'un qui
       serait entré dans le compte. */
    await db.prepare(`
      UPDATE patients
      SET password = ?, password_changed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(await bcrypt.hash(nouveau, 10), patient.id);

    await oublierEchecs('oubli', email);
    await oublierEchecs('patient', email);

    // Avertissement, pas confirmation : c'est le seul signal qu'aurait
    // quelqu'un dont le compte vient d'être repris par un tiers.
    await envoyerCourrier(email, courrierMotDePasseChange({
      langue: req.body.language === 'ar' ? 'ar' : 'fr',
    }));

    const token = jwt.sign(
      { id: patient.id, email: patient.email, type: 'patient', iat: Math.floor(Date.now() / 1000) },
      process.env.JWT_SECRET,
      { expiresIn: '24h' },
    );

    res.json({
      message: 'Mot de passe mis à jour.',
      token,
      user: { id: patient.id, email: patient.email, name: patient.name },
    });
  } catch (error) {
    console.error('Erreur réinitialisation du mot de passe:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * PUT /api/patient/password — changer son mot de passe en étant connecté.
 *
 * Le mot de passe actuel est exigé : un jeton volé ne doit pas suffire à
 * verrouiller le véritable titulaire hors de son compte.
 */
router.put('/api/patient/password', authenticatePatientToken, async (req, res) => {
  try {
    const actuel = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
    const nouveau = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';

    const patient = await db.prepare(
      'SELECT id, email, password FROM patients WHERE email = ? AND deleted_at IS NULL',
    ).get(req.user.email);
    if (!patient) return res.status(404).json({ error: 'Compte introuvable' });

    /* Compte social sans mot de passe : on ne peut pas en exiger un actuel.
       Le titulaire passe par « mot de passe oublié », qui prouve qu'il lit les
       courriers de l'adresse — la même preuve que celle du fournisseur. */
    if (!patient.password) {
      return res.status(400).json({
        error: 'Ce compte n\'a pas de mot de passe. Utilisez « Mot de passe oublié » pour en définir un.',
      });
    }

    if (await refuseSiFreine(res, 'patient', patient.email)) return;

    if (!actuel || !(await bcrypt.compare(actuel, patient.password))) {
      await noterEchec('patient', patient.email);
      return res.status(401).json({ error: 'Mot de passe actuel incorrect.' });
    }

    const erreurForce = passwordStrengthError(nouveau);
    if (erreurForce) return res.status(400).json({ error: erreurForce });

    if (isTooSimilar(actuel, nouveau)) {
      return res.status(400).json({
        error: 'Le nouveau mot de passe est trop proche de l\'ancien. Choisissez-en un différent.',
      });
    }

    await db.prepare(`
      UPDATE patients
      SET password = ?, password_changed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(await bcrypt.hash(nouveau, 10), patient.id);

    await oublierEchecs('patient', patient.email);
    await envoyerCourrier(patient.email, courrierMotDePasseChange({
      langue: req.body.language === 'ar' ? 'ar' : 'fr',
    }));

    /* Un jeton neuf, émis après l'horodatage : celui qu'avait le navigateur
       vient d'être invalidé avec tous les autres. */
    const token = jwt.sign(
      { id: patient.id, email: patient.email, type: 'patient', iat: Math.floor(Date.now() / 1000) },
      process.env.JWT_SECRET,
      { expiresIn: '24h' },
    );

    res.json({ message: 'Mot de passe mis à jour.', token });
  } catch (error) {
    console.error('Erreur changement de mot de passe patient:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
