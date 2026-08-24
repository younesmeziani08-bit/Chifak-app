import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { randomInt } from 'crypto';
import { escapeHtml } from './security.js';
import { envoyerParHttp, messagerieHttpConfiguree } from './lib/messagerieHttp.js';
import { adresseFront } from './config/adresses.js';

dotenv.config();

export function isEmailConfigured() {
  /* Deux voies possibles, et il suffit qu'une seule soit ouverte.
     La voie API est vérifiée d'abord : quand elle est configurée, les
     identifiants SMTP n'ont plus à l'être, et exiger les deux ferait passer
     pour « non configurée » une messagerie qui fonctionne parfaitement. */
  if (messagerieHttpConfiguree()) return true;

  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD;
  return Boolean(
    user &&
    pass &&
    user !== 'your_email@gmail.com' &&
    pass !== 'your_app_password_16_chars'
  );
}

// Adresse d'expéditeur (doit être validée chez le fournisseur, ex : Brevo/Resend)
const FROM_ADDRESS = process.env.EMAIL_FROM || `"chifak" <${process.env.EMAIL_USER}>`;

// Configuration du transporteur email.
// Compatible avec n'importe quel fournisseur SMTP (Brevo, Resend, SendGrid, Gmail...).
// - Avec EMAIL_HOST défini : SMTP générique (recommandé pour Brevo/Resend).
// - Sinon : on retombe sur Gmail (dépannage).
const transporter = process.env.EMAIL_HOST
  ? nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === 'true' || Number(process.env.EMAIL_PORT) === 465,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    })
  : nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

/**
 * Achemine un message, par l'API du fournisseur ou par SMTP.
 *
 * Toutes les fonctions d'envoi passent par ici. C'est le seul endroit qui sait
 * laquelle des deux voies est ouverte — ailleurs, on compose un message et on
 * demande qu'il parte.
 */
async function acheminer({ to, subject, html }) {
  if (messagerieHttpConfiguree()) {
    return envoyerParHttp(to, { subject, html });
  }
  await transporter.sendMail({ from: FROM_ADDRESS, to, subject, html });
  return true;
}

// Générer un code de vérification à 6 chiffres.
// SÉCURITÉ : on utilise un générateur cryptographique (crypto.randomInt) et non
// Math.random(), dont les valeurs sont prédictibles et pourraient être devinées.
export function generateVerificationCode() {
  return String(randomInt(100000, 1000000));
}

