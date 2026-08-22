/**
 * Double authentification du personnel.
 *
 * Quatre routes, et une règle qui les gouverne : le mot de passe seul ne
 * donne plus rien. La connexion s'arrête à un jeton intermédiaire — que
 * AUCUN middleware n'accepte — et seul le code à six chiffres le transforme
 * en session utilisable.
 *
 * L'activation est volontairement à la main de chaque personne : elle scanne
 * ou recopie son secret, prouve qu'elle sait produire un code, et reçoit
 * alors ses codes de secours. Tant que la preuve n'est pas faite, rien n'est
 * activé — sinon on enfermerait dehors quelqu'un qui aurait mal recopié.
 */
import express from 'express';
import jwt from 'jsonwebtoken';
import db from '../database.js';
import { authenticateToken } from '../middleware/auth.js';
import { authLimiter } from '../config/limiters.js';
import { refuseSiFreine, noterEchec, oublierEchecs } from '../lib/tentatives.js';
import {
  genererSecret, verifierCode, adresseOtpauth, secretLisible,
  chiffrerSecret, dechiffrerSecret,
  genererCodesDeSecours, empreinteCodeDeSecours,
} from '../lib/totp.js';

const router = express.Router();

const lireJson = (brut, repli) => { try { return JSON.parse(brut ?? ''); } catch { return repli; } };

/**
 * POST /api/auth/login-2fa — second temps de la connexion.
 *
 * Reçoit le jeton intermédiaire et le code. Rend la vraie session.
 */
