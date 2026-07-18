import { useEffect, useState } from 'react';
import { Doctor, Booking } from '../App';
import Header from './Header';
import FloatingShapes from './FloatingShapes';
import GoogleMapsView from './GoogleMapsView';
import { useLanguage } from '../contexts/LanguageContext';

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

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      label: i === 0 ? (isArabic ? 'اليوم' : "Auj.") : (isArabic ? DAYS_AR[d.getDay()] : DAYS_FR[d.getDay()]),
      dayNum: d.getDate(),
      month: isArabic ? MONTHS_AR[d.getMonth()] : MONTHS_FR[d.getMonth()],
      full: d.toISOString().split('T')[0],
    };
  });

  const workingDays = doctor.workingDays && doctor.workingDays.length > 0
    ? doctor.workingDays
    : [1, 2, 3, 4, 5];

  const isWorkingDate = (dateIso: string) => {
    const day = new Date(dateIso).getDay();
    return workingDays.includes(day);
  };

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
    });
  };

  const hasMap = doctor.mapsUrl || (doctor.latitude && doctor.longitude);

  return (
    <div className="relative min-h-screen bg-[#f8fafc] overflow-hidden" dir={isArabic ? 'rtl' : 'ltr'}>
      <FloatingShapes variant="soft" />
      <div className="relative z-10">
      <Header 
        onHomeClick={onBackToHome} 
        onDoctorClick={onDoctorClick}
        onOpenLogin={onOpenLogin}
        onOpenSignup={onOpenSignup}
        onOpenProfessional={onOpenProfessional}
        patientUser={patientUser}
        onLogout={onLogout}
      />

      {/* Breadcrumb - Pro Max */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-3 text-xs font-black uppercase tracking-widest text-gray-400">
          <button onClick={onBack} className="text-blue-600 hover:text-blue-700 transition-colors">
            {isArabic ? 'النتائج' : 'Résultats'}
          </button>
          <svg className="w-3 h-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d={isArabic ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"} />
          </svg>
          <span className="text-gray-900 truncate max-w-[200px]">{doctor.name}</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

          {/* ── Main column ── */}
          <div className="lg:col-span-2 space-y-10">
            {/* Doctor card - Pro Max */}
            <div className="glass-card-pro rounded-4xl p-8 sm:p-10">
              <div className="flex flex-col sm:flex-row gap-8 items-center sm:items-start text-center sm:text-left">
                <div className="w-24 h-24 sm:w-28 sm:h-28 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-3xl flex items-center justify-center text-5xl shadow-inner border border-blue-50">
                  {doctor.image}
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">{doctor.name}</h2>
                  <p className="text-blue-600 font-black text-xs sm:text-sm uppercase tracking-[0.2em] mt-2 mb-4">{doctor.specialty}</p>
                  <div className="flex flex-wrap justify-center sm:justify-start gap-4 items-center">
                    <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-xl px-3 py-1.5">
                      <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span className="text-sm font-black text-blue-700">{doctor.rating}</span>
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{doctor.reviewCount} avis</span>
                  </div>
                  <p className="text-gray-500 font-medium text-sm mt-6 flex items-center justify-center sm:justify-start gap-2">
                    <span className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-blue-500">📍</span>
                    {doctor.address}, {doctor.city}
                  </p>
                </div>
              </div>
            </div>

            {/* Step 1: Date & Time - Pro Max */}
            {step === 1 && (
              <div className="space-y-8 animate-fadeInUp">
                {/* Date picker */}
                <div className="bg-white rounded-4xl p-8 sm:p-10 shadow-sm border border-gray-100">
                  <h3 className="text-xl font-black text-gray-900 mb-8 flex items-center gap-4">
                    <span className="w-10 h-10 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-sm shadow-xl shadow-blue-500/20">1</span>
                    {isArabic ? 'اختر التاريخ' : 'Date de visite'}
                  </h3>
                  <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
                    {days.map(d => (
                      <button
                        key={d.full}
                        onClick={() => {
                          if (!isWorkingDate(d.full)) return;
                          setSelectedDate(d.full);
                          setSelectedTime('');
                        }}
                        disabled={!isWorkingDate(d.full)}
                        className={`flex-shrink-0 flex flex-col items-center min-w-[85px] p-5 rounded-3xl border-2 transition-all duration-300 ${
                          selectedDate === d.full
                            ? 'bg-blue-600 border-blue-600 text-white shadow-2xl shadow-blue-500/30 scale-105'
                            : isWorkingDate(d.full)
                              ? 'bg-white border-gray-100 text-gray-700 hover:border-blue-200 hover:bg-blue-50/30'
                              : 'bg-gray-50 border-gray-50 text-gray-300 cursor-not-allowed grayscale'
                        }`}
                      >
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">{d.label}</span>
                        <span className="text-2xl font-black leading-none mb-1">{d.dayNum}</span>
                        <span className="text-[10px] font-bold opacity-60">{d.month}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Time picker - Pro Max */}
                {selectedDate && isWorkingDate(selectedDate) && (
                  <div className="bg-white rounded-4xl p-8 sm:p-10 shadow-sm border border-gray-100 animate-fadeInUp">
                    <h3 className="text-xl font-black text-gray-900 mb-8 flex items-center gap-4">
                      <span className="w-10 h-10 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-sm shadow-xl shadow-blue-500/20">2</span>
                      {isArabic ? 'اختر الوقت' : 'Créneau horaire'}
                    </h3>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                      {(doctor.availableSlots || []).map(slot => (
                        <button
                          key={slot}
                          onClick={() => setSelectedTime(slot)}
                          className={`py-4 rounded-2xl text-sm font-black border-2 transition-all duration-300 ${
                            selectedTime === slot
                              ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-500/20'
                              : 'bg-white border-gray-50 text-gray-600 hover:border-blue-200 hover:text-blue-600 hover:bg-blue-50/50'
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                    {selectedTime && (
                      <button
                        onClick={() => setStep(2)}
                        className="btn-pro mt-10 w-full py-5 bg-blue-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-2xl shadow-blue-500/20 active:scale-[0.98]"
                      >
                        {isArabic ? 'التالي ←' : 'Confirmer le créneau'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Patient form - Pro Max */}
            {step === 2 && (
              <form onSubmit={handleSubmit} className="bg-white rounded-4xl p-8 sm:p-10 shadow-sm border border-gray-100 animate-fadeInUp">
                <div className="flex items-center gap-4 mb-10">
                  <button type="button" onClick={() => setStep(1)} className="group w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 hover:bg-blue-600 hover:text-white transition-all">
                    <svg className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d={isArabic ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"} />
                    </svg>
                  </button>
                  <h3 className="text-xl font-black text-gray-900 flex items-center gap-4">
                    <span className="w-10 h-10 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-sm shadow-xl shadow-blue-500/20">3</span>
                    {isArabic ? 'معلوماتك الشخصية' : 'Vos informations'}
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  {[
                    { label: isArabic ? 'الاسم الكامل *' : 'Nom complet *', key: 'name', type: 'text', placeholder: isArabic ? 'محمد أمين' : 'Ex: Karim Benali', required: true },
                    { label: isArabic ? 'البريد الإلكتروني *' : 'Email *', key: 'email', type: 'email', placeholder: 'karim@email.dz', required: true },
                    { label: isArabic ? 'الهاتف *' : 'Téléphone *', key: 'phone', type: 'tel', placeholder: '05xx xx xx xx', required: true },
                  ].map(f => (
                    <div key={f.key} className={f.key === 'phone' ? 'sm:col-span-2' : ''}>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-blue-900/40 mb-3 ml-1">{f.label}</label>
                      <input
                        type={f.type}
                        required={f.required}
                        placeholder={f.placeholder}
                        value={form[f.key as keyof typeof form]}
                        onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                        className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all text-gray-800 font-bold placeholder:text-gray-300 outline-none"
                      />
                    </div>
                  ))}
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-blue-900/40 mb-3 ml-1">
                      {isArabic ? 'سبب الاستشارة (اختياري)' : 'Motif de consultation (optionnel)'}
                    </label>
                    <textarea
                      rows={4}
                      placeholder={isArabic ? 'صف باختصار سبب زيارتك...' : 'Décrivez brièvement votre motif...'}
                      value={form.reason}
                      onChange={e => setForm({ ...form, reason: e.target.value })}
                      className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all text-gray-800 font-bold placeholder:text-gray-300 outline-none resize-none"
                    />
                  </div>
                </div>

                <div className="mt-10 p-6 bg-blue-50/50 border border-blue-100 rounded-3xl text-sm font-bold text-blue-800 flex items-center gap-4">
                  <span className="text-2xl">📧</span>
                  {isArabic
                    ? 'ستصلك رسالة تأكيد على بريدك الإلكتروني فور تأكيد الحجز'
                    : 'Une confirmation instantanée vous sera envoyée par e-mail.'}
                </div>

                <button
                  type="submit"
                  className="btn-pro w-full mt-10 py-6 bg-blue-600 text-white font-black uppercase tracking-[0.2em] text-sm rounded-3xl shadow-2xl shadow-blue-600/30 active:scale-[0.98]"
                >
                  ✅ {isArabic ? 'تأكيد الحجز' : 'Finaliser la réservation'}
                </button>
              </form>
            )}
          </div>

          {/* ── Summary sidebar - Pro Max ── */}
          <div>
            <div className="glass-panel rounded-4xl p-8 sticky top-48">
              <h3 className="font-black text-gray-400 text-[10px] uppercase tracking-[0.3em] mb-8">
                {isArabic ? 'ملخص الحجز' : 'Récapitulatif'}
              </h3>
              
              <div className="space-y-6">
                <div className="flex gap-4 items-center p-4 bg-white/50 rounded-2xl border border-white">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl flex items-center justify-center text-3xl shadow-sm">
                    {doctor.image}
                  </div>
                  <div>
                    <p className="font-black text-gray-900 tracking-tight leading-none mb-1.5">{doctor.name}</p>
                    <p className="text-blue-600 text-[10px] font-black uppercase tracking-widest">{doctor.specialty}</p>
                  </div>
                </div>

                <div className="space-y-4 pt-4">
                  {selectedDate && (
                    <div className="flex items-center gap-4 p-4 bg-gray-50/50 rounded-2xl">
                      <span className="text-xl">📅</span>
                      <div>
                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-0.5">Date</p>
                        <p className="font-bold text-gray-700 capitalize">
                          {new Date(selectedDate).toLocaleDateString(isArabic ? 'ar-DZ' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                      </div>
                    </div>
                  )}
                  {selectedTime && (
                    <div className="flex items-center gap-4 p-4 bg-gray-50/50 rounded-2xl">
                      <span className="text-xl">⏰</span>
                      <div>
                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-0.5">Heure</p>
                        <p className="font-bold text-gray-700">{selectedTime}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-4 p-4 bg-gray-50/50 rounded-2xl">
                    <span className="text-xl">📍</span>
                    <div>
                      <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-0.5">Lieu</p>
                      <p className="font-bold text-gray-700 leading-snug">{doctor.address}<br />{doctor.city}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-10 p-5 bg-blue-50 border border-blue-100 rounded-3xl">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-800 mb-2 flex items-center gap-2">
                  <span className="text-base">💡</span> Conseil
                </p>
                <p className="text-xs text-blue-700 font-bold leading-relaxed">
                  {isArabic
                    ? 'أحضر بطاقتك الصحية وبطاقة التأمين'
                    : 'Pensez à apporter votre carte vitale et votre dossier médical.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
