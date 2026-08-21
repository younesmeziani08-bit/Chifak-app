/**
 * Freinage des tentatives de connexion.
 *
 * Le point qui compte : le compteur porte sur le COMPTE visé, pas sur
 * l'adresse IP. Derrière le NAT d'un opérateur mobile algérien, des milliers
 * d'abonnés partagent une adresse — un plafond par IP y bloquerait des
 * innocents sans gêner l'attaquant, qui change d'adresse à volonté.
 */
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

const { attenteRequise, noterEchec, oublierEchecs } = await import('../lib/tentatives.js');

/** Chaque test travaille sur un compte qui lui est propre : pas d'interférence. */
let n = 0;
const compte = () => `essai-${++n}@ex.dz`;

describe('Paliers', () => {
  test('un compte neuf peut tenter sa chance', async () => {
    assert.equal(await attenteRequise('patient', compte()), 0);
  });

  test('quatre échecs ne bloquent pas — une erreur de frappe est honnête', async () => {
    const c = compte();
    for (let i = 0; i < 4; i++) await noterEchec('patient', c);
    assert.equal(await attenteRequise('patient', c), 0);
  });

  test('le délai croît avec l\'acharnement, sans jamais être définitif', async () => {
    const c = compte();
    const paliers = [[5, 30], [8, 300], [12, 900], [20, 3600]];
    let poses = 0;
    for (const [seuil, attendu] of paliers) {
      while (poses < seuil) { await noterEchec('patient', c); poses++; }
      assert.equal(await attenteRequise('patient', c), attendu, `au ${seuil}e échec`);
    }
  });
});

describe('Cloisonnement', () => {
  before(async () => {
    for (let i = 0; i < 25; i++) await noterEchec('patient', 'cible@ex.dz');
  });

  test('un compte bloqué n\'affecte pas ses voisins', async () => {
    assert.equal(await attenteRequise('patient', 'voisin@ex.dz'), 0,
      'le blocage doit viser le compte, pas tous les usagers du même opérateur');
  });

  test('les populations sont séparées', async () => {
    assert.equal(await attenteRequise('staff', 'cible@ex.dz'), 0);
    assert.equal(await attenteRequise('doctor', 'cible@ex.dz'), 0);
  });

  test('la casse ne permet pas de contourner', async () => {
    assert.equal(await attenteRequise('patient', 'CIBLE@EX.DZ'), 3600);
  });

  test('une connexion réussie efface l\'ardoise', async () => {
    await oublierEchecs('patient', 'cible@ex.dz');
    assert.equal(await attenteRequise('patient', 'cible@ex.dz'), 0);
  });
});

test('cent tentatives simultanées comptent bien cent échecs', async () => {
  const c = compte();
  await Promise.all(Array.from({ length: 100 }, () => noterEchec('staff', c)));
  assert.equal(await attenteRequise('staff', c), 3600);
});
