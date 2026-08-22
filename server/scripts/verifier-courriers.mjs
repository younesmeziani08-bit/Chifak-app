#!/usr/bin/env node
/**
 * Éprouve la messagerie DE BOUT EN BOUT, sans identifiants de production.
 *
 * ── Pourquoi ce script existe à côté de verifier-emails.mjs ──
 *
 * `verifier-emails.mjs` envoie vers une vraie boîte avec les vrais
 * identifiants : c'est l'épreuve finale, celle qui dit si les messages
 * arrivent chez le fournisseur et hors des indésirables. Mais elle demande des
 * identifiants que tout le monde n'a pas sous la main, et elle envoie
 * réellement — on ne la lance pas à chaque modification.
 *
 * Celui-ci n'a besoin de rien. Il ouvre un compte SMTP d'essai chez Ethereal —
 * le service de nodemailer — et fait passer les treize courriers du service par
 * une vraie connexion, une vraie authentification, une vraie transmission.
 * Puis il ouvre les messages produits et vérifie ce qui compte réellement dans
 * ce qui part sur le fil.
 *
 * Il a été écrit après la montée de nodemailer 6 → 9, qui refermait huit
 * vulnérabilités dont une injection de commandes SMTP. Un changement de version
 * majeure sur la seule pièce qui parle au monde extérieur, et rien pour dire si
 * les courriers partaient encore.
 *
 * ── Ce qu'il vérifie ──
 *
 *   · les treize courriers sont acceptés par un vrai serveur SMTP ;
 *   · l'arabe part en UTF-8, avec la direction de droite à gauche, et un objet
 *     encodé selon la RFC 2047 — sinon les clients affichent du charabia ;
 *   · l'échappement tient jusque dans le message final, pas seulement dans le
 *     gabarit : c'est la défense contre l'injection dans le corps du courrier ;
 *   · les en-têtes que tout client regarde sont présents. Un message sans
 *     Message-ID ou sans Date part directement en indésirables.
 *
 * ── Usage ──
 *
 *   cd server && npm run verifier:courriers
 *
 * Aucune configuration, aucun envoi vers une vraie personne. Nécessite un accès
 * réseau : le compte d'essai est créé à la volée.
 */
import '../env.js';
import nodemailer from 'nodemailer';
import {
  courrierMotDePasseOublie, courrierMotDePasseChange,
  courrierRendezVousAnnule, courrierCompteEfface,
} from '../lib/courriers.js';

let echecs = 0;
const dire = (ok, texte, detail = '') => {
  if (!ok) echecs += 1;
  console.log(`  ${ok ? '✅' : '❌'} ${texte}${detail ? ` — ${detail}` : ''}`);
};

console.log('\n── Ouverture d\'un compte SMTP d\'essai ──');
let compte;
try {
  compte = await nodemailer.createTestAccount();
} catch (e) {
  console.error('\n❌ Impossible de créer le compte d\'essai :', e.message);
  console.error('   Ce script a besoin d\'un accès réseau vers ethereal.email.\n');
  process.exit(1);
}
console.log(`  ${compte.smtp.host}:${compte.smtp.port}\n`);

/* Le module de messagerie construit son transporteur à son PREMIER import, en
   lisant l'environnement. On le renseigne donc avant d'y toucher.
   NODE_ENV=production coupe le repli « mode démo » : on veut le vrai envoi,
   pas une trace dans la console. */
process.env.EMAIL_HOST = compte.smtp.host;
process.env.EMAIL_PORT = String(compte.smtp.port);
process.env.EMAIL_SECURE = String(compte.smtp.secure);
process.env.EMAIL_USER = compte.user;
process.env.EMAIL_PASSWORD = compte.pass;
process.env.EMAIL_FROM = '"chifak" <no-reply@chifak.dz>';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'https://chifak.dz';
process.env.NODE_ENV = 'production';

const m = await import('../emailService.js');

const RDV = {
  patientName: 'Nadia Benali',
  doctorName: 'Dr. Ahmed Benali',
  specialty: 'Médecin généraliste',
  date: '2026-09-02',
  time: '09:00',
  address: '15 Rue Didouche Mourad, Alger',
  consultationType: 'cabinet',
  cancelUrl: 'https://chifak.dz/rdv/abc123DEF456ghi789JKL',
};

