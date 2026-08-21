import express from 'express';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import db from '../database.js';
import {
  cleanString, isValidEmail, normalizeEmail, isValidPhone, isValidId,
  passwordStrengthError,
} from '../security.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { applicationLimiter } from '../config/limiters.js';
import { journaliser, insererAvecUnicite } from '../lib/staff.js';
import { sendDoctorApproval, sendDoctorRejection } from '../emailService.js';

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
function tirerCodeMedecin() {
  return `MED-${String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')}`;
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
    /* L'adresse devient obligatoire pour une inscription : elle finit sur la
       fiche publique du praticien, et c'est elle que le patient lit pour se
       déplacer. Sans elle, l'acceptation recopiait la wilaya en guise
       d'adresse — « Alger » — et le patient devait téléphoner pour savoir où
       aller. Une demande de démonstration n'en a pas besoin : aucune fiche
       n'est créée au bout. */
    if (kind === 'registration' && (!address || address.length < 5)) {
      return res.status(400).json({ error: 'Adresse exacte du cabinet requise.' });
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
    /* Le code de connexion du praticien accompagne les demandes acceptées.

       Il n'était visible qu'une fois : dans l'encadré affiché juste après
       l'acceptation, que le premier clic fait disparaître. L'annuaire public
       ne le renvoie pas — délibérément, il n'a rien à faire chez un visiteur
       anonyme — si bien que la colonne « Code » de la liste des médecins
       affichait un tiret pour tout le monde. Un employé distrait, un
       rafraîchissement de page, et le praticien accepté ne pouvait plus
       jamais entrer dans son espace.

       Le mot de passe, lui, reste hors de portée : il n'est ni sélectionné
       ici, ni stocké ailleurs qu'en empreinte. */
    const rows = await db.prepare(`
      SELECT a.id, a.kind, a.full_name, a.specialty, a.city, a.address, a.phone,
             a.email, a.license_number, a.message,
             a.identity_checked, a.identity_score, a.status, a.review_note,
             a.reviewed_at, a.doctor_id, a.created_at,
             COALESCE(u.full_name, u.username) AS reviewed_by_name,
             d.doctor_code
      FROM doctor_applications a
      LEFT JOIN users u ON u.id = a.reviewed_by
      LEFT JOIN doctors d ON d.id = a.doctor_id
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

    /* ── On réserve la demande AVANT de créer quoi que ce soit ──
       L'ordre précédent était : lire la demande en attente, créer la fiche,
       puis marquer la demande acceptée. Deux administrateurs ouvrant la même
       demande — ou un double clic — lisaient tous deux « en attente » et
       créaient chacun une fiche : deux praticiens identiques, deux codes de
       connexion, et des patients répartis au hasard entre deux agendas.

       Cet UPDATE conditionnel est atomique : PostgreSQL ne le laisse réussir
       qu'une seule fois. Celui qui n'obtient aucune ligne a perdu la course et
       s'arrête. La fiche n'est créée qu'ensuite, par le gagnant. */
    const reservation = await db.prepare(`
      UPDATE doctor_applications
      SET status = 'approved', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP,
          review_note = ?
      WHERE id = ? AND status = 'pending'
    `).run(req.user.id, cleanString(req.body.note, 500) || null, id);

    if (!reservation.changes) {
      return res.status(409).json({ error: 'Demande introuvable ou déjà traitée par quelqu\'un d\'autre.' });
    }

    // Remise en attente si la suite échoue : une demande marquée acceptée sans
    // fiche créée serait invisible et bloquerait le praticien pour toujours.
    const rendreALaFile = async () => {
      await db.prepare(`
        UPDATE doctor_applications
        SET status = 'pending', reviewed_by = NULL, reviewed_at = NULL
        WHERE id = ?
      `).run(id).catch(() => {});
    };

    const demande = await db.prepare('SELECT * FROM doctor_applications WHERE id = ?').get(id);

    if (demande.kind !== 'registration') {
      await rendreALaFile();
      return res.status(400).json({ error: 'Une demande de démonstration ne crée pas de compte.' });
    }

    /* Le contrôle « ce praticien exerce-t-il déjà ? » a eu lieu au dépôt, qui
       peut dater de plusieurs semaines. Une fiche a pu être créée entre-temps
       par un employé, à la main. Sans cette relecture, l'acceptation produit
       un doublon : deux fiches, deux codes de connexion, et des patients
       répartis au hasard entre les deux agendas du même médecin. */
    const dejaInscrit = await db.prepare('SELECT id, name FROM doctors WHERE email = ?')
      .get(demande.email);
    if (dejaInscrit) {
      await rendreALaFile();
      return res.status(409).json({
        error: `Un praticien utilise déjà cette adresse (fiche n° ${dejaInscrit.id} — ${dejaInscrit.name}). Vérifiez s'il s'agit de la même personne avant d'accepter.`,
      });
    }

    // Sans mot de passe, la fiche créée serait inaccessible à son titulaire.
    if (!demande.password) {
      await rendreALaFile();
      return res.status(400).json({
        error: 'Cette demande ne porte pas de mot de passe. Créez la fiche manuellement et transmettez un mot de passe initial.',
      });
    }

    const slots = JSON.stringify(['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00']);

    /* Le mot de passe est celui que le praticien a choisi lors de sa demande,
       déjà haché. On ne le régénère pas : il le connaît, il peut se connecter
       tout de suite. `must_change_password` reste à 0 pour la même raison —
       ce n'est pas un mot de passe provisoire attribué par un tiers.

       Le code est tiré au sort à chaque tentative : vérifier qu'il est libre
       avant d'insérer laissait un intervalle où une autre acceptation pouvait
       le prendre. Sur un million de combinaisons, la collision devient
       courante bien avant que l'annuaire soit grand. */
    let doctorId;
    let doctorCode;
    try {
      const { code, id: nouvelId } = await insererAvecUnicite(async () => {
        const candidat = tirerCodeMedecin();
        const r = await db.prepare(`
          INSERT INTO doctors
            (name, specialty, address, city, phone, email, doctor_code, image,
             available_slots, next_available, slot_duration, working_days,
             password, must_change_password)
          VALUES (?, ?, ?, ?, ?, ?, ?, '👨‍⚕️', ?, 'Disponible maintenant', 30, '[1,2,3,4,5]', ?, 0)
        `).run(
          demande.full_name, demande.specialty, demande.address || demande.city,
          demande.city, demande.phone, demande.email, candidat, slots, demande.password
        );
        return { code: candidat, id: r.lastInsertRowid };
      });
      doctorId = nouvelId;
      doctorCode = code;
    } catch (e) {
      await rendreALaFile();
      throw e;
    }

    /* Le mot de passe est effacé de la demande une fois la fiche créée : il
       vit désormais dans `doctors`, il n'a plus rien à faire ici. */
    await db.prepare(`
      UPDATE doctor_applications
      SET doctor_id = ?, password = NULL
      WHERE id = ?
    `).run(doctorId, id);

    // Trace : l'acceptation compte comme une inscription au journal du personnel.
    await journaliser(req.user, 'doctor_created', { id: doctorId, name: demande.full_name });

    /* Le praticien est prévenu, et reçoit son code.
       L'envoi ne conditionne PAS la réponse : la fiche existe, elle est en
       ligne, et un incident de messagerie ne doit pas faire croire à
       l'administration que l'acceptation a échoué. En revanche le résultat
       remonte à l'écran — si le courrier n'est pas parti, l'employé doit le
       savoir pour transmettre le code autrement. */
    const courrierEnvoye = await sendDoctorApproval(demande.email, {
      doctorName: demande.full_name,
      doctorCode,
      language: req.body.language === 'ar' ? 'ar' : 'fr',
    }).catch((e) => {
      console.error('Erreur envoi acceptation praticien:', e.message);
      return false;
    });

    res.json({
      message: 'Demande acceptée, la fiche du praticien est créée.',
      doctorId,
      doctorCode,
      emailEnvoye: courrierEnvoye,
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

    /* RETURNING plutôt qu'un second SELECT : on récupère le destinataire dans
       le même ordre que celui qui verrouille la demande. Deux requêtes
       laisseraient un intervalle où un autre administrateur pourrait la
       traiter, et on écrirait à quelqu'un pour une décision qui n'est pas la
       nôtre. */
    const refusee = await db.prepare(`
      UPDATE doctor_applications
      SET status = 'rejected', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP,
          review_note = ?, password = NULL
      WHERE id = ? AND status = 'pending'
      RETURNING email, full_name
    `).get(req.user.id, note, Number(req.params.id));

    if (!refusee) {
      return res.status(404).json({ error: 'Demande introuvable ou déjà traitée.' });
    }

    /* Le motif est enfin transmis. Il était obligatoire à la saisie
       précisément pour cela, et restait pourtant en base sans jamais
       atteindre l'intéressé : le praticien attendait indéfiniment une réponse
       qui existait déjà, sans pouvoir corriger quoi que ce soit. */
    const courrierEnvoye = await sendDoctorRejection(refusee.email, {
      doctorName: refusee.full_name,
      reason: note,
      language: req.body.language === 'ar' ? 'ar' : 'fr',
    }).catch((e) => {
      console.error('Erreur envoi refus praticien:', e.message);
      return false;
    });

    res.json({ message: 'Demande refusée.', emailEnvoye: courrierEnvoye });
  } catch (error) {
    console.error('Erreur refus de demande:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
