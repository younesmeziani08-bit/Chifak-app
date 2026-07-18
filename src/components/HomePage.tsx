import { useState } from 'react';
import type { ReactNode } from 'react';
import Header from './Header';
import LocationSelector from './LocationSelector';
import LogoMark from './LogoMark';
import { useLanguage } from '../contexts/LanguageContext';

/* ── Line icon set (stroke-based, consistent) ── */
const ICONS: Record<string, ReactNode> = {
  search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></>,
  pin: <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>,
  chevron: <path d="m6 9 6 6 6-6" />,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  checkCircle: <><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
  clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
  video: <><path d="m22 8-6 4 6 4V8Z" /><rect x="2" y="6" width="14" height="12" rx="2" /></>,
  arrow: <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M6 21v-1a6 6 0 0 1 12 0v1" /></>,
  smile: <><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><path d="M9 9h.01M15 9h.01" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
  heart: <path d="M19 14c1.5-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  users: <><circle cx="9" cy="8" r="4" /><path d="M3 20v-1a6 6 0 0 1 12 0v1" /><path d="M17 4.5a4 4 0 0 1 0 7.5" /><path d="M21 20v-1a6 6 0 0 0-3-5" /></>,
  activity: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  message: <path d="M21 12a8 8 0 0 1-11.4 7.2L3 21l1.8-6.6A8 8 0 1 1 21 12Z" />,
  venus: <><circle cx="12" cy="9" r="5" /><path d="M12 14v7M9 18h6" /></>,
  ear: <><path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 1 1-7 0" /><path d="M6.5 12.5a3.5 3.5 0 1 1 7 0" /></>,
  bone: <path d="M17 10c.7-.7 1.69 0 2.5 0a2.5 2.5 0 1 0 0-5 .5.5 0 0 1-.5-.5 2.5 2.5 0 1 0-5 0c0 .81.7 1.8 0 2.5l-7 7c-.7.7-1.69 0-2.5 0a2.5 2.5 0 0 0 0 5c.28 0 .5.22.5.5a2.5 2.5 0 1 0 5 0c0-.81-.7-1.8 0-2.5Z" />,
  baby: <><path d="M9 12h.01M15 12h.01M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5" /><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3" /></>,
  building: <><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4M9 6h.01M15 6h.01M9 10h.01M15 10h.01M9 14h.01M15 14h.01" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  star: <path d="m12 3 2.6 5.5 6 .9-4.3 4.2 1 6-5.3-2.8L6.7 19.6l1-6L3.4 9.4l6-.9L12 3Z" />,
};

