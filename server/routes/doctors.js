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
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { urlPhoto, empreintePhoto } from '../lib/photos.js';
import { horairesBloquesPublics } from '../lib/publicData.js';
import { journaliser } from '../lib/staff.js';
import { photoLimiter } from '../config/limiters.js';

const router = express.Router();

router.get('/api/doctors/:id/photo', photoLimiter, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).end();
    const row = await db.prepare('SELECT image, photo_hash FROM doctors WHERE id = ?')
      .get(Number(req.params.id));
    if (!row || typeof row.image !== 'string' || !row.image.startsWith('data:image/')) {
      return res.status(404).end();
    }

    const virgule = row.image.indexOf(',');
    if (virgule === -1) return res.status(404).end();
    const entete = row.image.slice(0, virgule);
    const base64 = row.image.slice(virgule + 1);
    const type = /^data:(image\/[a-z+]+);base64$/i.exec(entete);
    if (!type || !base64) return res.status(404).end();

    const etag = `"${row.photo_hash || empreintePhoto(row.image)}"`;
    if (req.headers['if-none-match'] === etag) return res.status(304).end();

    const bytes = Buffer.from(base64, 'base64');
    res.set({
      'Content-Type': type[1],
      'Content-Length': bytes.length,
      // Immuable : l'adresse porte l'empreinte, une photo modifiée change d'adresse.
      'Cache-Control': 'public, max-age=31536000, immutable',
      ETag: etag,
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(bytes);
  } catch (error) {
    console.error('Erreur photo médecin:', error);
    res.status(500).end();
  }
});

