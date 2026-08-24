/**
 * Les deux modes d'essai : courrier jetable et SMS journalisé.
 *
 * ── À quoi ils répondent ──
 *
 * Éprouver l'inscription réclamait un compte chez un expéditeur, une adresse
 * validée et une clé d'API. Trois démarches avant de pouvoir répondre à la
 * seule question qui compte : « le code arrive-t-il, et marche-t-il ? »
 *
 * Côté SMS, c'est pire : aucune passerelle ne s'essaie gratuitement, toutes
 * réclament une inscription et souvent un numéro pré-vérifié — ce qui interdit
 * précisément d'éprouver l'envoi vers le numéro d'un patient.
 *
 * ── Ce qui est vérifié ici ──
 *
 * Que les modes s'activent sur la bonne valeur et sur elle seule. Un mode
 * d'essai qui s'allumerait tout seul en production serait bien pire que son
 * absence : les courriers cesseraient de partir sans que rien ne le signale.
 */
import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const initial = { ...process.env };
afterEach(() => {
  for (const c of ['EMAIL_PROVIDER', 'SMS_PROVIDER', 'SMS_URL', 'SMS_SENDER']) {
    if (initial[c] === undefined) delete process.env[c];
    else process.env[c] = initial[c];
  }
});

const { modeEssaiActif } = await import('../lib/messagerieEssai.js');
const { smsEnConsole, smsConfigure, envoyerSms, normaliserNumero } = await import('../lib/sms.js');

describe('Courrier : mode essai', () => {
  test('s\'active sur « essai » et sur « ethereal »', () => {
    for (const v of ['essai', 'ethereal', 'ESSAI', '  Ethereal  ']) {
      process.env.EMAIL_PROVIDER = v;
      assert.equal(modeEssaiActif(), true, `« ${v} » devrait activer le mode`);
    }
  });

  test('ne s\'active JAMAIS sur un vrai fournisseur', () => {
    for (const v of ['brevo', 'resend', 'sendgrid', '']) {
      process.env.EMAIL_PROVIDER = v;
      assert.equal(modeEssaiActif(), false,
        `« ${v} » ne doit pas détourner les courriers vers une boîte jetable`);
    }
  });

  test('ne s\'active pas quand la variable est absente', () => {
    delete process.env.EMAIL_PROVIDER;
    assert.equal(modeEssaiActif(), false);
  });
});

describe('SMS : mode console', () => {
  test('le canal est configuré sans la moindre passerelle', () => {
    delete process.env.SMS_URL;
    process.env.SMS_PROVIDER = 'console';
    assert.equal(smsEnConsole(), true);
    assert.equal(smsConfigure(), true,
      'sans cela, envoyerSms sortirait immédiatement et rien ne serait imprimé');
  });

  test('sans passerelle NI mode console, le canal reste fermé', () => {
    delete process.env.SMS_URL;
    delete process.env.SMS_PROVIDER;
    assert.equal(smsConfigure(), false);
  });

  test('une autre valeur n\'active pas le mode', () => {
    process.env.SMS_PROVIDER = 'twilio';
    delete process.env.SMS_URL;
    assert.equal(smsEnConsole(), false);
    assert.equal(smsConfigure(), false);
  });

  test('l\'envoi aboutit sans réseau, et le numéro est normalisé', async () => {
    delete process.env.SMS_URL;
    process.env.SMS_PROVIDER = 'console';
    /* Aucune passerelle n'est joignable : si l'appel réseau avait lieu, il
       échouerait. Le retour à true atteste que l'impression a remplacé
       l'envoi. */
    assert.equal(await envoyerSms('0555 12 34 56', 'Rappel de test'), true);
    assert.equal(normaliserNumero('0555 12 34 56'), '+213555123456');
  });

  test('un numéro inexploitable est refusé même en mode console', async () => {
    process.env.SMS_PROVIDER = 'console';
    assert.equal(await envoyerSms('abc', 'Rappel'), false,
      'le mode console doit éprouver la vraie chaîne, y compris ses refus');
  });
});
