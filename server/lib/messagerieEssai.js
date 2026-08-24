/**
 * Mode d'essai : lire ses propres courriers sans fournisseur ni inscription.
 *
 * ── À quoi ça sert ──
 *
 * Éprouver l'inscription demandait jusqu'ici un compte chez un expéditeur, une
 * adresse validée, une clé d'API. Trois démarches avant de pouvoir répondre à
 * la seule question qui compte : « est-ce que le code arrive, et est-ce qu'il
 * marche ? »
 *
 * Ethereal fabrique une boîte jetable à la volée. Aucune inscription, aucune
 * clé, et le message n'atteint jamais un vrai destinataire — il est capturé et
 * consultable par un lien que l'on affiche dans la console.
 *
 * ── Comment l'employer ──
 *
 *     EMAIL_PROVIDER=essai
 *
 * Et c'est tout. Le parcours complet devient jouable : on s'inscrit, la
 * console imprime un lien, on ouvre le lien, on lit le code à six chiffres, on
 * le saisit. Le compte existe.
 *
 * ── Ce que ce mode n'atteste pas ──
 *
 * Que vos courriers arrivent VRAIMENT. Rien n'est remis, donc rien n'est filtré
 * comme indésirable, et aucun domaine n'est authentifié. Il éprouve le parcours
 * et le contenu, pas la distribution. Pour la production, il faut un vrai
 * expéditeur — Brevo offre 300 messages par jour.
 */
import nodemailer from 'nodemailer';

/** Le mode est-il demandé ? */
export function modeEssaiActif() {
  const choisi = String(process.env.EMAIL_PROVIDER || '').trim().toLowerCase();
  return choisi === 'essai' || choisi === 'ethereal';
}

/* La boîte est créée à la première demande, puis conservée : chaque appel à
   createTestAccount() fabrique une boîte différente, et les messages se
   retrouveraient éparpillés dans autant d'inbox. */
let transporteur = null;
let compte = null;

async function obtenirTransporteur() {
  if (transporteur) return transporteur;

  compte = await nodemailer.createTestAccount();
  transporteur = nodemailer.createTransport({
    host: compte.smtp.host,
    port: compte.smtp.port,
    secure: compte.smtp.secure,
    auth: { user: compte.user, pass: compte.pass },
  });

  console.log('\n╭─ Messagerie en mode ESSAI ─────────────────────────────');
  console.log('│  Boîte jetable créée. Aucun message ne part pour de vrai.');
  console.log(`│  Consulter la boîte : https://ethereal.email/login`);
  console.log(`│    identifiant : ${compte.user}`);
  console.log(`│    mot de passe : ${compte.pass}`);
  console.log('│  Plus simple : chaque envoi imprime son lien de lecture direct.');
  console.log('╰────────────────────────────────────────────────────────\n');

  return transporteur;
}

/** Envoie, puis imprime le lien qui permet de lire le message. */
export async function envoyerEnEssai({ from, to, subject, html }) {
  const t = await obtenirTransporteur();
  const info = await t.sendMail({ from, to, subject, html });
  const lien = nodemailer.getTestMessageUrl(info);

  console.log(`📨  ${subject}`);
  console.log(`    destinataire : ${to}`);
  console.log(`    à lire ici   : ${lien}\n`);

  return true;
}
