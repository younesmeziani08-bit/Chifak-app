import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { randomInt } from 'crypto';
import { escapeHtml } from './security.js';

dotenv.config();

export function isEmailConfigured() {
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
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email de vérification envoyé à ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Erreur envoi email:', error);
    console.log(`\n📧 [FALLBACK DÉMO] Code de vérification pour ${email}: ${code}\n`);
    return true;
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
    await transporter.sendMail({ from: FROM_ADDRESS, to: email, subject, html: htmlContent });
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
            <span class="detail-label">العنوان:</span>
            <span class="detail-value">${escapeHtml(appointmentDetails.address)}</span>
          </div>
        </div>
        
        <p class="message"><strong>تذكيرات مهمة:</strong></p>
        <ul class="message">
          <li>احضر قبل 10 دقائق من موعدك</li>
          <li>أحضر بطاقتك الصحية وبطاقة التأمين</li>
          <li>في حالة عدم القدرة على الحضور، الرجاء الإلغاء قبل 24 ساعة</li>
        </ul>
        
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
            <span class="detail-label">Adresse :</span>
            <span class="detail-value">${escapeHtml(appointmentDetails.address)}</span>
          </div>
        </div>
        
        <p class="message"><strong>Rappels importants :</strong></p>
        <ul class="message">
          <li>Présentez-vous 10 minutes avant l'heure du rendez-vous</li>
          <li>N'oubliez pas votre carte vitale et votre carte de mutuelle</li>
          <li>En cas d'empêchement, annulez au moins 24h à l'avance</li>
        </ul>
        
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
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email de confirmation envoyé à ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Erreur envoi email confirmation:', error.message);
    return false;
  }
}
