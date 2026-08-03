import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import session from 'express-session';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';
import db, { initDatabase } from './database.js';
import { sendDailyAgendas } from './dailyAgenda.js';
import {
  cleanString,
  isValidEmail,
  normalizeEmail,
  isValidDate,
  isValidTime,
  isValidPhone,
  isValidId,
  toBoundedInt,
  passwordStrengthError,
  isTooSimilar,
  assertStrongSecrets,
} from './security.js';
import passport from './passport-config.js';
import { generateVerificationCode, sendVerificationEmail, sendAppointmentConfirmation } from './emailService.js';
import { saveAccountToFile } from './storageService.js';

dotenv.config();

// SÉCURITÉ : on refuse de démarrer en production avec des secrets absents ou faibles.
assertStrongSecrets();

const app = express();
const PORT = process.env.PORT || 3001;

// Derrière le proxy de Render : nécessaire pour lire la vraie IP (rate-limiting, cookies sécurisés).
app.set('trust proxy', 1);

// Masque l'en-tête « X-Powered-By: Express » (moins d'informations pour un attaquant)
app.disable('x-powered-by');

// Sécurité des en-têtes HTTP (API JSON : pas besoin de CSP)
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));

// Compression gzip des réponses (moins de bande passante, réponses plus rapides)
app.use(compression());

// ── CORS ──
// En production : liste blanche stricte d'origines (ALLOWED_ORIGINS séparées par des virgules,
// ou FRONTEND_URL). En développement : on reflète l'origine pour autoriser le réseau local.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Requêtes sans origine (applications mobiles, curl, health checks) : autorisées
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origine non autorisée par la politique CORS'));
  },
  credentials: true,
}));

// Limite la taille des corps de requête (protège contre les payloads abusifs)
app.use(express.json({ limit: '1mb' }));

// ── Rate limiting ──
// Limiteur général : plafonne les requêtes par IP pour absorber les pics / abus.
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: Number(process.env.RATE_LIMIT_MAX) || 300, // 300 req/min/IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes, réessayez dans un instant.' },
});
app.use('/api/', generalLimiter);

// Limiteur strict sur les endpoints sensibles (connexion/inscription) : anti brute-force.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
});
[
  '/api/auth/login',
  '/api/auth/login-patient',
  '/api/auth/login-doctor',
  '/api/auth/register',
  '/api/auth/verify-code',   // anti-force brute du code à 6 chiffres
  '/api/auth/resend-code',   // anti-spam d'e-mails
  '/api/doctor/change-password',
].forEach((path) => app.use(path, authLimiter));

// Limiteur dédié à l'assistant IA (appels coûteux) : plafonne les messages par IP.
const assistantLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.ASSISTANT_RATE_LIMIT_MAX) || 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { reply: 'Vous envoyez des messages trop vite. Patientez un instant avant de réessayer.' },
});
app.use('/api/assistant', assistantLimiter);

// Endpoint de santé (surveillance / réveil Render)
app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// Session pour OAuth
// Cookie durci : httpOnly (inaccessible au JavaScript), sameSite (anti-CSRF),
// secure en production (transmis uniquement en HTTPS).
app.use(session({
  name: 'chifak.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 heures
  }
}));

// Initialiser Passport
app.use(passport.initialize());
app.use(passport.session());

// La base est initialisée au démarrage (voir en bas du fichier).

// Middleware d'authentification du personnel (admin / employé).
// SÉCURITÉ : on vérifie explicitement le type ET le rôle du jeton.
// Sans ce contrôle, un jeton de patient ou de médecin donnerait accès
// aux routes d'administration (création/suppression de médecins, etc.).
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
    if (user.type !== 'staff' || !['admin', 'employee'].includes(user.role)) {
      return res.status(403).json({ error: 'Accès réservé à l\'administration' });
    }
    req.user = user;
    next();
  });
};

// Réservé aux administrateurs (actions destructrices)
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
  }
  next();
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
    // SÉCURITÉ : tant que le mot de passe initial n'est pas changé, le jeton ne
    // donne accès à AUCUNE donnée, sauf à la route de changement de mot de passe.
    // Sans ce contrôle, on pourrait contourner l'écran du navigateur en appelant l'API.
    if (user.mustChangePassword && req.path !== '/api/doctor/change-password') {
      return res.status(403).json({ error: 'Changement de mot de passe requis', mustChangePassword: true });
    }
    req.user = user;
    next();
  });
};

// ==================== ROUTES AUTH ====================

// POST /api/auth/login - Connexion employé
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username et password requis' });
    }

    const user = await db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    if (!user) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    const validPassword = await bcrypt.compare(password, user.password);

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

