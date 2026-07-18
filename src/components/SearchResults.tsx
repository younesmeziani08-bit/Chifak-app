import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Doctor } from '../App';
import Header from './Header';
import { useLanguage } from '../contexts/LanguageContext';
import { useDoctors } from '../contexts/DoctorsContext';

const NAVY = '#00264c';

const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const MONTHS_FR = ['jan.', 'fév.', 'mar.', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sep.', 'oct.', 'nov.', 'déc.'];
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

const ICONS: Record<string, ReactNode> = {
  search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></>,
  pin: <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
  star: <path d="m12 3 2.6 5.5 6 .9-4.3 4.2 1 6-5.3-2.8L6.7 19.6l1-6L3.4 9.4l6-.9L12 3Z" />,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  arrowLeft: <><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  map: <><path d="M9 20l-5.4 2.7A1 1 0 0 1 2 21.8V6.2a1 1 0 0 1 .6-.9L9 2m0 18 6-3M9 20V2m6 15 5.4 2.7A1 1 0 0 0 22 18.8V3.2a1 1 0 0 0-.6-.9L15 -1M15 17V2M15 2 9 5" /></>,
};

function Icon({ name, className = 'w-5 h-5', strokeWidth = 1.75 }: { name: string; className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

interface SearchResultsProps {
  searchQuery: { specialty: string; location: string; date: string };
  onDoctorSelect: (doctor: Doctor) => void;
  onBackToHome: () => void;
  onDoctorClick?: () => void;
  onOpenLogin: () => void;
  onOpenSignup: () => void;
  onOpenProfessional: () => void;
  patientUser?: { id: number; name: string; email: string } | null;
  onLogout?: () => void;
}

interface DayInfo {
  full: string;
  weekday: string;
  dayNum: number;
  month: string;
  isToday: boolean;
}

function buildDays(count: number, isArabic: boolean): DayInfo[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    return {
      full: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      weekday: i === 0 ? (isArabic ? 'اليوم' : 'Auj.') : (isArabic ? DAYS_AR[d.getDay()] : DAYS_FR[d.getDay()]),
      dayNum: d.getDate(),
      month: isArabic ? MONTHS_AR[d.getMonth()] : MONTHS_FR[d.getMonth()],
      isToday: i === 0,
    };
  });
}

function weekdayOf(iso: string): number {
  return new Date(`${iso}T00:00:00`).getDay();
}

function workingDaysOf(doctor: Doctor): number[] {
  return doctor.workingDays && doctor.workingDays.length ? doctor.workingDays : [1, 2, 3, 4, 5];
}

function slotsForDay(doctor: Doctor, iso: string): string[] {
  if (!workingDaysOf(doctor).includes(weekdayOf(iso))) return [];
  return doctor.availableSlots || [];
}

/* Next day (within the strip window) where the doctor has availability */
function nextAvailableDay(doctor: Doctor, days: DayInfo[], fromISO: string): DayInfo | null {
  const start = days.findIndex((d) => d.full === fromISO);
  const from = start === -1 ? 0 : start;
  for (let i = from + 1; i < days.length; i++) {
    if (slotsForDay(doctor, days[i].full).length > 0) return days[i];
  }
  for (let i = 0; i < from; i++) {
    if (slotsForDay(doctor, days[i].full).length > 0) return days[i];
  }
  return null;
}

function initials(name: string): string {
  const parts = name.replace(/^Dr\.?\s*/i, '').trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'DR';
}

export default function SearchResults({ searchQuery, onDoctorSelect, onBackToHome, onDoctorClick, onOpenLogin, onOpenSignup, onOpenProfessional, patientUser, onLogout }: SearchResultsProps) {
  const { language } = useLanguage();
  const { getDoctorsBySpecialtyAndLocation } = useDoctors();
  const isArabic = language === 'ar';

  const todayISO = buildDays(1, isArabic)[0].full;
  const days = useMemo(() => buildDays(30, isArabic), [isArabic]);
  const initialDay = searchQuery.date && searchQuery.date >= todayISO ? searchQuery.date : todayISO;
  const [activeDay, setActiveDay] = useState(initialDay);
  const [sortBy, setSortBy] = useState<'availability' | 'rating'>('availability');

  const stripRef = useRef<HTMLDivElement>(null);
  const activeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeBtnRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeDay]);

  const scrollStrip = (dir: number) => {
    stripRef.current?.scrollBy({ left: dir * 240, behavior: 'smooth' });
  };

  const allDoctors = getDoctorsBySpecialtyAndLocation(searchQuery.specialty, searchQuery.location);
  const doctors = [...allDoctors].sort((a, b) => {
    if (sortBy === 'rating') return b.rating - a.rating;
    const av = slotsForDay(a, activeDay).length > 0 ? 0 : 1;
    const bv = slotsForDay(b, activeDay).length > 0 ? 0 : 1;
    return av - bv;
  });

  const availableCount = doctors.filter((d) => slotsForDay(d, activeDay).length > 0).length;
  const activeDayInfo = days.find((d) => d.full === activeDay);

  return (
    <div className="min-h-screen bg-gray-50" dir={isArabic ? 'rtl' : 'ltr'}>
      <Header
        onHomeClick={onBackToHome}
        onDoctorClick={onDoctorClick}
        onOpenLogin={onOpenLogin}
        onOpenSignup={onOpenSignup}
        onOpenProfessional={onOpenProfessional}
        patientUser={patientUser}
        onLogout={onLogout}
      />

      {/* Search summary bar */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3 flex-wrap">
          <button
            onClick={onBackToHome}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
          >
            <Icon name="arrowLeft" className="w-4 h-4" strokeWidth={2} />
            {isArabic ? 'تعديل' : 'Modifier'}
          </button>
          <div className="h-5 w-px bg-gray-200" />
          <div className="flex items-center gap-2 text-gray-500">
            <Icon name="search" className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium" style={{ color: NAVY }}>{searchQuery.specialty || (isArabic ? 'كل التخصصات' : 'Toutes les spécialités')}</span>
          </div>
          {searchQuery.location && (
            <div className="flex items-center gap-2 text-gray-500">
              <Icon name="pin" className="w-4 h-4 text-blue-600" />
              <span className="text-sm">{searchQuery.location}</span>
            </div>
          )}
        </div>
      </div>

      {/* Day navigator */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => scrollStrip(-1)}
              aria-label={isArabic ? 'الأيام السابقة' : 'Jours précédents'}
              className="flex-shrink-0 w-9 h-9 rounded-lg border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-300 flex items-center justify-center transition-colors"
            >
              <Icon name={isArabic ? 'chevronRight' : 'chevronLeft'} className="w-5 h-5" strokeWidth={2} />
            </button>

            <div ref={stripRef} className="flex-1 flex gap-2 overflow-x-auto no-scrollbar scroll-smooth">
              {days.map((d) => {
                const isActive = d.full === activeDay;
                return (
                  <button
                    key={d.full}
                    ref={isActive ? activeBtnRef : undefined}
                    onClick={() => setActiveDay(d.full)}
                    className={`flex flex-col items-center flex-shrink-0 min-w-[68px] px-3 py-2 rounded-xl border transition-colors ${
                      isActive
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'
                    }`}
                  >
                    <span className="text-xs font-medium capitalize">{d.weekday}</span>
                    <span className="text-lg font-semibold leading-tight">{d.dayNum}</span>
                    <span className={`text-[10px] ${isActive ? 'text-blue-100' : 'text-gray-400'}`}>{d.month}</span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => scrollStrip(1)}
              aria-label={isArabic ? 'الأيام التالية' : 'Jours suivants'}
              className="flex-shrink-0 w-9 h-9 rounded-lg border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-300 flex items-center justify-center transition-colors"
            >
              <Icon name={isArabic ? 'chevronLeft' : 'chevronRight'} className="w-5 h-5" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex items-end justify-between gap-4 mb-5 flex-wrap">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: NAVY }}>
              {isArabic
                ? `${availableCount} طبيب متاح`
                : `${availableCount} praticien${availableCount > 1 ? 's' : ''} disponible${availableCount > 1 ? 's' : ''}`}
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {activeDayInfo && (
                <>
                  {isArabic ? 'ليوم' : 'Le'} {activeDayInfo.weekday} {activeDayInfo.dayNum} {activeDayInfo.month}
                  {doctors.length !== availableCount && (
                    <span className="text-gray-400"> · {doctors.length} {isArabic ? 'في المجموع' : 'au total'}</span>
                  )}
                </>
              )}
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            {isArabic ? 'ترتيب' : 'Trier'}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="availability">{isArabic ? 'التوفر' : 'Disponibilité'}</option>
              <option value="rating">{isArabic ? 'التقييم' : 'Note'}</option>
            </select>
          </label>
        </div>

        {doctors.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 sm:p-16 text-center">
            <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-5">
              <Icon name="search" className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: NAVY }}>
              {isArabic ? 'لا يوجد طبيب' : 'Aucun praticien trouvé'}
            </h3>
            <p className="text-gray-500 max-w-md mx-auto mb-8">
              {isArabic ? 'جرّب تغيير التخصص أو المنطقة.' : "Essayez de modifier la spécialité ou la localisation."}
            </p>
            <button
              onClick={onBackToHome}
              className="btn-pro inline-flex px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors"
            >
              {isArabic ? 'بحث جديد' : 'Nouvelle recherche'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {doctors.map((doctor) => (
              <DoctorCard
                key={doctor.id}
                doctor={doctor}
                isArabic={isArabic}
                slots={slotsForDay(doctor, activeDay)}
                nextDay={nextAvailableDay(doctor, days, activeDay)}
                onSelect={() => onDoctorSelect(doctor)}
                onPickDay={(iso) => setActiveDay(iso)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DoctorCard({
  doctor, isArabic, slots, nextDay, onSelect, onPickDay,
}: {
  doctor: Doctor;
  isArabic: boolean;
  slots: string[];
  nextDay: DayInfo | null;
  onSelect: () => void;
  onPickDay: (iso: string) => void;
}) {
  const isUrl = typeof doctor.image === 'string' && doctor.image.startsWith('http');
  const mapsLink = doctor.mapsUrl
    || (doctor.latitude && doctor.longitude ? `https://www.google.com/maps?q=${doctor.latitude},${doctor.longitude}` : null);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 hover:border-blue-300 transition-colors">
      <div className="flex flex-col sm:flex-row gap-5">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {isUrl ? (
            <img src={doctor.image} alt={doctor.name} className="w-16 h-16 rounded-full object-cover border border-gray-100" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-lg font-semibold">
              {initials(doctor.name)}
            </div>
          )}
        </div>

        {/* Info + slots */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold" style={{ color: NAVY }}>{doctor.name}</h2>
              <p className="text-blue-600 text-sm font-medium">{doctor.specialty}</p>
            </div>
            <div className="flex items-center gap-1 text-sm">
              <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="m12 3 2.6 5.5 6 .9-4.3 4.2 1 6-5.3-2.8L6.7 19.6l1-6L3.4 9.4l6-.9L12 3Z" />
              </svg>
              <span className="font-semibold" style={{ color: NAVY }}>{doctor.rating}</span>
              <span className="text-gray-400 text-xs">({doctor.reviewCount})</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-gray-500 mt-2">
            <span className="flex items-center gap-1.5"><Icon name="pin" className="w-4 h-4 text-gray-400" />{doctor.city}</span>
            {doctor.slotDuration && (
              <span className="flex items-center gap-1.5"><Icon name="clock" className="w-4 h-4 text-gray-400" />{isArabic ? `${doctor.slotDuration} دقيقة` : `${doctor.slotDuration} min`}</span>
            )}
            {mapsLink && (
              <a href={mapsLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800">
                <Icon name="map" className="w-4 h-4" />{isArabic ? 'الخريطة' : 'Voir sur la carte'}
              </a>
            )}
          </div>

          <div className="border-t border-gray-100 mt-4 pt-4">
            {slots.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                {slots.slice(0, 8).map((slot) => (
                  <button
                    key={slot}
                    onClick={onSelect}
                    className="px-4 py-2 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:!text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {slot}
                  </button>
                ))}
                <button
                  onClick={onSelect}
                  className="btn-pro ltr:ml-auto rtl:mr-auto px-5 py-2 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors"
                >
                  {isArabic ? 'حجز موعد' : 'Prendre RDV'}
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-gray-500">
                  {isArabic ? 'لا توجد مواعيد في هذا اليوم.' : "Pas de disponibilité ce jour-là."}
                </p>
                {nextDay ? (
                  <button
                    onClick={() => onPickDay(nextDay.full)}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800"
                  >
                    <Icon name="calendar" className="w-4 h-4" />
                    {isArabic ? 'أقرب موعد' : 'Prochaine dispo'} : {nextDay.weekday} {nextDay.dayNum} {nextDay.month}
                  </button>
                ) : (
                  <span className="text-sm text-gray-400">{isArabic ? 'لا مواعيد قريبة' : 'Aucune dispo prochainement'}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
