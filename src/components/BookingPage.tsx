import { useEffect, useState } from 'react';
import { Doctor, Booking } from '../App';
import Header from './Header';
import FloatingShapes from './FloatingShapes';
import DoctorAvatar from './DoctorAvatar';
import { useLanguage } from '../contexts/LanguageContext';
import { slotsForDay, isWorkingDate as isWorkingDateShared, todayIso, maxBookingIso } from '../utils/slots';

const IconStar = ({ className = '' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.07 3.29a1 1 0 00.95.69h3.46c.97 0 1.37 1.24.59 1.81l-2.8 2.03a1 1 0 00-.37 1.12l1.07 3.29c.3.92-.75 1.69-1.54 1.12l-2.8-2.03a1 1 0 00-1.17 0l-2.8 2.03c-.79.57-1.84-.2-1.54-1.12l1.07-3.29a1 1 0 00-.37-1.12l-2.8-2.03c-.78-.57-.38-1.81.59-1.81h3.46a1 1 0 00.95-.69l1.07-3.29z" />
  </svg>
);
const IconPin = ({ className = '' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0116 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
const IconCalendar = ({ className = '' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4.5" width="18" height="17" rx="2.5" />
    <path d="M3 9h18M8 2.5v4M16 2.5v4" />
  </svg>
);
const IconClock = ({ className = '' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
const IconMail = ({ className = '' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="M4 7l8 6 8-6" />
  </svg>
);
const IconInfo = ({ className = '' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
);
const IconCheck = ({ className = '' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 13l4 4L19 7" />
  </svg>
);

interface BookingPageProps {
  doctor: Doctor;
  onBookingComplete: (booking: Booking) => Promise<void> | void;
  onBack: () => void;
  onBackToHome: () => void;
  onDoctorClick?: () => void;
  onOpenLogin: () => void;
  onOpenSignup: () => void;
  onOpenProfessional: () => void;
  patientUser?: { id: number; name: string; email: string } | null;
  onLogout?: () => void;
}

const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

export default function BookingPage({ doctor, onBookingComplete, onBack, onBackToHome, onDoctorClick, onOpenLogin, onOpenSignup, onOpenProfessional, patientUser, onLogout }: BookingPageProps) {
  const { language } = useLanguage();
  const isArabic = language === 'ar';

  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({ name: '', email: '', phone: '', reason: '' });

  useEffect(() => {
    const raw = localStorage.getItem('chifak_patient_user');
    if (!raw) return;
    try {
      const user = JSON.parse(raw);
      setForm((prev) => ({
        ...prev,
        name: prev.name || user.name || '',
        email: prev.email || user.email || '',
      }));
    } catch {
      // ignore malformed storage
    }
  }, []);

  // Fenêtre de 7 jours que l'on peut faire glisser librement jusqu'à un an à l'avance.
  const [weekOffset, setWeekOffset] = useState(0);

  const isoOf = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const todayStr = todayIso();
  const maxStr = maxBookingIso();

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + weekOffset * 7 + i);
    const full = isoOf(d);
    return {
      label: full === todayStr ? (isArabic ? 'اليوم' : "Auj.") : (isArabic ? DAYS_AR[d.getDay()] : DAYS_FR[d.getDay()]),
      dayNum: d.getDate(),
      month: isArabic ? MONTHS_AR[d.getMonth()] : MONTHS_FR[d.getMonth()],
      monthIndex: d.getMonth(),
      year: d.getFullYear(),
      full,
      isPast: full < todayStr,
      beyondHorizon: full > maxStr,
    };
  });

  // Intitulé du mois affiché (ex. « Août 2026 »)
  const MONTHS_FULL_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const periodLabel = (() => {
    const first = days[0], last = days[6];
    const nameOf = (m: number) => (isArabic ? MONTHS_AR[m] : MONTHS_FULL_FR[m]);
    if (first.monthIndex === last.monthIndex) return `${nameOf(first.monthIndex)} ${first.year}`;
    return `${nameOf(first.monthIndex)} – ${nameOf(last.monthIndex)} ${last.year}`;
  })();

  const canGoBack = weekOffset > 0;
  const canGoForward = !days[6].beyondHorizon;

  // Même logique que la liste des résultats et l'espace patient (module partagé) :
  // les créneaux découlent toujours de la durée de consultation du médecin.
  const isWorkingDate = (dateIso: string) => isWorkingDateShared(doctor, dateIso);
  /* Mode de consultation. Il pilote la liste des créneaux : en vidéo, seules
     les heures que le praticien a ouvertes à la téléconsultation. */
  const [consultationType, setConsultationType] = useState<'cabinet' | 'video'>('cabinet');

  const daySlots = selectedDate ? slotsForDay(doctor, selectedDate, consultationType) : [];

  /* Disponibilités par mode pour la date choisie : le patient doit pouvoir
     comparer avant de basculer, sans découvrir une liste vide après coup. */
  const cabinetCount = selectedDate ? slotsForDay(doctor, selectedDate, 'cabinet').length : 0;
  const videoCount = selectedDate ? slotsForDay(doctor, selectedDate, 'video').length : 0;

  /* Le choix du mode occupe l'étape 1 lorsqu'il existe : les étapes suivantes
     se décalent d'un cran, sinon la numérotation afficherait deux « 1 ». */
  const stepNo = (n: number) => (doctor.acceptsVideo ? n + 1 : n);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.phone) return;
    await onBookingComplete({
      doctor,
      date: selectedDate,
      time: selectedTime,
      patientName: form.name,
      patientEmail: form.email,
      patientPhone: form.phone,
      reason: form.reason,
      // Garde-fou côté client, doublé d'une vérification serveur.
      consultationType: doctor.acceptsVideo ? consultationType : 'cabinet',
    });
  };

  return (
    <div className="relative min-h-screen bg-[#f8fafc] overflow-hidden" dir={isArabic ? 'rtl' : 'ltr'}>
      <FloatingShapes variant="soft" />
      <div className="relative z-10">
      <Header
        onHomeClick={onBackToHome}
        onBack={onBack}
        onDoctorClick={onDoctorClick}
        onOpenLogin={onOpenLogin}
        onOpenSignup={onOpenSignup}
        onOpenProfessional={onOpenProfessional}
        patientUser={patientUser}
        onLogout={onLogout}
      />

      {/* Fil d'ariane */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center gap-2 text-sm text-gray-400">
          <button onClick={onBack} className="text-blue-600 hover:text-blue-700 font-medium transition-colors">
            {isArabic ? 'النتائج' : 'Résultats'}
          </button>
          <svg className="w-3.5 h-3.5 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={isArabic ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"} />
          </svg>
          <span className="text-gray-700 font-medium truncate max-w-[200px]">{doctor.name}</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── Colonne principale ── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Carte médecin */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-8">
              <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start text-center sm:text-left">
                <DoctorAvatar doctor={doctor} className="w-24 h-24 sm:w-28 sm:h-28 shadow-sm ring-1 ring-gray-100" rounded="rounded-2xl" />
                <div className="flex-1">
                  <h2 className="text-2xl sm:text-[1.7rem] font-bold text-gray-900 tracking-tight leading-tight">{doctor.name}</h2>
                  <p className="text-blue-600 font-semibold text-sm mt-1 mb-3">{doctor.specialty}</p>
                  <div className="flex flex-wrap justify-center sm:justify-start gap-2.5 items-center">
                    <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1">
                      <IconStar className="w-4 h-4 text-amber-400" />
                      <span className="text-sm font-semibold text-gray-800">{doctor.rating}</span>
                    </div>
                    <span className="text-sm text-gray-400">
                      {doctor.reviewCount} {isArabic ? 'رأي' : 'avis'}
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm mt-4 flex items-center justify-center sm:justify-start gap-2">
                    <IconPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    {doctor.address}, {doctor.city}
                  </p>
                </div>
              </div>
            </div>

            {/* Étape 1 : date & heure */}
            {step === 1 && (
              <div className="space-y-6 animate-fadeInUp">
                {/* Mode de consultation — d'abord, car il conditionne la
                    manière dont se déroulera le rendez-vous. Affiché seulement
                    si le praticien a activé la téléconsultation. */}
                {doctor.acceptsVideo && (
                  <fieldset className="bg-white rounded-2xl p-5 sm:p-8 shadow-sm border border-gray-100">
                    <legend className="contents">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-3 mb-4">
                        <span className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center text-sm font-semibold">1</span>
                        {isArabic ? 'نوع الاستشارة' : 'Type de consultation'}
                      </h3>
                    </legend>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {([
                        {
                          value: 'cabinet' as const,
                          title: isArabic ? 'في العيادة' : 'Au cabinet',
                          desc: `${doctor.address}, ${doctor.city}`,
                          count: cabinetCount,
                        },
                        {
                          value: 'video' as const,
                          title: isArabic ? 'عن بُعد بالفيديو' : 'En visioconférence',
                          desc: isArabic
                            ? 'رابط الاتصال يظهر لك وللطبيب فقط'
                            : 'Le lien d’appel n’apparaît que pour vous et le praticien',
                          count: videoCount,
                        },
                      ]).map((opt) => {
                        const active = consultationType === opt.value;
                        return (
                          <label
                            key={opt.value}
                            className={`flex gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                              active ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <input
                              type="radio"
                              name="consultationType"
                              value={opt.value}
                              checked={active}
                              onChange={() => {
                                setConsultationType(opt.value);
                                // L'horaire déjà coché peut ne pas exister dans
                                // l'autre mode : on repart d'une sélection vide.
                                setSelectedTime('');
                              }}
                              className="mt-0.5 w-4 h-4 accent-blue-600 flex-shrink-0"
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-gray-800">{opt.title}</span>
                              <span className="block text-xs text-gray-500 mt-0.5 leading-relaxed">{opt.desc}</span>
                              {/* Le patient voit tout de suite si ce mode offre des horaires ce jour-là */}
                              {selectedDate && (
                                <span className={`block text-xs mt-1 font-medium ${opt.count > 0 ? 'text-blue-700' : 'text-amber-700'}`}>
                                  {opt.count > 0
                                    ? (isArabic ? `${opt.count} موعد متاح` : `${opt.count} créneau${opt.count > 1 ? 'x' : ''} ce jour-là`)
                                    : (isArabic ? 'لا موعد في هذا اليوم' : 'Aucun créneau ce jour-là')}
                                </span>
                              )}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-500 mt-3">
                      {isArabic
                        ? 'الأوقات المتاحة هي نفسها في الحالتين.'
                        : 'Les créneaux proposés sont les mêmes dans les deux cas.'}
                    </p>
                  </fieldset>
                )}

                {/* Sélecteur de date */}
                <div className="bg-white rounded-2xl p-5 sm:p-8 shadow-sm border border-gray-100">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                      <span className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center text-sm font-semibold">{stepNo(1)}</span>
                      {isArabic ? 'اختر التاريخ' : 'Date de visite'}
                    </h3>
                    {/* Aller directement à une date précise (jusqu'à un an) */}
                    <input
                      type="date"
                      min={todayStr}
                      max={maxStr}
                      value={selectedDate}
                      onChange={(e) => {
                        const iso = e.target.value;
                        if (!iso) return;
                        const diff = Math.floor(
                          (new Date(`${iso}T00:00:00`).getTime() - new Date(`${todayStr}T00:00:00`).getTime()) / 86400000
                        );
                        setWeekOffset(Math.max(0, Math.floor(diff / 7)));
                        setSelectedDate(iso);
                        setSelectedTime('');
                      }}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none"
                    />
                  </div>

                  {/* Navigation semaine par semaine + mois affiché */}
                  <div className="flex items-center justify-between mb-3">
                    <button
                      type="button"
                      onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
                      disabled={!canGoBack}
                      aria-label={isArabic ? 'الأسبوع السابق' : 'Semaine précédente'}
                      className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:border-blue-300 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d={isArabic ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'} />
                      </svg>
                    </button>
                    <span className="text-sm font-semibold text-gray-700 capitalize">{periodLabel}</span>
                    <button
                      type="button"
                      onClick={() => setWeekOffset((w) => w + 1)}
                      disabled={!canGoForward}
                      aria-label={isArabic ? 'الأسبوع التالي' : 'Semaine suivante'}
                      className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:border-blue-300 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d={isArabic ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
                      </svg>
                    </button>
                  </div>

                  <div className="flex gap-2.5 overflow-x-auto pb-2 no-scrollbar">
                    {days.map(d => {
                      const working = isWorkingDate(d.full) && !d.isPast && !d.beyondHorizon
                        // Un jour sans créneau DANS LE MODE CHOISI est désactivé :
                        // en vidéo, les jours purement « cabinet » deviennent gris.
                        && slotsForDay(doctor, d.full, consultationType).length > 0;
                      const active = selectedDate === d.full;
                      return (
                        <button
                          key={d.full}
                          onClick={() => {
                            if (!working) return;
                            setSelectedDate(d.full);
                            setSelectedTime('');
                          }}
                          disabled={!working}
                          className={`flex-shrink-0 flex flex-col items-center min-w-[76px] py-3.5 rounded-xl border transition-all ${
                            active
                              ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20'
                              : working
                                ? 'bg-white border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50/40'
                                : 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed'
                          }`}
                        >
                          <span className={`text-[11px] font-medium mb-1 ${active ? 'text-blue-100' : 'opacity-60'}`}>{d.label}</span>
                          <span className="text-xl font-bold leading-none mb-1">{d.dayNum}</span>
                          <span className={`text-[11px] ${active ? 'text-blue-100' : 'opacity-60'}`}>{d.month}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sélecteur d'heure */}
                {selectedDate && isWorkingDate(selectedDate) && (
                  <div className="bg-white rounded-2xl p-5 sm:p-8 shadow-sm border border-gray-100 animate-fadeInUp">
                    <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-3">
                      <span className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center text-sm font-semibold">{stepNo(2)}</span>
                      {isArabic ? 'اختر الوقت' : 'Créneau horaire'}
                    </h3>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
                      {daySlots.map(slot => (
                        <button
                          key={slot}
                          onClick={() => setSelectedTime(slot)}
                          className={`py-3 rounded-lg text-sm font-semibold border transition-all ${
                            selectedTime === slot
                              ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                              : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50'
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                    {selectedTime && (
                      <button
                        onClick={() => setStep(2)}
                        className="mt-8 w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm transition-colors active:scale-[0.99]"
                      >
                        {isArabic ? 'التالي' : 'Continuer'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Étape 2 : formulaire patient */}
            {step === 2 && (
              <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 sm:p-8 shadow-sm border border-gray-100 animate-fadeInUp">
                <div className="flex items-center gap-3 mb-8">
                  <button type="button" onClick={() => setStep(1)} className="group w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-all">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d={isArabic ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"} />
                    </svg>
                  </button>
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                    <span className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center text-sm font-semibold">{stepNo(3)}</span>
                    {isArabic ? 'معلوماتك الشخصية' : 'Vos informations'}
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {[
                    { label: isArabic ? 'الاسم الكامل *' : 'Nom complet *', key: 'name', type: 'text', placeholder: isArabic ? 'محمد أمين' : 'Ex: Karim Benali', required: true },
                    { label: isArabic ? 'البريد الإلكتروني *' : 'Email *', key: 'email', type: 'email', placeholder: 'karim@email.dz', required: true },
                    { label: isArabic ? 'الهاتف *' : 'Téléphone *', key: 'phone', type: 'tel', placeholder: '05xx xx xx xx', required: true },
                  ].map(f => (
                    <div key={f.key} className={f.key === 'phone' ? 'sm:col-span-2' : ''}>
                      <label className="block text-sm font-medium text-gray-600 mb-1.5">{f.label}</label>
                      <input
                        type={f.type}
                        required={f.required}
                        placeholder={f.placeholder}
                        value={form[f.key as keyof typeof form]}
                        onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all text-gray-800 placeholder:text-gray-300 outline-none"
                      />
                    </div>
                  ))}
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">
                      {isArabic ? 'سبب الاستشارة (اختياري)' : 'Motif de consultation (optionnel)'}
                    </label>
                    <textarea
                      rows={4}
                      placeholder={isArabic ? 'صف باختصار سبب زيارتك...' : 'Décrivez brièvement votre motif...'}
                      value={form.reason}
                      onChange={e => setForm({ ...form, reason: e.target.value })}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all text-gray-800 placeholder:text-gray-300 outline-none resize-none"
                    />
                  </div>
                </div>

                <div className="mt-6 p-4 bg-blue-50/60 border border-blue-100 rounded-xl text-sm text-blue-800 flex items-center gap-3">
                  <IconMail className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  {isArabic
                    ? 'ستصلك رسالة تأكيد على بريدك الإلكتروني فور تأكيد الحجز'
                    : 'Une confirmation vous sera envoyée par e-mail.'}
                </div>

                <button
                  type="submit"
                  className="w-full mt-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm transition-colors active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  <IconCheck className="w-5 h-5" />
                  {isArabic ? 'تأكيد الحجز' : 'Finaliser la réservation'}
                </button>
              </form>
            )}
          </div>

          {/* ── Récapitulatif latéral ── */}
          <div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sticky top-24">
              <h3 className="font-semibold text-gray-400 text-xs uppercase tracking-wider mb-5">
                {isArabic ? 'ملخص الحجز' : 'Récapitulatif'}
              </h3>

              <div className="flex gap-3 items-center pb-5 border-b border-gray-100">
                <DoctorAvatar doctor={doctor} className="w-12 h-12" rounded="rounded-xl" />
                <div>
                  <p className="font-semibold text-gray-900 leading-tight">{doctor.name}</p>
                  <p className="text-blue-600 text-sm">{doctor.specialty}</p>
                </div>
              </div>

              <div className="space-y-1 pt-5">
                {selectedDate && (
                  <div className="flex items-center gap-3 py-2">
                    <span className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <IconCalendar className="w-[18px] h-[18px] text-blue-500" />
                    </span>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Date</p>
                      <p className="font-medium text-gray-700 capitalize text-sm">
                        {new Date(selectedDate).toLocaleDateString(isArabic ? 'ar-DZ' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </p>
                    </div>
                  </div>
                )}
                {selectedTime && (
                  <div className="flex items-center gap-3 py-2">
                    <span className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <IconClock className="w-[18px] h-[18px] text-blue-500" />
                    </span>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Heure</p>
                      <p className="font-medium text-gray-700 text-sm">{selectedTime}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-3 py-2">
                  <span className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <IconPin className="w-[18px] h-[18px] text-blue-500" />
                  </span>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Lieu</p>
                    <p className="font-medium text-gray-700 text-sm leading-snug">{doctor.address}<br />{doctor.city}</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 p-4 bg-blue-50/60 border border-blue-100 rounded-xl flex gap-3">
                <IconInfo className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-800 mb-1">{isArabic ? 'نصيحة' : 'Conseil'}</p>
                  <p className="text-sm text-blue-700 leading-relaxed">
                    {isArabic
                      ? 'أحضر بطاقتك الصحية وملفك الطبي'
                      : 'Pensez à apporter votre carte et votre dossier médical.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