// POST /api/auth/login-doctor - Connexion médecin (code + mot de passe)
app.post('/api/auth/login-doctor', async (req, res) => {
  try {
    const doctorCode = cleanString(req.body.doctorCode, 64);
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!doctorCode) {
      return res.status(400).json({ error: 'Code médecin requis' });
    }

    const doctor = await db.prepare('SELECT * FROM doctors WHERE doctor_code = ?').get(doctorCode);

    // Message volontairement identique pour ne pas révéler si le code existe
    if (!doctor) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    // Si un mot de passe a été défini par l'admin, il est obligatoire
    if (doctor.password) {
      if (!password) {
        return res.status(401).json({ error: 'Mot de passe requis' });
      }
      const ok = await bcrypt.compare(password, doctor.password);
      if (!ok) {
        return res.status(401).json({ error: 'Identifiants incorrects' });
      }
    }

    const token = jwt.sign(
      {
        id: doctor.id,
        name: doctor.name,
        type: 'doctor',
        mustChangePassword: !!doctor.must_change_password,
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: doctor.id,
        name: doctor.name,
        type: 'doctor'
      },
      mustChangePassword: !!doctor.must_change_password
    });
  } catch (error) {
    console.error('Erreur login médecin:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/doctor/change-password - Le médecin change son mot de passe (obligatoire à la 1re connexion)
app.post('/api/doctor/change-password', authenticateDoctorToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ error: 'Nouveau mot de passe requis' });
    }

    const doctor = await db.prepare('SELECT * FROM doctors WHERE id = ?').get(req.user.id);
    if (!doctor) {
      return res.status(404).json({ error: 'Médecin non trouvé' });
    }

    // Si un mot de passe existe déjà, vérifier l'actuel
    if (doctor.password) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Mot de passe actuel requis' });
      }
      if (!await bcrypt.compare(currentPassword, doctor.password)) {
        return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
      }
    }

    // Robustesse
    const strengthErr = passwordStrengthError(newPassword);
    if (strengthErr) {
      return res.status(400).json({ error: strengthErr });
    }

    // Le nouveau mot de passe ne doit pas ressembler à l'ancien
    const reference = currentPassword || doctor.password_plain || '';
    if (doctor.password && currentPassword && isTooSimilar(currentPassword, newPassword)) {
      return res.status(400).json({ error: 'Le nouveau mot de passe est trop proche de l\'ancien. Choisissez-en un différent.' });
    }
    // (garde-fou supplémentaire si l'ancien clair n'est pas disponible)
    if (reference && isTooSimilar(reference, newPassword)) {
      return res.status(400).json({ error: 'Le nouveau mot de passe est trop proche de l\'ancien. Choisissez-en un différent.' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await db.prepare('UPDATE doctors SET password = ?, must_change_password = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(hashed, req.user.id);

    // Nouveau jeton sans le drapeau « changement requis » : l'ancien reste bloqué.
    const token = jwt.sign(
      { id: doctor.id, name: doctor.name, type: 'doctor', mustChangePassword: false },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ message: 'Mot de passe mis à jour avec succès', token });
  } catch (error) {
    console.error('Erreur changement mot de passe médecin:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/auth/verify - Vérifier le token
app.get('/api/auth/verify', authenticateToken, async (req, res) => {
  res.json({ user: req.user });
});

// ==================== ROUTES PATIENTS (EMAIL + OAUTH) ====================

// POST /api/auth/register - Inscription avec email (envoie code de vérification)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { language } = req.body;
    const email = normalizeEmail(req.body.email);
    const name = cleanString(req.body.name, 120);
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Adresse e-mail invalide' });
    }
    if (!name || name.length < 2) {
      return res.status(400).json({ error: 'Nom invalide' });
    }
    // Le mot de passe doit être robuste dès l'inscription
    const pwdError = passwordStrengthError(password);
    if (pwdError) {
      return res.status(400).json({ error: pwdError });
    }

    // Vérifier si l'email existe déjà
    const existingPatient = await db.prepare('SELECT * FROM patients WHERE email = ?').get(email);
    if (existingPatient) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }

    // Générer un code de vérification
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Sauvegarder le code
    await db.prepare(`
      INSERT INTO verification_codes (email, code, expires_at)
      VALUES (?, ?, ?)
    `).run(email, code, expiresAt.toISOString());

    // Envoyer l'email
    await sendVerificationEmail(email, code, language || 'fr');

    // Sauvegarder temporairement l'utilisateur (non vérifié)
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.prepare(`
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
app.post('/api/auth/verify-code', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const code = typeof req.body.code === 'string' ? req.body.code.trim() : '';

    if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Email ou code invalide' });
    }

    // Récupérer le code
    const verificationCode = await db.prepare(`
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
    await db.prepare('UPDATE verification_codes SET is_used = 1 WHERE id = ?')
      .run(verificationCode.id);

    // Activer le compte
    await db.prepare('UPDATE patients SET is_verified = 1 WHERE email = ?')
      .run(email);

    const patient = await db.prepare('SELECT * FROM patients WHERE email = ?').get(email);

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
app.post('/api/auth/login-patient', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!isValidEmail(email) || !password) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    const demoEmail = 'demo.patient@chifak.dz';
    const demoPassword = 'patient123';

    // Filet de sécurité: recréer automatiquement le compte démo s'il manque
    if (email === demoEmail && password === demoPassword) {
      const existingDemo = await db.prepare('SELECT * FROM patients WHERE email = ?').get(demoEmail);
      if (!existingDemo) {
        const hashed = await bcrypt.hash(demoPassword, 10);
        await db.prepare(`
          INSERT INTO patients (email, name, password, is_verified)
          VALUES (?, ?, ?, 1)
        `).run(demoEmail, 'Patient Demo', hashed);
      }
    }

    const patient = await db.prepare('SELECT * FROM patients WHERE email = ?').get(email);

    if (!patient || !patient.password) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    if (!patient.is_verified) {
      return res.status(401).json({ error: 'Compte non vérifié. Vérifiez votre email.' });
    }

    const validPassword = await bcrypt.compare(password, patient.password);

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

    const patient = await db.prepare('SELECT * FROM patients WHERE email = ?').get(email);

    if (!patient) {
      return res.status(404).json({ error: 'Email non trouvé' });
    }

    if (patient.is_verified) {
      return res.status(400).json({ error: 'Compte déjà vérifié' });
    }

    // Générer un nouveau code
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.prepare(`
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

// GET /api/patient/profile - Profil patient connecté
app.get('/api/patient/profile', authenticatePatientToken, async (req, res) => {
  try {
    const patient = await db.prepare('SELECT id, email, name, phone, balance FROM patients WHERE email = ?').get(req.user.email);
    if (!patient) {
      return res.status(404).json({ error: 'Patient non trouvé' });
    }
    res.json({ ...patient, phone: patient.phone || '', balance: patient.balance || 0 });
  } catch (error) {
    console.error('Erreur récupération profil patient:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/patient/profile - Modifier ses informations (nom, téléphone)
app.put('/api/patient/profile', authenticatePatientToken, async (req, res) => {
  try {
    const name = cleanString(req.body.name, 120);
    const phone = cleanString(req.body.phone, 20);
    const current = await db.prepare('SELECT * FROM patients WHERE email = ?').get(req.user.email);
    if (!current) {
      return res.status(404).json({ error: 'Patient non trouvé' });
    }
    if (phone && !isValidPhone(phone)) {
      return res.status(400).json({ error: 'Numéro de téléphone invalide' });
    }
    const newName = name && name.length >= 2 ? name : current.name;
    const newPhone = phone !== null ? phone : (current.phone || '');
    await db.prepare('UPDATE patients SET name = ?, phone = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?')
      .run(newName, newPhone, req.user.email);

    const patient = await db.prepare('SELECT id, email, name, phone, balance FROM patients WHERE email = ?').get(req.user.email);
    res.json({ ...patient, phone: patient.phone || '', balance: patient.balance || 0 });
  } catch (error) {
    console.error('Erreur mise à jour profil patient:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/patient/recharge - Recharger le solde patient
app.post('/api/patient/recharge', authenticatePatientToken, async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Montant invalide' });
    }

    const patient = await db.prepare('SELECT id, email, name, balance FROM patients WHERE email = ?').get(req.user.email);
    if (!patient) {
      return res.status(404).json({ error: 'Patient non trouvé' });
    }

    const newBalance = (patient.balance || 0) + Math.round(amount);
    await db.prepare('UPDATE patients SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newBalance, patient.id);

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
  // 'app' quand la demande vient de l'app mobile -> retour par lien profond
  const state = req.query.redirect === 'app' ? 'app' : 'web';
  passport.authenticate('google', { scope: ['profile', 'email'], state })(req, res, next);
});

const buildOAuthRedirect = (user, token, isApp) => {
  const params = new URLSearchParams({
    token,
    email: user.email,
    name: user.name || '',
  });
  if (isApp) {
    // Retour dans l'app native via un lien profond (custom URL scheme)
    const scheme = process.env.MOBILE_REDIRECT_URL || 'chifak://auth/callback';
    return `${scheme}?${params.toString()}`;
  }
  const frontend = process.env.FRONTEND_URL || 'http://localhost:5173';
  return `${frontend}/auth/callback?${params.toString()}`;
};

const oauthFailureRedirect = () =>
  `${process.env.FRONTEND_URL || 'http://localhost:5173'}/?auth_error=1`;

app.get('/api/auth/google/callback',
  passport.authenticate('google', { failureRedirect: oauthFailureRedirect() }),
  async (req, res) => {
    const token = jwt.sign(
      { id: req.user.id, email: req.user.email, type: 'patient' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.redirect(buildOAuthRedirect(req.user, token, req.query.state === 'app'));
  }
);

// Facebook OAuth
app.get('/api/auth/facebook', (req, res, next) => {
  if (!isFacebookOAuthReady()) {
    return res.redirect(`${frontendUrl()}/?oauth=unconfigured&provider=facebook`);
  }
  const state = req.query.redirect === 'app' ? 'app' : 'web';
  passport.authenticate('facebook', { scope: ['email'], state })(req, res, next);
});

app.get('/api/auth/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: oauthFailureRedirect() }),
  async (req, res) => {
    const token = jwt.sign(
      { id: req.user.id, email: req.user.email, type: 'patient' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.redirect(buildOAuthRedirect(req.user, token, req.query.state === 'app'));
  }
);

// ==================== ROUTES DOCTORS ====================

// GET /api/doctors - Récupérer tous les médecins
app.get('/api/doctors', async (req, res) => {
  try {
    // Entrées bornées et nettoyées ; les valeurs restent des paramètres liés.
    const specialty = cleanString(req.query.specialty, 80);
    const location = cleanString(req.query.location, 80);
    // Neutralise les jokers LIKE fournis par l'utilisateur (% et _)
    const escapeLike = (v) => v.replace(/[\\%_]/g, (m) => `\\${m}`);

    let query = 'SELECT * FROM doctors WHERE 1=1';
    const params = [];

    if (specialty) {
      query += " AND specialty ILIKE ? ESCAPE '\\'";
      params.push(`%${escapeLike(specialty)}%`);
    }

    if (location) {
      query += " AND city ILIKE ? ESCAPE '\\'";
      params.push(`%${escapeLike(location)}%`);
    }

    // Plafond de sécurité + pagination optionnelle (?limit & ?offset) — évite de renvoyer
    // des dizaines de milliers de lignes d'un coup si l'annuaire grossit.
    // Valeurs passées en paramètres liés (jamais concaténées dans le SQL).
    const limit = toBoundedInt(req.query.limit, { min: 1, max: 1000, fallback: 500 }) ?? 500;
    const offset = toBoundedInt(req.query.offset, { min: 0, max: 1000000, fallback: 0 }) ?? 0;
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const doctors = await db.prepare(query).all(...params);

    // Parser les available_slots (JSON string vers array)
    const doctorsWithParsedSlots = doctors.map(doctor => ({
      ...doctor,
      password: undefined, // ne jamais exposer le hash
      hasPassword: !!doctor.password,
      availableSlots: JSON.parse(doctor.available_slots),
      nextAvailable: doctor.next_available,
      slotDuration: doctor.slot_duration || 30,
      workingDays: doctor.working_days ? JSON.parse(doctor.working_days) : [1, 2, 3, 4, 5],
      description: doctor.description || '',
      bio: doctor.bio || '',
      offDays: doctor.off_days ? JSON.parse(doctor.off_days) : [],
      blockedSlots: doctor.blocked_slots ? JSON.parse(doctor.blocked_slots) : [],
    }));

    res.json(doctorsWithParsedSlots);
  } catch (error) {
    console.error('Erreur récupération médecins:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/doctors/:id - Récupérer un médecin
app.get('/api/doctors/:id', async (req, res) => {
  try {
    const doctor = await db.prepare('SELECT * FROM doctors WHERE id = ?').get(req.params.id);

    if (!doctor) {
      return res.status(404).json({ error: 'Médecin non trouvé' });
    }

    const doctorWithParsedSlots = {
      ...doctor,
      password: undefined, // ne jamais exposer le hash
      hasPassword: !!doctor.password,
      availableSlots: JSON.parse(doctor.available_slots),
      nextAvailable: doctor.next_available,
      slotDuration: doctor.slot_duration || 30,
      workingDays: doctor.working_days ? JSON.parse(doctor.working_days) : [1, 2, 3, 4, 5],
      description: doctor.description || '',
      bio: doctor.bio || '',
      offDays: doctor.off_days ? JSON.parse(doctor.off_days) : [],
      blockedSlots: doctor.blocked_slots ? JSON.parse(doctor.blocked_slots) : [],
    };

    res.json(doctorWithParsedSlots);
  } catch (error) {
    console.error('Erreur récupération médecin:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/doctors - Créer un médecin (authentification requise)
app.post('/api/doctors', authenticateToken, async (req, res) => {
  try {
    const { name, specialty, address, city, phone, email, doctorCode, image, availableSlots, nextAvailable, slotDuration, workingDays, latitude, longitude, mapsUrl, password } = req.body;

    if (!name || !specialty || !address || !city) {
      return res.status(400).json({ error: 'Champs requis manquants' });
    }

    const slots = JSON.stringify(availableSlots || ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00']);
    const serializedWorkingDays = JSON.stringify(Array.isArray(workingDays) && workingDays.length ? workingDays : [1, 2, 3, 4, 5]);

    // Mot de passe défini par l'admin : haché + changement obligatoire à la 1re connexion
    // Le mot de passe initial fixé par l'admin doit lui aussi être robuste
    if (password) {
      const pwdError = passwordStrengthError(password);
      if (pwdError) return res.status(400).json({ error: pwdError });
    }
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;
    const mustChange = password ? 1 : 0;

    const result = await db.prepare(`
      INSERT INTO doctors (name, specialty, address, city, phone, email, doctor_code, image, available_slots, next_available, slot_duration, working_days, latitude, longitude, maps_url, password, must_change_password)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      mapsUrl || null,
      hashedPassword,
      mustChange
    );

    const newDoctor = await db.prepare('SELECT * FROM doctors WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({
      ...newDoctor,
      password: undefined,
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
app.put('/api/doctors/:id', authenticateToken, async (req, res) => {
  try {
    const { name, specialty, address, city, phone, email, doctorCode, image, availableSlots, nextAvailable, slotDuration, workingDays, latitude, longitude, mapsUrl, password } = req.body;

    const doctor = await db.prepare('SELECT * FROM doctors WHERE id = ?').get(req.params.id);

    if (!doctor) {
      return res.status(404).json({ error: 'Médecin non trouvé' });
    }

    const slots = availableSlots ? JSON.stringify(availableSlots) : doctor.available_slots;
    const serializedWorkingDays =
      workingDays !== undefined
        ? JSON.stringify(Array.isArray(workingDays) && workingDays.length ? workingDays : [1, 2, 3, 4, 5])
        : doctor.working_days;

    // Réinitialisation du mot de passe par l'admin : haché + changement obligatoire à la prochaine connexion
    if (password) {
      const pwdError = passwordStrengthError(password);
      if (pwdError) return res.status(400).json({ error: pwdError });
    }
    const newHashed = password ? await bcrypt.hash(password, 10) : doctor.password;
    const mustChange = password ? 1 : (doctor.must_change_password || 0);

    await db.prepare(`
      UPDATE doctors
      SET name = ?, specialty = ?, address = ?, city = ?, phone = ?, email = ?, doctor_code = ?,
          image = ?, available_slots = ?, next_available = ?, slot_duration = ?, working_days = ?, latitude = ?, longitude = ?, maps_url = ?, password = ?, must_change_password = ?, updated_at = CURRENT_TIMESTAMP
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
      newHashed,
      mustChange,
      req.params.id
    );

    const updatedDoctor = await db.prepare('SELECT * FROM doctors WHERE id = ?').get(req.params.id);

    res.json({
      ...updatedDoctor,
      password: undefined,
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
app.delete('/api/doctors/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const doctor = await db.prepare('SELECT * FROM doctors WHERE id = ?').get(req.params.id);

    if (!doctor) {
      return res.status(404).json({ error: 'Médecin non trouvé' });
    }

    await db.prepare('DELETE FROM doctors WHERE id = ?').run(req.params.id);

    res.json({ message: 'Médecin supprimé avec succès' });
  } catch (error) {
    console.error('Erreur suppression médecin:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== ROUTES CONSULTATIONS ====================

// POST /api/consultations - Créer une consultation (réservé aux médecins)
app.post('/api/consultations', authenticateDoctorToken, async (req, res) => {
  try {
    const { patientName, patientPhone, patientEmail, stateDescription, progressNotes, nextAppointmentId } = req.body;
    const doctorId = req.user.id;

    if (!patientName) {
      return res.status(400).json({ error: 'Nom du patient requis' });
    }

    const result = await db.prepare(`
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
app.get('/api/consultations', authenticateDoctorToken, async (req, res) => {
  try {
    const consultations = await db.prepare(`
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

// ==================== ROUTES AVIS (REVIEWS) ====================

// GET /api/doctors/:id/reviews - Avis d'un médecin
app.get('/api/doctors/:id/reviews', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }
    const doctorId = Number(req.params.id);
    const reviews = await db.prepare(`
      SELECT id, patient_name, rating, comment, created_at
      FROM reviews WHERE doctor_id = ? ORDER BY created_at DESC
    `).all(doctorId);
    res.json(reviews);
  } catch (error) {
    console.error('Erreur récupération avis:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/doctors/:id/reviews - Laisser (ou mettre à jour) son avis
app.post('/api/doctors/:id/reviews', authenticatePatientToken, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }
    const doctorId = Number(req.params.id);
    const rating = Number(req.body.rating);
    const comment = typeof req.body.comment === 'string' ? req.body.comment.trim() : null;

    if (!rating || rating < 1 || rating > 5) {
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

    // Recalcul de la note moyenne et du nombre d'avis du médecin
    const stats = await db.prepare('SELECT COUNT(*)::int AS count, COALESCE(AVG(rating), 0) AS avg FROM reviews WHERE doctor_id = ?').get(doctorId);
    const avg = Math.round(Number(stats.avg) * 10) / 10;
    await db.prepare('UPDATE doctors SET rating = ?, review_count = ? WHERE id = ?').run(avg, stats.count, doctorId);

    res.status(201).json({ rating: avg, reviewCount: stats.count });
  } catch (error) {
    console.error('Erreur enregistrement avis:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/patient/reviews - Médecins déjà notés par le patient connecté
app.get('/api/patient/reviews', authenticatePatientToken, async (req, res) => {
  try {
    const rows = await db.prepare('SELECT doctor_id FROM reviews WHERE patient_email = ?').all(req.user.email);
    res.json(rows);
  } catch (error) {
    console.error('Erreur récupération avis patient:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/reviews - Tous les avis (espace admin/personnel)
app.get('/api/reviews', authenticateToken, async (req, res) => {
  try {
    const rows = await db.prepare(`
      SELECT r.id, r.doctor_id, r.patient_name, r.rating, r.comment, r.created_at,
             d.name AS doctor_name, d.specialty
      FROM reviews r JOIN doctors d ON r.doctor_id = d.id
      ORDER BY r.created_at DESC
    `).all();
    res.json(rows);
  } catch (error) {
    console.error('Erreur récupération avis (admin):', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/reviews/:id - Supprimer un avis (admin/personnel) + recalcul de la note
app.delete('/api/reviews/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }
    const id = Number(req.params.id);
    const review = await db.prepare('SELECT doctor_id FROM reviews WHERE id = ?').get(id);
    if (!review) {
      return res.status(404).json({ error: 'Avis non trouvé' });
    }
    await db.prepare('DELETE FROM reviews WHERE id = ?').run(id);
    const stats = await db.prepare('SELECT COUNT(*)::int AS count, COALESCE(AVG(rating), 0) AS avg FROM reviews WHERE doctor_id = ?').get(review.doctor_id);
    const avg = Math.round(Number(stats.avg) * 10) / 10;
    await db.prepare('UPDATE doctors SET rating = ?, review_count = ? WHERE id = ?').run(avg, stats.count, review.doctor_id);
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur suppression avis:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== ROUTES APPOINTMENTS ====================

// POST /api/appointments - Créer un rendez-vous
app.post('/api/appointments', async (req, res) => {
  try {
    const { doctorId, appointmentDate, appointmentTime, language } = req.body;

    // ── Validation stricte de toutes les entrées (endpoint public) ──
    const patientName = cleanString(req.body.patientName, 120);
    const patientEmail = normalizeEmail(req.body.patientEmail);
    const patientPhone = cleanString(req.body.patientPhone, 20);
    const reason = cleanString(req.body.reason, 1000);

    if (!isValidId(doctorId)) {
      return res.status(400).json({ error: 'Médecin invalide' });
    }
    if (!patientName || patientName.length < 2) {
      return res.status(400).json({ error: 'Nom du patient invalide' });
    }
    if (!isValidEmail(patientEmail)) {
      return res.status(400).json({ error: 'Adresse e-mail invalide' });
    }
    if (!isValidPhone(patientPhone)) {
      return res.status(400).json({ error: 'Numéro de téléphone invalide' });
    }
    if (!isValidDate(appointmentDate)) {
      return res.status(400).json({ error: 'Date invalide' });
    }
    if (!isValidTime(appointmentTime)) {
      return res.status(400).json({ error: 'Heure invalide' });
    }

    // On ne réserve pas dans le passé, ni au-delà d'un an
    const todayIso = new Date().toISOString().slice(0, 10);
    const maxIso = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    if (appointmentDate < todayIso || appointmentDate > maxIso) {
      return res.status(400).json({ error: 'Date hors de la période autorisée' });
    }

    const doctor = await db.prepare('SELECT * FROM doctors WHERE id = ?').get(doctorId);

    if (!doctor) {
      return res.status(404).json({ error: 'Médecin non trouvé' });
    }

    // ── Le créneau demandé doit être réellement proposé par le médecin ──
    // (sinon on pourrait forcer un rendez-vous à 3h du matin ou un jour de fermeture)
    const parseJson = (raw, fallback) => { try { return JSON.parse(raw); } catch { return fallback; } };
    const workingDays = parseJson(doctor.working_days, [1, 2, 3, 4, 5]);
    const offDays = parseJson(doctor.off_days, []);
    const slots = parseJson(doctor.available_slots, []);
    const weekday = new Date(`${appointmentDate}T12:00:00Z`).getUTCDay();

    if (!workingDays.includes(weekday) || offDays.includes(appointmentDate)) {
      return res.status(400).json({ error: 'Le médecin ne consulte pas à cette date.' });
    }
    if (!slots.includes(appointmentTime)) {
      return res.status(400).json({ error: 'Créneau horaire non proposé par ce médecin.' });
    }

    // Créneau réservé par le médecin (patient habitué, urgence, etc.)
    const blocked = parseJson(doctor.blocked_slots, [])
      .map((e) => (typeof e === 'string' ? e : e && e.slot))
      .filter(Boolean);
    if (blocked.includes(`${appointmentDate} ${appointmentTime}`)) {
      return res.status(409).json({ error: 'Ce créneau n\'est pas disponible.' });
    }

    // Anti-spam : un même e-mail ne peut pas réserver en masse
    const recent = await db.prepare(`
      SELECT COUNT(*)::int AS count FROM appointments
      WHERE patient_email = ? AND status != 'cancelled' AND created_at > NOW() - INTERVAL '1 hour'
    `).get(patientEmail);
    if (recent && recent.count >= 5) {
      return res.status(429).json({ error: 'Trop de réservations récentes. Réessayez plus tard.' });
    }

    // Anti-double réservation : ce créneau est-il déjà pris (hors annulés) ?
    const existing = await db.prepare(`
      SELECT id FROM appointments
      WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ? AND status != 'cancelled'
    `).get(doctorId, appointmentDate, appointmentTime);

    if (existing) {
      return res.status(409).json({ error: 'Ce créneau vient d\'être réservé. Choisissez-en un autre.' });
    }

    const result = await db.prepare(`
      INSERT INTO appointments (doctor_id, patient_name, patient_email, patient_phone, appointment_date, appointment_time, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(doctorId, patientName, patientEmail, patientPhone, appointmentDate, appointmentTime, reason || null);

    const appointment = await db.prepare('SELECT * FROM appointments WHERE id = ?').get(result.lastInsertRowid);

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

// GET /api/booked-slots?date=YYYY-MM-DD - Créneaux déjà pris ce jour-là (tous médecins)
app.get('/api/booked-slots', async (req, res) => {
  try {
    const { date } = req.query;
    if (!isValidDate(date)) {
      return res.status(400).json({ error: 'Paramètre date invalide (format AAAA-MM-JJ)' });
    }
    const rows = await db.prepare(`
      SELECT doctor_id, appointment_time
      FROM appointments
      WHERE appointment_date = ? AND status != 'cancelled'
    `).all(date);
    res.json(rows);
  } catch (error) {
    console.error('Erreur récupération créneaux pris:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/patient/appointments - Récupérer les rendez-vous du patient connecté
app.get('/api/patient/appointments', authenticatePatientToken, async (req, res) => {
  try {
    const appointments = await db.prepare(`
      SELECT a.*, d.name as doctor_name, d.specialty, d.address, d.city,
             d.slot_duration, d.available_slots, d.working_days, d.off_days, d.blocked_slots
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

// PATCH /api/patient/appointments/:id/cancel - Annuler son rendez-vous
app.patch('/api/patient/appointments/:id/cancel', authenticatePatientToken, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }
    const id = Number(req.params.id);
    const appt = await db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);
    if (!appt) {
      return res.status(404).json({ error: 'Rendez-vous non trouvé' });
    }
    if (appt.patient_email !== req.user.email) {
      return res.status(403).json({ error: 'Ce rendez-vous ne vous appartient pas' });
    }
    await db.prepare("UPDATE appointments SET status = 'cancelled' WHERE id = ?").run(id);
    const updated = await db.prepare(`
      SELECT a.*, d.name as doctor_name, d.specialty, d.address, d.city,
             d.slot_duration, d.available_slots, d.working_days, d.off_days, d.blocked_slots
      FROM appointments a JOIN doctors d ON a.doctor_id = d.id WHERE a.id = ?
    `).get(id);
    res.json(updated);
  } catch (error) {
    console.error('Erreur annulation rendez-vous:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /api/patient/appointments/:id/reschedule - Reprogrammer son rendez-vous
app.patch('/api/patient/appointments/:id/reschedule', authenticatePatientToken, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }
    const id = Number(req.params.id);
    const { appointmentDate, appointmentTime } = req.body;
    if (!appointmentDate || !appointmentTime) {
      return res.status(400).json({ error: 'Date et heure requises' });
    }
    const appt = await db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);
    if (!appt) {
      return res.status(404).json({ error: 'Rendez-vous non trouvé' });
    }
    if (appt.patient_email !== req.user.email) {
      return res.status(403).json({ error: 'Ce rendez-vous ne vous appartient pas' });
    }
    // Le nouveau créneau est-il libre chez ce médecin ?
    const clash = await db.prepare(`
      SELECT id FROM appointments
      WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ? AND status != 'cancelled' AND id != ?
    `).get(appt.doctor_id, appointmentDate, appointmentTime, id);
    if (clash) {
      return res.status(409).json({ error: 'Ce créneau est déjà pris. Choisissez-en un autre.' });
    }
    await db.prepare("UPDATE appointments SET appointment_date = ?, appointment_time = ?, status = 'confirmed' WHERE id = ?")
      .run(appointmentDate, appointmentTime, id);
    const updated = await db.prepare(`
      SELECT a.*, d.name as doctor_name, d.specialty, d.address, d.city,
             d.slot_duration, d.available_slots, d.working_days, d.off_days, d.blocked_slots
      FROM appointments a JOIN doctors d ON a.doctor_id = d.id WHERE a.id = ?
    `).get(id);
    res.json(updated);
  } catch (error) {
    console.error('Erreur reprogrammation rendez-vous:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/appointments - Récupérer tous les rendez-vous (authentification requise)
app.get('/api/appointments', authenticateToken, async (req, res) => {
  try {
    const appointments = await db.prepare(`
      SELECT a.*, d.name as doctor_name, d.specialty, d.address, d.city,
             d.slot_duration, d.available_slots, d.working_days, d.off_days, d.blocked_slots
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

// ==================== ESPACE MÉDECIN ====================

// GET /api/doctor/profile - Profil du médecin connecté
app.get('/api/doctor/profile', authenticateDoctorToken, async (req, res) => {
  try {
    const d = await db.prepare('SELECT * FROM doctors WHERE id = ?').get(req.user.id);
    if (!d) return res.status(404).json({ error: 'Médecin non trouvé' });
    res.json({
      id: d.id,
      name: d.name,
      email: d.email || '',
      phone: d.phone || '',
      address: d.address || '',
      city: d.city || '',
      specialty: d.specialty,
      doctorCode: d.doctor_code,
      description: d.description || '',
      bio: d.bio || '',
      slotDuration: d.slot_duration || 30,
      offDays: d.off_days ? JSON.parse(d.off_days) : [],
      blockedSlots: d.blocked_slots ? JSON.parse(d.blocked_slots) : [],
      availableSlots: d.available_slots ? JSON.parse(d.available_slots) : [],
      workingDays: d.working_days ? JSON.parse(d.working_days) : [1, 2, 3, 4, 5],
    });
  } catch (error) {
    console.error('Erreur profil médecin:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/doctor/profile - Modifier UNIQUEMENT descriptif, parcours, durée créneau, jours off
app.put('/api/doctor/profile', authenticateDoctorToken, async (req, res) => {
  try {
    const current = await db.prepare('SELECT * FROM doctors WHERE id = ?').get(req.user.id);
    if (!current) return res.status(404).json({ error: 'Médecin non trouvé' });

    const { description, bio, slotDuration, offDays, blockedSlots } = req.body;
    const dur = Number(slotDuration);
    const newDescription = typeof description === 'string' ? description : (current.description || null);
    const newBio = typeof bio === 'string' ? bio : (current.bio || null);
    const newDuration = dur >= 5 && dur <= 120 ? dur : (current.slot_duration || 30);

    // Jours d'indisponibilité : uniquement des dates valides (max 400 entrées)
    const newOff = Array.isArray(offDays)
      ? JSON.stringify(offDays.filter((d) => isValidDate(d)).slice(0, 400))
      : (current.off_days || '[]');

    // Créneaux bloqués. Deux formats acceptés :
    //  - « AAAA-MM-JJ HH:MM » (simple)
    //  - { slot, patientName, patientPhone, patientEmail, note } (réservé à un patient)
    const newBlocked = Array.isArray(blockedSlots)
      ? JSON.stringify(
          blockedSlots
            .map((entry) => {
              const raw = typeof entry === 'string' ? entry : entry && entry.slot;
              if (typeof raw !== 'string') return null;
              const [d, t] = raw.split(' ');
              if (!isValidDate(d) || !isValidTime(t)) return null;
              if (typeof entry === 'string') return raw;

              const cleaned = { slot: raw };
              const name = cleanString(entry.patientName, 120);
              const phone = cleanString(entry.patientPhone, 20);
              const email = normalizeEmail(entry.patientEmail);
              const note = cleanString(entry.note, 500);
              if (name) cleaned.patientName = name;
              if (phone && isValidPhone(phone)) cleaned.patientPhone = phone;
              if (email && isValidEmail(email)) cleaned.patientEmail = email;
              if (note) cleaned.note = note;
              return cleaned;
            })
            .filter(Boolean)
            .slice(0, 2000)
        )
      : (current.blocked_slots || '[]');

    await db.prepare('UPDATE doctors SET description = ?, bio = ?, slot_duration = ?, off_days = ?, blocked_slots = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newDescription, newBio, newDuration, newOff, newBlocked, req.user.id);

    const d = await db.prepare('SELECT * FROM doctors WHERE id = ?').get(req.user.id);
    res.json({
      description: d.description || '',
      bio: d.bio || '',
      slotDuration: d.slot_duration || 30,
      offDays: d.off_days ? JSON.parse(d.off_days) : [],
      blockedSlots: d.blocked_slots ? JSON.parse(d.blocked_slots) : [],
      availableSlots: d.available_slots ? JSON.parse(d.available_slots) : [],
      workingDays: d.working_days ? JSON.parse(d.working_days) : [1, 2, 3, 4, 5],
    });
  } catch (error) {
    console.error('Erreur mise à jour profil médecin:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/doctor/appointments - Rendez-vous du médecin + coordonnées patients + remarques
app.get('/api/doctor/appointments', authenticateDoctorToken, async (req, res) => {
  try {
    const rows = await db.prepare(`
      SELECT id, patient_name, patient_email, patient_phone, appointment_date, appointment_time, reason, status, doctor_notes
      FROM appointments
      WHERE doctor_id = ?
      ORDER BY appointment_date DESC, appointment_time DESC
    `).all(req.user.id);
    res.json(rows);
  } catch (error) {
    console.error('Erreur rendez-vous médecin:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /api/doctor/appointments/:id/notes - Remarques privées du médecin
app.patch('/api/doctor/appointments/:id/notes', authenticateDoctorToken, async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: 'Identifiant invalide' });
    }
    const id = Number(req.params.id);
    const appt = await db.prepare('SELECT doctor_id FROM appointments WHERE id = ?').get(id);
    if (!appt) return res.status(404).json({ error: 'Rendez-vous non trouvé' });
    if (appt.doctor_id !== req.user.id) return res.status(403).json({ error: 'Non autorisé' });
    const notes = typeof req.body.notes === 'string' ? req.body.notes : null;
    await db.prepare('UPDATE appointments SET doctor_notes = ? WHERE id = ?').run(notes, id);
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur remarques médecin:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ==================== STATS ====================

// GET /api/stats - Statistiques (authentification requise)
app.get('/api/stats', authenticateToken, async (req, res) => {
  try {
    const doctorCount = await db.prepare('SELECT COUNT(*)::int as count FROM doctors').get();
    const appointmentCount = await db.prepare('SELECT COUNT(*)::int as count FROM appointments').get();
    const specialties = await db.prepare('SELECT COUNT(DISTINCT specialty)::int as count FROM doctors').get();

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

// ==================== ASSISTANT SANTÉ (IA) ====================

// Configuration IA (modèle open-source via API compatible OpenAI, ex : Groq)
const AI_BASE_URL = process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1';
const AI_MODEL = process.env.AI_MODEL || 'llama-3.3-70b-versatile';
const AI_API_KEY = process.env.AI_API_KEY || '';

const ASSISTANT_SYSTEM_PROMPT = `Tu es « l'Assistant Santé chifak », un assistant d'orientation médicale pour une plateforme de prise de rendez-vous en Algérie. Tu parles au patient avec bienveillance, clarté et simplicité.

Phrases courtes et simples. Pas de jargon médical compliqué.
(Les règles de langue figurent en fin de consigne : elles priment sur tout le reste.)

TON RÔLE — UN SEUL, ET RIEN D'AUTRE :
Identifier la spécialité à consulter, le plus vite possible, puis t'effacer.
1. Poser UNE question courte à la fois pour cerner le motif (où, depuis quand, intensité).
2. ORIENTER vers la spécialité la plus adaptée parmi cette liste UNIQUEMENT :
   Médecin généraliste, Dentiste, Ophtalmologue, Dermatologue, Cardiologue, Pédiatre, Gynécologue, ORL, Kinésithérapeute, Psychologue, Ostéopathe, Sage-femme.
   En cas de doute ou de symptômes généraux, oriente vers « Médecin généraliste ».
Tu ne donnes pas de conseils de santé spontanés, tu ne fais pas de pédagogie, tu n'expliques pas le fonctionnement du site.
Si le patient te pose une question hors de ce cadre, réponds en une phrase et reviens à l'orientation.

SÉCURITÉ — TRÈS IMPORTANT :
- Tu n'es PAS un médecin et tu ne poses JAMAIS de diagnostic définitif. Rappelle-le brièvement quand c'est utile.
- Ne prescris JAMAIS de médicament précis ni de dosage. Tu peux mentionner des mesures générales et conseiller de voir un médecin ou un pharmacien.
- URGENCES : si le patient décrit des signes graves (douleur thoracique intense, difficulté à respirer, signes d'AVC comme visage qui tombe/bras faible/parole troublée, saignement abondant, perte de conscience, douleur abdominale intense, pensées suicidaires, réaction allergique grave), tu DOIS lui dire d'appeler immédiatement les secours : Protection Civile 14 (ou 1021) et SAMU 115, ou de se rendre aux urgences les plus proches, SANS attendre un rendez-vous.
- Reste dans le domaine médical et de la santé. Si on te demande autre chose, ramène poliment vers ce sujet.

COMMENT PRENDRE RENDEZ-VOUS SUR CHIFAK (à expliquer si demandé) :
1. Sur la page d'accueil, choisir la spécialité et la wilaya dans la barre de recherche.
2. Parcourir la liste des médecins et en choisir un.
3. Sélectionner une date et un créneau horaire disponibles.
4. Remplir ses informations et confirmer. Une confirmation est envoyée par e-mail.

FORMAT — RÈGLE DE BRIÈVETÉ, STRICTE :
- UNE SEULE phrase par réponse. Deux au maximum, jamais plus.
- Une seule question à la fois. Jamais deux questions dans le même message.
- Pas de formule d'accueil répétée, pas de « j'espère que tu vas bien », pas de conclusion.
- Pas de conseils spontanés : le patient veut un rendez-vous, pas un cours.
- Objectif : orienter en 2 ou 3 échanges MAXIMUM, puis t'arrêter.

RÉPONSES PROPOSÉES (technique, obligatoire) :
Chaque fois que tu poses une question, termine par une dernière ligne au format exact :
[[OPTIONS:première réponse|deuxième réponse|troisième réponse]]
- De 2 à 4 options, séparées par le caractère « | ».
- Chaque option fait 1 à 4 mots, formulée à la première personne, telle que le patient la dirait.
- Les options doivent couvrir les cas les plus probables, et rester exclusives entre elles.
- Écris-les dans la langue de la conversation.
- Cette ligne est retirée avant affichage : ne l'annonce jamais, ne la commente jamais.
Exemple de réponse complète et correcte :
Depuis combien de temps avez-vous mal ?
[[OPTIONS:Depuis aujourd'hui|Quelques jours|Plus d'une semaine]]

MARQUEUR D'ORIENTATION (technique, très important) :
Dès que tu as assez d'éléments — au plus tard au 3e échange — termine ta réponse par une dernière ligne au format exact :
[[ORIENTATION:Nom de la spécialité]]
Le nom doit être copié à l'identique depuis la liste autorisée ci-dessus, sans traduction ni variante.
Cette ligne est retirée avant affichage : ne la commente pas, ne l'annonce pas, et n'en parle jamais au patient.
Quand tu émets ce marqueur, n'émets PAS d'options : la conversation est terminée, le patient passe à la réservation.
N'émets ce marqueur qu'une seule fois.
En cas d'urgence vitale, n'émets AUCUN marqueur : le patient doit appeler les secours, pas prendre rendez-vous.`;

/** Spécialités vers lesquelles l'assistant peut orienter. Toute valeur hors de
 *  cette liste est rejetée : le modèle ne décide pas seul du vocabulaire. */
const ORIENTATION_SPECIALTIES = [
  'Médecin généraliste', 'Dentiste', 'Ophtalmologue', 'Dermatologue',
  'Cardiologue', 'Pédiatre', 'Gynécologue', 'ORL', 'Kinésithérapeute',
  'Psychologue', 'Ostéopathe', 'Sage-femme',
];

/**
 * Consignes de langue. Elles sont placées EN DERNIER dans le prompt système et
 * sont les seules à parler de langue : le prompt de base n'en impose aucune,
 * sans quoi le modèle suivait cette consigne-là plutôt que le choix du patient.
 * La règle est exclusive et répétée, y compris pour les messages écrits dans
 * une autre langue que celle retenue.
 *
 * Deux langues seulement : français et arabe littéraire. Le dialecte algérien
 * a été retiré, et chaque consigne en interdit explicitement les tournures —
 * un modèle entraîné sur du contenu maghrébin y glisse sinon spontanément.
 */
const LANGUAGE_INSTRUCTIONS = {
  ar: `RÈGLE DE LANGUE — ABSOLUE, PRIME SUR TOUT LE RESTE :
Le patient a choisi l'ARABE LITTÉRAIRE (فصحى).
Réponds EXCLUSIVEMENT en arabe standard moderne, clair et accessible.
N'emploie AUCUNE tournure dialectale algérienne : ni « واش راك »، ni « وين »، ni « ماتخافش »، ni « كيفاش »، ni « شحال »، ni « برك ».
N'emploie pas le français, sauf pour un terme médical sans équivalent courant.
Même si le patient écrit en dialecte ou en français, tu réponds en arabe littéraire.`,

  fr: `RÈGLE DE LANGUE — ABSOLUE, PRIME SUR TOUT LE RESTE :
Le patient a choisi le FRANÇAIS.
Réponds EXCLUSIVEMENT en français, dans une langue simple, chaleureuse et vouvoyée.
N'écris AUCUN mot en arabe, pas même une salutation.
Même si le patient écrit en arabe ou en dialecte, tu réponds en français.`,
};

/**
 * Extrait le marqueur d'orientation d'une réponse du modèle.
 * Renvoie le texte nettoyé et, si elle est valide, la spécialité reconnue.
 * La comparaison est insensible à la casse et aux accents pour tolérer les
 * approximations du modèle, mais la valeur renvoyée est toujours celle de la
 * liste autorisée — jamais celle produite par le modèle.
 */
function extractOrientation(text) {
  const match = /\[\[\s*ORIENTATION\s*:\s*([^\]]+?)\s*\]\]/i.exec(text || '');
  const reply = (text || '').replace(/\[\[\s*ORIENTATION\s*:[^\]]*\]\]/gi, '').trim();
  if (!match) return { reply, orientation: null };

  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const wanted = norm(match[1]);
  const found = ORIENTATION_SPECIALTIES.find((s) => norm(s) === wanted) || null;
  return { reply, orientation: found };
}

/**
 * Extrait les réponses rapides proposées par le modèle.
 * Renvoie le texte nettoyé et au plus quatre options courtes.
 * Les options sont bornées en nombre et en longueur : le modèle propose,
 * mais ne décide pas de la taille de ce qui s'affiche à l'écran.
 */
function extractOptions(text) {
  const match = /\[\[\s*OPTIONS\s*:\s*([^\]]+?)\s*\]\]/i.exec(text || '');
  const reply = (text || '').replace(/\[\[\s*OPTIONS\s*:[^\]]*\]\]/gi, '').trim();
  if (!match) return { reply, options: [] };

  const options = match[1]
    .split('|')
    .map((o) => o.trim().replace(/\s+/g, ' ').slice(0, 60))
    .filter((o) => o.length > 0)
    .slice(0, 4);

  return { reply, options };
}

// POST /api/assistant/chat - Dialogue avec l'assistant santé
// Réservé aux patients connectés : la conversation porte sur des symptômes,
// donc sur des données de santé. On ne les traite pas pour un visiteur anonyme.
app.post('/api/assistant/chat', authenticatePatientToken, async (req, res) => {
  try {
    const { messages, lang } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages requis' });
    }

    // Le français est le repli : c'est la langue par défaut de l'interface.
    const langKey = ['ar', 'fr'].includes(lang) ? lang : 'fr';

    if (!AI_API_KEY) {
      return res.status(503).json({
        error: 'assistant_non_configuré',
        reply: "L'assistant n'est pas encore configuré (clé API manquante). Veuillez réessayer plus tard.",
      });
    }

    // On ne garde que les 12 derniers échanges pour limiter la taille du contexte
    const trimmed = messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-12)
      .map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) }));

    const payload = {
      model: AI_MODEL,
      messages: [
        // La consigne de langue est rappelée deux fois : en fin de prompt
        // système, puis en tout dernier message. Les modèles suivent mieux
        // les instructions proches de la fin du contexte.
        { role: 'system', content: `${ASSISTANT_SYSTEM_PROMPT}\n\n${LANGUAGE_INSTRUCTIONS[langKey]}` },
        ...trimmed,
        { role: 'system', content: LANGUAGE_INSTRUCTIONS[langKey] },
      ],
      temperature: 0.3,
      // Plafond bas assumé : la consigne impose une à deux phrases. Un plafond
      // élevé laissait le modèle dériver vers de longs paragraphes.
      max_tokens: 220,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let aiRes;
    try {
      aiRes = await fetch(`${AI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${AI_API_KEY}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!aiRes.ok) {
      const detail = await aiRes.text().catch(() => '');
      console.error('Erreur API IA:', aiRes.status, detail.slice(0, 300));
      return res.status(502).json({ error: 'Service IA indisponible', reply: "Désolé, je rencontre un problème technique. Réessayez dans un instant." });
    }

    const data = await aiRes.json();
    const raw = data?.choices?.[0]?.message?.content?.trim() || "Je n'ai pas de réponse pour le moment.";

    // Le marqueur est retiré du texte affiché et la spécialité est validée
    // contre la liste autorisée avant d'être renvoyée au client.
    // Les deux marqueurs sont retirés du texte affiché, dans cet ordre.
    const step1 = extractOrientation(raw);
    const step2 = extractOptions(step1.reply);

    // Une orientation clôt la conversation : on n'affiche plus d'options,
    // même si le modèle en a produit malgré la consigne.
    const options = step1.orientation ? [] : step2.options;

    // `lang` est renvoyé pour pouvoir vérifier, depuis l'onglet réseau du
    // navigateur, quelle consigne a réellement été appliquée. Si ce champ est
    // absent de la réponse, le backend déployé est une version antérieure.
    res.json({ reply: step2.reply, orientation: step1.orientation, options, lang: langKey });
  } catch (error) {
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Délai dépassé', reply: 'La réponse a mis trop de temps. Réessayez.' });
    }
    console.error('Erreur assistant:', error);
    res.status(500).json({ error: 'Erreur serveur', reply: 'Une erreur est survenue.' });
  }
});

// POST /api/admin/daily-agendas - Déclenche manuellement l'envoi des agendas (test)
// Body optionnel : { date: 'YYYY-MM-DD', doctorId: number }
app.post('/api/admin/daily-agendas', authenticateToken, async (req, res) => {
  try {
    const { date, doctorId } = req.body || {};
    const summary = await sendDailyAgendas({ date, doctorId: doctorId ? Number(doctorId) : undefined });
    res.json(summary);
  } catch (error) {
    console.error('Erreur envoi agendas (manuel):', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Route de test / vérification de déploiement.
// `features` permet de savoir en un coup d'œil quelle version tourne
// réellement sur Render, sans avoir à lire les logs.
app.get('/', async (req, res) => {
  res.json({
    message: 'API chifak fonctionne ! 🏥',
    features: {
      assistantLangChoice: true,
      assistantOrientation: true,
      assistantRequiresPatientAuth: true,
    },
  });
});

// 404 pour les routes API inconnues
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Route introuvable' });
});

// Gestionnaire d'erreurs global : toute erreur non capturée renvoie une 500 propre
// au lieu de faire tomber la requête (ou le process).
app.use((err, req, res, next) => {
  console.error('Erreur non gérée:', err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: 'Erreur serveur' });
});

// Filets de sécurité au niveau du process : on log sans tuer le serveur brutalement.
process.on('unhandledRejection', (reason) => {
  console.error('Rejet de promesse non géré:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Exception non capturée:', err);
});

// Démarrer le serveur
initDatabase()
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log(`\n🚀 Serveur chifak démarré sur http://localhost:${PORT}`);
      console.log(`📊 Base de données: PostgreSQL`);
      console.log(`\n✅ Prêt à recevoir des requêtes!\n`);
    });
    // Laisse plus de temps aux connexions lentes (mobiles) avant de couper.
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;

    // Envoi automatique de l'agenda du jour à chaque médecin, tous les matins à 5h00 (heure d'Alger).
    const AGENDA_TZ = process.env.AGENDA_TIMEZONE || 'Africa/Algiers';
    if (cron.validate('0 5 * * *')) {
      cron.schedule('0 5 * * *', async () => {
        console.log('⏰ Envoi des agendas quotidiens (5h00)...');
        try {
          await sendDailyAgendas();
        } catch (err) {
          console.error('Erreur envoi agendas planifiés:', err);
        }
      }, { timezone: AGENDA_TZ });
      console.log(`🗓️  Agendas quotidiens planifiés à 05:00 (${AGENDA_TZ})`);
    }
  })
  .catch((err) => {
    console.error('❌ Échec de l\'initialisation de la base de données:', err);
    process.exit(1);
  });
