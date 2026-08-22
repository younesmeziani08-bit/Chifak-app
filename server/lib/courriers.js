/**
 * Courriers ajoutés après l'audit : mot de passe oublié, annulation d'un
 * rendez-vous, effacement d'un compte.
 *
 * Ils vivent ici plutôt que dans emailService.js pour une raison de taille :
 * ce fichier passait 660 lignes, chaque gabarit y étant recopié en entier
 * dans les deux langues. Ici la mise en page est écrite UNE fois et les
 * textes sont fournis à part — ajouter un courrier ne veut plus dire recopier
 * quatre-vingts lignes de HTML.
 *
 * L'échappement reste la règle : tout ce qui vient d'un formulaire passe par
 * escapeHtml avant d'entrer dans le gabarit.
 */
import { escapeHtml } from '../security.js';

/**
 * Mise en page commune.
 *
 * Tableaux plutôt que flexbox, styles en ligne plutôt que feuille externe :
 * les clients de messagerie sont restés à HTML de 2005, et une mise en page
 * moderne s'y effondre.
 */
export function gabarit({ langue = 'fr', titre, corps, bouton = null, pied = null }) {
  const ar = langue === 'ar';
  const dir = ar ? 'rtl' : 'ltr';
  const align = ar ? 'right' : 'left';

  const boutonHtml = bouton
    ? `<tr><td align="center" style="padding:8px 0 28px;">
         <a href="${escapeHtml(bouton.url)}"
            style="display:inline-block;background:#1B3A8F;color:#ffffff;text-decoration:none;
                   padding:14px 32px;border-radius:8px;font-weight:bold;font-size:15px;">
           ${escapeHtml(bouton.libelle)}
         </a>
       </td></tr>`
    : '';

  const piedHtml = pied
    ? `<p style="margin:0 0 8px;font-size:13px;color:#6b7280;">${pied}</p>`
    : '';

  return `<!DOCTYPE html>
<html dir="${dir}" lang="${ar ? 'ar' : 'fr'}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px 12px;background:#eef1f6;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
    <tr><td style="padding:32px 32px 8px;text-align:center;">
      <div style="font-size:26px;font-weight:bold;color:#1B3A8F;">🏥 ${ar ? 'شفاك' : 'chifak'}</div>
    </td></tr>
    <tr><td style="padding:8px 32px 0;text-align:${align};">
      <h1 style="margin:0 0 16px;font-size:20px;color:#14192C;font-weight:bold;">${escapeHtml(titre)}</h1>
      ${corps}
    </td></tr>
    ${boutonHtml}
    <tr><td style="padding:0 32px 28px;text-align:${align};border-top:1px solid #e5e7eb;padding-top:20px;">
      ${piedHtml}
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        ${ar ? 'رسالة آلية، لا ترد عليها.' : 'Message automatique, ne pas y répondre.'}
      </p>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Paragraphe, dans le style du gabarit. */
const p = (texte) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#374151;">${texte}</p>`;

/** Le code à six chiffres, mis en évidence. */
const encadreCode = (code) => `
  <div style="background:#eef1f6;border:2px solid #1B3A8F;border-radius:10px;padding:22px;text-align:center;margin:20px 0;">
    <div style="font-size:32px;font-weight:bold;color:#1B3A8F;letter-spacing:6px;font-family:monospace;">${escapeHtml(code)}</div>
  </div>`;

/**
 * Nouveau mot de passe demandé.
 *
 * Le texte dit explicitement quoi faire si la demande ne vient pas de la
 * personne : ne rien faire. C'est important — un courrier de ce type inquiète,
 * et sans cette phrase les gens cliquent « pour vérifier », ce qui est
 * exactement ce qu'on ne veut pas leur apprendre.
 */
export function courrierMotDePasseOublie({ code, langue = 'fr' }) {
  const ar = langue === 'ar';
  return {
    subject: ar ? 'شفاك — رمز إعادة تعيين كلمة المرور' : 'chifak — code pour votre nouveau mot de passe',
    html: gabarit({
      langue,
      titre: ar ? 'إعادة تعيين كلمة المرور' : 'Nouveau mot de passe',
      corps: ar
        ? p('لقد طُلب رمز لتغيير كلمة مرور حسابك. أدخل الرمز التالي في التطبيق:')
          + encadreCode(code)
          + p('هذا الرمز صالح لمدة <strong>15 دقيقة</strong>، ويُستعمل مرة واحدة.')
        : p('Un code a été demandé pour changer le mot de passe de votre compte. Saisissez-le dans l’application :')
          + encadreCode(code)
          + p('Il est valable <strong>15 minutes</strong> et ne sert qu’une fois.'),
      pied: ar
        ? 'إذا لم تطلب هذا، فلا شيء عليك فعله: كلمة مرورك لم تتغير، وستنتهي صلاحية الرمز وحده.'
        : 'Si vous n’êtes pas à l’origine de cette demande, il n’y a rien à faire : '
          + 'votre mot de passe n’a pas changé, et le code expirera seul.',
    }),
  };
}

/** Le mot de passe vient d'être changé — avertissement, pas confirmation. */
export function courrierMotDePasseChange({ langue = 'fr' }) {
  const ar = langue === 'ar';
  return {
    subject: ar ? 'شفاك — تم تغيير كلمة المرور' : 'chifak — votre mot de passe a été changé',
    html: gabarit({
      langue,
      titre: ar ? 'تم تغيير كلمة المرور' : 'Mot de passe changé',
      corps: ar
        ? p('تم تغيير كلمة مرور حسابك للتو.')
        : p('Le mot de passe de votre compte vient d’être changé.'),
      pied: ar
        ? 'إذا لم تقم بذلك، اتصل بنا فورًا: قد يكون شخص آخر قد دخل إلى حسابك.'
        : 'Si ce n’est pas vous, contactez-nous immédiatement : quelqu’un d’autre a pu entrer dans votre compte.',
    }),
  };
}

/**
 * Rendez-vous annulé par le praticien ou par le cabinet.
 *
 * Le motif est affiché quand il y en a un. Sans lui, le patient ne sait pas
 * s'il doit reprendre rendez-vous ailleurs ou attendre qu'on le rappelle.
 */
export function courrierRendezVousAnnule({ patientName, doctorName, date, heure, motif, parQui, langue = 'fr' }) {
  const ar = langue === 'ar';
  const auteur = parQui === 'doctor'
    ? (ar ? 'الطبيب' : 'le praticien')
    : (ar ? 'الإدارة' : 'le cabinet');

  const details = `
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f6f8fb;border-radius:8px;margin:4px 0 18px;">
      <tr><td style="padding:16px 18px;font-size:15px;color:#14192C;line-height:1.8;">
        <strong>${escapeHtml(doctorName)}</strong><br>
        ${escapeHtml(date)} · ${escapeHtml(heure)}
      </td></tr>
    </table>`;

  return {
    subject: ar ? 'شفاك — أُلغي موعدك' : 'chifak — votre rendez-vous a été annulé',
    html: gabarit({
      langue,
      titre: ar ? 'أُلغي موعدك' : 'Votre rendez-vous est annulé',
      corps: (ar
        ? p(`مرحبًا ${escapeHtml(patientName)}، أُلغي الموعد التالي من طرف ${auteur}.`)
        : p(`Bonjour ${escapeHtml(patientName)}, le rendez-vous suivant a été annulé par ${auteur}.`))
        + details
        + (motif
          ? (ar ? p(`السبب المذكور: <em>${escapeHtml(motif)}</em>`) : p(`Motif indiqué : <em>${escapeHtml(motif)}</em>`))
          : '')
        + (ar
          ? p('يمكنك حجز موعد جديد من التطبيق، مع المواعيد المتاحة فعليًا.')
          : p('Vous pouvez reprendre rendez-vous depuis l’application, avec les disponibilités à jour.')),
      pied: ar ? 'نعتذر عن الإزعاج.' : 'Nous sommes désolés pour ce contretemps.',
    }),
  };
}

/**
 * Confirmation d'effacement du compte.
 *
 * Elle dit ce qui a été effacé ET ce qui est conservé. Annoncer une
 * suppression totale alors que les rendez-vous restent — parce qu'ils
 * appartiennent aussi au dossier du praticien — serait une promesse fausse.
 */
export function courrierCompteEfface({ langue = 'fr' }) {
  const ar = langue === 'ar';
  return {
    subject: ar ? 'شفاك — تم حذف حسابك' : 'chifak — votre compte a été supprimé',
    html: gabarit({
      langue,
      titre: ar ? 'تم حذف حسابك' : 'Votre compte est supprimé',
      corps: ar
        ? p('حُذف اسمك وبريدك ورقم هاتفك وكلمة مرورك نهائيًا. لم يعد بإمكانك تسجيل الدخول.')
          + p('تبقى المواعيد السابقة في سجل الطبيب دون ما يسمح بالتعرف عليك: '
            + 'فهي جزء من ملفه الطبي، وله التزاماته الخاصة في حفظه.')
        : p('Votre nom, votre adresse, votre téléphone et votre mot de passe ont été effacés '
            + 'définitivement. Vous ne pouvez plus vous connecter.')
          + p('Les rendez-vous passés restent dans le dossier du praticien, sans rien qui permette '
            + 'de vous identifier : ils font partie de son dossier médical, et il a ses propres '
            + 'obligations de conservation.'),
      pied: ar ? 'شكرًا على ثقتك.' : 'Merci de la confiance que vous nous avez accordée.',
    }),
  };
}

/**
 * Un créneau s'est libéré, et il vous est réservé.
 *
 * Le courrier dit trois choses, dans cet ordre : quel créneau, jusqu'à quand
 * il est gardé, et quoi faire. Le délai est en gras et répété : c'est la seule
 * information qui, mal comprise, fait perdre la place.
 *
 * Il ne promet pas le rendez-vous — il propose une place à confirmer. Annoncer
 * « votre rendez-vous est pris » puis le retirer deux heures plus tard serait
 * pire que de n'avoir rien envoyé.
 */
export function courrierCreneauLibere({
  patientName, doctorName, date, heure, lien, heuresDeReponse = 2, langue = 'fr',
}) {
  const ar = langue === 'ar';

  const details = `
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#EAF3EC;border:1px solid #A7D2B4;border-radius:8px;margin:4px 0 18px;">
      <tr><td style="padding:16px 18px;font-size:16px;color:#14192C;line-height:1.8;">
        <strong>${escapeHtml(doctorName)}</strong><br>
        ${escapeHtml(date)} · <strong>${escapeHtml(heure)}</strong>
      </td></tr>
    </table>`;

  return {
    subject: ar
      ? `شفاك — موعد متاح عند ${doctorName}`
      : `chifak — une place s'est libérée chez ${doctorName}`,
    html: gabarit({
      langue,
      titre: ar ? 'موعد متاح' : 'Une place s’est libérée',
      corps: (ar
        ? p(`مرحبًا ${escapeHtml(patientName)}، أنت مسجّل في قائمة الانتظار، وقد تحرّر هذا الموعد:`)
        : p(`Bonjour ${escapeHtml(patientName)}, vous êtes inscrit sur la liste d’attente et ce créneau vient de se libérer :`))
        + details
        + (ar
          ? p(`الموعد <strong>محجوز لك لمدة ${heuresDeReponse} ساعتين</strong>. أكّده الآن، وإلا عاد متاحًا لغيرك.`)
          : p(`Il vous est <strong>réservé pendant ${heuresDeReponse} heures</strong>. Confirmez-le maintenant, sinon il repart à quelqu’un d’autre.`)),
      bouton: { url: lien, libelle: ar ? 'تأكيد الموعد' : 'Confirmer ce rendez-vous' },
      pied: ar
        ? 'لا يناسبك؟ لا تفعل شيئًا: سيُقترح على التالي، وتبقى أنت في القائمة للمرة القادمة.'
        : 'Ce créneau ne vous convient pas ? Ne faites rien : il sera proposé au suivant, '
          + 'et vous resterez sur la liste pour la prochaine fois.',
    }),
  };
}

/** Confirmation d'inscription sur la liste d'attente, avec le lien pour en sortir. */
export function courrierInscritEnAttente({ patientName, doctorName, lienSortie, langue = 'fr' }) {
  const ar = langue === 'ar';
  return {
    subject: ar
      ? `شفاك — أنت في قائمة الانتظار عند ${doctorName}`
      : `chifak — vous êtes sur la liste d'attente de ${doctorName}`,
    html: gabarit({
      langue,
      titre: ar ? 'أنت في قائمة الانتظار' : 'Vous êtes sur la liste d’attente',
      corps: ar
        ? p(`مرحبًا ${escapeHtml(patientName)}، سنُعلمك فور تحرّر موعد عند <strong>${escapeHtml(doctorName)}</strong>.`)
          + p('يُحجز لك الموعد ساعتين لتأكيده. لا داعي للعودة إلى التطبيق بانتظام.')
        : p(`Bonjour ${escapeHtml(patientName)}, nous vous préviendrons dès qu’un créneau se libérera chez <strong>${escapeHtml(doctorName)}</strong>.`)
          + p('La place vous sera réservée deux heures, le temps de la confirmer. '
            + 'Inutile de revenir consulter l’application régulièrement.'),
      bouton: { url: lienSortie, libelle: ar ? 'الخروج من القائمة' : 'Me retirer de la liste' },
      pied: ar
        ? 'يمكنك الخروج من القائمة في أي وقت عبر هذا الرابط.'
        : 'Vous pouvez vous retirer à tout moment depuis ce lien.',
    }),
  };
}
