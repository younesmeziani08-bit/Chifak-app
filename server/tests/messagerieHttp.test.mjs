/**
 * Envoi des courriers par l'API d'un fournisseur.
 *
 * ── Pourquoi cette voie a dû être ouverte ──
 *
 * Le service n'envoyait que par SMTP, et en pratique par Gmail. Gmail plafonne
 * à quelques centaines d'envois par jour et coupe sans prévenir ce qu'il juge
 * automatique ; certains hébergements bloquent en plus les ports SMTP
 * sortants. Sur un service de rendez-vous médicaux qui envoie un courrier à
 * chaque inscription, chaque réservation et chaque rappel, ce n'est pas un
 * régime de croisière.
 *
 * Ce qui est éprouvé ici, c'est la FORME des requêtes. Chaque fournisseur
 * attend son propre corps JSON, et une clé mal nommée se solde par un refus
 * silencieux — le courrier ne part pas, personne ne s'inscrit, et le journal
 * ne dit rien d'exploitable.
 */
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  decouperExpediteur, fournisseurHttp, messagerieHttpConfiguree,
  envoyerParHttp, FOURNISSEURS_CONNUS,
} from '../lib/messagerieHttp.js';

const fetchOrigine = globalThis.fetch;
let appels = [];

beforeEach(() => {
  appels = [];
  delete process.env.EMAIL_PROVIDER;
  delete process.env.EMAIL_API_KEY;
  process.env.EMAIL_FROM = '"chifak" <no-reply@chifak.dz>';
  globalThis.fetch = async (url, options) => {
    appels.push({ url, ...options, corps: JSON.parse(options.body) });
    return { ok: true, status: 201, text: async () => '' };
  };
});

afterEach(() => { globalThis.fetch = fetchOrigine; });

describe('Découpage de l\'expéditeur', () => {
  test('« "chifak" <no-reply@chifak.dz> » se sépare en nom et adresse', () => {
    assert.deepEqual(decouperExpediteur('"chifak" <no-reply@chifak.dz>'),
      { name: 'chifak', email: 'no-reply@chifak.dz' });
  });

  test('sans guillemets', () => {
    assert.deepEqual(decouperExpediteur('chifak <a@b.dz>'), { name: 'chifak', email: 'a@b.dz' });
  });

  test('adresse seule : un nom par défaut est fourni', () => {
    assert.deepEqual(decouperExpediteur('a@b.dz'), { name: 'chifak', email: 'a@b.dz' });
  });

  test('valeur absente : ne lève pas', () => {
    assert.equal(decouperExpediteur(undefined).name, 'chifak');
    assert.equal(decouperExpediteur(null).email, '');
  });
});

describe('Choix du fournisseur', () => {
  test('sans EMAIL_PROVIDER, on reste en SMTP', () => {
    assert.equal(fournisseurHttp(), null);
    assert.equal(messagerieHttpConfiguree(), false);
  });

  test('« smtp » est une valeur explicite, pas une erreur', () => {
    process.env.EMAIL_PROVIDER = 'smtp';
    process.env.EMAIL_API_KEY = 'peu importe';
    assert.equal(fournisseurHttp(), null);
  });

  test('un fournisseur sans clé retombe en SMTP plutôt que d\'échouer à l\'envoi', () => {
    process.env.EMAIL_PROVIDER = 'brevo';
    assert.equal(fournisseurHttp(), null);
  });

  test('un nom inconnu retombe en SMTP', () => {
    process.env.EMAIL_PROVIDER = 'fournisseur-imaginaire';
    process.env.EMAIL_API_KEY = 'xxx';
    assert.equal(fournisseurHttp(), null);
  });

  test('la casse et les espaces sont tolérés', () => {
    process.env.EMAIL_PROVIDER = '  BREVO  ';
    process.env.EMAIL_API_KEY = 'xkeysib-test';
    assert.equal(fournisseurHttp()?.cle, 'brevo');
  });

  test('les fournisseurs annoncés sont bien ceux qui répondent', () => {
    for (const nom of FOURNISSEURS_CONNUS) {
      process.env.EMAIL_PROVIDER = nom;
      process.env.EMAIL_API_KEY = 'cle-de-test';
      assert.ok(fournisseurHttp(), `${nom} devrait être reconnu`);
    }
  });
});

describe('Forme des requêtes — Brevo', () => {
  beforeEach(() => {
    process.env.EMAIL_PROVIDER = 'brevo';
    process.env.EMAIL_API_KEY = 'xkeysib-secret';
  });

  test('adresse, en-tête d\'authentification et corps attendus', async () => {
    const parti = await envoyerParHttp('patient@exemple.dz', {
      subject: 'Votre code', html: '<p>481902</p>',
    });
    assert.equal(parti, true);
    assert.equal(appels.length, 1);

    const a = appels[0];
    assert.equal(a.url, 'https://api.brevo.com/v3/smtp/email');
    assert.equal(a.headers['api-key'], 'xkeysib-secret');
    // Brevo attend sender/to/subject/htmlContent — pas from/html.
    assert.deepEqual(a.corps.sender, { name: 'chifak', email: 'no-reply@chifak.dz' });
    assert.deepEqual(a.corps.to, [{ email: 'patient@exemple.dz' }]);
    assert.equal(a.corps.subject, 'Votre code');
    assert.equal(a.corps.htmlContent, '<p>481902</p>');
  });

  test('la clé ne se retrouve jamais dans le corps du message', async () => {
    await envoyerParHttp('patient@exemple.dz', { subject: 'x', html: '<p>y</p>' });
    assert.equal(JSON.stringify(appels[0].corps).includes('xkeysib-secret'), false);
  });
});

describe('Forme des requêtes — Resend', () => {
  beforeEach(() => {
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.EMAIL_API_KEY = 're_secret';
  });

  test('adresse, jeton porteur et corps attendus', async () => {
    await envoyerParHttp('patient@exemple.dz', { subject: 'Votre code', html: '<p>481902</p>' });

    const a = appels[0];
    assert.equal(a.url, 'https://api.resend.com/emails');
    assert.equal(a.headers.Authorization, 'Bearer re_secret');
    // Resend attend from/to/subject/html, et « from » sous forme combinée.
    assert.equal(a.corps.from, 'chifak <no-reply@chifak.dz>');
    assert.deepEqual(a.corps.to, ['patient@exemple.dz']);
    assert.equal(a.corps.html, '<p>481902</p>');
  });
});

describe('Un envoi qui échoue ne lève jamais', () => {
  beforeEach(() => {
    process.env.EMAIL_PROVIDER = 'brevo';
    process.env.EMAIL_API_KEY = 'xkeysib-secret';
  });

  test('un refus du fournisseur rend false', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 401, text: async () => 'Key not found' });
    assert.equal(await envoyerParHttp('a@b.dz', { subject: 'x', html: 'y' }), false);
  });

  test('une panne réseau rend false', async () => {
    globalThis.fetch = async () => { throw new Error('ECONNREFUSED'); };
    assert.equal(await envoyerParHttp('a@b.dz', { subject: 'x', html: 'y' }), false);
  });

  test('sans fournisseur configuré, rien n\'est appelé', async () => {
    delete process.env.EMAIL_PROVIDER;
    assert.equal(await envoyerParHttp('a@b.dz', { subject: 'x', html: 'y' }), false);
    assert.equal(appels.length, 0);
  });
});
