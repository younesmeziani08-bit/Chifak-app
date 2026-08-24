/**
 * Les adresses publiques du service.
 *
 * ── Ce qui était cassé ──
 *
 * `process.env.FRONTEND_URL || 'http://localhost:5173'` était recopié dans
 * sept fichiers. En production, la variable n'était pas renseignée : le repli
 * s'appliquait donc pour de vrai. Le retour de connexion Google renvoyait le
 * patient sur localhost, et le lien d'annulation de chaque courrier de
 * confirmation pointait au même endroit.
 *
 * Le diagnostic annonçait « Connexion Google : prête ». Elle l'était — c'est
 * le retour qui n'atterrissait nulle part. Un repli vers localhost en
 * production n'est pas un repli, c'est une panne invisible.
 *
 * ── Et l'en-tête Host ──
 *
 * L'adresse des photos était bâtie sur `req.get('host')`, que le CLIENT écrit.
 * Appeler l'annuaire avec « Host: ailleurs.example » faisait répondre des
 * adresses d'images pointant là-bas — mises en cache un an, puisque c'est tout
 * l'intérêt de l'empreinte en paramètre.
 */
import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const initial = { ...process.env };
afterEach(() => {
  for (const c of ['NODE_ENV', 'FRONTEND_URL', 'PUBLIC_API_URL']) {
    if (initial[c] === undefined) delete process.env[c];
    else process.env[c] = initial[c];
  }
});

/* Le module lit process.env à chaque appel, pas au chargement : une seule
   importation suffit pour éprouver les deux environnements. */
const { adresseFront, adresseApi } = await import('../config/adresses.js');

/** Une requête réduite à ce que la fonction en lit. */
const requete = (host, protocol = 'http') => ({ protocol, get: () => host });

describe('Adresse du site', () => {
  test('la variable prime toujours', () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'https://exemple.dz';
    assert.equal(adresseFront(), 'https://exemple.dz');
  });

  test('le slash final est retiré, pour ne pas doubler celui du chemin', () => {
    process.env.FRONTEND_URL = 'https://exemple.dz/';
    assert.equal(adresseFront(), 'https://exemple.dz',
      'sinon les liens deviennent https://exemple.dz//rdv/<jeton>');
  });

  test('en PRODUCTION sans variable, jamais localhost', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.FRONTEND_URL;
    const a = adresseFront();
    assert.doesNotMatch(a, /localhost/,
      'c\'est le bug : le retour de connexion Google renvoyait le patient sur sa propre machine');
    assert.match(a, /^https:\/\//);
  });

  test('en développement, localhost reste le bon défaut', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.FRONTEND_URL;
    assert.equal(adresseFront(), 'http://localhost:5173');
  });

  test('une variable vide ou blanche ne compte pas pour renseignée', () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = '   ';
    assert.doesNotMatch(adresseFront(), /localhost/);
    assert.match(adresseFront(), /^https:\/\//);
  });
});

describe('Adresse de l\'API', () => {
  test('la variable prime sur l\'en-tête Host', () => {
    process.env.NODE_ENV = 'production';
    process.env.PUBLIC_API_URL = 'https://api.exemple.dz';
    assert.equal(adresseApi(requete('malveillant.example')), 'https://api.exemple.dz');
  });

  test('en PRODUCTION, l\'en-tête Host n\'est jamais suivi', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.PUBLIC_API_URL;
    const a = adresseApi(requete('malveillant.example'));
    assert.doesNotMatch(a, /malveillant/,
      'le client écrit cet en-tête ; le suivre laissait empoisonner des adresses mises en cache un an');
    assert.match(a, /^https:\/\//);
  });

  test('en développement, l\'en-tête Host reste la seule façon de connaître le port', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.PUBLIC_API_URL;
    assert.equal(adresseApi(requete('127.0.0.1:5000')), 'http://127.0.0.1:5000');
  });
});
