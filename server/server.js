import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import session from 'express-session';
import db, { initDatabase } from './database.js';
import passport from './passport-config.js';
import { generateVerificationCode, sendVerificationEmail, sendAppointmentConfirmation } from './emailService.js';
import { saveAccountToFile } from './storageService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
// En dev, on reflète l'origine de la requête pour autoriser le réseau local
// (accès depuis un téléphone via l'IP du Mac). À restreindre en production.
app.use(cors({
  origin: process.env.FRONTEND_URL || true,
  credentials: true
}));
app.use(express.json());

// Session pour OAuth
app.use(session({
  secret: process.env.SESSION_SECRET || 'chifak_session_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 heures
  }
}));

// Initialiser Passport
app.use(passport.initialize());
app.use(passport.session());

// Initialiser la base de données
initDatabase();

// Middleware d'authentification
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token invalide' });
    }
    req.user = user;
    next();
  });
};

const authenticatePatientToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token invalide' });
    }
    if (user.type !== 'patient') {
      return res.status(403).json({ error: 'Accès réservé aux patients' });
    }
    req.user = user;
    next();
  });
};

const authenticateDoctorToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token invalide' });
    }
    if (user.type !== 'doctor') {
      return res.status(403).json({ error: 'Accès réservé aux médecins' });
    }
    req.user = user;
    next();
  });
};

// ==================== ROUTES AUTH ====================

