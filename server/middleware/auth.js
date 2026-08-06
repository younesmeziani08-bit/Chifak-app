/**
 * Authentification par jeton, un middleware par population.
 * Chaque middleware vérifie le TYPE du jeton : un jeton patient ne peut pas
 * ouvrir une route d'administration, et réciproquement.
 */
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

// La base est initialisée au démarrage (voir en bas du fichier).

// Middleware d'authentification du personnel (admin / employé).
// SÉCURITÉ : on vérifie explicitement le type ET le rôle du jeton.
/* Empreinte bcrypt d'une valeur aléatoire jetée à la création. Ne sert qu'à
   égaliser le temps de réponse quand un identifiant n'existe pas. */
export const EMPREINTE_FACTICE = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10);

// Sans ce contrôle, un jeton de patient ou de médecin donnerait accès
// aux routes d'administration (création/suppression de médecins, etc.).
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  // Algorithme épinglé : sans cette précision, la bibliothèque accepte tout
  // algorithme annoncé DANS le jeton lui-même. Un attaquant choisirait alors
  // le sien. On n'accepte que celui avec lequel nous signons.
  jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] }, (err, user) => {
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
export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
  }
  next();
};

export const authenticatePatientToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] }, (err, user) => {
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

export const authenticateDoctorToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] }, (err, user) => {
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