router.get('/api/doctors', async (req, res) => {
  try {
    // Entrées bornées et nettoyées ; les valeurs restent des paramètres liés.
    const specialty = cleanString(req.query.specialty, 80);
    const location = cleanString(req.query.location, 80);
    // Neutralise les jokers LIKE fournis par l'utilisateur (% et _)
    const escapeLike = (v) => v.replace(/[\\%_]/g, (m) => `\\${m}`);

    /* Colonnes citées une à une. « SELECT * » ramenait la colonne image —
       jusqu'à 200 Ko de base64 par praticien — que PostgreSQL doit alors aller
       chercher dans son stockage débordé. Ne pas la nommer suffit à ne jamais
       la lire. Le CASE n'évalue image que pour les photos externes, courtes. */
    let query = `SELECT id, name, specialty, address, city, rating, review_count,
                        available_slots, next_available, slot_duration, working_days,
                        off_days, blocked_slots, accepts_video, video_slots,
                        description, latitude, longitude, maps_url, created_at,
                        photo_hash,
                        CASE WHEN photo_hash IS NULL THEN image ELSE NULL END AS image
                 FROM doctors WHERE 1=1`;
    const params = [];

    if (specialty) {
      query += " AND specialty ILIKE ? ESCAPE '\\'";
      params.push(`%${escapeLike(specialty)}%`);
    }

    if (location) {
      query += " AND city ILIKE ? ESCAPE '\\'";
      params.push(`%${escapeLike(location)}%`);
    }

    // Filtre téléconsultation appliqué en base, pas dans le navigateur.
    // Un praticien n'est retenu que s'il a activé la visio ET déclaré au moins
    // une heure : accepts_video seul laisserait passer des fiches sans créneau.
    if (req.query.video === '1') {
      query += " AND accepts_video = 1 AND video_slots IS NOT NULL AND video_slots <> '[]'";
    }

    // Plafond de sécurité + pagination optionnelle (?limit & ?offset) — évite de renvoyer
    // des dizaines de milliers de lignes d'un coup si l'annuaire grossit.
    // Valeurs passées en paramètres liés (jamais concaténées dans le SQL).
    const limit = toBoundedInt(req.query.limit, { min: 1, max: 1000, fallback: 500 }) ?? 500;
    const offset = toBoundedInt(req.query.offset, { min: 0, max: 1000000, fallback: 0 }) ?? 0;
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const doctors = await db.prepare(query).all(...params);

    // Charge utile explicite : on n'étale plus la ligne brute avec « ...doctor ».
    // Cet étalement renvoyait chaque colonne JSON deux fois — la chaîne d'origine
    // ET sa version analysée — soit 38 % du poids pour rien, et exposait au
    // passage le code médecin, l'e-mail et le téléphone du praticien à un
    // visiteur anonyme. La liste ne contient que ce dont l'affichage a besoin.
    const list = doctors.map((doctor) => ({
      id: doctor.id,
      name: doctor.name,
      specialty: doctor.specialty,
      address: doctor.address,
      city: doctor.city,
      image: urlPhoto(req, doctor),
      rating: doctor.rating,
      reviewCount: doctor.review_count,
      availableSlots: doctor.available_slots ? JSON.parse(doctor.available_slots) : [],
      nextAvailable: doctor.next_available,
      slotDuration: doctor.slot_duration || 30,
      workingDays: doctor.working_days ? JSON.parse(doctor.working_days) : [1, 2, 3, 4, 5],
      offDays: doctor.off_days ? JSON.parse(doctor.off_days) : [],
      blockedSlots: horairesBloquesPublics(doctor.blocked_slots),
      acceptsVideo: !!doctor.accepts_video,
      videoSlots: doctor.video_slots ? JSON.parse(doctor.video_slots) : [],
      description: doctor.description || '',
      latitude: doctor.latitude,
      longitude: doctor.longitude,
      mapsUrl: doctor.maps_url,
    }));

    res.json(list);
  } catch (error) {
    console.error('Erreur récupération médecins:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/doctors/:id - Récupérer un médecin
router.get('/api/doctors/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }
    const doctor = await db.prepare(`
      SELECT id, name, specialty, address, city, rating, review_count,
             available_slots, next_available, slot_duration, working_days,
             description, bio, off_days, blocked_slots, accepts_video, video_slots,
             latitude, longitude, maps_url, photo_hash,
             CASE WHEN photo_hash IS NULL THEN image ELSE NULL END AS image
      FROM doctors WHERE id = ?
    `).get(Number(req.params.id));

    if (!doctor) {
      return res.status(404).json({ error: 'Médecin non trouvé' });
    }

    /* Liste de champs explicite, jamais « ...doctor ». L'étalement renvoyait
       le code de connexion du praticien, son e-mail, son téléphone et l'état
       de son mot de passe à n'importe quel visiteur. */
    const doctorWithParsedSlots = {
      id: doctor.id,
      name: doctor.name,
      specialty: doctor.specialty,
      address: doctor.address,
      city: doctor.city,
      image: urlPhoto(req, doctor),
      rating: doctor.rating,
      reviewCount: doctor.review_count,
      availableSlots: doctor.available_slots ? JSON.parse(doctor.available_slots) : [],
      nextAvailable: doctor.next_available,
      slotDuration: doctor.slot_duration || 30,
      workingDays: doctor.working_days ? JSON.parse(doctor.working_days) : [1, 2, 3, 4, 5],
      description: doctor.description || '',
      bio: doctor.bio || '',
      offDays: doctor.off_days ? JSON.parse(doctor.off_days) : [],
      blockedSlots: horairesBloquesPublics(doctor.blocked_slots),
      acceptsVideo: !!doctor.accepts_video,
      videoSlots: doctor.video_slots ? JSON.parse(doctor.video_slots) : [],
      latitude: doctor.latitude,
      longitude: doctor.longitude,
      mapsUrl: doctor.maps_url,
    };

    res.json(doctorWithParsedSlots);
  } catch (error) {
    console.error('Erreur récupération médecin:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/doctors - Créer un médecin (authentification requise)
router.post('/api/doctors', authenticateToken, async (req, res) => {
  try {
    const { name, specialty, address, city, phone, email, doctorCode, image, availableSlots, nextAvailable, slotDuration, workingDays, latitude, longitude, mapsUrl, password } = req.body;

    // La photo peut être une image téléversée (encodée) : on borne sa taille,
    // sinon une requête forgée pourrait stocker plusieurs mégaoctets par fiche.
    if (!isValidDoctorImage(image)) {
      return res.status(400).json({ error: 'Photo invalide ou trop lourde (220 Ko maximum).' });
    }

    if (!name || !specialty || !address || !city) {
      return res.status(400).json({ error: 'Champs requis manquants' });
    }

    const slots = JSON.stringify(availableSlots || ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00']);
    const serializedWorkingDays = JSON.stringify(Array.isArray(workingDays) && workingDays.length ? workingDays : [1, 2, 3, 4, 5]);

    /* Mot de passe initial : réservé à l'administration, comme à la
       modification. Un employé qui crée une fiche avec un mot de passe qu'il
       choisit dispose ensuite d'un accès complet à cet espace praticien. */
    if (password) {
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Seule l\'administration peut définir le mot de passe d\'un praticien.',
        });
      }
      const pwdError = passwordStrengthError(password);
      if (pwdError) return res.status(400).json({ error: pwdError });
    }
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;
    const mustChange = password ? 1 : 0;

    /* Le code médecin porte une contrainte d'unicité : c'est lui qui sert
       d'identifiant de connexion au praticien. Une saisie en double renvoyait
       « Erreur serveur », et l'employé recommençait la fiche entière sans
       comprendre que seul ce champ posait problème. */
    const codeDejaPris = doctorCode
      ? await db.prepare('SELECT id FROM doctors WHERE doctor_code = ?').get(doctorCode)
      : null;
    if (codeDejaPris) {
      return res.status(409).json({ error: 'Ce code médecin est déjà attribué à un autre praticien.' });
    }

    const result = await db.prepare(`
      INSERT INTO doctors (name, specialty, address, city, phone, email, doctor_code, image, photo_hash, available_slots, next_available, slot_duration, working_days, latitude, longitude, maps_url, password, must_change_password)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      specialty,
      address,
      city,
      phone || null,
      email || null,
      doctorCode || null,
      image || '👨‍⚕️',
      empreintePhoto(image),
      slots,
      nextAvailable || 'Disponible maintenant',
      Number(slotDuration) || 30,
      serializedWorkingDays,
      latitude || null,
      longitude || null,
      mapsUrl || null,
      hashedPassword,
      mustChange
    );

    const newDoctor = await db.prepare('SELECT * FROM doctors WHERE id = ?').get(result.lastInsertRowid);

    // Trace : qui a inscrit ce médecin, et quand.
    await journaliser(req.user, 'doctor_created', newDoctor);

    // Même règle qu'à la modification : la liste brute des créneaux réservés
    // ne sort jamais, elle peut contenir les coordonnées de patients.
    const { blocked_slots: _brut, ...ficheCreee } = newDoctor;

    res.status(201).json({
      ...ficheCreee,
      password: undefined,
      // Adresse de la photo, comme dans la liste : renvoyer la data URL ferait
      // remonter 200 Ko pour rien, et le formulaire la réécrirait à l'identique.
      image: urlPhoto(req, newDoctor),
      hasPassword: !!newDoctor.password,
      availableSlots: JSON.parse(newDoctor.available_slots),
      nextAvailable: newDoctor.next_available,
      slotDuration: newDoctor.slot_duration || 30,
      workingDays: newDoctor.working_days ? JSON.parse(newDoctor.working_days) : [1, 2, 3, 4, 5],
    });
  } catch (error) {
    console.error('Erreur création médecin:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/doctors/:id - Modifier un médecin (authentification requise)
router.put('/api/doctors/:id', authenticateToken, async (req, res) => {
  try {
    const { name, specialty, address, city, phone, email, doctorCode, image, availableSlots, nextAvailable, slotDuration, workingDays, latitude, longitude, mapsUrl, password, acceptsVideo } = req.body;

    // La photo peut être une image téléversée (encodée) : on borne sa taille,
    // sinon une requête forgée pourrait stocker plusieurs mégaoctets par fiche.
    if (!isValidDoctorImage(image)) {
      return res.status(400).json({ error: 'Photo invalide ou trop lourde (220 Ko maximum).' });
    }

    /* Le formulaire d'administration relit la fiche puis la renvoie entière.
       Comme la fiche porte désormais l'ADRESSE de la photo et non la photo
       elle-même, un enregistrement où l'admin n'a pas touché au portrait
       écraserait l'image stockée par sa propre adresse — le portrait serait
       perdu sans retour possible. On reconnaît nos propres adresses et on les
       traite comme « aucun changement ». */
    const photoInchangee = typeof image === 'string' && /\/api\/doctors\/\d+\/photo(\?|$)/.test(image);

    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }
    const doctorId = Number(req.params.id);
    const doctor = await db.prepare('SELECT * FROM doctors WHERE id = ?').get(doctorId);

    if (!doctor) {
      return res.status(404).json({ error: 'Médecin non trouvé' });
    }

    const slots = availableSlots ? JSON.stringify(availableSlots) : doctor.available_slots;
    const serializedWorkingDays =
      workingDays !== undefined
        ? JSON.stringify(Array.isArray(workingDays) && workingDays.length ? workingDays : [1, 2, 3, 4, 5])
        : doctor.working_days;

    /* ── Réinitialiser un mot de passe est réservé à l'administration ──
       Cette route est ouverte à tout le personnel, employés compris. Le champ
       « password » permettait donc à n'importe quel employé de fixer le mot de
       passe d'un praticien, puis de se connecter à son espace : agenda,
       coordonnées de tous ses patients, et remarques médicales privées.

       Ce n'est pas un abus de droit théorique : c'est le chemin le plus court
       vers le dossier médical, et il ne laissait aucune trace lisible. */
    if (password) {
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Seule l\'administration peut définir le mot de passe d\'un praticien.',
        });
      }
      const pwdError = passwordStrengthError(password);
      if (pwdError) return res.status(400).json({ error: pwdError });
    }
    const newHashed = password ? await bcrypt.hash(password, 10) : doctor.password;
    const mustChange = password ? 1 : (doctor.must_change_password || 0);

    // Même garde qu'à la création : le code doit rester unique, et le dire.
    if (doctorCode !== undefined && doctorCode && doctorCode !== doctor.doctor_code) {
      const conflit = await db.prepare('SELECT id FROM doctors WHERE doctor_code = ? AND id <> ?')
        .get(doctorCode, doctorId);
      if (conflit) {
        return res.status(409).json({ error: 'Ce code médecin est déjà attribué à un autre praticien.' });
      }
    }

    await db.prepare(`
      UPDATE doctors
      SET name = ?, specialty = ?, address = ?, city = ?, phone = ?, email = ?, doctor_code = ?,
          image = ?, photo_hash = ?, available_slots = ?, next_available = ?, slot_duration = ?, working_days = ?, latitude = ?, longitude = ?, maps_url = ?, password = ?, must_change_password = ?, accepts_video = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name || doctor.name,
      specialty || doctor.specialty,
      address || doctor.address,
      city || doctor.city,
      phone !== undefined ? phone : doctor.phone,
      email !== undefined ? email : doctor.email,
      doctorCode !== undefined ? doctorCode : doctor.doctor_code,
      photoInchangee || !image ? doctor.image : image,
      // L'empreinte suit la photo : sans cela, l'adresse mise en cache par les
      // navigateurs continuerait de désigner l'ancien portrait.
      photoInchangee || !image ? doctor.photo_hash : empreintePhoto(image),
      slots,
      nextAvailable || doctor.next_available,
      slotDuration !== undefined ? Number(slotDuration) : (doctor.slot_duration || 30),
      serializedWorkingDays,
      latitude !== undefined ? latitude : doctor.latitude,
      longitude !== undefined ? longitude : doctor.longitude,
      mapsUrl !== undefined ? mapsUrl : doctor.maps_url,
      newHashed,
      mustChange,
      // Champ non transmis = on ne touche pas au réglage choisi par le praticien.
      acceptsVideo === undefined ? (doctor.accepts_video || 0) : (acceptsVideo ? 1 : 0),
      doctorId
    );

    const updatedDoctor = await db.prepare('SELECT * FROM doctors WHERE id = ?').get(doctorId);

    /* blocked_slots est retiré de la réponse. L'étalement de la ligne brute le
       renvoyait tel quel : or une entrée peut porter le nom, le téléphone,
       l'e-mail et une note sur le patient à qui le praticien réserve la plage.
       Ces informations n'ont rien à faire dans un écran d'administration de
       fiches, et elles ne doivent sortir que par horairesBloquesPublics. */
    const { blocked_slots, ...ficheAdmin } = updatedDoctor;

    res.json({
      ...ficheAdmin,
      password: undefined,
      blockedSlots: horairesBloquesPublics(blocked_slots),
      image: urlPhoto(req, updatedDoctor),
      hasPassword: !!updatedDoctor.password,
      availableSlots: JSON.parse(updatedDoctor.available_slots),
      nextAvailable: updatedDoctor.next_available,
      slotDuration: updatedDoctor.slot_duration || 30,
      workingDays: updatedDoctor.working_days ? JSON.parse(updatedDoctor.working_days) : [1, 2, 3, 4, 5],
    });
  } catch (error) {
    console.error('Erreur modification médecin:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/doctors/:id - Supprimer un médecin (authentification requise)
router.delete('/api/doctors/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }
    const doctorId = Number(req.params.id);
    // Seuls les champs recopiés dans le journal : inutile de charger la photo.
    const doctor = await db.prepare('SELECT id, name, specialty FROM doctors WHERE id = ?')
      .get(doctorId);

    if (!doctor) {
      return res.status(404).json({ error: 'Médecin non trouvé' });
    }

    await db.prepare('DELETE FROM doctors WHERE id = ?').run(doctorId);

    // Le nom est recopié dans le journal : la fiche n'existe plus, mais
    // l'administration doit pouvoir lire « X a supprimé Dr Y ».
    await journaliser(req.user, 'doctor_deleted', doctor);

    res.json({ message: 'Médecin supprimé avec succès' });
  } catch (error) {
    console.error('Erreur suppression médecin:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
