/**
 * Double authentification — TOTP.
 *
 * Les six premiers cas sont les vecteurs officiels de la RFC 6238. Ce sont
 * eux qui garantissent l'interopérabilité : si l'un tombe, Google
 * Authenticator produira des codes que le serveur refusera, et plus personne
 * ne pourra se connecter à l'administration.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET ||= 'secret-de-test-suffisamment-long-pour-les-essais-abcdef';

const {
  base32Encoder, base32Decoder, genererSecret, codePour, verifierCode,
  chiffrerSecret, dechiffrerSecret, adresseOtpauth, secretLisible,
  genererCodesDeSecours, empreinteCodeDeSecours,
} = await import('../lib/totp.js');

describe('Vecteurs officiels RFC 6238', () => {
  // Secret de la RFC : la chaîne ASCII « 12345678901234567890 ».
  const secret = base32Encoder(Buffer.from('12345678901234567890', 'ascii'));
  const vecteurs = [
    [59, '287082'], [1111111109, '081804'], [1111111111, '050471'],
    [1234567890, '005924'], [2000000000, '279037'], [20000000000, '353130'],
  ];
  for (const [secondes, attendu] of vecteurs) {
    test(`t=${secondes} produit ${attendu}`, () => {
      assert.equal(codePour(secret, Math.floor(secondes / 30)), attendu);
    });
  }
});

describe('Base32', () => {
  test('aller-retour', () => {
    const b = Buffer.from('12345678901234567890', 'ascii');
    assert.deepEqual(base32Decoder(base32Encoder(b)), b);
  });
  test('tolère espaces et minuscules — le secret se recopie à la main', () => {
    const s = genererSecret();
    assert.deepEqual(base32Decoder(secretLisible(s).toLowerCase()), base32Decoder(s));
  });
  test('refuse un caractère hors alphabet', () => {
    assert.throws(() => base32Decoder('ABC1!'), /invalide/);
  });
});

describe('Vérification d\'un code', () => {
  const secret = genererSecret();
  const maintenant = Date.now();
  const actuel = Math.floor(maintenant / 1000 / 30);

  test('accepte la période courante', () => {
    assert.equal(verifierCode(secret, codePour(secret, actuel), { maintenant }), actuel);
  });
  test('tolère une période d\'écart — les horloges dérivent', () => {
    assert.equal(verifierCode(secret, codePour(secret, actuel - 1), { maintenant }), actuel - 1);
    assert.equal(verifierCode(secret, codePour(secret, actuel + 1), { maintenant }), actuel + 1);
  });
  test('refuse au-delà de la tolérance', () => {
    assert.equal(verifierCode(secret, codePour(secret, actuel + 5), { maintenant }), null);
  });
  test('refuse un code mal formé', () => {
    for (const mauvais of ['12ab56', '', '1234567', '12345']) {
      assert.equal(verifierCode(secret, mauvais, { maintenant }), null);
    }
  });
  test('REJEU : un code déjà consommé ne repasse pas', () => {
    const c = codePour(secret, actuel);
    const accepte = verifierCode(secret, c, { maintenant });
    assert.equal(verifierCode(secret, c, { maintenant, dernierCompteur: accepte }), null,
      'un code lu par-dessus l\'épaule resterait valable une minute et demie');
  });
  test('un autre secret ne valide pas le code', () => {
    assert.equal(verifierCode(genererSecret(), codePour(secret, actuel), { maintenant }), null);
  });
});

describe('Secret chiffré au repos', () => {
  const secret = genererSecret();
  test('aller-retour', () => {
    assert.equal(dechiffrerSecret(chiffrerSecret(secret)), secret);
  });
  test('le secret n\'apparaît jamais en clair', () => {
    assert.ok(!chiffrerSecret(secret).includes(secret));
  });
  test('deux chiffrements diffèrent — vecteur d\'initialisation aléatoire', () => {
    assert.notEqual(chiffrerSecret(secret), chiffrerSecret(secret));
  });
  test('un contenu altéré est rejeté', () => {
    const parts = chiffrerSecret(secret).split('.');
    parts[2] = Buffer.from('altéré').toString('base64');
    assert.throws(() => dechiffrerSecret(parts.join('.')));
  });
});

describe('Codes de secours', () => {
  test('huit codes distincts', () => {
    const c = genererCodesDeSecours();
    assert.equal(c.length, 8);
    assert.equal(new Set(c).size, 8);
  });
  test('empreinte insensible au format de saisie', () => {
    assert.equal(empreinteCodeDeSecours('ab12c-de34f'), empreinteCodeDeSecours('AB12C DE34F'));
  });
});

test('adresse otpauth au format attendu des applications', () => {
  const secret = genererSecret();
  const u = adresseOtpauth({ secret, compte: 'admin' });
  assert.ok(u.startsWith('otpauth://totp/chifak%3Aadmin?'));
  assert.ok(u.includes(`secret=${secret}`));
  assert.ok(u.includes('period=30') && u.includes('digits=6'));
});
