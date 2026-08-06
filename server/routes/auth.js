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
import passport from '../passport-config.js';
import { generateVerificationCode, sendVerificationEmail } from '../emailService.js';
import {
  EMPREINTE_FACTICE, authenticateToken, authenticatePatientToken,
  authenticateDoctorToken,
} from '../middleware/auth.js';

const router = express.Router();

// ==================== ROUTES AUTH ====================

// POST /api/auth/login - Connexion employé
router.post('/api/auth/login', async (req, res) => {
  try {
    const username = cleanString(req.body.username, 64);
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    // Bornes : bcrypt sur une chaîne d'un mégaoctet est un déni de service
    // gratuit ; aucun mot de passe légitime ne dépasse 200 caractères.
    if (!username || !password || password.length > 200) {
      return res.status(400).json({ error: 'Username et password requis' });
    }

    const user = await db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    /* Compte inexistant : on compare quand même, contre une empreinte factice.
       Sans cela, la réponse « identifiant inconnu » revenait en 2 ms et la
       réponse « mot de passe faux » en 80 ms — un chronomètre suffisait à
       dresser la liste des identifiants valides. */
    if (!user) {
      await bcrypt.compare(password, EMPREINTE_FACTICE);
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
router.post('/api/auth/login-doctor', async (req, res) => {
  try {
    const doctorCode = cleanString(req.body.doctorCode, 64);
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!doctorCode) {
      return res.status(400).json({ error: 'Code médecin requis' });
    }

    const doctor = await db.prepare(`
      SELECT id, name, specialty, doctor_code, email, password, must_change_password
      FROM doctors WHERE doctor_code = ?
    `).get(doctorCode);

    // Message volontairement identique pour ne pas révéler si le code existe
    if (!doctor) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    /* Un compte sans mot de passe ne peut PAS se connecter. L'ancien code
       laissait entrer sur le seul code médecin — un identifiant attribué par
       l'administration, ni secret ni aléatoire. Le tableau de bord admin
       signale ces comptes ; l'admin doit définir un mot de passe initial. */
    if (!doctor.password) {
      await bcrypt.compare(password || 'x', EMPREINTE_FACTICE);
      return res.status(401).json({
        error: 'Compte non activé. Demandez à l\'administration de définir votre mot de passe initial.',
      });
    }

    if (!password || password.length > 200) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }
    const ok = await bcrypt.compare(password, doctor.password);
    if (!ok) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
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
router.post('/api/doctor/change-password', authenticateDoctorToken, async (req, res) => {
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
    if (currentPassword && isTooSimilar(currentPassword, newPassword)) {
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
router.get('/api/auth/verify', authenticateToken, async (req, res) => {
  res.json({ user: req.user });
});

// ==================== ROUTES PATIENTS (EMAIL + OAUTH) ====================

// POST /api/auth/register - Inscription avec email (envoie code de vérification)
router.post('/api/auth/register', async (req, res) => {
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

    // Envoyer l'email — s'il ne part pas, on ne crée pas un compte que
    // personne ne pourra jamais vérifier.
    const envoye = await sendVerificationEmail(email, code, language || 'fr');
    if (!envoye) {
      return res.status(502).json({ error: 'Impossible d\'envoyer le code de vérification. Réessayez dans quelques minutes.' });
    }

    // Sauvegarder temporairement l'utilisateur (non vérifié)
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.prepare(`
      INSERT INTO patients (email, name, password, is_verified)
      VALUES (?, ?, ?, 0)
    `).run(email, name, hashedPassword);


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
router.post('/api/auth/verify-code', async (req, res) => {
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
router.post('/api/auth/login-patient', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!isValidEmail(email) || !password || password.length > 200) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    /* Compte de démonstration : développement UNIQUEMENT. En production,
       cette recréation automatique était une porte dérobée permanente — un
       mot de passe publié dans le dépôt, impossible à désactiver puisque le
       compte renaissait à chaque tentative. */
    if (process.env.NODE_ENV !== 'production') {
      const demoEmail = 'demo.patient@chifak.dz';
      if (email === demoEmail && password === 'patient123') {
        const existingDemo = await db.prepare('SELECT id FROM patients WHERE email = ?').get(demoEmail);
        if (!existingDemo) {
          const hashed = await bcrypt.hash(password, 10);
          await db.prepare(`
            INSERT INTO patients (email, name, password, is_verified)
            VALUES (?, ?, ?, 1)
          `).run(demoEmail, 'Patient Demo', hashed);
        }
      }
    }

    const patient = await db.prepare('SELECT * FROM patients WHERE email = ?').get(email);

    if (!patient || !patient.password) {
      // Même durée de réponse qu'un mot de passe faux : voir la connexion employé.
      await bcrypt.compare(password, EMPREINTE_FACTICE);
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
router.post('/api/auth/resend-code', async (req, res) => {
  try {
    const { language } = req.body;
    const email = normalizeEmail(req.body.email);

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Email requis' });
    }

    const patient = await db.prepare('SELECT id, is_verified FROM patients WHERE email = ?').get(email);

    /* Réponse identique que le compte existe, soit déjà vérifié, ou n'existe
       pas : cette route est publique, elle ne doit pas servir d'annuaire des
       inscrits. On n'envoie évidemment de code qu'au compte réel non vérifié. */
    if (!patient || patient.is_verified) {
      return res.json({ message: 'Si un compte non vérifié existe pour cette adresse, un code a été envoyé.' });
    }

    // Générer un nouveau code
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.prepare(`
      INSERT INTO verification_codes (email, code, expires_at)
      VALUES (?, ?, ?)
    `).run(email, code, expiresAt.toISOString());

    await sendVerificationEmail(email, code, language || 'fr');

    res.json({ message: 'Si un compte non vérifié existe pour cette adresse, un code a été envoyé.' });
  } catch (error) {
    console.error('Erreur renvoi code:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/patient/profile - Profil patient connecté
router.get('/api/patient/profile', authenticatePatientToken, async (req, res) => {
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
router.put('/api/patient/profile', authenticatePatientToken, async (req, res) => {
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
router.post('/api/patient/recharge', authenticatePatientToken, async (req, res) => {
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
router.get('/api/auth/google', (req, res, next) => {
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

router.get('/api/auth/google/callback',
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
router.get('/api/auth/facebook', (req, res, next) => {
  if (!isFacebookOAuthReady()) {
    return res.redirect(`${frontendUrl()}/?oauth=unconfigured&provider=facebook`);
  }
  const state = req.query.redirect === 'app' ? 'app' : 'web';
  passport.authenticate('facebook', { scope: ['email'], state })(req, res, next);
});

router.get('/api/auth/facebook/callback',
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

export default router;
