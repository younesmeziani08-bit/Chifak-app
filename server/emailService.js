import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

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

// Configuration du transporteur email
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Générer un code de vérification à 6 chiffres
export function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
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
    from: `"chifak" <${process.env.EMAIL_USER}>`,
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
        
        <p class="message">عزيزي/عزيزتي ${appointmentDetails.patientName},</p>
        <p class="message">تم تأكيد موعدك الطبي بنجاح. إليك التفاصيل:</p>
        
        <div class="details">
          <div class="detail-row">
            <span class="detail-label">الطبيب:</span>
            <span class="detail-value">${appointmentDetails.doctorName}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">التخصص:</span>
            <span class="detail-value">${appointmentDetails.specialty}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">التاريخ:</span>
            <span class="detail-value">${appointmentDetails.date}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">الوقت:</span>
            <span class="detail-value">${appointmentDetails.time}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">العنوان:</span>
            <span class="detail-value">${appointmentDetails.address}</span>
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
        
        <p class="message">Cher/Chère ${appointmentDetails.patientName},</p>
        <p class="message">Votre rendez-vous médical a été confirmé avec succès. Voici les détails :</p>
        
        <div class="details">
          <div class="detail-row">
            <span class="detail-label">Médecin :</span>
            <span class="detail-value">${appointmentDetails.doctorName}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Spécialité :</span>
            <span class="detail-value">${appointmentDetails.specialty}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Date :</span>
            <span class="detail-value">${appointmentDetails.date}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Heure :</span>
            <span class="detail-value">${appointmentDetails.time}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Adresse :</span>
            <span class="detail-value">${appointmentDetails.address}</span>
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
    from: `"chifak" <${process.env.EMAIL_USER}>`,
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
