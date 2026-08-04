import { Booking } from '../App';
import Header from './Header';
import FloatingShapes from './FloatingShapes';
import { useLanguage } from '../contexts/LanguageContext';

interface ConfirmationPageProps {
  booking: Booking;
  onBackToHome: () => void;
  onOpenProfessional: () => void;
  onOpenLogin: () => void;
  onOpenSignup: () => void;
  patientUser?: { id: number; name: string; email: string } | null;
  onLogout?: () => void;
}

export default function ConfirmationPage({ booking, onBackToHome, onOpenProfessional, onOpenLogin, onOpenSignup, patientUser, onLogout }: ConfirmationPageProps) {
  const { language } = useLanguage();
  const isArabic = language === 'ar';

  const formattedDate = new Date(booking.date).toLocaleDateString(
    isArabic ? 'ar-DZ' : 'fr-FR',
    { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
  );

  const isVideo = booking.consultationType === 'video';

  /* En visio, l'adresse du cabinet n'a plus lieu d'être : on la remplace par
     le rappel que le lien d'appel se trouve dans « Mes rendez-vous ». */
  const details = [
    { icon: '👨‍⚕️', label: isArabic ? 'الطبيب' : 'Médecin', value: booking.doctor.name },
    { icon: '🏥', label: isArabic ? 'التخصص' : 'Spécialité', value: booking.doctor.specialty },
    { icon: '📅', label: isArabic ? 'التاريخ' : 'Date', value: formattedDate },
    { icon: '⏰', label: isArabic ? 'الوقت' : 'Heure', value: booking.time },
    {
      icon: isVideo ? '🎥' : '📍',
      label: isArabic ? (isVideo ? 'نوع الاستشارة' : 'العنوان') : (isVideo ? 'Type de consultation' : 'Adresse'),
      value: isVideo
        ? (isArabic ? 'عن بُعد بالفيديو' : 'En visioconférence')
        : `${booking.doctor.address}, ${booking.doctor.city}`,
    },
    { icon: '👤', label: isArabic ? 'المريض' : 'Patient', value: booking.patientName },
  ];

  return (
    <div className="relative min-h-screen bg-[#f8fafc] overflow-hidden" dir={isArabic ? 'rtl' : 'ltr'}>
      <FloatingShapes variant="soft" />
      <div className="relative z-10">
      <Header
        onHomeClick={onBackToHome}
        onBack={onBackToHome}
        onOpenProfessional={onOpenProfessional}
        onOpenLogin={onOpenLogin}
        onOpenSignup={onOpenSignup}
        patientUser={patientUser}
        onLogout={onLogout}
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">

        {/* Success Banner - Pro Max */}
        <div className="text-center mb-12 animate-fadeInUp">
          <div className="relative inline-flex mb-10">
            <div className="absolute inset-0 bg-green-400 blur-2xl opacity-20 animate-pulse" />
            <div className="relative w-28 h-28 bg-green-500 rounded-4xl flex items-center justify-center shadow-2xl shadow-green-500/40">
              <svg className="w-14 h-14 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <h1 className="text-3xl sm:text-6xl font-black text-gray-900 tracking-tight mb-4">
            {isArabic ? 'تم تأكيد موعدك! 🎉' : 'C\'est confirmé ! 🎉'}
          </h1>
          <p className="text-gray-500 text-lg font-medium">
            {isArabic
              ? `تم إرسال تأكيد إلى ${booking.patientEmail}`
              : `Votre rendez-vous a bien été enregistré. Un e-mail de confirmation vient d'être envoyé à ${booking.patientEmail}`}
          </p>
        </div>

        {/* Details Card - Pro Max */}
        <div className="glass-card-pro rounded-4xl overflow-hidden mb-8 animate-fadeInUp delay-100">
          <div className="bg-gray-900 p-5 sm:p-10">
            <h2 className="text-white font-black text-xl tracking-tight flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-xs">📋</span>
              {isArabic ? 'تفاصيل موعدك' : 'Récapitulatif complet'}
            </h2>
          </div>
          <div className="p-5 sm:p-10 grid grid-cols-1 sm:grid-cols-2 gap-8 divide-y sm:divide-y-0 divide-gray-100">
            {details.map((d, i) => (
              <div key={i} className="flex items-start gap-4 pt-4 sm:pt-0">
                <span className="text-2xl w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center border border-gray-100">{d.icon}</span>
                <div>
                  <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">{d.label}</p>
                  <p className="text-sm font-black text-gray-900 leading-snug">{d.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* En visio, on dit où trouver le lien — il n'est pas affiché ici,
            ni envoyé par email : uniquement dans l'espace du patient. */}
        {isVideo && (
          <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-8 mb-6 animate-fadeInUp">
            <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
              <span className="text-lg">🎥</span>
              {isArabic ? 'كيف تنضم للاستشارة' : 'Comment rejoindre la consultation'}
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              {isArabic
                ? 'يوم الموعد، افتح « مواعيدي » واضغط على « انضم للفيديو ». الرابط متاح لك وللطبيب فقط، ولا يُرسل بالبريد الإلكتروني.'
                : 'Le jour du rendez-vous, ouvrez « Mes rendez-vous » et cliquez sur « Rejoindre la visio ». Le lien n’est accessible qu’à vous et au praticien, et n’est pas envoyé par email.'}
            </p>
          </div>
        )}

        {/* Reminders - Pro Max Unified */}
        <div className="bg-blue-50 border border-blue-100 rounded-3xl p-5 sm:p-8 mb-10 animate-fadeInUp delay-200">
          <h3 className="font-black text-blue-900 mb-6 flex items-center gap-3 uppercase tracking-widest text-xs">
            <span className="text-lg">💡</span> {isArabic ? 'تذكيرات مهمة' : 'À ne pas oublier'}
          </h3>
          <ul className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(isArabic ? [
              'احضر قبل 10 دقائق من موعدك',
              'أحضر بطاقتك الصحية وبطاقة التأمين',
              'في حالة إلغاء الموعد، أعلمنا قبل 24 ساعة على الأقل'
            ] : [
              'Présentez-vous 10 minutes avant l\'heure prévue.',
              'Munissez-vous de votre carte vitale et dossier médical.',
              'En cas d\'empêchement, prévenez 24h à l\'avance.'
            ]).map((tip, i) => (
              <li key={i} className="text-xs font-bold text-blue-800 leading-relaxed bg-white/50 p-4 rounded-2xl border border-blue-100/50 shadow-sm">
                {tip}
              </li>
            ))}
          </ul>
        </div>

        {/* Actions - Pro Max */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fadeInUp delay-300">
          <button
            onClick={onBackToHome}
            className="btn-pro py-5 bg-blue-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-2xl shadow-blue-500/20 active:scale-[0.98] flex items-center justify-center gap-3"
          >
            🏠 {isArabic ? 'العودة إلى الرئيسية' : 'Retour à l\'accueil'}
          </button>
          <button
            onClick={onBackToHome}
            className="btn-pro py-5 bg-white border-2 border-gray-100 text-gray-900 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-gray-50 active:scale-[0.98] flex items-center justify-center gap-3"
          >
            ➕ {isArabic ? 'حجز موعد آخر' : 'Nouveau rendez-vous'}
          </button>
        </div>

        {/* Bottom links */}
        <div className="mt-12 text-center flex justify-center gap-10 text-[10px] font-black uppercase tracking-widest text-gray-400">
          {[
            { label: isArabic ? 'مساعدة' : 'Aide', href: '#' },
            { label: isArabic ? 'إدارة مواعيدي' : 'Gérer mes RDV', href: '#' },
            { label: isArabic ? 'اتصل بنا' : 'Support', href: '#' }
          ].map((link, i) => (
            <a key={i} href={link.href} className="hover:text-blue-600 transition-colors border-b border-transparent hover:border-blue-600">{link.label}</a>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}