const COURRIERS = [
  ['Code de vérification (fr)', () => m.sendVerificationEmail('patient@exemple.dz', '481902', 'fr')],
  ['Code de vérification (ar)', () => m.sendVerificationEmail('patient@exemple.dz', '481902', 'ar')],
  ['Confirmation de rendez-vous (fr)', () => m.sendAppointmentConfirmation('patient@exemple.dz', RDV, 'fr')],
  ['Confirmation de rendez-vous (ar)', () => m.sendAppointmentConfirmation('patient@exemple.dz', RDV, 'ar')],
  ['Rappel de la veille', () => m.sendAppointmentReminder('patient@exemple.dz', RDV, 'fr')],
  ['Agenda du praticien', () => m.sendDoctorDailyAgenda('doc@exemple.dz', 'Dr. Ahmed Benali', 'demain', [
    { time: '09:00', reserved: true, patient: { name: 'Nadia Benali', phone: '0555123456', reason: 'Contrôle' } },
    { time: '09:30', reserved: false },
  ])],
  ['Candidature acceptée', () => m.sendDoctorApproval('doc@exemple.dz', {
    doctorName: 'Dr. Essai', doctorCode: 'MED-004212', language: 'fr',
  })],
  ['Candidature refusée', () => m.sendDoctorRejection('doc@exemple.dz', {
    doctorName: 'Dr. Essai', reason: 'Numéro d\'ordre non vérifiable', language: 'fr',
  })],
  ['Mot de passe oublié (fr)', () => m.envoyerCourrier('patient@exemple.dz', courrierMotDePasseOublie({ code: '739154', langue: 'fr' }))],
  ['Mot de passe oublié (ar)', () => m.envoyerCourrier('patient@exemple.dz', courrierMotDePasseOublie({ code: '739154', langue: 'ar' }))],
  ['Mot de passe changé', () => m.envoyerCourrier('patient@exemple.dz', courrierMotDePasseChange({ langue: 'fr' }))],
  ['Rendez-vous annulé', () => m.envoyerCourrier('patient@exemple.dz', courrierRendezVousAnnule({
    patientName: 'Nadia Benali', doctorName: 'Dr. Ahmed Benali', date: '2 septembre 2026',
    heure: '09:00', motif: 'Absence imprévue du praticien', parQui: 'doctor', langue: 'fr',
  }))],
  ['Compte supprimé', () => m.envoyerCourrier('patient@exemple.dz', courrierCompteEfface({ langue: 'fr' }))],
];

console.log('── Transmission par un vrai serveur SMTP ──');
const bruit = console.log;
for (const [nom, envoyer] of COURRIERS) {
  // Le module de messagerie journalise chaque envoi ; on le laisse se taire.
  console.log = () => {};
  let parti = false;
  let raison = '';
  try {
    parti = await envoyer();
  } catch (e) {
    raison = e.message;
  }
  console.log = bruit;
  dire(parti, nom, raison);
}

/* ── Ce qui part réellement sur le fil ──
   Un serveur qui accepte un message ne dit rien de sa lisibilité. On construit
   donc les mêmes courriers avec un transport en mémoire, et on lit le résultat
   octet par octet. */
console.log('\n── Le message tel qu\'il part ──');
const enMemoire = nodemailer.createTransport({ streamTransport: true, buffer: true });
const composer = async (courrier) => (await enMemoire.sendMail({
  from: '"chifak" <no-reply@chifak.dz>', to: 'patient@exemple.dz', ...courrier,
})).message.toString();

const ar = await composer(courrierMotDePasseOublie({ code: '739154', langue: 'ar' }));

dire(/charset=utf-8/i.test(ar), 'Arabe transmis en UTF-8');
dire(ar.includes('dir=3D"rtl"') || ar.includes('dir="rtl"'), 'Direction de droite à gauche conservée');
dire(/^Subject: =\?UTF-8\?/m.test(ar), 'Objet encodé selon la RFC 2047',
  'un objet arabe non encodé s\'affiche en charabia');
dire(ar.includes('739154'), 'Le code reste lisible après encodage');

/* L'échappement doit tenir dans le MESSAGE, pas seulement dans le gabarit.
   On décode le quoted-printable avant de chercher : sans cela, « <script> »
   voyage sous la forme « =3Cscript=3E » et un test naïf le croirait échappé. */
const injection = await composer(courrierRendezVousAnnule({
  patientName: '<script>alert(1)</script>', doctorName: 'Dr. Test',
  date: '2 septembre 2026', heure: '09:00',
  motif: '<img src=x onerror=alert(1)>', parQui: 'doctor', langue: 'fr',
}));
const decode = injection.replace(/=\r?\n/g, '').replace(/=3C/gi, '<').replace(/=3E/gi, '>');

dire(!decode.includes('<script>'), 'Aucune balise <script> ne passe');
dire(!/<img[^>]*onerror/i.test(decode), 'Aucun gestionnaire onerror ne passe');
dire(decode.includes('&lt;script&gt;'), 'Le texte saisi reste visible, mais échappé');

console.log('\n── En-têtes ──');
for (const entete of ['From', 'To', 'Subject', 'Message-ID', 'Date', 'MIME-Version']) {
  const present = new RegExp(`^${entete}: .+$`, 'm').test(ar);
  dire(present, entete, present ? '' : 'un message sans cet en-tête finit en indésirables');
}

console.log(`\n${'─'.repeat(62)}`);
if (echecs === 0) {
  console.log('  ✅ La messagerie fonctionne de bout en bout.');
  console.log(`\n  Messages consultables : https://ethereal.email/login`);
  console.log(`  ${compte.user} / ${compte.pass}`);
  console.log('\n  Ce compte est jetable et ne contient rien de réel. Il reste');
  console.log('  à lancer une fois « npm run verifier:emails » avec les vrais');
  console.log('  identifiants : seule une vraie boîte dit si les messages');
  console.log('  arrivent, et hors du dossier indésirables.');
} else {
  console.log(`  ❌ ${echecs} contrôle(s) en échec.`);
}
console.log(`${'─'.repeat(62)}\n`);

process.exit(echecs === 0 ? 0 : 1);
