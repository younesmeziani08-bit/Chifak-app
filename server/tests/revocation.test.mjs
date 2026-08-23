/**
 * Révocation des jetons — personnel et praticiens.
 *
 * ── La brèche que ces essais referment ──
 *
 * Le middleware du personnel ne consultait jamais la base. Il se contentait de
 * vérifier la signature du jeton, puis lisait le rôle ANNONCÉ PAR LE JETON.
 *
 * Trois conséquences, toutes exploitables :
 *
 *   · `DELETE /api/admin/employees/:id` retirait la ligne, et le jeton
 *     continuait d'ouvrir l'API d'administration jusqu'à son expiration.
 *     Congédier quelqu'un lui laissait vingt-quatre heures d'accès aux
 *     rendez-vous de tous les praticiens et aux coordonnées des patients ;
 *   · régénérer le numéro de connexion d'un employé — le geste qu'on fait
 *     quand on le soupçonne d'être compromis — ne coupait pas sa session ;
 *   · un praticien qui changeait son mot de passe après une intrusion n'en
 *     délogeait personne.
 *
 * Les patients étaient protégés depuis longtemps. L'asymétrie était le bug.
 */
import { test, describe, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET ||= 'secret-de-test-suffisamment-long-pour-les-essais-abcdef';
process.env.SESSION_SECRET ||= 'session-de-test-suffisamment-longue-pour-les-essais-abcd';

/* bcrypt est un binaire natif et n'a rien à voir avec ce qu'on vérifie ici. */
const faux = { hashSync: () => '$test$', hash: async () => '$test$', compare: async () => false };
mock.module('bcrypt', { defaultExport: faux, namedExports: faux });

/** La ligne que la base renverra ; `null` simule un compte disparu. */
let ligne = null;

mock.module('../database.js', {
  defaultExport: {
    prepare: () => ({
      get: async () => ligne,
      all: async () => [],
      run: async () => ({ changes: 0 }),
    }),
  },
});

const { authenticateToken, authenticateDoctorToken } = await import('../middleware/auth.js');

/**
 * Fait passer un jeton dans un middleware et rend ce qui s'est produit :
 * soit `next()` a été appelé, soit une réponse a été rendue.
 */
function passer(middleware, charge, { path = '/api/stats' } = {}) {
  const token = jwt.sign(charge, process.env.JWT_SECRET, { expiresIn: '24h' });
  const req = { headers: { authorization: `Bearer ${token}` }, path };
  return new Promise((resolve) => {
    const res = {
      status(code) { this._code = code; return this; },
      json(corps) { resolve({ passe: false, statut: this._code, corps }); },
    };
    middleware(req, res, () => resolve({ passe: true, req }));
  });
}

/** Un instant daté, exprimé comme la base le rendrait. */
const ilYA = (secondes) => new Date(Date.now() - secondes * 1000).toISOString();
const dans = (secondes) => new Date(Date.now() + secondes * 1000).toISOString();

beforeEach(() => { ligne = null; });

describe('Personnel : le compte existe-t-il encore ?', () => {
  test('un compte supprimé ferme l\'accès immédiatement', async () => {
    ligne = null; // `DELETE FROM users` est passé par là
    const r = await passer(authenticateToken, { id: 7, username: '12345678', role: 'admin', type: 'staff' });
    assert.equal(r.passe, false);
    assert.equal(r.statut, 403);
    assert.match(r.corps.error, /introuvable ou supprim/i);
  });

  test('un compte encore présent passe', async () => {
    ligne = { id: 7, role: 'employee', password_changed_at: null };
    const r = await passer(authenticateToken, { id: 7, username: '12345678', role: 'employee', type: 'staff' });
    assert.equal(r.passe, true);
  });
});

describe('Personnel : le rôle vient de la base, jamais du jeton', () => {
  test('un jeton qui se déclare admin ne l\'est pas si la base dit employé', async () => {
    ligne = { id: 7, role: 'employee', password_changed_at: null };
    const r = await passer(authenticateToken, { id: 7, role: 'admin', type: 'staff' });
    assert.equal(r.passe, true, 'l\'accès reste ouvert : employé est un rôle valide');
    assert.equal(r.req.user.role, 'employee',
      'le rôle du jeton doit être écrasé par celui de la base, sinon une rétrogradation ne prend effet qu\'au bout de 24 h');
  });

  test('un rôle inconnu en base est refusé, même annoncé admin par le jeton', async () => {
    ligne = { id: 7, role: 'revoque', password_changed_at: null };
    const r = await passer(authenticateToken, { id: 7, role: 'admin', type: 'staff' });
    assert.equal(r.passe, false);
    assert.equal(r.statut, 403);
  });
});

describe('Personnel : le jeton précède-t-il le changement d\'identifiant ?', () => {
  test('un jeton émis AVANT la régénération du numéro est refusé', async () => {
    ligne = { id: 7, role: 'employee', password_changed_at: dans(60) };
    const r = await passer(authenticateToken, { id: 7, role: 'employee', type: 'staff' });
    assert.equal(r.passe, false);
    assert.equal(r.statut, 403);
    assert.equal(r.corps.identifiantsModifies, true);
  });

  test('un jeton émis APRÈS le changement reste valable', async () => {
    ligne = { id: 7, role: 'employee', password_changed_at: ilYA(3600) };
    const r = await passer(authenticateToken, { id: 7, role: 'employee', type: 'staff' });
    assert.equal(r.passe, true);
  });

  test('aucune date : rien à comparer, le jeton passe', async () => {
    ligne = { id: 7, role: 'admin', password_changed_at: null };
    const r = await passer(authenticateToken, { id: 7, role: 'admin', type: 'staff' });
    assert.equal(r.passe, true);
  });
});

describe('Praticien', () => {
  test('une fiche supprimée ferme l\'agenda et les dossiers', async () => {
    ligne = null;
    const r = await passer(authenticateDoctorToken, { id: 3, name: 'Dr X', type: 'doctor' },
      { path: '/api/doctor/appointments' });
    assert.equal(r.passe, false);
    assert.equal(r.statut, 403);
  });

  test('changer son mot de passe déloge le jeton volé', async () => {
    ligne = { id: 3, password_changed_at: dans(60) };
    const r = await passer(authenticateDoctorToken, { id: 3, name: 'Dr X', type: 'doctor' },
      { path: '/api/doctor/appointments' });
    assert.equal(r.passe, false);
    assert.equal(r.corps.motDePasseModifie, true);
  });

  test('le jeton rendu PAR la route de changement n\'est pas rejeté aussitôt émis', async () => {
    /* La route écrit `CURRENT_TIMESTAMP` et signe dans la foulée. `iat` étant
       arrondi à la seconde, il peut se retrouver un instant derrière la date
       d'écriture — d'où la marge d'une seconde dans le middleware. */
    ligne = { id: 3, password_changed_at: new Date().toISOString() };
    const r = await passer(authenticateDoctorToken, { id: 3, name: 'Dr X', type: 'doctor' },
      { path: '/api/doctor/appointments' });
    assert.equal(r.passe, true, 'sans la marge d\'une seconde, changer son mot de passe déconnecterait celui qui vient de le faire');
  });

  test('un jeton de praticien n\'ouvre pas les routes du personnel', async () => {
    ligne = { id: 3, role: 'admin', password_changed_at: null };
    const r = await passer(authenticateToken, { id: 3, type: 'doctor' });
    assert.equal(r.passe, false);
    assert.equal(r.statut, 403);
  });

  test('le mot de passe initial non changé barre tout sauf la route de changement', async () => {
    ligne = { id: 3, password_changed_at: null };
    const barre = await passer(authenticateDoctorToken,
      { id: 3, type: 'doctor', mustChangePassword: true }, { path: '/api/doctor/appointments' });
    assert.equal(barre.passe, false);
    assert.equal(barre.corps.mustChangePassword, true);

    const permis = await passer(authenticateDoctorToken,
      { id: 3, type: 'doctor', mustChangePassword: true }, { path: '/api/doctor/change-password' });
    assert.equal(permis.passe, true);
  });
});
