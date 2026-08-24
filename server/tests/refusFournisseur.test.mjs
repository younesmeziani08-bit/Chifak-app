/**
 * Un refus du fournisseur doit se voir.
 *
 * ── Le bug que ces cas verrouillent ──
 *
 * `acheminer()` rendait `false` quand l'API du fournisseur refusait le
 * message. Les six fonctions d'envoi appelaient `await acheminer(...)` sans
 * jamais regarder ce retour, imprimaient « ✅ envoyé », et rendaient `true`.
 *
 * Un refus — clé invalide, adresse IP non autorisée chez Brevo, quota dépassé,
 * expéditeur non validé — remontait donc comme un succès. En production cela
 * donne une inscription qui répond 200 alors que le code de vérification n'est
 * jamais parti : le compte existe, et son propriétaire ne peut plus rien en
 * faire.
 *
 * Le défaut ne touchait que la voie API. `transporter.sendMail` lève en cas
 * d'échec, donc la voie SMTP se comportait correctement — ce qui explique que
 * le bug ait tenu jusqu'au tout premier envoi par API.
 *
 * Découvert en configurant Brevo : le script d'épreuve affichait huit refus
 * HTTP 401 de Brevo, puis « 8 accepté(s), 0 en échec ».
 */
import { test, describe, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/* On éprouve le comportement de PRODUCTION. En développement, plusieurs
   fonctions impriment volontairement le code dans la console et rendent true
   pour ne pas bloquer le développeur — repli utile, mais qui masquerait
   précisément ce qu'on veut vérifier ici. */
process.env.NODE_ENV = 'production';
process.env.EMAIL_PROVIDER = 'brevo';
process.env.EMAIL_API_KEY = 'xkeysib-cle-de-test';
process.env.EMAIL_FROM = '"chifak" <no-reply@chifak.dz>';
process.env.FRONTEND_URL = 'https://chifak.dz';

/** Ce que le fournisseur répondra : true accepte, false refuse. */
let accepte = true;

mock.module('../lib/messagerieHttp.js', {
  namedExports: {
    messagerieHttpConfiguree: () => true,
    envoyerParHttp: async () => accepte,
    fournisseurHttp: () => ({ cle: 'brevo', nom: 'Brevo' }),
    decouperExpediteur: (b) => ({ name: 'chifak', email: String(b) }),
  },
});

/* Le transporteur SMTP ne doit jamais servir ici : si la voie API est
   configurée, un refus ne doit surtout pas se rattraper en SMTP. */
let smtpAppele = 0;
mock.module('nodemailer', {
  defaultExport: {
    createTransport: () => ({
      sendMail: async () => { smtpAppele += 1; return { messageId: 'smtp' }; },
    }),
    createTestAccount: async () => { throw new Error('inattendu'); },
    getTestMessageUrl: () => null,
  },
});

const {
  sendVerificationEmail, sendAppointmentConfirmation,
  sendAppointmentReminder, sendDoctorApproval,
} = await import('../emailService.js');

const RDV = {
  patientName: 'Younes', doctorName: 'Dr Belkacem', specialty: 'Cardiologie',
  date: '2026-09-03', time: '14:30', address: 'Alger', consultationType: 'cabinet',
};

beforeEach(() => { accepte = true; smtpAppele = 0; });

describe('Le fournisseur accepte', () => {
  test('l\'envoi est rapporté comme réussi', async () => {
    assert.equal(await sendVerificationEmail('a@b.dz', '123456', 'fr'), true);
  });
});

describe('Le fournisseur refuse', () => {
  test('le code de vérification ne se dit PAS envoyé', async () => {
    accepte = false;
    assert.equal(await sendVerificationEmail('a@b.dz', '123456', 'fr'), false,
      'c\'est le bug : une inscription répondait 200 sans que le code parte');
  });

  test('la confirmation de rendez-vous non plus', async () => {
    accepte = false;
    assert.equal(await sendAppointmentConfirmation('a@b.dz', RDV, 'fr'), false);
  });

  test('ni le rappel de la veille', async () => {
    accepte = false;
    assert.equal(await sendAppointmentReminder('a@b.dz', RDV, 'fr'), false);
  });

  test('ni l\'acceptation d\'un praticien', async () => {
    accepte = false;
    assert.equal(
      await sendDoctorApproval('a@b.dz', { doctorName: 'Dr X', doctorCode: 'MED-000001', language: 'fr' }),
      false,
    );
  });

  test('en DÉVELOPPEMENT, le code est imprimé et l\'envoi passe pour réussi', async () => {
    /* Repli délibéré, et il faut qu'il reste : sans lui, aucune inscription
       n'est jouable sur une machine sans messagerie. Ce cas est ici pour que
       personne ne le supprime en le prenant pour le bug — et pour rappeler
       qu'il ne vaut QU'en développement. */
    accepte = false;
    process.env.NODE_ENV = 'development';
    try {
      assert.equal(await sendVerificationEmail('a@b.dz', '123456', 'fr'), true);
    } finally {
      process.env.NODE_ENV = 'production';
    }
  });

  test('le refus ne se rattrape jamais en SMTP', async () => {
    accepte = false;
    await sendVerificationEmail('a@b.dz', '123456', 'fr');
    assert.equal(smtpAppele, 0,
      'repartir en SMTP après un refus d\'API enverrait depuis un expéditeur '
      + 'que l\'exploitant croyait avoir remplacé');
  });
});