// POST /api/auth/login - Connexion employé
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username et password requis' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    if (!user) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    const validPassword = bcrypt.compareSync(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, type: 'staff' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Erreur login:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/login-doctor - Connexion médecin avec code spécial
app.post('/api/auth/login-doctor', (req, res) => {
  try {
    const { doctorCode } = req.body;

    if (!doctorCode) {
      return res.status(400).json({ error: 'Code médecin requis' });
    }

    const doctor = db.prepare('SELECT * FROM doctors WHERE doctor_code = ?').get(doctorCode);

    if (!doctor) {
      return res.status(401).json({ error: 'Code médecin invalide' });
    }

    const token = jwt.sign(
      { id: doctor.id, name: doctor.name, type: 'doctor' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: doctor.id,
        name: doctor.name,
        type: 'doctor'
      }
    });
  } catch (error) {
    console.error('Erreur login médecin:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/auth/verify - Vérifier le token
app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// ==================== ROUTES PATIENTS (EMAIL + OAUTH) ====================

// POST /api/auth/register - Inscription avec email (envoie code de vérification)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, name, password, language } = req.body;

    if (!email || !name || !password) {
      return res.status(400).json({ error: 'Email, nom et mot de passe requis' });
    }

    // Vérifier si l'email existe déjà
    const existingPatient = db.prepare('SELECT * FROM patients WHERE email = ?').get(email);
    if (existingPatient) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }

    // Générer un code de vérification
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Sauvegarder le code
    db.prepare(`
      INSERT INTO verification_codes (email, code, expires_at)
      VALUES (?, ?, ?)
    `).run(email, code, expiresAt.toISOString());

    // Envoyer l'email
    await sendVerificationEmail(email, code, language || 'fr');

    // Sauvegarder temporairement l'utilisateur (non vérifié)
    const hashedPassword = bcrypt.hashSync(password, 10);
    db.prepare(`
      INSERT INTO patients (email, name, password, is_verified)
      VALUES (?, ?, ?, 0)
    `).run(email, name, hashedPassword);

    // Sauvegarde additionnelle dans le dossier temporaire (base de données fichier)
    saveAccountToFile({ email, name, password: '[ENCRYPTED]', status: 'pending_verification' });

    res.json({
      message: 'Code de vérification envoyé',
      email: email
    });
  } catch (error) {
    console.error('Erreur inscription:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/verify-code - Vérifier le code
app.post('/api/auth/verify-code', (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email et code requis' });
    }

    // Récupérer le code
    const verificationCode = db.prepare(`
      SELECT * FROM verification_codes 
      WHERE email = ? AND code = ? AND is_used = 0
      ORDER BY created_at DESC
      LIMIT 1
    `).get(email, code);

    if (!verificationCode) {
      return res.status(400).json({ error: 'Code invalide' });
    }

    // Vérifier l'expiration
    if (new Date(verificationCode.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Code expiré' });
    }

    // Marquer le code comme utilisé
    db.prepare('UPDATE verification_codes SET is_used = 1 WHERE id = ?')
      .run(verificationCode.id);

    // Activer le compte
    db.prepare('UPDATE patients SET is_verified = 1 WHERE email = ?')
      .run(email);

    const patient = db.prepare('SELECT * FROM patients WHERE email = ?').get(email);

    // Mettre à jour la sauvegarde dans le dossier
    saveAccountToFile({ ...patient, password: '[ENCRYPTED]', status: 'verified' });

    // Générer un token
    const token = jwt.sign(
      { id: patient.id, email: patient.email, type: 'patient' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Compte vérifié avec succès',
      token,
      user: {
        id: patient.id,
        email: patient.email,
        name: patient.name,
        balance: patient.balance || 0,
      }
    });
  } catch (error) {
    console.error('Erreur vérification:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/login-patient - Connexion patient avec email
app.post('/api/auth/login-patient', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    const demoEmail = 'demo.patient@chifak.dz';
    const demoPassword = 'patient123';

    // Filet de sécurité: recréer automatiquement le compte démo s'il manque
    if (email === demoEmail && password === demoPassword) {
      const existingDemo = db.prepare('SELECT * FROM patients WHERE email = ?').get(demoEmail);
      if (!existingDemo) {
        const hashed = bcrypt.hashSync(demoPassword, 10);
        db.prepare(`
          INSERT INTO patients (email, name, password, is_verified)
          VALUES (?, ?, ?, 1)
        `).run(demoEmail, 'Patient Demo', hashed);
      }
    }

    const patient = db.prepare('SELECT * FROM patients WHERE email = ?').get(email);

    if (!patient || !patient.password) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    if (!patient.is_verified) {
      return res.status(401).json({ error: 'Compte non vérifié. Vérifiez votre email.' });
    }

    const validPassword = bcrypt.compareSync(password, patient.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    const token = jwt.sign(
      { id: patient.id, email: patient.email, type: 'patient' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: patient.id,
        email: patient.email,
        name: patient.name,
        balance: patient.balance || 0,
      }
    });
  } catch (error) {
    console.error('Erreur login patient:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/resend-code - Renvoyer le code
app.post('/api/auth/resend-code', async (req, res) => {
  try {
    const { email, language } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email requis' });
    }

    const patient = db.prepare('SELECT * FROM patients WHERE email = ?').get(email);

    if (!patient) {
      return res.status(404).json({ error: 'Email non trouvé' });
    }

    if (patient.is_verified) {
      return res.status(400).json({ error: 'Compte déjà vérifié' });
    }

    // Générer un nouveau code
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    db.prepare(`
      INSERT INTO verification_codes (email, code, expires_at)
      VALUES (?, ?, ?)
    `).run(email, code, expiresAt.toISOString());

    await sendVerificationEmail(email, code, language || 'fr');

    res.json({ message: 'Nouveau code envoyé' });
  } catch (error) {
    console.error('Erreur renvoi code:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/patient/profile - Profil patient connecté (solde)
app.get('/api/patient/profile', authenticatePatientToken, (req, res) => {
  try {
    const patient = db.prepare('SELECT id, email, name, balance FROM patients WHERE email = ?').get(req.user.email);
    if (!patient) {
      return res.status(404).json({ error: 'Patient non trouvé' });
    }
    res.json({ ...patient, balance: patient.balance || 0 });
  } catch (error) {
    console.error('Erreur récupération profil patient:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/patient/recharge - Recharger le solde patient
app.post('/api/patient/recharge', authenticatePatientToken, (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Montant invalide' });
    }

    const patient = db.prepare('SELECT id, email, name, balance FROM patients WHERE email = ?').get(req.user.email);
    if (!patient) {
      return res.status(404).json({ error: 'Patient non trouvé' });
    }

    const newBalance = (patient.balance || 0) + Math.round(amount);
    db.prepare('UPDATE patients SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newBalance, patient.id);

    res.json({
      message: 'Recharge effectuée avec succès',
      balance: newBalance,
      addedAmount: Math.round(amount),
    });
  } catch (error) {
    console.error('Erreur recharge solde patient:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== ROUTES OAUTH ====================

const frontendUrl = () => process.env.FRONTEND_URL || 'http://localhost:5173';

const isGoogleOAuthReady = () =>
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id';

const isFacebookOAuthReady = () =>
  process.env.FACEBOOK_APP_ID &&
  process.env.FACEBOOK_APP_ID !== 'your_facebook_app_id';

// Google OAuth
app.get('/api/auth/google', (req, res, next) => {
  if (!isGoogleOAuthReady()) {
    return res.redirect(`${frontendUrl()}/?oauth=unconfigured&provider=google`);
  }
  next();
}, passport.authenticate('google', { scope: ['profile', 'email'] }));

const buildOAuthRedirect = (user, token) => {
  const frontend = process.env.FRONTEND_URL || 'http://localhost:5173';
  const params = new URLSearchParams({
    token,
    email: user.email,
    name: user.name || '',
  });
  return `${frontend}/auth/callback?${params.toString()}`;
};

const oauthFailureRedirect = () =>
  `${process.env.FRONTEND_URL || 'http://localhost:5173'}/?auth_error=1`;

app.get('/api/auth/google/callback',
  passport.authenticate('google', { failureRedirect: oauthFailureRedirect() }),
  (req, res) => {
    const token = jwt.sign(
      { id: req.user.id, email: req.user.email, type: 'patient' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.redirect(buildOAuthRedirect(req.user, token));
  }
);

// Facebook OAuth
app.get('/api/auth/facebook', (req, res, next) => {
  if (!isFacebookOAuthReady()) {
    return res.redirect(`${frontendUrl()}/?oauth=unconfigured&provider=facebook`);
  }
  next();
}, passport.authenticate('facebook', { scope: ['email'] }));

app.get('/api/auth/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: oauthFailureRedirect() }),
  (req, res) => {
    const token = jwt.sign(
      { id: req.user.id, email: req.user.email, type: 'patient' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.redirect(buildOAuthRedirect(req.user, token));
  }
);

// ==================== ROUTES DOCTORS ====================

// GET /api/doctors - Récupérer tous les médecins
app.get('/api/doctors', (req, res) => {
  try {
    const { specialty, location } = req.query;

    let query = 'SELECT * FROM doctors WHERE 1=1';
    const params = [];

    if (specialty) {
      query += ' AND specialty LIKE ?';
      params.push(`%${specialty}%`);
    }

    if (location) {
      query += ' AND city LIKE ?';
      params.push(`%${location}%`);
    }

    query += ' ORDER BY created_at DESC';

    const doctors = db.prepare(query).all(...params);

    // Parser les available_slots (JSON string vers array)
    const doctorsWithParsedSlots = doctors.map(doctor => ({
      ...doctor,
      availableSlots: JSON.parse(doctor.available_slots),
      nextAvailable: doctor.next_available,
      slotDuration: doctor.slot_duration || 30,
      workingDays: doctor.working_days ? JSON.parse(doctor.working_days) : [1, 2, 3, 4, 5],
    }));

    res.json(doctorsWithParsedSlots);
  } catch (error) {
    console.error('Erreur récupération médecins:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/doctors/:id - Récupérer un médecin
app.get('/api/doctors/:id', (req, res) => {
  try {
    const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(req.params.id);

    if (!doctor) {
      return res.status(404).json({ error: 'Médecin non trouvé' });
    }

    const doctorWithParsedSlots = {
      ...doctor,
      availableSlots: JSON.parse(doctor.available_slots),
      nextAvailable: doctor.next_available,
      slotDuration: doctor.slot_duration || 30,
      workingDays: doctor.working_days ? JSON.parse(doctor.working_days) : [1, 2, 3, 4, 5],
    };

    res.json(doctorWithParsedSlots);
  } catch (error) {
    console.error('Erreur récupération médecin:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/doctors - Créer un médecin (authentification requise)
app.post('/api/doctors', authenticateToken, (req, res) => {
  try {
    const { name, specialty, address, city, phone, email, doctorCode, image, availableSlots, nextAvailable, slotDuration, workingDays, latitude, longitude, mapsUrl } = req.body;

    if (!name || !specialty || !address || !city) {
      return res.status(400).json({ error: 'Champs requis manquants' });
    }

    const slots = JSON.stringify(availableSlots || ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00']);
    const serializedWorkingDays = JSON.stringify(Array.isArray(workingDays) && workingDays.length ? workingDays : [1, 2, 3, 4, 5]);

    const result = db.prepare(`
      INSERT INTO doctors (name, specialty, address, city, phone, email, doctor_code, image, available_slots, next_available, slot_duration, working_days, latitude, longitude, maps_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      specialty,
      address,
      city,
      phone || null,
      email || null,
      doctorCode || null,
      image || '👨‍⚕️',
      slots,
      nextAvailable || 'Disponible maintenant',
      Number(slotDuration) || 30,
      serializedWorkingDays,
      latitude || null,
      longitude || null,
      mapsUrl || null
    );

    const newDoctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({
      ...newDoctor,
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
app.put('/api/doctors/:id', authenticateToken, (req, res) => {
  try {
    const { name, specialty, address, city, phone, email, doctorCode, image, availableSlots, nextAvailable, slotDuration, workingDays, latitude, longitude, mapsUrl } = req.body;

    const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(req.params.id);

    if (!doctor) {
      return res.status(404).json({ error: 'Médecin non trouvé' });
    }

    const slots = availableSlots ? JSON.stringify(availableSlots) : doctor.available_slots;
    const serializedWorkingDays =
      workingDays !== undefined
        ? JSON.stringify(Array.isArray(workingDays) && workingDays.length ? workingDays : [1, 2, 3, 4, 5])
        : doctor.working_days;

    db.prepare(`
      UPDATE doctors 
      SET name = ?, specialty = ?, address = ?, city = ?, phone = ?, email = ?, doctor_code = ?,
          image = ?, available_slots = ?, next_available = ?, slot_duration = ?, working_days = ?, latitude = ?, longitude = ?, maps_url = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name || doctor.name,
      specialty || doctor.specialty,
      address || doctor.address,
      city || doctor.city,
      phone !== undefined ? phone : doctor.phone,
      email !== undefined ? email : doctor.email,
      doctorCode !== undefined ? doctorCode : doctor.doctor_code,
      image || doctor.image,
      slots,
      nextAvailable || doctor.next_available,
      slotDuration !== undefined ? Number(slotDuration) : (doctor.slot_duration || 30),
      serializedWorkingDays,
      latitude !== undefined ? latitude : doctor.latitude,
      longitude !== undefined ? longitude : doctor.longitude,
      mapsUrl !== undefined ? mapsUrl : doctor.maps_url,
      req.params.id
    );

    const updatedDoctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(req.params.id);

    res.json({
      ...updatedDoctor,
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
app.delete('/api/doctors/:id', authenticateToken, (req, res) => {
  try {
    const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(req.params.id);

    if (!doctor) {
      return res.status(404).json({ error: 'Médecin non trouvé' });
    }

    db.prepare('DELETE FROM doctors WHERE id = ?').run(req.params.id);

    res.json({ message: 'Médecin supprimé avec succès' });
  } catch (error) {
    console.error('Erreur suppression médecin:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== ROUTES CONSULTATIONS ====================

// POST /api/consultations - Créer une consultation (réservé aux médecins)
app.post('/api/consultations', authenticateDoctorToken, (req, res) => {
  try {
    const { patientName, patientPhone, patientEmail, stateDescription, progressNotes, nextAppointmentId } = req.body;
    const doctorId = req.user.id;

    if (!patientName) {
      return res.status(400).json({ error: 'Nom du patient requis' });
    }

    const result = db.prepare(`
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
app.get('/api/consultations', authenticateDoctorToken, (req, res) => {
  try {
    const consultations = db.prepare(`
      SELECT c.*, a.appointment_date as next_date, a.appointment_time as next_time
      FROM consultations c
      LEFT JOIN appointments a ON c.next_appointment_id = a.id
      WHERE c.doctor_id = ?
      ORDER BY c.created_at DESC
    `).all(req.user.id);

    res.json(consultations);
  } catch (error) {
    console.error('Erreur récupération consultations:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== ROUTES APPOINTMENTS ====================

// POST /api/appointments - Créer un rendez-vous
app.post('/api/appointments', async (req, res) => {
  try {
    const { doctorId, patientName, patientEmail, patientPhone, appointmentDate, appointmentTime, reason, language } = req.body;

    if (!doctorId || !patientName || !patientEmail || !patientPhone || !appointmentDate || !appointmentTime) {
      return res.status(400).json({ error: 'Champs requis manquants' });
    }

    const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(doctorId);

    if (!doctor) {
      return res.status(404).json({ error: 'Médecin non trouvé' });
    }

    const result = db.prepare(`
      INSERT INTO appointments (doctor_id, patient_name, patient_email, patient_phone, appointment_date, appointment_time, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(doctorId, patientName, patientEmail, patientPhone, appointmentDate, appointmentTime, reason || null);

    const appointment = db.prepare('SELECT * FROM appointments WHERE id = ?').get(result.lastInsertRowid);

    // Envoyer un email de confirmation
    try {
      await sendAppointmentConfirmation(patientEmail, {
        patientName,
        doctorName: doctor.name,
        specialty: doctor.specialty,
        date: appointmentDate,
        time: appointmentTime,
        address: `${doctor.address}, ${doctor.city}`
      }, language || 'fr');
    } catch (emailError) {
      console.error('Erreur envoi email confirmation:', emailError);
      // Ne pas bloquer la création du rendez-vous si l'email échoue
    }

    res.status(201).json(appointment);
  } catch (error) {
    console.error('Erreur création rendez-vous:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/patient/appointments - Récupérer les rendez-vous du patient connecté
app.get('/api/patient/appointments', authenticatePatientToken, (req, res) => {
  try {
    const appointments = db.prepare(`
      SELECT a.*, d.name as doctor_name, d.specialty, d.address, d.city
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      WHERE a.patient_email = ?
      ORDER BY a.appointment_date DESC, a.appointment_time DESC
    `).all(req.user.email);

    res.json(appointments);
  } catch (error) {
    console.error('Erreur récupération rendez-vous patient:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/appointments - Récupérer tous les rendez-vous (authentification requise)
app.get('/api/appointments', authenticateToken, (req, res) => {
  try {
    const appointments = db.prepare(`
      SELECT a.*, d.name as doctor_name, d.specialty, d.address, d.city
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      ORDER BY a.appointment_date DESC, a.appointment_time DESC
    `).all();

    res.json(appointments);
  } catch (error) {
    console.error('Erreur récupération rendez-vous:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== STATS ====================

// GET /api/stats - Statistiques (authentification requise)
app.get('/api/stats', authenticateToken, (req, res) => {
  try {
    const doctorCount = db.prepare('SELECT COUNT(*) as count FROM doctors').get();
    const appointmentCount = db.prepare('SELECT COUNT(*) as count FROM appointments').get();
    const specialties = db.prepare('SELECT COUNT(DISTINCT specialty) as count FROM doctors').get();

    res.json({
      totalDoctors: doctorCount.count,
      totalAppointments: appointmentCount.count,
      totalSpecialties: specialties.count
    });
  } catch (error) {
    console.error('Erreur récupération stats:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Route de test
app.get('/', (req, res) => {
  res.json({ message: 'API chifak fonctionne ! 🏥' });
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`\n🚀 Serveur chifak démarré sur http://localhost:${PORT}`);
  console.log(`📊 Base de données: chifak.db`);
  console.log(`\n📍 Endpoints disponibles:`);
  console.log(`   POST   /api/auth/login`);
  console.log(`   GET    /api/doctors`);
  console.log(`   POST   /api/doctors`);
  console.log(`   DELETE /api/doctors/:id`);
  console.log(`   POST   /api/appointments`);
  console.log(`   GET    /api/appointments`);
  console.log(`\n✅ Prêt à recevoir des requêtes!\n`);
});