// Envoyer un email de vérification
export async function sendVerificationEmail(email, code, language = 'fr') {
  const subject = language === 'ar' 
    ? 'شفاك - رمز التحقق من حسابك'
    : 'chifak - Code de vérification';

  const htmlContent = language === 'ar' ? `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 32px; font-weight: bold; color: #2563eb; }
        .code-box { background: #eff6ff; border: 2px solid #2563eb; border-radius: 10px; padding: 30px; text-align: center; margin: 30px 0; }
        .code { font-size: 36px; font-weight: bold; color: #2563eb; letter-spacing: 5px; }
        .message { color: #666; line-height: 1.6; margin-bottom: 20px; }
        .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; }
        .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🏥 شفاك</div>
          <p style="color: #666;">منصة حجز المواعيد الطبية</p>
        </div>
        
        <p class="message">مرحباً!</p>
        <p class="message">شكراً لتسجيلك في شفاك. استخدم رمز التحقق أدناه لإكمال إنشاء حسابك:</p>
        
        <div class="code-box">
          <div style="color: #666; margin-bottom: 10px;">رمز التحقق الخاص بك</div>
          <div class="code">${code}</div>
        </div>
        
        <p class="message">سيبقى هذا الرمز صالحاً لمدة <strong>10 دقائق</strong>.</p>
        <p class="message">إذا لم تطلب هذا الرمز، يرجى تجاهل هذا البريد الإلكتروني.</p>
        
        <div class="footer">
          <p>© 2026 شفاك. جميع الحقوق محفوظة.</p>
          <p>لا ترد على هذا البريد الإلكتروني</p>
        </div>
      </div>
    </body>
    </html>
  ` : `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 32px; font-weight: bold; color: #2563eb; }
        .code-box { background: #eff6ff; border: 2px solid #2563eb; border-radius: 10px; padding: 30px; text-align: center; margin: 30px 0; }
        .code { font-size: 36px; font-weight: bold; color: #2563eb; letter-spacing: 5px; }
        .message { color: #666; line-height: 1.6; margin-bottom: 20px; }
        .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; }
        .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🏥 chifak</div>
          <p style="color: #666;">Plateforme de réservation médicale</p>
        </div>
        
        <p class="message">Bonjour,</p>
        <p class="message">Merci de vous être inscrit sur chifak. Utilisez le code de vérification ci-dessous pour finaliser la création de votre compte :</p>
        
        <div class="code-box">
          <div style="color: #666; margin-bottom: 10px;">Votre code de vérification</div>
          <div class="code">${code}</div>
        </div>
        
        <p class="message">Ce code est valide pendant <strong>10 minutes</strong>.</p>
        <p class="message">Si vous n'avez pas demandé ce code, veuillez ignorer cet email.</p>
        
        <div class="footer">
          <p>© 2026 chifak. Tous droits réservés.</p>
          <p>Ne répondez pas à cet email</p>
        </div>
      </div>
    </body>
    </html>
  `;

  if (!isEmailConfigured()) {
    /* Le code n'apparaît dans les logs qu'en développement. En production,
       les logs Render sont un stockage partagé et durable : y écrire un code
       de vérification revient à le publier. Si l'e-mail n'est pas configuré
       en production, la vérification échoue franchement — c'est un problème
       de configuration à corriger, pas à contourner. */
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ EMAIL_USER/EMAIL_PASSWORD absents : impossible d\'envoyer le code de vérification.');
      return false;
    }
    console.log('\n📧 [MODE DÉMO] Code de vérification');
    console.log(`   Email : ${email}`);
    console.log(`   Code  : ${code}\n`);
    return true;
  }

  const mailOptions = {
    from: FROM_ADDRESS,
    to: email,
    subject: subject,
    html: htmlContent
  };

  try {
    await acheminer(mailOptions);
    console.log(`✅ Email de vérification envoyé à ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Erreur envoi email:', error.message);
    // Même règle : le code ne sort dans les logs qu'en développement.
    if (process.env.NODE_ENV !== 'production') {
      console.log(`\n📧 [FALLBACK DÉMO] Code de vérification pour ${email}: ${code}\n`);
      return true;
    }
    return false;
  }
}

// Envoyer au médecin l'agenda du jour (créneaux réservés + créneaux libres)
export async function sendDoctorDailyAgenda(email, doctorName, dateLabel, slots) {
  const reserved = slots.filter((s) => s.reserved).length;
  const free = slots.length - reserved;
  const subject = `chifak - Votre agenda du ${dateLabel} (${reserved} RDV, ${free} libres)`;

  const rows = slots.map((s) => {
    if (s.reserved) {
      const p = s.patient || {};
      return `
        <tr style="background:#eff6ff;">
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-weight:bold;color:#1e3a8a;white-space:nowrap;">${escapeHtml(s.time)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#1d4ed8;font-weight:bold;">Réservé</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#111827;">${escapeHtml(p.name) || '-'}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#374151;white-space:nowrap;">${escapeHtml(p.phone) || '-'}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;">${escapeHtml(p.reason)}</td>
        </tr>`;
    }
    return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#111827;white-space:nowrap;">${escapeHtml(s.time)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#16a34a;">Libre</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#9ca3af;" colspan="3">—</td>
      </tr>`;
  }).join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="UTF-8"></head>
    <body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;">
      <div style="max-width:640px;margin:0 auto;background:#fff;padding:32px;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.08);">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="font-size:26px;font-weight:bold;color:#0e75c4;">chifak</div>
          <p style="color:#666;margin:4px 0 0;">Votre agenda du ${escapeHtml(dateLabel)}</p>
        </div>
        <p style="color:#374151;">Bonjour ${escapeHtml(doctorName)},</p>
        <p style="color:#374151;">Voici votre programme du jour : <strong>${reserved}</strong> rendez-vous et <strong>${free}</strong> créneaux encore libres.</p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px;">
          <thead>
            <tr style="background:#f9fafb;text-align:left;">
              <th style="padding:10px 12px;border-bottom:2px solid #e5e7eb;color:#374151;">Heure</th>
              <th style="padding:10px 12px;border-bottom:2px solid #e5e7eb;color:#374151;">État</th>
              <th style="padding:10px 12px;border-bottom:2px solid #e5e7eb;color:#374151;">Patient</th>
              <th style="padding:10px 12px;border-bottom:2px solid #e5e7eb;color:#374151;">Téléphone</th>
              <th style="padding:10px 12px;border-bottom:2px solid #e5e7eb;color:#374151;">Motif</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="text-align:center;color:#999;font-size:12px;margin-top:28px;border-top:1px solid #eee;padding-top:16px;">
          <p>© 2026 chifak. E-mail automatique, ne pas répondre.</p>
        </div>
      </div>
    </body>
    </html>`;

  if (!isEmailConfigured()) {
    console.log(`\n📧 [MODE DÉMO] Agenda du ${dateLabel} pour ${doctorName} (${email}) : ${reserved} RDV / ${free} libres\n`);
    return true;
  }

  try {
    await acheminer({ to: email, subject, html: htmlContent });
    console.log(`✅ Agenda du jour envoyé à ${doctorName} <${email}>`);
    return true;
  } catch (error) {
    console.error(`❌ Erreur envoi agenda à ${email}:`, error.message);
    return false;
  }
}

// Envoyer un email de confirmation de rendez-vous
export async function sendAppointmentConfirmation(email, appointmentDetails, language = 'fr') {
  const subject = language === 'ar'
    ? 'شفاك - تأكيد موعدك الطبي'
    : 'chifak - Confirmation de votre rendez-vous';

  const htmlContent = language === 'ar' ? `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: white; padding: 30px; border-radius: 10px; }
        .success-icon { font-size: 48px; margin-bottom: 10px; }
        .details { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
        .detail-label { font-weight: bold; color: #374151; }
        .detail-value { color: #6b7280; }
        .message { color: #666; line-height: 1.6; }
        .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="success-icon">✅</div>
          <h1 style="margin: 0;">تم تأكيد موعدك!</h1>
        </div>
        
        <p class="message">عزيزي/عزيزتي ${escapeHtml(appointmentDetails.patientName)},</p>
        <p class="message">تم تأكيد موعدك الطبي بنجاح. إليك التفاصيل:</p>
        
        <div class="details">
          <div class="detail-row">
            <span class="detail-label">الطبيب:</span>
            <span class="detail-value">${escapeHtml(appointmentDetails.doctorName)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">التخصص:</span>
            <span class="detail-value">${escapeHtml(appointmentDetails.specialty)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">التاريخ:</span>
            <span class="detail-value">${escapeHtml(appointmentDetails.date)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">الوقت:</span>
            <span class="detail-value">${escapeHtml(appointmentDetails.time)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">نوع الاستشارة:</span>
            <span class="detail-value">${appointmentDetails.consultationType === 'video' ? 'عن بُعد بالفيديو' : 'في العيادة'}</span>
          </div>
          ${appointmentDetails.consultationType === 'video' ? '' : `<div class="detail-row">
            <span class="detail-label">العنوان:</span>
            <span class="detail-value">${escapeHtml(appointmentDetails.address)}</span>
          </div>`}
        </div>
        
        <p class="message"><strong>تذكيرات مهمة:</strong></p>
        <ul class="message">
          <li>احضر قبل 10 دقائق من موعدك</li>
          <li>أحضر بطاقتك الصحية وبطاقة التأمين</li>
          <li>في حالة عدم القدرة على الحضور، الرجاء الإلغاء قبل 24 ساعة</li>
        </ul>
        
        ${appointmentDetails.cancelUrl ? `
        <div style="text-align:center;margin:24px 0 8px;">
          <a href="${escapeHtml(appointmentDetails.cancelUrl)}" style="display:inline-block;background:#f4f4f4;color:#374151;border:1px solid #d1d5db;text-decoration:none;padding:12px 26px;border-radius:8px;font-size:14px;">
            عرض موعدي أو إلغاؤه
          </a>
          <p style="color:#9ca3af;font-size:12px;margin-top:10px;">رابط شخصي — لا تشاركه مع أحد.</p>
        </div>` : ''}

        <div class="footer">
          <p>© 2026 شفاك. جميع الحقوق محفوظة.</p>
        </div>
      </div>
    </body>
    </html>
  ` : `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: white; padding: 30px; border-radius: 10px; }
        .success-icon { font-size: 48px; margin-bottom: 10px; }
        .details { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
        .detail-label { font-weight: bold; color: #374151; }
        .detail-value { color: #6b7280; }
        .message { color: #666; line-height: 1.6; }
        .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="success-icon">✅</div>
          <h1 style="margin: 0;">Rendez-vous confirmé !</h1>
        </div>
        
        <p class="message">Cher/Chère ${escapeHtml(appointmentDetails.patientName)},</p>
        <p class="message">Votre rendez-vous médical a été confirmé avec succès. Voici les détails :</p>
        
        <div class="details">
          <div class="detail-row">
            <span class="detail-label">Médecin :</span>
            <span class="detail-value">${escapeHtml(appointmentDetails.doctorName)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Spécialité :</span>
            <span class="detail-value">${escapeHtml(appointmentDetails.specialty)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Date :</span>
            <span class="detail-value">${escapeHtml(appointmentDetails.date)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Heure :</span>
            <span class="detail-value">${escapeHtml(appointmentDetails.time)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Type de consultation :</span>
            <span class="detail-value">${appointmentDetails.consultationType === 'video' ? 'Téléconsultation vidéo' : 'Au cabinet'}</span>
          </div>
          ${appointmentDetails.consultationType === 'video' ? '' : `<div class="detail-row">
            <span class="detail-label">Adresse :</span>
            <span class="detail-value">${escapeHtml(appointmentDetails.address)}</span>
          </div>`}
        </div>
        
        <p class="message"><strong>Rappels importants :</strong></p>
        <ul class="message">
          <li>Présentez-vous 10 minutes avant l'heure du rendez-vous</li>
          <li>N'oubliez pas votre carte vitale et votre carte de mutuelle</li>
          <li>En cas d'empêchement, annulez au moins 24h à l'avance</li>
        </ul>
        
        ${appointmentDetails.cancelUrl ? `
        <div style="text-align:center;margin:24px 0 8px;">
          <a href="${escapeHtml(appointmentDetails.cancelUrl)}" style="display:inline-block;background:#f4f4f4;color:#374151;border:1px solid #d1d5db;text-decoration:none;padding:12px 26px;border-radius:8px;font-size:14px;">
            Voir ou annuler mon rendez-vous
          </a>
          <p style="color:#9ca3af;font-size:12px;margin-top:10px;">Lien personnel — ne le transmettez à personne.</p>
        </div>` : ''}

        <div class="footer">
          <p>© 2026 chifak. Tous droits réservés.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  if (!isEmailConfigured()) {
    console.log(`\n📧 [MODE DÉMO] Confirmation RDV envoyée (simulation) à ${email}\n`);
    return true;
  }

  const mailOptions = {
    from: FROM_ADDRESS,
    to: email,
    subject: subject,
    html: htmlContent
  };

  try {
    await acheminer(mailOptions);
    console.log(`✅ Email de confirmation envoyé à ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Erreur envoi email confirmation:', error.message);
    return false;
  }
}

/* ── Réponses aux demandes d'inscription des praticiens ──
 *
 * Un praticien déposait sa demande, lisait « vous recevrez votre code de
 * connexion par e-mail », et n'entendait plus jamais parler de personne :
 * aucun envoi n'existait, ni à l'acceptation, ni au refus. Sa fiche pouvait
 * être en ligne depuis des semaines sans qu'il le sache, et le motif d'un
 * refus — que l'administration est pourtant obligée d'écrire — ne quittait
 * jamais la base.
 *
 * Ces deux courriers ferment la boucle. Ils reprennent la même mise en page
 * sobre que les autres envois du service.
 */

/** Enveloppe commune : même cadre, même pied, dans les deux langues. */
function gabaritPraticien({ ar, titre, intro, corps, pied }) {
  return `<!DOCTYPE html>
<html dir="${ar ? 'rtl' : 'ltr'}" lang="${ar ? 'ar' : 'fr'}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#F3F6FD;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:14px;overflow:hidden;border:1px solid #DDE5F5;">
    <div style="padding:22px 28px;border-bottom:1px solid #EEF2FB;">
      <span style="font-size:19px;font-weight:bold;color:#07008F;letter-spacing:-0.3px;">chifak</span>
    </div>
    <div style="padding:28px;">
      <h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;color:#0C0E45;">${titre}</h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#454A73;">${intro}</p>
      ${corps}
      <p style="margin:22px 0 0;font-size:14px;line-height:1.65;color:#6B7096;">${pied}</p>
    </div>
    <div style="padding:16px 28px;background:#F8FAFE;border-top:1px solid #EEF2FB;">
      <p style="margin:0;font-size:12px;color:#6B7096;">
        ${ar ? 'هذه رسالة آلية، لا داعي للرد عليها.' : 'Message automatique, merci de ne pas y répondre.'}
      </p>
    </div>
  </div>
</body>
</html>`;
}

/** Envoi mutualisé : mode démo, journalisation, et jamais d'exception remontée. */
async function envoyerAuPraticien(email, subject, html, etiquette) {
  if (!isEmailConfigured()) {
    console.log(`\n📧 [MODE DÉMO] ${etiquette} — destinataire : ${email}\n`);
    return true;
  }
  try {
    await acheminer({ to: email, subject, html });
    console.log(`✅ ${etiquette} envoyé à ${email}`);
    return true;
  } catch (error) {
    console.error(`❌ Erreur envoi ${etiquette} à ${email}:`, error.message);
    return false;
  }
}

/**
 * Demande acceptée : la fiche est en ligne, voici le code de connexion.
 *
 * Le mot de passe n'est PAS rappelé, et ne peut pas l'être : il n'existe
 * qu'en empreinte. C'est celui que le praticien a choisi lui-même — le lui
 * redire suffit, l'écrire serait impossible et dangereux.
 */
export async function sendDoctorApproval(email, { doctorName, doctorCode, language = 'fr' }) {
  const ar = language === 'ar';
  const subject = ar
    ? `شفاك - تم قبول طلبك (${doctorCode})`
    : `chifak - Votre inscription est acceptée (${doctorCode})`;

  const corps = `
      <div style="background:#F3F6FD;border-radius:10px;padding:18px;text-align:center;">
        <p style="margin:0 0 8px;font-size:13px;color:#6B7096;">
          ${ar ? 'رمز الدخول الخاص بك' : 'Votre code de connexion'}
        </p>
        <p style="margin:0;font-size:26px;font-weight:bold;letter-spacing:2px;color:#07008F;font-family:monospace;">
          ${escapeHtml(doctorCode)}
        </p>
      </div>
      <p style="margin:18px 0 0;font-size:15px;line-height:1.65;color:#454A73;">
        ${ar
          ? 'استعمل هذا الرمز مع كلمة المرور التي اخترتها عند التسجيل للدخول إلى فضائك.'
          : 'Utilisez ce code avec le mot de passe que vous avez choisi lors de votre demande pour accéder à votre espace.'}
      </p>`;

  return envoyerAuPraticien(email, subject, gabaritPraticien({
    ar,
    titre: ar ? 'تم قبول طلبك' : 'Votre inscription est acceptée',
    intro: ar
      ? `مرحبًا ${escapeHtml(doctorName)}، ملفك الآن منشور ويمكن للمرضى العثور عليك وحجز مواعيد لديك.`
      : `Bonjour ${escapeHtml(doctorName)}, votre fiche est désormais publiée : les patients peuvent vous trouver et réserver un rendez-vous.`,
    corps,
    pied: ar
      ? 'ننصحك بضبط أيامك وساعاتك من فضاءك قبل استقبال أول موعد.'
      : 'Pensez à régler vos jours et vos horaires depuis votre espace avant votre premier rendez-vous.',
  }), 'Acceptation praticien');
}

/**
 * Demande refusée, avec le motif écrit par l'administration.
 *
 * Le motif est obligatoire à la saisie précisément pour être transmis ici.
 * Sans cet envoi, il restait en base sans jamais atteindre l'intéressé, qui
 * ne pouvait ni comprendre ni corriger son dossier.
 */
export async function sendDoctorRejection(email, { doctorName, reason, language = 'fr' }) {
  const ar = language === 'ar';
  const subject = ar ? 'شفاك - بخصوص طلب تسجيلك' : 'chifak - Concernant votre demande d’inscription';

  const corps = `
      <div style="background:#F8FAFE;border-inline-start:3px solid #6B7096;border-radius:0;padding:14px 16px;">
        <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#6B7096;">
          ${ar ? 'السبب' : 'Motif'}
        </p>
        <p style="margin:0;font-size:15px;line-height:1.65;color:#0C0E45;">${escapeHtml(reason)}</p>
      </div>`;

  return envoyerAuPraticien(email, subject, gabaritPraticien({
    ar,
    titre: ar ? 'لم نتمكن من قبول طلبك' : 'Nous n’avons pas pu retenir votre demande',
    intro: ar
      ? `مرحبًا ${escapeHtml(doctorName)}، بعد فحص ملفك، لم نتمكن من قبوله في هذه المرحلة.`
      : `Bonjour ${escapeHtml(doctorName)}, après examen de votre dossier, nous n’avons pas pu le retenir à ce stade.`,
    corps,
    pied: ar
      ? 'يمكنك إيداع طلب جديد بعد تصحيح ما ورد أعلاه.'
      : 'Vous pouvez déposer une nouvelle demande après avoir corrigé le point ci-dessus.',
  }), 'Refus praticien');
}

/**
 * Rappel de rendez-vous, envoyé la veille au soir.
 *
 * ── Pourquoi c'est la fonction qui manquait le plus ──
 *
 * Le praticien recevait son agenda chaque matin. Le patient, lui, n'avait plus
 * aucune nouvelle après la confirmation initiale. Un rendez-vous pris trois
 * semaines à l'avance s'oublie — et l'absence au rendez-vous est précisément
 * le problème que cette plateforme est censée résoudre pour les cabinets.
 *
 * ── Ce que le message contient, et pourquoi ──
 *
 * L'heure et le lieu, évidemment. Mais aussi le lien pour annuler : un patient
 * empêché qui ne trouve pas comment le dire ne prévient personne, et le
 * créneau est perdu pour tout le monde. Lui rendre l'annulation facile n'est
 * pas une faveur, c'est ce qui remet le créneau en circulation.
 *
 * Le rappel d'apporter carte et dossier ne s'affiche qu'au cabinet : on ne
 * demande pas d'« apporter » quelque chose à quelqu'un qui ne se déplace pas.
 */
export async function sendAppointmentReminder(email, {
  patientName, doctorName, specialty, date, time, address,
  consultationType = 'cabinet', childName = null, language = 'fr',
}) {
  const ar = language === 'ar';
  const visio = consultationType === 'video';

  const jour = (() => {
    try {
      return new Date(`${date}T12:00:00`).toLocaleDateString(ar ? 'ar-DZ' : 'fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long',
      });
    } catch { return date; }
  })();

  const subject = ar
    ? `شفاك - تذكير: موعدك غدًا على الساعة ${time}`
    : `chifak - Rappel : votre rendez-vous demain à ${time}`;

  /* Le nom qui figure en tête est celui de la personne RÉELLEMENT attendue.
     Un parent qui a pris rendez-vous pour son fils doit lire le nom de son
     fils, sinon il croit qu'il s'agit du sien et se présente seul. */
  const attendu = childName
    ? escapeHtml(childName)
    : escapeHtml(patientName);

  const lieu = visio
    ? (ar
      ? 'من المنزل — بالفيديو'
      : 'Depuis chez vous — en visioconférence')
    : escapeHtml(address);

  const consigne = visio
    ? (ar
      ? 'يظهر رابط الاتصال في « حسابي › مواعيدي » يوم الموعد. حضّر بطاقتك وملفك الطبي بقربك، وتأكد من اتصالك بالإنترنت.'
      : 'Le lien d’appel apparaît dans « Mon compte › Mes rendez-vous » le jour venu. Préparez votre carte et votre dossier médical à portée de main, et vérifiez votre connexion internet.')
    : (ar
      ? 'لا تنسَ بطاقتك الصحية وملفك الطبي.'
      : 'N’oubliez pas votre carte et votre dossier médical.');

  const front = adresseFront();

  const html = `<!DOCTYPE html>
<html dir="${ar ? 'rtl' : 'ltr'}" lang="${ar ? 'ar' : 'fr'}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#F3F6FD;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:14px;overflow:hidden;border:1px solid #DDE5F5;">
    <div style="padding:22px 28px;border-bottom:1px solid #EEF2FB;">
      <span style="font-size:19px;font-weight:bold;color:#07008F;letter-spacing:-0.3px;">chifak</span>
    </div>
    <div style="padding:28px;">
      <h1 style="margin:0 0 6px;font-size:21px;line-height:1.3;color:#0C0E45;">
        ${ar ? 'موعدك غدًا' : 'Votre rendez-vous, c’est demain'}
      </h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.65;color:#454A73;">
        ${ar ? `مرحبًا ${escapeHtml(patientName)}،` : `Bonjour ${escapeHtml(patientName)},`}
      </p>

      <div style="background:#F3F6FD;border-radius:10px;padding:18px;">
        <p style="margin:0 0 10px;font-size:22px;font-weight:bold;color:#07008F;">${jour} · ${escapeHtml(time)}</p>
        <p style="margin:0 0 4px;font-size:15px;color:#0C0E45;"><strong>${escapeHtml(doctorName)}</strong> — ${escapeHtml(specialty)}</p>
        <p style="margin:0;font-size:15px;color:#454A73;">${lieu}</p>
        ${childName ? `<p style="margin:10px 0 0;font-size:14px;color:#454A73;">${ar ? 'الموعد باسم' : 'Au nom de'} : <strong>${attendu}</strong></p>` : ''}
      </div>

      <p style="margin:18px 0 0;font-size:15px;line-height:1.65;color:#454A73;">${consigne}</p>

      <div style="margin:24px 0 0;padding:16px;background:#FFFAEB;border-radius:10px;">
        <p style="margin:0 0 6px;font-size:14px;font-weight:bold;color:#93370D;">
          ${ar ? 'هل طرأ ما يمنعك؟' : 'Un empêchement ?'}
        </p>
        <p style="margin:0;font-size:14px;line-height:1.65;color:#93370D;">
          ${ar
            ? `ألغِ موعدك من <a href="${front}" style="color:#93370D;">حسابك</a> حتى يستفيد منه مريض آخر.`
            : `Annulez depuis <a href="${front}" style="color:#93370D;">votre compte</a> pour qu’un autre patient puisse en profiter.`}
        </p>
      </div>
    </div>
    <div style="padding:16px 28px;background:#F8FAFE;border-top:1px solid #EEF2FB;">
      <p style="margin:0;font-size:12px;color:#6B7096;">
        ${ar ? 'هذه رسالة آلية، لا داعي للرد عليها.' : 'Message automatique, merci de ne pas y répondre.'}
      </p>
    </div>
  </div>
</body>
</html>`;

  if (!isEmailConfigured()) {
    console.log(`\n📧 [MODE DÉMO] Rappel — ${email} · ${date} ${time} · ${doctorName}\n`);
    return true;
  }
  try {
    await acheminer({ to: email, subject, html });
    return true;
  } catch (error) {
    console.error(`❌ Erreur envoi rappel à ${email}:`, error.message);
    return false;
  }
}

/**
 * Envoi générique d'un courrier déjà composé (voir lib/courriers.js).
 *
 * Les fonctions ci-dessus recopient chacune leur gabarit et leur logique
 * d'envoi. Celle-ci sépare enfin les deux : la composition vit dans
 * lib/courriers.js, l'acheminement ici. Tout nouveau courrier passe par elle.
 *
 * Même contrat que les autres : elle ne lève jamais, et rend false quand le
 * message n'est pas parti — l'appelant décide alors s'il poursuit ou non.
 */
export async function envoyerCourrier(email, { subject, html }) {
  if (!isEmailConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      console.error(`❌ Messagerie non configurée : « ${subject} » n'est pas parti vers ${email}.`);
      return false;
    }
    console.log(`\n📧 [MODE DÉMO] « ${subject} » → ${email}\n`);
    return true;
  }
  try {
    await acheminer({ to: email, subject, html });
    console.log(`✅ « ${subject} » envoyé à ${email}`);
    return true;
  } catch (error) {
    console.error(`❌ Erreur envoi « ${subject} » à ${email}:`, error.message);
    return false;
  }
}
