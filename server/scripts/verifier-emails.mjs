#!/usr/bin/env node
/**
 * Envoi RÉEL des six courriers du service, vers une adresse que vous indiquez.
 *
 * ── Pourquoi ce script existe ──
 *
 * La messagerie est la seule pièce du service qui parle au monde extérieur, et
 * la seule qu'aucun test ne peut couvrir : une doublure prouve que le message
 * se compose, jamais qu'il arrive. Or entre « composé » et « arrivé » il y a
 * tout ce qui casse en vrai — identifiants refusés, port bloqué, expéditeur
 * non validé chez le fournisseur, message classé en indésirable.
 *
 * Le service a par ailleurs changé de version majeure de nodemailer (6 → 9)
 * pour refermer huit vulnérabilités, dont une injection de commandes SMTP.
 * Rien ne remplace un envoi réel pour s'assurer que ce changement n'a rien
 * cassé.
 *
 * ── Ce qu'il fait ──
 *
 * Il envoie les six courriers, un par un, avec des données factices, et
 * rapporte ce qui part et ce qui échoue. Aucune écriture en base, aucun
 * patient réel touché : la seule adresse destinataire est celle que vous
 * donnez en argument.
 *
 * ── Usage ──
 *
 *   cd server
 *   node scripts/verifier-emails.mjs vous@exemple.dz
 *
 * Puis OUVREZ la boîte de réception. Le script dit si le serveur a accepté les
 * messages ; seule votre boîte dit s'ils sont arrivés, lisibles, et hors du
 * dossier indésirables. Vérifiez les deux langues : l'arabe doit s'afficher de
 * droite à gauche.
 */
import '../env.js';
import { isEmailConfigured } from '../emailService.js';

const destinataire = process.argv[2];

if (!destinataire || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(destinataire)) {
  console.error('\nUsage : node scripts/verifier-emails.mjs vous@exemple.dz\n');
  console.error('Indiquez VOTRE adresse : c\'est la seule qui recevra quoi que ce soit.\n');
  process.exit(1);
}

if (!isEmailConfigured()) {
  console.error('\n❌ La messagerie n\'est pas configurée.\n');
  console.error('   EMAIL_USER et EMAIL_PASSWORD portent encore les valeurs d\'exemple,');
  console.error('   ou sont absents. Renseignez-les dans server/.env (en local) ou dans');
  console.error('   les variables de votre hébergeur (en production), puis relancez.\n');
  console.error('   Pour un envoi par Gmail, EMAIL_PASSWORD doit être un « mot de passe');
  console.error('   d\'application » à 16 caractères, pas votre mot de passe habituel :');
  console.error('   https://myaccount.google.com/apppasswords\n');
  process.exit(1);
}

const {
  generateVerificationCode, sendVerificationEmail, sendAppointmentConfirmation,
  sendAppointmentReminder, sendDoctorDailyAgenda, sendDoctorApproval, sendDoctorRejection,
} = await import('../emailService.js');

const RENDEZ_VOUS = {
  patientName: 'Essai chifak',
  doctorName: 'Dr. Ahmed Benali',
  specialty: 'Médecin généraliste',
  date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  time: '09:00',
  address: '15 Rue Didouche Mourad, Alger',
  consultationType: 'cabinet',
};

const epreuves = [
  ['Code de vérification (fr)', () => sendVerificationEmail(destinataire, generateVerificationCode(), 'fr')],
  ['Code de vérification (ar)', () => sendVerificationEmail(destinataire, generateVerificationCode(), 'ar')],
  ['Confirmation de rendez-vous (fr)', () => sendAppointmentConfirmation(destinataire, RENDEZ_VOUS, 'fr')],
  ['Confirmation de rendez-vous (ar)', () => sendAppointmentConfirmation(destinataire, RENDEZ_VOUS, 'ar')],
  ['Rappel de la veille', () => sendAppointmentReminder(destinataire, RENDEZ_VOUS, 'fr')],
  ['Agenda du praticien', () => sendDoctorDailyAgenda(destinataire, 'Dr. Ahmed Benali', 'demain', [
    { time: '09:00', reserved: true, patient: { name: 'Essai chifak', phone: '0555000000', reason: 'Contrôle' } },
    { time: '09:30', reserved: false },
  ])],
  ['Candidature acceptée', () => sendDoctorApproval(destinataire, {
    doctorName: 'Dr. Essai', doctorCode: 'MED-000000', language: 'fr',
  })],
  ['Candidature refusée', () => sendDoctorRejection(destinataire, {
    doctorName: 'Dr. Essai', reason: 'Épreuve d\'envoi — ce message ne concerne personne.', language: 'fr',
  })],
];

console.log(`\nEnvoi de ${epreuves.length} courriers vers ${destinataire}`);
/* Le transport annoncé ne regardait que EMAIL_HOST : il disait donc « Gmail »
   alors que les messages partaient par l'API de Brevo. Quand le rapport se
   trompe sur la voie employée, il oriente le dépannage dans la mauvaise
   direction — on cherche du côté de Gmail un refus qui vient d'ailleurs. */
const transport = (() => {
  const p = String(process.env.EMAIL_PROVIDER || '').trim().toLowerCase();
  if (p === 'essai' || p === 'ethereal') return 'boîte jetable (mode ESSAI)';
  if (p && p !== 'smtp') return `API ${p}`;
  return process.env.EMAIL_HOST || 'Gmail';
})();
console.log(`Transport : ${transport}\n`);

let partis = 0;
let echoues = 0;

for (const [nom, envoyer] of epreuves) {
  process.stdout.write(`  ${nom.padEnd(36)}`);
  try {
    const ok = await envoyer();
    if (ok) { console.log('✅ accepté'); partis += 1; }
    else { console.log('❌ refusé par le serveur'); echoues += 1; }
  } catch (e) {
    console.log(`❌ ${e.message}`);
    echoues += 1;
  }
}

console.log(`\n${partis} accepté(s), ${echoues} en échec.\n`);

if (echoues) {
  console.log('Un échec vient presque toujours de l\'une de ces causes :');
  console.log('  · adresse IP non autorisée — Brevo n\'accepte les appels d\'API que');
  console.log('    depuis des adresses déclarées : https://app.brevo.com/security/authorised_ips');
  console.log('  · identifiants refusés — pour Gmail, il faut un mot de passe d\'application ;');
  console.log('  · clé du mauvais type — Brevo distingue xkeysib- (API) et xsmtpsib- (SMTP) ;');
  console.log('  · expéditeur non validé chez le fournisseur (Brevo, Resend…) ;');
  console.log('  · port sortant bloqué par l\'hébergement.\n');
  process.exit(1);
}

console.log('Le serveur de messagerie a tout accepté. Ouvrez maintenant la boîte');
console.log(`de ${destinataire} et vérifiez :`);
console.log('  · les huit messages sont arrivés, et PAS dans les indésirables ;');
console.log('  · l\'arabe s\'affiche de droite à gauche ;');
console.log('  · le code de vérification et le code praticien sont lisibles ;');
console.log('  · l\'expéditeur affiché est bien celui que vous voulez montrer.\n');
