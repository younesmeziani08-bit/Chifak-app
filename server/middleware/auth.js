/**
 * Authentification par jeton, un middleware par population.
 * Chaque middleware vérifie le TYPE du jeton : un jeton patient ne peut pas
 * ouvrir une route d'administration, et réciproquement.
 */
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import db from '../database.js';


// Middleware d'authentification du personnel (admin / employé).
// SÉCURITÉ : on vérifie explicitement le type ET le rôle du jeton.
/* Empreinte bcrypt d'une valeur aléatoire jetée à la création. Ne sert qu'à
   égaliser le temps de réponse quand un identifiant n'existe pas. */
export const EMPREINTE_FACTICE = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10);

/**
 * Le jeton est-il antérieur au dernier changement d'identifiant ?
 *
 * `iat` est en secondes, la date en millisecondes. On accorde une seconde de
 * marge : le jeton rendu par une route de changement porte le même instant que
 * l'écriture, et l'arrondi à la seconde le ferait sinon rejeter aussitôt émis.
 */
function jetonPerime(iat, changeLe) {
  if (!changeLe || !iat) return false;
  return iat * 1000 + 1000 < new Date(changeLe).getTime();
}

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
  jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] }, async (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token invalide' });
    }
    if (user.type !== 'staff') {
      return res.status(403).json({ error: 'Accès réservé à l\'administration' });
    }

    /* ── Le compte existe-t-il encore, et avec quels droits ? ──

       Ce contrôle n'existait pas. Le middleware se contentait de la signature
       et du rôle ANNONCÉ PAR LE JETON. Trois conséquences :

       · congédier quelqu'un ne fermait rien. `DELETE /api/admin/employees/:id`
         retirait la ligne, et le jeton continuait d'ouvrir toute l'API
         d'administration jusqu'à son expiration — vingt-quatre heures pour
         lire les rendez-vous de tous les praticiens et les coordonnées de
         leurs patients, créer ou modifier des fiches ;
       · régénérer le numéro de connexion d'un employé ne coupait pas sa
         session, alors que c'est le geste qu'on fait justement quand on le
         soupçonne d'être compromis ;
       · le rôle voyageait dans le jeton, donc restait figé à ce qu'il valait
         à la connexion.

       Le rôle est désormais relu en base et écrase celui du jeton. Le coût est
       une lecture par requête d'administration — ce n'est pas le chemin chaud
       du service, l'annuaire public ne passe pas par ici. */
    try {
      const compte = await db.prepare(
        'SELECT id, role, password_changed_at FROM users WHERE id = ?',
      ).get(user.id);

      if (!compte) {
        return res.status(403).json({ error: 'Compte introuvable ou supprimé' });
      }
      if (!['admin', 'employee'].includes(compte.role)) {
        return res.status(403).json({ error: 'Accès réservé à l\'administration' });
      }
      if (jetonPerime(user.iat, compte.password_changed_at)) {
        return res.status(403).json({
          error: 'Session expirée : vos identifiants ont été modifiés. Reconnectez-vous.',
          identifiantsModifies: true,
        });
      }

      // Le rôle vient de la base, jamais du jeton.
      req.user = { ...user, role: compte.role };
    } catch (e) {
      console.error('Contrôle du compte personnel impossible:', e.message);
      return res.status(500).json({ error: 'Erreur serveur' });
    }

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

  jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] }, async (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token invalide' });
    }
    if (user.type !== 'patient') {
      return res.status(403).json({ error: 'Accès réservé aux patients' });
    }

    /* ── Le jeton survit-il au compte ? ──
       Un jeton vaut vingt-quatre heures et rien ne pouvait l'annuler. Deux
       conséquences que ce contrôle referme :

       · quelqu'un qui reprend la main sur son compte après une intrusion
         laissait l'intrus dedans pour le reste de la journée. Changer son mot
         de passe ne servait donc à rien tant que le jeton volé vivait ;
       · un compte effacé continuait d'ouvrir toutes les routes jusqu'à
         expiration.

       Le coût est une lecture par requête authentifiée. Les routes patient ne
       sont pas le chemin chaud du service — l'annuaire public, lui, ne passe
       pas par ici. */
    try {
      const compte = await db.prepare(
        'SELECT deleted_at, password_changed_at FROM patients WHERE email = ?',
      ).get(String(user.email || '').toLowerCase());

      if (!compte || compte.deleted_at) {
        return res.status(403).json({ error: 'Compte introuvable ou supprimé' });
      }

      if (jetonPerime(user.iat, compte.password_changed_at)) {
        return res.status(403).json({
          error: 'Session expirée : le mot de passe a été modifié. Reconnectez-vous.',
          motDePasseModifie: true,
        });
      }
    } catch (e) {
      console.error('Contrôle du compte patient impossible:', e.message);
      return res.status(500).json({ error: 'Erreur serveur' });
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

  jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] }, async (err, user) => {
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

    /* ── La fiche existe-t-elle encore, et le jeton la précède-t-il ? ──

       Comme pour le personnel, ce contrôle manquait. Un praticien qui changeait
       son mot de passe parce qu'il le savait compromis ne délogeait personne :
       le jeton volé gardait son agenda, ses dossiers de consultation et les
       coordonnées de ses patients jusqu'au lendemain. La manœuvre était donc
       vide de sens, ce qui est pire que de ne pas la proposer.

       Une fiche supprimée est retirée en dur de la table : l'absence de ligne
       suffit à fermer l'accès. */
    try {
      const fiche = await db.prepare(
        'SELECT id, password_changed_at FROM doctors WHERE id = ?',
      ).get(user.id);

      if (!fiche) {
        return res.status(403).json({ error: 'Compte introuvable ou supprimé' });
      }
      if (jetonPerime(user.iat, fiche.password_changed_at)) {
        return res.status(403).json({
          error: 'Session expirée : le mot de passe a été modifié. Reconnectez-vous.',
          motDePasseModifie: true,
        });
      }
    } catch (e) {
      console.error('Contrôle du compte praticien impossible:', e.message);
      return res.status(500).json({ error: 'Erreur serveur' });
    }

    req.user = user;
    next();
  });
};
