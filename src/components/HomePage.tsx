import { useState, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import Header from './Header';
import LocationSelector from './LocationSelector';
import AlgeriaMap from './AlgeriaMap';
import LogoMark from './LogoMark';
import { useLanguage } from '../contexts/LanguageContext';

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

interface HomePageProps {
  onSearch: (specialty: string, location: string, date: string) => void;
  onAdminClick?: () => void;
  onDoctorClick?: () => void;
  onOpenLogin: () => void;
  onOpenSignup: () => void;
  onOpenProfessional: () => void;
  onOpenAccount?: () => void;
  patientUser?: { id: number; name: string; email: string } | null;
  onLogout?: () => void;
}

export default function HomePage({ onSearch, onAdminClick, onDoctorClick, onOpenLogin, onOpenSignup, onOpenProfessional, onOpenAccount, patientUser, onLogout }: HomePageProps) {
  const { t, language } = useLanguage();
  const [specialty, setSpecialty] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [selectedWilaya, setSelectedWilaya] = useState<{ code: number; name: string; nameAr: string } | null>(null);
  const [selectedDaira, setSelectedDaira] = useState<{ name: string; communes: string[] } | null>(null);
  const [selectedCommune, setSelectedCommune] = useState<string | null>(null);
  const [communeCoords, setCommuneCoords] = useState<Record<string, [number, number]>>({});

  useEffect(() => {
    fetch('/algeria-communes.json')
      .then((r) => (r.ok ? r.json() : {}))
      .then(setCommuneCoords)
      .catch(() => {});
  }, []);

  const normPlace = (s: string) =>
    (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '').trim();

  const mapPin = useMemo(() => {
    if (selectedCommune) {
      const c = communeCoords[normPlace(selectedCommune)];
      return c ? { lat: c[0], lng: c[1] } : null;
    }
    if (selectedDaira) {
      // Position de la daïra = moyenne des coordonnées de ses communes trouvées
      const pts = selectedDaira.communes
        .map((n) => communeCoords[normPlace(n)])
        .filter(Boolean) as [number, number][];
      if (pts.length) {
        const lat = pts.reduce((s, p) => s + p[0], 0) / pts.length;
        const lng = pts.reduce((s, p) => s + p[1], 0) / pts.length;
        return { lat, lng };
      }
      const seat = communeCoords[normPlace(selectedDaira.name)];
      return seat ? { lat: seat[0], lng: seat[1] } : null;
    }
    return null;
  }, [selectedCommune, selectedDaira, communeCoords]);
  const isArabic = language === 'ar';
  const todayISO = new Date().toISOString().split('T')[0];

  const specialties = [
    { key: 'specialty.generalDoctor' }, { key: 'specialty.dentist' },
    { key: 'specialty.ophthalmologist' }, { key: 'specialty.dermatologist' },
    { key: 'specialty.cardiologist' }, { key: 'specialty.pediatrician' },
    { key: 'specialty.gynecologist' }, { key: 'specialty.ent' },
    { key: 'specialty.physiotherapist' }, { key: 'specialty.psychologist' },
    { key: 'specialty.osteopath' }, { key: 'specialty.midwife' },
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (specialty) onSearch(t(specialty), location, date || todayISO);
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }} dir={isArabic ? 'rtl' : 'ltr'}>
      <Header
        onAdminClick={onAdminClick}
        onDoctorClick={onDoctorClick}
        onHomeClick={() => { setSpecialty(''); setLocation(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        onScrollToSearch={() => document.getElementById('hero-search')?.scrollIntoView({ behavior: 'smooth' })}
        onScrollToTeleconsult={() => document.getElementById('teleconsult-section')?.scrollIntoView({ behavior: 'smooth' })}
        onOpenProfessional={onOpenProfessional}
        onOpenLogin={onOpenLogin}
        onOpenSignup={onOpenSignup}
        onOpenAccount={onOpenAccount}
        patientUser={patientUser}
        onLogout={onLogout}
      />

      {/* ── HERO ── */}
      <section className="relative overflow-hidden" style={{ background: '#F8F9FB' }}>
        {/* Animated gradient orbs */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="hero-orb hero-orb-1" />
          <div className="hero-orb hero-orb-2" />
          <div className="hero-orb hero-orb-3" />
        </div>

        <div className="relative max-w-7xl mx-auto px-5 sm:px-8 py-14 sm:py-20 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">

            {/* Left */}
            <div>
              {/* Availability pill */}
              <div
                className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold mb-6"
                style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid rgba(0,102,204,0.12)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--success)' }} />
                {isArabic ? 'متاح في 48 ولاية' : 'Disponible dans les 48 wilayas'}
              </div>

              <h1
                className="hero-reveal font-extrabold tracking-tight mb-5"
                style={{
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  fontSize: 'clamp(2.25rem, 5vw, 3.75rem)',
                  lineHeight: 1.08,
                  color: 'var(--ink)',
                }}
              >
                {patientUser
                  ? (isArabic
                    ? `مرحباً ${patientUser.name.split(' ')[0]}،\nهل تحتاج موعدًا؟`
                    : `Bonjour ${patientUser.name.split(' ')[0]},\nbesoin d'un RDV ?`)
                  : (isArabic
                    ? 'احجز موعدك الطبي\nفي الجزائر، بسهولة.'
                    : 'Prenez rendez-vous\navec votre médecin.')}
              </h1>

              <p
                className="hero-reveal hero-reveal-delay-1 text-lg leading-relaxed mb-8 max-w-md"
                style={{ color: 'var(--ink-2)' }}
              >
                {isArabic
                  ? 'اعثر على طبيب حسب التخصص والمنطقة، واحجز موعدك مباشرة عبر الإنترنت.'
                  : 'Trouvez un praticien par spécialité et par ville, et réservez directement en ligne.'}
              </p>

              {/* Search card */}
              <form
                id="hero-search"
                onSubmit={handleSubmit}
                className="hero-reveal hero-reveal-delay-1 rounded-2xl p-3 scroll-mt-24"
                style={{ background: 'var(--bg)', border: '1px solid rgba(0,0,0,0.08)', boxShadow: 'var(--shadow-md)' }}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row gap-3">
                    {/* Specialty */}
                    <div className="flex-1">
                      <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 px-1" style={{ color: 'var(--ink-3)' }}>
                        {isArabic ? 'التخصص' : 'Spécialité'}
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 ltr:left-3 rtl:right-3 flex items-center pointer-events-none" style={{ color: 'var(--ink-3)' }}>
                          <Icon name="search" className="w-4 h-4" />
                        </span>
                        <select
                          value={specialty}
                          onChange={(e) => setSpecialty(e.target.value)}
                          className="field ltr:pl-9 rtl:pr-9 ltr:pr-8 rtl:pl-8 cursor-pointer"
                          style={{ color: specialty ? 'var(--ink)' : 'var(--ink-3)' }}
                        >
                          <option value="">{isArabic ? 'Choisir une spécialité' : 'Choisir une spécialité'}</option>
                          {specialties.map((s) => (
                            <option key={s.key} value={s.key}>{t(s.key)}</option>
                          ))}
                        </select>
                        <span className="absolute inset-y-0 ltr:right-3 rtl:left-3 flex items-center pointer-events-none" style={{ color: 'var(--ink-3)' }}>
                          <Icon name="chevron" className="w-4 h-4" strokeWidth={2} />
                        </span>
                      </div>
                    </div>

                    {/* Location */}
                    <div className="flex-1">
                      <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 px-1" style={{ color: 'var(--ink-3)' }}>
                        {isArabic ? 'المكان' : 'Où ?'}
                      </label>
                      <LocationSelector onLocationChange={setLocation} onWilayaChange={setSelectedWilaya} onDairaChange={setSelectedDaira} onCommuneChange={setSelectedCommune} showWilayaLabel={false} selectVariant="hero" />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    {/* Date */}
                    <div className="flex-1">
                      <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 px-1" style={{ color: 'var(--ink-3)' }}>
                        {isArabic ? 'متى؟' : 'Quand ?'}
                      </label>
                      <input
                        type="date"
                        value={date}
                        min={todayISO}
                        onChange={(e) => setDate(e.target.value)}
                        className="field"
                        style={{ color: date ? 'var(--ink)' : 'var(--ink-3)' }}
                      />
                    </div>

                    {/* Submit */}
                    <div className="sm:pt-[26px]">
                      <button
                        type="submit"
                        disabled={!specialty}
                        className="btn-primary w-full sm:w-auto"
                        style={{ height: '48px', padding: '0 1.5rem', fontSize: '15px' }}
                      >
                        <Icon name="search" className="w-4 h-4" strokeWidth={2.5} />
                        {isArabic ? 'بحث' : 'Rechercher'}
                      </button>
                    </div>
                  </div>
                </div>
              </form>

              {/* Trust badges */}
              <ul className="hero-reveal hero-reveal-delay-2 flex flex-wrap gap-x-5 gap-y-2 mt-5">
                {[
                  { icon: 'check', label: isArabic ? 'حجز مجاني' : 'Sans frais' },
                  { icon: 'clock', label: isArabic ? 'تأكيد فوري' : 'Confirmation immédiate' },
                  { icon: 'shield', label: isArabic ? 'بيانات آمنة' : 'Données sécurisées' },
                ].map((item) => (
                  <li key={item.label} className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--ink-2)' }}>
                    <span style={{ color: 'var(--accent)' }}><Icon name={item.icon} className="w-3.5 h-3.5" strokeWidth={2.5} /></span>
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>

            {/* Right: photo + floating card */}
            <div className="relative mt-4 lg:mt-0">
              {/* Glow ring behind photo */}
              <div
                className="absolute -inset-3 rounded-3xl pointer-events-none"
                style={{
                  background: 'radial-gradient(ellipse at 60% 40%, rgba(0,102,204,0.18) 0%, rgba(35,166,160,0.10) 50%, transparent 75%)',
                  filter: 'blur(18px)',
                  zIndex: 0,
                }}
              />
              <div className="relative" style={{ zIndex: 1 }}>
                <AlgeriaMap
                  selectedCode={selectedWilaya?.code}
                  selectedNames={selectedWilaya ? [selectedWilaya.name, selectedWilaya.nameAr] : []}
                  pin={mapPin}
                  pinScale={selectedCommune ? 16 : 9}
                />
                <p className="text-center text-xs mt-2" style={{ color: 'var(--ink-2)' }}>
                  {isArabic ? 'اختر ولاية لعرضها على الخريطة' : 'Choisissez une wilaya pour la voir sur la carte'}
                </p>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section style={{ background: 'var(--bg)', borderTop: '1px solid rgba(0,0,0,0.06)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { num: '12 000+', label: isArabic ? 'طبيب مسجل' : 'Praticiens inscrits' },
              { num: '48', label: isArabic ? 'ولاية مغطاة' : 'Wilayas couvertes' },
              { num: '60+', label: isArabic ? 'تخصص طبي' : 'Spécialités' },
              { num: '4,8 ★', label: isArabic ? 'رضا المرضى' : 'Satisfaction patients' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div
                  className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-1"
                  style={{ color: 'var(--ink)', fontFamily: '"Plus Jakarta Sans", sans-serif' }}
                >
                  {s.num}
                </div>
                <div className="text-sm" style={{ color: 'var(--ink-2)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── QUICK SPECIALTIES ── */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 py-16 sm:py-20">
        <div className="mb-10">
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--accent)' }}>
            {isArabic ? 'التخصصات' : 'Spécialités'}
          </p>
          <h2
            className="text-3xl sm:text-4xl font-extrabold tracking-tight"
            style={{ color: 'var(--ink)', fontFamily: '"Plus Jakarta Sans", sans-serif' }}
          >
            {isArabic ? 'ابحث حسب التخصص' : 'Rechercher par spécialité'}
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {quickSpecialties.map((s) => (
            <button
              key={s.key}
              onClick={() => {
                setSpecialty(s.key);
                document.getElementById('hero-search')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="specialty-card flex items-center gap-3 p-4 text-start"
            >
              <span
                className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}
              >
                <Icon name={s.icon} className="w-5 h-5" />
              </span>
              <span className="text-sm font-semibold leading-tight" style={{ color: 'var(--ink)', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                {t(s.key)}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ background: 'var(--bg-2)' }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-16 sm:py-20">
          <div className="max-w-xl mb-12">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--accent)' }}>
              {isArabic ? 'كيف يعمل شفاك' : 'Comment ça marche'}
            </p>
            <h2
              className="text-3xl sm:text-4xl font-extrabold tracking-tight"
              style={{ color: 'var(--ink)', fontFamily: '"Plus Jakarta Sans", sans-serif' }}
            >
              {isArabic ? 'موعدك في ثلاث خطوات' : 'Votre RDV en trois étapes'}
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                icon: 'search',
                title: isArabic ? 'ابحث عن طبيب' : 'Cherchez',
                desc: isArabic ? 'حسب التخصص أو المدينة، اعثر على الطبيب المناسب.' : 'Par spécialité ou par ville, trouvez le praticien qui vous convient.',
              },
              {
                icon: 'calendar',
                title: isArabic ? 'اختر موعدًا' : 'Choisissez',
                desc: isArabic ? 'شاهد الأوقات المتاحة الفعلية واحجز في لحظة.' : 'Consultez les disponibilités en temps réel et réservez en un clic.',
              },
              {
                icon: 'checkCircle',
                title: isArabic ? 'تأكيد فوري' : 'Confirmez',
                desc: isArabic ? 'استلم تأكيد موعدك وتذكيرات تلقائية.' : 'Recevez votre confirmation et vos rappels automatiques.',
              },
            ].map((item, i) => (
              <div
                key={i}
                className="rounded-2xl p-7"
                style={{ background: 'var(--bg)', border: '1px solid rgba(0,0,0,0.07)', boxShadow: 'var(--shadow-xs)' }}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
                  style={{ background: 'var(--accent)' }}
                >
                  <Icon name={item.icon} className="w-6 h-6 text-white" strokeWidth={2} />
                </div>
                <h3
                  className="text-xl font-bold mb-2"
                  style={{ color: 'var(--ink)', fontFamily: '"Plus Jakarta Sans", sans-serif' }}
                >
                  {item.title}
                </h3>
                <p style={{ color: 'var(--ink-2)', fontSize: '15px', lineHeight: '1.65' }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TELECONSULTATION ── */}
      <section id="teleconsult-section" className="max-w-7xl mx-auto px-5 sm:px-8 py-16 sm:py-20 scroll-mt-20">
        <div className="rounded-3xl overflow-hidden" style={{ background: 'var(--ink)' }}>
          <div className="grid md:grid-cols-2">
            <div className="p-10 md:p-14">
              <span
                className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider rounded-full px-3 py-1.5 mb-6"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {isArabic ? 'قريبًا · 2026' : 'Bientôt · 2026'}
              </span>
              <h2
                className="font-extrabold tracking-tight leading-tight mb-5"
                style={{ fontSize: 'clamp(2rem, 4vw, 3.25rem)', color: '#FFFFFF', fontFamily: '"Plus Jakarta Sans", sans-serif', whiteSpace: 'pre-line' }}
              >
                {isArabic ? 'طبيبك\nعلى الشاشة.' : 'Votre médecin,\nà l\'écran.'}
              </h2>
              <p className="text-lg leading-relaxed mb-8" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {isArabic
                  ? 'استشارة طبية بالفيديو من منزلك — مثالية للمتابعة والاستشارات السريعة.'
                  : 'Consultez en visioconférence depuis chez vous. Idéal pour le suivi et les avis rapides.'}
              </p>
              <button
                type="button"
                onClick={onOpenProfessional}
                className="btn-primary"
                style={{ background: '#FFFFFF', color: 'var(--accent)', height: '48px', padding: '0 1.5rem', fontSize: '15px' }}
              >
                {isArabic ? 'أبلغني عند الإطلاق' : 'Être informé du lancement'}
                <Icon name="arrow" className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>
            <div
              className="hidden md:flex items-center justify-center p-10"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              <div
                className="w-48 h-48 rounded-3xl flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <span style={{ color: 'rgba(255,255,255,0.25)' }}>
                  <Icon name="video" className="w-24 h-24" strokeWidth={1} />
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOR PROFESSIONALS ── */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 pb-16 sm:pb-20">
        <div
          className="rounded-3xl p-10 md:p-14"
          style={{ background: 'var(--accent-bg)', border: '1px solid rgba(0,102,204,0.1)' }}
        >
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--accent)' }}>
                {isArabic ? 'للأطباء والمراكز الطبية' : 'Pour les praticiens'}
              </p>
              <h2
                className="font-extrabold tracking-tight leading-tight mb-6"
                style={{ fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)', color: 'var(--ink)', fontFamily: '"Plus Jakarta Sans", sans-serif', whiteSpace: 'pre-line' }}
              >
                {isArabic ? 'طوّر عيادتك\nمع شفاك.' : 'Développez votre cabinet\navec chifak.'}
              </h2>
              <ul className="grid sm:grid-cols-2 gap-3 mb-8">
                {(isArabic
                  ? ['مرضى جدد كل يوم', 'أجندة رقمية مجانية', 'تقليل حالات الغياب', 'استشارة عن بُعد']
                  : ['De nouveaux patients', 'Agenda numérique gratuit', 'Moins de rendez-vous manqués', 'Outils de téléconsultation']
                ).map((item) => (
                  <li key={item} className="flex items-center gap-2.5">
                    <span
                      className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: 'var(--accent)', color: '#fff' }}
                    >
                      <Icon name="check" className="w-3 h-3" strokeWidth={3} />
                    </span>
                    <span className="text-sm font-medium" style={{ color: 'var(--ink)' }}>{item}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={onOpenProfessional}
                className="btn-primary"
                style={{ height: '48px', padding: '0 1.5rem', fontSize: '15px' }}
              >
                {isArabic ? 'ابدأ مجانًا' : 'Démarrer gratuitement'}
                <Icon name="arrow" className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>
            <div className="hidden md:flex justify-center">
              <div
                className="w-44 h-44 rounded-3xl flex items-center justify-center"
                style={{ background: 'rgba(0,102,204,0.07)', border: '1px solid rgba(0,102,204,0.12)' }}
              >
                <span style={{ color: 'var(--accent)', opacity: 0.5 }}>
                  <Icon name="building" className="w-20 h-20" strokeWidth={1.4} />
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: '#111113', color: 'rgba(255,255,255,0.45)' }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-16 pb-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-14">
            <div className="lg:col-span-2 max-w-xs">
              <div className="flex items-center gap-2.5 mb-5">
                <LogoMark className="h-9 w-9" pulseColor="#23a6a0" />
                <span
                  className="text-lg font-bold text-white tracking-tight"
                  style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
                >
                  chifak
                </span>
              </div>
              <p className="leading-relaxed text-sm mb-6">
                {isArabic
                  ? 'منصة رقمية لحجز المواعيد الطبية في الجزائر. بسيطة وسريعة وآمنة.'
                  : 'La plateforme de prise de rendez-vous médicaux en Algérie. Simple, rapide et sécurisée.'}
              </p>
              <div className="flex gap-2">
                {['f', 'in', '𝕏', 'ig'].map((s, i) => (
                  <a
                    key={i}
                    href="#"
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium transition-colors hover:bg-blue-600 hover:text-white"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    {s}
                  </a>
                ))}
              </div>
              {onAdminClick && (
                <button
                  onClick={onAdminClick}
                  className="mt-5 flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl transition-colors hover:bg-white/10"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.45)' }}
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
                <h4
                  className="text-sm font-semibold text-white mb-4"
                  style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
                >
                  {col.title}
                </h4>
                <ul className="space-y-3">
                  {col.links.map((link, j) => (
                    <li key={j}>
                      <a href="#" className="text-sm transition-colors hover:text-white">{link}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div
            className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
          >
            <p>© 2026 chifak Algérie. {isArabic ? 'جميع الحقوق محفوظة' : 'Tous droits réservés'}.</p>
            <div className="flex gap-5">
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
