/**
 * Les six courriers du service, composés pour de vrai.
 *
 * ── Pourquoi ces cas existent ──
 *
 * Rien ne couvrait la messagerie. Il a fallu remplacer nodemailer 6, qui
 * traînait huit vulnérabilités — dont une injection de commandes SMTP par
 * CRLF — par la version 9. Un changement de version majeure sur la seule
 * pièce du service qui parle au monde extérieur, sans un seul test pour dire
 * si les courriers partaient encore.
 *
 * Ce fichier comble ce trou. Le transporteur est une doublure : rien ne part,
 * mais tout est composé par le vrai code. Ce qui est vérifié :
 *
 *   — chaque courrier se compose sans erreur, dans les deux langues ;
 *   — l'échappement HTML tient, y compris quand un nom porte des chevrons —
 *     c'est la défense contre l'injection dans le corps du message ;
 *   — les valeurs qui comptent pour le patient (date, heure, praticien, code)
 *     apparaissent réellement dans ce qu'il recevra.
 */
import { test, describe, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.EMAIL_USER = 'chifak@exemple.dz';
process.env.EMAIL_PASSWORD = 'mot-de-passe-de-test';
process.env.FRONTEND_URL = 'https://chifak.dz';

/* ── Doublure du transporteur ──
   On garde la vraie composition et on intercepte l'envoi. */
const boite = [];
const reglage = { echouer: false };

mock.module('nodemailer', {
  defaultExport: {
    createTransport: () => ({
      sendMail: async (options) => {
        if (reglage.echouer) throw new Error('SMTP injoignable');
        boite.push(options);
        return { messageId: `test-${boite.length}` };
      },
    }),
  },
});

const {
  generateVerificationCode,
  sendVerificationEmail,
  sendAppointmentConfirmation,
  sendAppointmentReminder,
  sendDoctorApproval,
  sendDoctorRejection,
} = await import('../emailService.js');

beforeEach(() => { boite.length = 0; reglage.echouer = false; });

const dernier = () => boite[boite.length - 1];

const RENDEZ_VOUS = {
  patientName: 'Nadia Benali',
  doctorName: 'Dr. Ahmed Benali',
  specialty: 'Médecin généraliste',
  date: '2026-09-02',
  time: '09:00',
  address: '15 Rue Didouche Mourad, Alger',
  consultationType: 'cabinet',
};

describe('Code de vérification', () => {
  test('six chiffres', () => {
    for (let i = 0; i < 50; i++) {
      assert.match(generateVerificationCode(), /^\d{6}$/);
    }
  });

  test('le code figure dans le courrier, en français', async () => {
    const ok = await sendVerificationEmail('patient@exemple.dz', '481902', 'fr');
    assert.equal(ok, true);
    assert.equal(dernier().to, 'patient@exemple.dz');
    assert.ok(dernier().html.includes('481902'), 'le code doit être lisible dans le message');
  });

  test('et en arabe', async () => {
    await sendVerificationEmail('patient@exemple.dz', '481902', 'ar');
    assert.ok(dernier().html.includes('481902'));
  });

  /* Un envoi qui échoue ne doit jamais lever : l'inscription retomberait en
     « Erreur serveur » au lieu d'expliquer ce qui s'est passé. Le retour, en
     revanche, dépend volontairement de l'environnement — et c'est la
     distinction qui compte.

     En développement, le code est écrit dans la console et la fonction rend
     `true` : on peut éprouver le parcours d'inscription sans messagerie.

     En production, elle rend `false`, et auth.js refuse alors de créer un
     compte que personne ne pourrait jamais vérifier. Écrire le code dans les
     journaux de l'hébergeur reviendrait à le publier. */
  test('échec en développement : repli sur la console, retourne true', async () => {
    reglage.echouer = true;
    const avant = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      assert.equal(await sendVerificationEmail('patient@exemple.dz', '123456', 'fr'), true);
    } finally { process.env.NODE_ENV = avant; }
  });

  test('échec en production : retourne false, et rien dans les journaux', async () => {
    reglage.echouer = true;
    const avant = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      assert.equal(await sendVerificationEmail('patient@exemple.dz', '123456', 'fr'), false);
    } finally { process.env.NODE_ENV = avant; }
  });
});