router.post('/api/auth/login-2fa', authLimiter, async (req, res) => {
  try {
    const { jetonIntermediaire, code } = req.body;
    if (!jetonIntermediaire || !code) {
      return res.status(400).json({ error: 'Code requis.' });
    }

    let porteur;
    try {
      porteur = jwt.verify(jetonIntermediaire, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    } catch {
      // Cinq minutes écoulées, ou jeton forgé : on renvoie à la case départ.
      return res.status(401).json({ error: 'Session expirée. Recommencez la connexion.' });
    }
    if (porteur.type !== 'staff-pending') {
      return res.status(401).json({ error: 'Jeton invalide.' });
    }

    // Le freinage porte sur le compte visé, pas sur l'adresse IP : voir
    // lib/tentatives.js. Un million de codes possibles se forcent vite sans lui.
    if (await refuseSiFreine(res, 'staff', porteur.username)) return;

    const user = await db.prepare(`
      SELECT id, username, role, totp_secret, totp_enabled, totp_last_counter, totp_backup_codes
      FROM users WHERE id = ?
    `).get(porteur.id);

    if (!user || !user.totp_enabled || !user.totp_secret) {
      return res.status(401).json({ error: 'Double authentification non configurée.' });
    }

    const secret = dechiffrerSecret(user.totp_secret);
    const compteur = verifierCode(secret, code, {
      dernierCompteur: user.totp_last_counter !== null ? Number(user.totp_last_counter) : null,
    });

    if (compteur !== null) {
      /* Le compteur accepté est mémorisé : le même code ne repassera plus.
         Sans cela, un code lu par-dessus l'épaule reste valable une minute
         et demie. */
      await db.prepare('UPDATE users SET totp_last_counter = ? WHERE id = ?').run(compteur, user.id);
    } else {
      /* ── Code refusé : peut-être un code de secours ? ──
         Consommation ATOMIQUE, en un seul ordre.

         La séquence « lire la liste, retirer l'élément, réécrire la liste »
         laissait passer deux requêtes simultanées portant le même code :
         toutes deux lisaient une liste qui le contenait encore, toutes deux
         obtenaient une session. L'usage unique n'existait que tant que
         personne n'essayait deux fois en même temps — c'est-à-dire qu'il
         n'existait pas, puisque c'est précisément ce que fait un attaquant
         qui a intercepté un code.

         Ici PostgreSQL sérialise les écritures sur la ligne : la première
         requête retire le code, la seconde ne trouve plus rien à retirer et
         `jsonb_exists` la fait repartir sans aucune ligne.

         `jsonb_exists(…)` plutôt que l'opérateur `?` : il dit exactement la
         même chose sans dépendre de l'analyse des marqueurs (voir toPg dans
         database.js). */
      const empreinte = empreinteCodeDeSecours(code);
      const consomme = await db.prepare(`
        UPDATE users SET totp_backup_codes = COALESCE((
          SELECT jsonb_agg(t.c)::text
          FROM jsonb_array_elements_text(totp_backup_codes::jsonb) AS t(c)
          WHERE t.c <> ?
        ), '[]')
        WHERE id = ? AND jsonb_exists(totp_backup_codes::jsonb, ?)
        RETURNING totp_backup_codes
      `).get(empreinte, user.id, empreinte);

      if (!consomme) {
        await noterEchec('staff', porteur.username);
        return res.status(401).json({ error: 'Code incorrect.' });
      }
      const restants = lireJson(consomme.totp_backup_codes, []);
      console.warn(`⚠️  Code de secours utilisé par ${user.username} — il en reste ${restants.length}.`);
    }

    await oublierEchecs('staff', porteur.username);

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, type: 'staff' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    const codesRestants = lireJson(
      (await db.prepare('SELECT totp_backup_codes FROM users WHERE id = ?').get(user.id))?.totp_backup_codes,
      []
    ).length;

    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role },
      // Prévenir quand la réserve s'épuise, avant qu'elle soit vide.
      codesDeSecoursRestants: codesRestants,
    });
  } catch (error) {
    console.error('Erreur second facteur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/staff/2fa — état de MON second facteur.
 * Chacun ne voit que le sien : le paramètre vient du jeton, jamais de l'URL.
 */
router.get('/api/staff/2fa', authenticateToken, async (req, res) => {
  try {
    const u = await db.prepare(
      'SELECT totp_enabled, totp_enrolled_at, totp_backup_codes FROM users WHERE id = ?'
    ).get(req.user.id);
    res.json({
      actif: !!u?.totp_enabled,
      activeLe: u?.totp_enrolled_at || null,
      codesDeSecoursRestants: lireJson(u?.totp_backup_codes, []).length,
    });
  } catch (error) {
    console.error('Erreur lecture second facteur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/staff/2fa/preparer — tirer un secret et l'afficher.
 *
 * Le secret est enregistré mais l'activation reste à 0 : tant que la personne
 * n'a pas prouvé qu'elle sait produire un code, sa connexion continue de
 * fonctionner sans second facteur. C'est ce qui évite de l'enfermer dehors
 * après une recopie approximative.
 */
router.post('/api/staff/2fa/preparer', authenticateToken, async (req, res) => {
  try {
    const u = await db.prepare('SELECT username, totp_enabled FROM users WHERE id = ?').get(req.user.id);
    if (u?.totp_enabled) {
      return res.status(409).json({ error: 'La double authentification est déjà active sur ce compte.' });
    }

    const secret = genererSecret();
    await db.prepare('UPDATE users SET totp_secret = ?, totp_last_counter = NULL WHERE id = ?')
      .run(chiffrerSecret(secret), req.user.id);

    /* L'adresse otpauth et le secret repartent vers le navigateur de la
       personne concernée, et nulle part ailleurs — surtout pas vers un
       service tiers de génération de QR, qui recevrait le second facteur. */
    res.json({
      secret: secretLisible(secret),
      adresse: adresseOtpauth({ secret, compte: u.username }),
    });
  } catch (error) {
    console.error('Erreur préparation second facteur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/staff/2fa/activer — prouver, puis activer.
 * Rend les codes de secours, affichés une seule fois.
 */
router.post('/api/staff/2fa/activer', authenticateToken, async (req, res) => {
  try {
    const u = await db.prepare(
      'SELECT username, totp_secret, totp_enabled FROM users WHERE id = ?'
    ).get(req.user.id);

    if (u?.totp_enabled) {
      return res.status(409).json({ error: 'Déjà active.' });
    }
    if (!u?.totp_secret) {
      return res.status(400).json({ error: 'Commencez par préparer la double authentification.' });
    }
    if (await refuseSiFreine(res, 'staff', u.username)) return;

    const compteur = verifierCode(dechiffrerSecret(u.totp_secret), req.body.code);
    if (compteur === null) {
      await noterEchec('staff', u.username);
      return res.status(400).json({
        error: 'Code incorrect. Vérifiez que l\'heure de votre téléphone est à jour.',
      });
    }

    const codes = genererCodesDeSecours();
    await db.prepare(`
      UPDATE users
      SET totp_enabled = 1, totp_enrolled_at = CURRENT_TIMESTAMP,
          totp_last_counter = ?, totp_backup_codes = ?
      WHERE id = ?
    `).run(compteur, JSON.stringify(codes.map(empreinteCodeDeSecours)), req.user.id);

    await oublierEchecs('staff', u.username);

    /* Seuls les codes hachés sont conservés : cette réponse est la seule et
       unique occasion de les lire. On le dit explicitement à l'écran. */
    res.json({ actif: true, codesDeSecours: codes });
  } catch (error) {
    console.error('Erreur activation second facteur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/staff/2fa/desactiver — retirer le second facteur de SON compte.
 *
 * Un code valide est exigé. Sans lui, un jeton volé suffirait à désactiver la
 * protection qu'il est censé franchir — la mesure ne protégerait alors que
 * de quelqu'un qui n'est déjà pas entré.
 */
router.post('/api/staff/2fa/desactiver', authenticateToken, async (req, res) => {
  try {
    const u = await db.prepare(
      'SELECT username, totp_secret, totp_enabled, totp_last_counter FROM users WHERE id = ?'
    ).get(req.user.id);

    if (!u?.totp_enabled) return res.status(400).json({ error: 'Elle n\'est pas active.' });
    if (await refuseSiFreine(res, 'staff', u.username)) return;

    const compteur = verifierCode(dechiffrerSecret(u.totp_secret), req.body.code, {
      dernierCompteur: u.totp_last_counter !== null ? Number(u.totp_last_counter) : null,
    });
    if (compteur === null) {
      await noterEchec('staff', u.username);
      return res.status(400).json({ error: 'Code incorrect.' });
    }

    await db.prepare(`
      UPDATE users
      SET totp_enabled = 0, totp_secret = NULL, totp_last_counter = NULL,
          totp_enrolled_at = NULL, totp_backup_codes = '[]'
      WHERE id = ?
    `).run(req.user.id);

    await oublierEchecs('staff', u.username);
    console.warn(`⚠️  Double authentification désactivée par ${u.username}.`);
    res.json({ actif: false });
  } catch (error) {
    console.error('Erreur désactivation second facteur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