function Icon({ name, className = 'w-5 h-5', strokeWidth = 1.75 }: { name: string; className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

const NAVY = '#00264c';

interface HomePageProps {
  onSearch: (specialty: string, location: string, date: string) => void;
  onAdminClick?: () => void;
  onDoctorClick?: () => void;
  onOpenLogin: () => void;
  onOpenSignup: () => void;
  onOpenProfessional: () => void;
  patientUser?: { id: number; name: string; email: string } | null;
  onLogout?: () => void;
}

export default function HomePage({ onSearch, onAdminClick, onDoctorClick, onOpenLogin, onOpenSignup, onOpenProfessional, patientUser, onLogout }: HomePageProps) {
  const { t, language } = useLanguage();
  const [specialty, setSpecialty] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const isArabic = language === 'ar';
  const todayISO = new Date().toISOString().split('T')[0];

  const specialties = [
    { key: 'specialty.generalDoctor' },
    { key: 'specialty.dentist' },
    { key: 'specialty.ophthalmologist' },
    { key: 'specialty.dermatologist' },
    { key: 'specialty.cardiologist' },
    { key: 'specialty.pediatrician' },
    { key: 'specialty.gynecologist' },
    { key: 'specialty.ent' },
    { key: 'specialty.physiotherapist' },
    { key: 'specialty.psychologist' },
    { key: 'specialty.osteopath' },
    { key: 'specialty.midwife' },
  ];

  const quickSpecialties = [
    { key: 'specialty.generalDoctor', icon: 'user' },
    { key: 'specialty.dentist', icon: 'smile' },
    { key: 'specialty.ophthalmologist', icon: 'eye' },
    { key: 'specialty.dermatologist', icon: 'sun' },
    { key: 'specialty.cardiologist', icon: 'heart' },
    { key: 'specialty.pediatrician', icon: 'users' },
    { key: 'specialty.gynecologist', icon: 'venus' },
    { key: 'specialty.ent', icon: 'ear' },
    { key: 'specialty.physiotherapist', icon: 'activity' },
    { key: 'specialty.psychologist', icon: 'message' },
    { key: 'specialty.osteopath', icon: 'bone' },
    { key: 'specialty.midwife', icon: 'baby' },
  ];

  const trust = [
    { icon: 'check', label: isArabic ? 'حجز مجاني' : 'Sans frais' },
    { icon: 'clock', label: isArabic ? 'تأكيد فوري' : 'Confirmation immédiate' },
    { icon: 'shield', label: isArabic ? 'بيانات آمنة' : 'Données sécurisées' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (specialty) onSearch(t(specialty), location, date || todayISO);
  };

  return (
    <div className="min-h-screen bg-white" dir={isArabic ? 'rtl' : 'ltr'}>
      <Header
        onAdminClick={onAdminClick}
        onDoctorClick={onDoctorClick}
        onHomeClick={() => {
          setSpecialty('');
          setLocation('');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onScrollToSearch={() => document.getElementById('hero-search')?.scrollIntoView({ behavior: 'smooth' })}
        onScrollToTeleconsult={() => document.getElementById('teleconsult-section')?.scrollIntoView({ behavior: 'smooth' })}
        onOpenProfessional={onOpenProfessional}
        onOpenLogin={onOpenLogin}
        onOpenSignup={onOpenSignup}
        patientUser={patientUser}
        onLogout={onLogout}
      />

      {/* ── HERO ── */}
      <section style={{ backgroundColor: '#f1f7fe' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left */}
            <div>
              <h1 className="hero-reveal text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.15] tracking-tight mb-4" style={{ color: NAVY }}>
                {patientUser
                  ? (isArabic ? `مرحباً ${patientUser.name.split(' ')[0]}، هل تحتاج موعدًا؟` : `Bonjour ${patientUser.name.split(' ')[0]}, besoin d'un rendez-vous ?`)
                  : (isArabic ? 'احجز موعدك الطبي عبر الإنترنت' : 'Prenez rendez-vous avec un médecin, en ligne.')}
              </h1>
              <p className="hero-reveal hero-reveal-delay-1 text-gray-600 text-base sm:text-lg leading-relaxed mb-6 max-w-lg">
                {isArabic
                  ? 'اعثر على طبيب حسب التخصص والمنطقة، واحجز موعدك مباشرة عبر الإنترنت.'
                  : 'Trouvez un praticien par spécialité et par ville, et réservez directement en ligne.'}
              </p>

              {/* Search bar */}
              <form
                id="hero-search"
                onSubmit={handleSubmit}
                className="hero-reveal hero-reveal-delay-1 bg-white rounded-2xl border border-gray-200 shadow-sm p-3 scroll-mt-24"
              >
                <div className="flex flex-col lg:flex-row lg:flex-wrap lg:items-start gap-3">
                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-xs font-medium text-gray-500 mb-1 ms-1">
                      {isArabic ? 'التخصص' : 'Spécialité'}
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 ltr:left-3 rtl:right-3 flex items-center text-gray-400 pointer-events-none">
                        <Icon name="search" className="w-5 h-5" />
                      </span>
                      <select
                        value={specialty}
                        onChange={(e) => setSpecialty(e.target.value)}
                        className="w-full ltr:pl-10 rtl:pr-10 ltr:pr-9 rtl:pl-9 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800 bg-white transition appearance-none cursor-pointer"
                      >
                        <option value="">{isArabic ? 'التخصص' : 'Spécialité'}</option>
                        {specialties.map((s) => (
                          <option key={s.key} value={s.key}>{t(s.key)}</option>
                        ))}
                      </select>
                      <span className="absolute inset-y-0 ltr:right-3 rtl:left-3 flex items-center text-gray-400 pointer-events-none">
                        <Icon name="chevron" className="w-4 h-4" strokeWidth={2} />
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-xs font-medium text-gray-500 mb-1 ms-1">
                      {isArabic ? 'المكان' : 'Où ?'}
                    </label>
                    <LocationSelector onLocationChange={setLocation} showWilayaLabel={false} selectVariant="hero" />
                  </div>

                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-xs font-medium text-gray-500 mb-1 ms-1">
                      {isArabic ? 'متى؟' : 'Quand ?'}
                    </label>
                    <input
                      type="date"
                      value={date}
                      min={todayISO}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800 bg-white transition"
                    />
                  </div>

                  <div className="lg:pt-[22px]">
                    <button
                      type="submit"
                      disabled={!specialty}
                      className="btn-pro w-full lg:w-auto h-[46px] px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      <Icon name="search" className="w-5 h-5" strokeWidth={2} />
                      {isArabic ? 'ابحث' : 'Rechercher'}
                    </button>
                  </div>
                </div>
              </form>

              <ul className="hero-reveal hero-reveal-delay-2 flex flex-wrap gap-x-5 gap-y-2 mt-4">
                {trust.map((item) => (
                  <li key={item.label} className="flex items-center gap-1.5 text-gray-500 text-sm">
                    <span className="text-blue-600"><Icon name={item.icon} className="w-4 h-4" strokeWidth={2} /></span>
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>

            {/* Right: doctor photo + floating availability card */}
            <div className="relative mt-4 lg:mt-0">
              <img
                src="https://images.pexels.com/photos/5327584/pexels-photo-5327584.jpeg?auto=compress&cs=tinysrgb&w=1000&h=1100&fit=crop"
                alt={isArabic ? 'طبيبة بمعطف أبيض تفحص مريضًا بسماعة الطبيب' : 'Médecin en blouse blanche examinant un patient avec un stéthoscope'}
                loading="lazy"
                className="w-full h-72 sm:h-96 lg:h-[460px] object-cover rounded-2xl shadow-lg bg-blue-100"
              />

              {/* RDV confirmé badge */}
              <div className="absolute top-4 ltr:left-4 rtl:right-4 bg-white shadow-md rounded-full ltr:pl-2 ltr:pr-3 rtl:pr-2 rtl:pl-3 py-1.5 flex items-center gap-1.5 border border-gray-100">
                <span className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center">
                  <Icon name="check" className="w-3 h-3" strokeWidth={3} />
                </span>
                <span className="text-xs font-medium text-gray-700">{isArabic ? 'تم تأكيد الموعد' : 'RDV confirmé'}</span>
              </div>

              {/* Floating availability card */}
              <div className="hidden sm:block absolute bottom-4 ltr:left-4 rtl:right-4 bg-white rounded-xl shadow-lg border border-gray-100 p-3.5 w-60">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-sm font-semibold">AB</div>
                  <div className="leading-tight">
                    <div className="font-semibold text-sm" style={{ color: NAVY }}>Dr Amina Benali</div>
                    <div className="text-xs text-gray-500">{isArabic ? 'أخصائية القلب' : 'Cardiologue'}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {[isArabic ? 'اليوم 14:30' : 'Auj. 14:30', isArabic ? 'غدًا 09:00' : 'Dem. 09:00'].map((slot) => (
                    <div key={slot} className="text-center text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-lg py-1.5">
                      {slot}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── QUICK SPECIALTIES ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2" style={{ color: NAVY }}>
            {isArabic ? 'ابحث حسب التخصص' : 'Rechercher par spécialité'}
          </h2>
          <p className="text-gray-500">
            {isArabic ? 'اختر التخصص المناسب لحاجتك' : 'Choisissez la spécialité adaptée à votre besoin'}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {quickSpecialties.map((s) => (
            <button
              key={s.key}
              onClick={() => {
                setSpecialty(s.key);
                document.getElementById('hero-search')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="group flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50/40 transition-colors text-start"
            >
              <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:!text-white transition-colors">
                <Icon name={s.icon} className="w-5 h-5" />
              </span>
              <span className="text-sm font-medium text-gray-800 leading-tight">{t(s.key)}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="bg-gray-50 border-y border-gray-100 py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3" style={{ color: NAVY }}>
              {isArabic ? 'كيف يعمل شفاك؟' : 'Comment ça marche ?'}
            </h2>
            <p className="text-gray-500 text-lg">
              {isArabic ? 'ثلاث خطوات بسيطة' : 'Trois étapes simples pour prendre rendez-vous'}
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { n: '1', icon: 'search', title: isArabic ? 'ابحث عن طبيب' : 'Cherchez un médecin', desc: isArabic ? 'حسب التخصص أو المدينة' : 'Par spécialité ou par ville, trouvez le praticien qui vous convient.' },
              { n: '2', icon: 'calendar', title: isArabic ? 'اختر موعدًا' : 'Choisissez un créneau', desc: isArabic ? 'شاهد الأوقات المتاحة واحجز' : 'Consultez les disponibilités réelles et réservez en un clic.' },
              { n: '3', icon: 'checkCircle', title: isArabic ? 'تأكيد فوري' : 'Confirmation immédiate', desc: isArabic ? 'استلم تأكيدًا وتذكيرات' : 'Recevez votre confirmation et vos rappels automatiquement.' },
            ].map((item) => (
              <div key={item.n} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                    <Icon name={item.icon} className="w-5 h-5" strokeWidth={2} />
                  </span>
                  <span className="text-sm font-medium text-gray-400">
                    {isArabic ? `الخطوة ${item.n}` : `Étape ${item.n}`}
                  </span>
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: NAVY }}>{item.title}</h3>
                <p className="text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { num: '12 000+', label: isArabic ? 'طبيب مسجل' : 'Praticiens inscrits' },
            { num: '48', label: isArabic ? 'ولاية مغطاة' : 'Wilayas couvertes' },
            { num: '60+', label: isArabic ? 'تخصص طبي' : 'Spécialités médicales' },
            { num: '4,8/5', label: isArabic ? 'رضا المستخدمين' : 'Satisfaction patients' },
          ].map((s) => (
            <div key={s.label} className="text-start">
              <div className="text-3xl sm:text-4xl font-bold tracking-tight mb-1 text-blue-600">{s.num}</div>
              <div className="text-gray-500 text-sm">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── TELECONSULTATION ── */}
      <section id="teleconsult-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 scroll-mt-20">
        <div className="rounded-2xl bg-blue-600 text-white p-8 md:p-14 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <span className="inline-block text-xs font-medium text-blue-50 bg-white/10 px-3 py-1.5 rounded-lg mb-6 border border-white/15">
              {isArabic ? 'قريبًا 2026' : 'Bientôt · 2026'}
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight leading-tight mb-4">
              {isArabic ? 'استشارة عن بُعد، ببساطة' : 'La téléconsultation, en toute simplicité'}
            </h2>
            <p className="text-blue-50/90 text-lg leading-relaxed mb-8">
              {isArabic
                ? 'تحدث مع طبيبك عبر الفيديو من منزلك — مثالي للمتابعة والاستشارات السريعة.'
                : 'Consultez votre médecin en visioconférence depuis chez vous. Idéal pour le suivi et les avis rapides.'}
            </p>
            <button
              type="button"
              onClick={onOpenProfessional}
              className="btn-pro inline-flex items-center gap-2 bg-white text-blue-700 font-semibold px-6 py-3 rounded-xl hover:bg-blue-50 transition-colors"
            >
              {isArabic ? 'أبلغني عند الإطلاق' : 'Être informé du lancement'}
              <Icon name="arrow" className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
          <div className="hidden md:flex justify-center">
            <div className="w-40 h-40 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center">
              <Icon name="video" className="w-20 h-20 text-white" strokeWidth={1.4} />
            </div>
          </div>
        </div>
      </section>

      {/* ── FOR PROFESSIONALS ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20">
        <div className="rounded-2xl p-8 md:p-14" style={{ backgroundColor: NAVY }}>
          <div className="grid md:grid-cols-2 gap-10 items-center text-white">
            <div>
              <span className="inline-block text-xs font-medium text-blue-200 bg-white/10 px-3 py-1.5 rounded-lg mb-6 border border-white/15">
                {isArabic ? 'للأطباء والمراكز الطبية' : 'Pour les praticiens'}
              </span>
              <h2 className="text-2xl sm:text-4xl font-bold tracking-tight leading-tight mb-6">
                {isArabic ? 'طوّر عيادتك مع شفاك' : 'Développez votre cabinet avec chifak'}
              </h2>
              <ul className="grid sm:grid-cols-2 gap-3 mb-8">
                {(isArabic
                  ? ['مرضى جدد كل يوم', 'أجندة رقمية مجانية', 'تقليل حالات الغياب', 'استشارة عن بُعد']
                  : ['De nouveaux patients', 'Agenda numérique gratuit', 'Moins de rendez-vous manqués', 'Outils de téléconsultation']
                ).map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-blue-50/90">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center">
                      <Icon name="check" className="w-3 h-3" strokeWidth={3} />
                    </span>
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={onOpenProfessional}
                className="btn-pro inline-flex items-center gap-2 bg-blue-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors"
              >
                {isArabic ? 'ابدأ مجانًا' : 'Démarrer gratuitement'}
                <Icon name="arrow" className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>
            <div className="hidden md:flex justify-center">
              <div className="w-40 h-40 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Icon name="building" className="w-20 h-20 text-blue-300" strokeWidth={1.4} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-gray-950 text-gray-400 pt-16 pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-14">
            <div className="lg:col-span-2 max-w-sm">
              <div className="flex items-center gap-2.5 mb-5">
                <LogoMark className="h-10 w-10" pulseColor="#23a6a0" />
                <span className="text-xl font-bold text-white tracking-tight">chifak</span>
              </div>
              <p className="leading-relaxed text-gray-400 mb-6">
                {isArabic
                  ? 'منصة رقمية لحجز المواعيد الطبية في الجزائر. بسيطة وسريعة وآمنة.'
                  : 'La plateforme de prise de rendez-vous médicaux en Algérie. Simple, rapide et sécurisée.'}
              </p>
              <div className="flex gap-2.5">
                {['f', 'in', '𝕏', 'ig'].map((s, i) => (
                  <a key={i} href="#" className="w-9 h-9 bg-white/5 hover:bg-blue-600 hover:text-white rounded-lg flex items-center justify-center text-sm font-medium transition-colors border border-white/5">
                    {s}
                  </a>
                ))}
              </div>
              {onAdminClick && (
                <button
                  onClick={onAdminClick}
                  className="mt-6 flex items-center gap-2 text-sm font-medium bg-white/5 hover:bg-white/10 text-gray-300 px-4 py-2.5 rounded-lg transition-colors border border-white/5"
                >
                  <Icon name="shield" className="w-4 h-4" />
                  {isArabic ? 'مساحة الموظفين' : 'Portail administration'}
                </button>
              )}
            </div>
            {[
              {
                title: isArabic ? 'للمرضى' : 'Patients',
                links: isArabic
                  ? ['ابحث عن طبيب', 'احجز موعدًا', 'استشارة عن بُعد', 'المساعدة']
                  : ['Annuaire médical', 'Prise de RDV', 'Téléconsultation', 'Aide & support'],
              },
              {
                title: isArabic ? 'للأطباء' : 'Praticiens',
                links: isArabic
                  ? ['سجل عيادتك', 'تسجيل الدخول', 'حلول البرمجيات', 'الأسعار']
                  : ['Inscrire mon cabinet', 'Espace docteur', 'Logiciel de gestion', 'Tarifs'],
              },
              {
                title: isArabic ? 'الشركة' : 'Entreprise',
                links: isArabic
                  ? ['من نحن', 'تواصل معنا', 'الخصوصية', 'الشروط']
                  : ['Notre mission', 'Nous contacter', 'Confidentialité', 'Mentions légales'],
              },
            ].map((col, i) => (
              <div key={i}>
                <h4 className="text-white font-semibold text-sm mb-4">{col.title}</h4>
                <ul className="space-y-3">
                  {col.links.map((link, j) => (
                    <li key={j}>
                      <a href="#" className="text-sm hover:text-white transition-colors">{link}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
            <p>© 2026 chifak Algérie. {isArabic ? 'جميع الحقوق محفوظة' : 'Tous droits réservés'}.</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-white transition-colors">Cookies</a>
              <a href="#" className="hover:text-white transition-colors">{isArabic ? 'الأمان' : 'Sécurité'}</a>
              <a href="#" className="hover:text-white transition-colors">{isArabic ? 'خريطة الموقع' : 'Plan du site'}</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