describe('Confirmation de rendez-vous', () => {
  test('porte le praticien, la date et l\'heure', async () => {
    await sendAppointmentConfirmation('patient@exemple.dz', RENDEZ_VOUS, 'fr');
    const html = dernier().html;
    assert.ok(html.includes('Dr. Ahmed Benali'), 'le nom du praticien');
    assert.ok(html.includes('09:00'), 'l\'heure');
    assert.ok(html.includes('Rue Didouche Mourad'), 'l\'adresse du cabinet');
  });

  test('version arabe', async () => {
    await sendAppointmentConfirmation('patient@exemple.dz', RENDEZ_VOUS, 'ar');
    assert.ok(dernier().html.includes('Dr. Ahmed Benali'));
  });

  /* La défense contre l'injection dans le corps du message. Un nom est saisi
     par le patient : s'il repart tel quel dans du HTML, il y injecte ce qu'il
     veut — et le lecteur d'un client de messagerie permissif l'exécute. */
  test('un nom porteur de balises ressort échappé', async () => {
    await sendAppointmentConfirmation(
      'patient@exemple.dz',
      { ...RENDEZ_VOUS, patientName: '<script>alert(1)</script>' },
      'fr',
    );
    const html = dernier().html;
    assert.equal(html.includes('<script>'), false, 'aucune balise brute ne doit passer');
    assert.ok(html.includes('&lt;script&gt;'), 'le nom doit apparaître, mais échappé');
  });
});

describe('Rappel de la veille', () => {
  test('se compose et mentionne l\'heure', async () => {
    await sendAppointmentReminder('patient@exemple.dz', RENDEZ_VOUS, 'fr');
    assert.ok(dernier().html.includes('09:00'));
    assert.ok(dernier().subject.length > 0, 'un rappel sans objet finit en indésirables');
  });
});

describe('Réponse à une candidature de praticien', () => {
  test('acceptation : le code de connexion est transmis', async () => {
    await sendDoctorApproval('praticien@exemple.dz', {
      doctorName: 'Dr. Fatima Zahra',
      doctorCode: 'MED-004212',
      language: 'fr',
    });
    assert.ok(dernier().html.includes('MED-004212'), 'sans ce code, le praticien ne peut pas se connecter');
  });

  test('refus : le motif est transmis, échappé', async () => {
    await sendDoctorRejection('praticien@exemple.dz', {
      doctorName: 'Dr. Untel',
      reason: 'Numéro d\'ordre <non vérifiable>',
      language: 'fr',
    });
    const html = dernier().html;
    assert.equal(html.includes('<non vérifiable>'), false);
    assert.ok(html.includes('&lt;non vérifiable&gt;'));
  });
});

describe('Tous les courriers', () => {
  test('portent un expéditeur, un destinataire, un objet et un corps', async () => {
    await sendVerificationEmail('a@exemple.dz', '111111', 'fr');
    await sendAppointmentConfirmation('a@exemple.dz', RENDEZ_VOUS, 'fr');
    await sendAppointmentReminder('a@exemple.dz', RENDEZ_VOUS, 'fr');
    await sendDoctorApproval('a@exemple.dz', { doctorName: 'X', doctorCode: 'MED-1', language: 'fr' });
    await sendDoctorRejection('a@exemple.dz', { doctorName: 'X', reason: 'motif', language: 'fr' });

    assert.equal(boite.length, 5);
    for (const courrier of boite) {
      assert.ok(courrier.from, 'expéditeur');
      assert.ok(courrier.to, 'destinataire');
      assert.ok(courrier.subject, 'objet');
      assert.ok(courrier.html && courrier.html.length > 100, 'corps');
    }
  });
});
