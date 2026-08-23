import { Booking } from '../../App';
import Header from '../shared/Header';
import { useLanguage } from '../../contexts/LanguageContext';
import { Bouton, CarteRdv, Icone } from '../shared/Carte';

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

  const isVideo = booking.consultationType === 'video';

  /* Le nom porté sur la carte est celui que le praticien appellera en salle
     d'attente — celui de l'enfant quand le rendez-vous est pris pour lui,
     pas celui du parent qui tient le compte. */
  const nomPresente = booking.forChild && booking.childFirstName
    ? `${booking.childFirstName} ${booking.childLastName ?? ''}`.trim()
    : booking.patientName;

  /* Un seul des trois rappels fait perdre la consultation quand on l'oublie.
     Le signaler tous les trois reviendrait à n'en signaler aucun. */
  const RAPPELS = isArabic
    ? [
      { texte: 'احضر قبل 10 دقائق من موعدك', critique: false },
      { texte: 'أحضر بطاقتك الصحية وملفك الطبي', critique: true },
      { texte: 'في حال تعذّر الحضور، أعلمنا قبل 24 ساعة', critique: false },
    ]
    : [
      { texte: 'Présentez-vous 10 minutes avant l’heure prévue.', critique: false },
      { texte: 'Munissez-vous de votre carte et de votre dossier médical.', critique: true },
      { texte: 'En cas d’empêchement, prévenez 24 h à l’avance.', critique: false },
    ];

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-2)' }} dir={isArabic ? 'rtl' : 'ltr'}>
      <Header
        onHomeClick={onBackToHome}
        onBack={onBackToHome}
        onOpenProfessional={onOpenProfessional}
        onOpenLogin={onOpenLogin}
        onOpenSignup={onOpenSignup}
        patientUser={patientUser}
        onLogout={onLogout}
      />

      <div className="max-w-md mx-auto px-4 py-10 sm:py-14">

        {/* La confirmation se dit une fois, calmement. Un halo vert pulsant
            derrière une coche géante fête l'événement à la place du patient —
            qui, lui, veut surtout savoir quand et où il doit se présenter. */}
        <div className="flex items-center gap-3 mb-3">
          <span
            className="flex-shrink-0 grid place-items-center"
            style={{ width: 40, height: 40, borderRadius: 'var(--r-md)', background: 'var(--accent-bg)', color: 'var(--success)' }}
          >
            <Icone nom="coche" />
          </span>
          <h1
            className="text-2xl leading-tight"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--ink)' }}
          >
            {isArabic ? 'تم تأكيد موعدك' : 'C’est confirmé'}
          </h1>
        </div>

        <p className="text-[15px] leading-relaxed mb-6" style={{ color: 'var(--ink-2)' }}>
          {isArabic
            ? 'أُرسل تأكيد إلى '
            : 'Un e-mail de confirmation vient de partir à l’adresse '}
          <span style={{ color: 'var(--ink)' }}>{booking.patientEmail}</span>.
        </p>

        {/* La carte : l'objet que le patient garde. */}
        <CarteRdv
          praticien={booking.doctor.name}
          specialite={booking.doctor.specialty}
          date={booking.date}
          heure={booking.time}
          adresse={isVideo ? null : `${booking.doctor.address}, ${booking.doctor.city}`}
          isArabic={isArabic}
        >
          {isVideo && (
            <p
              className="flex items-start gap-2 mt-4 text-[13px] leading-relaxed"
              style={{ color: 'var(--ink-2)' }}
            >
              <Icone nom="video" className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{isArabic ? 'استشارة بالفيديو' : 'Consultation en visioconférence'}</span>
            </p>
          )}
          <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--tint-10)' }}>
            <p className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
              {isArabic ? 'المريض' : 'Patient'}
            </p>
            <p className="text-[15px] mt-0.5" style={{ color: 'var(--ink)', fontWeight: 600 }}>
              {nomPresente}
            </p>
          </div>
        </CarteRdv>

        {/* En visio, le lien d'appel n'est ni affiché ici ni envoyé par
            e-mail : on dit seulement où le retrouver. */}
        {isVideo && (
          <div className="mt-6 p-4" style={{ background: 'var(--bg)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-xs)' }}>
            <p className="text-[14px] mb-1" style={{ color: 'var(--ink)', fontWeight: 600 }}>
              {isArabic ? 'كيف تنضم للاستشارة' : 'Rejoindre la consultation'}
            </p>
            <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
              {isArabic
                ? 'يوم الموعد، افتح « مواعيدي » واضغط على « انضم للفيديو ». الرابط متاح لك وللطبيب فقط.'
                : 'Le jour du rendez-vous, ouvrez « Mes rendez-vous » et cliquez sur « Rejoindre la visio ». Le lien n’est accessible qu’à vous et au praticien.'}
            </p>
          </div>
        )}

        <ul className="mt-8 space-y-2.5">
          {RAPPELS.map(({ texte, critique }) => (
            <li
              key={texte}
              className="flex items-start gap-2.5 text-[14px] leading-relaxed p-3.5"
              style={critique
                ? { borderRadius: 'var(--r-md)', color: 'var(--danger)', background: 'rgba(180,35,24,.05)' }
                : { borderRadius: 'var(--r-md)', color: 'var(--ink-2)' }}
            >
              <span className="flex-shrink-0 mt-0.5">
                <Icone nom={critique ? 'alerte' : 'coche'} className="w-4 h-4" />
              </span>
              <span>{texte}</span>
            </li>
          ))}
        </ul>

        <div className="mt-8 space-y-2.5">
          <Bouton onClick={onBackToHome}>
            {isArabic ? 'حجز موعد آخر' : 'Prendre un autre rendez-vous'}
          </Bouton>
          <Bouton variante="discret" onClick={onBackToHome}>
            {isArabic ? 'العودة إلى الرئيسية' : 'Retour à l’accueil'}
          </Bouton>
        </div>
      </div>
    </div>
  );
}
