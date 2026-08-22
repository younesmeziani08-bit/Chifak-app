/**
 * Envoi de SMS — le canal qui manquait.
 *
 * Tout passait par l'e-mail. En Algérie, le SMS porte bien plus loin, et le
 * rappel de la veille est précisément ce qui décide si quelqu'un se déplace.
 *
 * Deux choses sont éprouvées ici, et elles comptent autant l'une que l'autre :
 *
 *  — la mise au format international. Les numéros sont saisis « 0555 12 34 56 »
 *    et presque toutes les passerelles exigent « +213555123456 ». Sans cette
 *    conversion, les envois échouent un par un sans que personne ne comprenne
 *    pourquoi ;
 *  — le fait que le canal soit ÉTEINT par défaut et ne lève jamais. Le SMS
 *    complète l'e-mail, il ne le remplace pas : son échec ne doit jamais faire
 *    échouer un rappel déjà parti.
 */
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { normaliserNumero, smsConfigure, envoyerSms, texteRappel } from '../lib/sms.js';

beforeEach(() => {
  delete process.env.SMS_URL;
  delete process.env.SMS_COUNTRY_CODE;
});

describe('Mise au format international', () => {
  test('un numéro algérien saisi avec des espaces', () => {
    assert.equal(normaliserNumero('0555 12 34 56'), '+213555123456');
    assert.equal(normaliserNumero('0555-12-34-56'), '+213555123456');
    assert.equal(normaliserNumero('(0555) 123456'), '+213555123456');
  });

  test('le zéro de tête cède la place à l\'indicatif', () => {
    assert.equal(normaliserNumero('0770123456'), '+213770123456');
    assert.equal(normaliserNumero('0661234567'), '+213661234567');
  });

  test('un numéro déjà international n\'est pas retouché', () => {
    assert.equal(normaliserNumero('+213555123456'), '+213555123456');
    assert.equal(normaliserNumero('+33612345678'), '+33612345678', 'tout le monde n\'a pas un numéro algérien');
  });

  test('la forme 00 devient +', () => {
    assert.equal(normaliserNumero('00213555123456'), '+213555123456');
  });

  test('l\'indicatif est configurable', () => {
    process.env.SMS_COUNTRY_CODE = '+216';
    assert.equal(normaliserNumero('0555123456'), '+216555123456');
  });

  test('ce qui n\'est pas exploitable rend null, sans lever', () => {
    for (const bricole of ['', '   ', 'pas un numéro', '12', null, undefined, 42, {}, '+++']) {
      assert.equal(normaliserNumero(bricole), null);
    }
  });

  test('un numéro sans zéro ni indicatif n\'est pas deviné', () => {
    // 555123456 pourrait être algérien, ou pas. On ne suppose rien.
    assert.equal(normaliserNumero('555123456'), null);
  });
});

describe('Le canal est éteint par défaut', () => {
  test('sans SMS_URL, rien n\'est configuré', () => {
    assert.equal(smsConfigure(), false);
  });

  test('avec SMS_URL, le canal s\'active', () => {
    process.env.SMS_URL = 'https://api.exemple.dz/sms';
    assert.equal(smsConfigure(), true);
  });

  test('envoyer sans configuration rend false, sans lever ni appeler personne', async () => {
    assert.equal(await envoyerSms('0555123456', 'Test'), false);
  });

  test('un numéro inexploitable rend false, sans lever', async () => {
    process.env.SMS_URL = 'https://api.exemple.dz/sms';
    assert.equal(await envoyerSms('pas un numéro', 'Test'), false);
  });
});

describe('Texte du rappel', () => {
  const base = { patientName: 'Nadia Benali', doctorName: 'Dr. Ahmed Benali', date: '2026-09-02', heure: '09:00' };

  test('porte l\'essentiel : qui, quand, avec qui', () => {
    const t = texteRappel({ ...base, visio: false, langue: 'fr' });
    assert.match(t, /Nadia/);
    assert.match(t, /Dr\. Ahmed Benali/);
    assert.match(t, /09:00/);
  });

  test('le prénom seul — un SMS se lit sur un écran verrouillé', () => {
    assert.equal(texteRappel({ ...base, langue: 'fr' }).includes('Benali,'), false);
  });

  test('distingue la téléconsultation', () => {
    assert.match(texteRappel({ ...base, visio: true, langue: 'fr' }), /téléconsultation/i);
    assert.equal(/téléconsultation/i.test(texteRappel({ ...base, visio: false, langue: 'fr' })), false);
  });

  test('version arabe', () => {
    const t = texteRappel({ ...base, visio: false, langue: 'ar' });
    assert.match(t, /تذكير/);
    assert.match(t, /09:00/);
  });

  test('reste dans deux segments — chaque segment se paie', () => {
    const long = texteRappel({
      patientName: 'Abdelrahmane Boumediene Belkacemi',
      doctorName: 'Dr. Mohammed El Amine Benyoucef Zerrouki',
      date: 'mercredi 2 septembre 2026', heure: '09:00', visio: true, langue: 'fr',
    });
    assert.ok(long.length <= 320, `un rappel de ${long.length} caractères coûterait trois segments`);
  });
});
