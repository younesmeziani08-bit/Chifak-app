import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Header from '../shared/Header';
import VideoCall from '../booking/VideoCall';
import { useLanguage } from '../../contexts/LanguageContext';
import { appointmentsAPI, patientAPI, reviewsAPI } from '../../services/api';

const NAVY = '#00264c';

const ICONS: Record<string, ReactNode> = {
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
  pin: <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M6 21v-1a6 6 0 0 1 12 0v1" /></>,
  mail: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 6-10 7L2 6" /></>,
  phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.5-1.1a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2Z" />,
  check: <path d="M20 6 9 17l-5-5" />,
};

function Icon({ name, className = 'w-5 h-5', strokeWidth = 1.75 }: { name: string; className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

interface Appointment {
  id: number;
  doctor_id: number;
  doctor_name: string;
  specialty: string;
  address?: string;
  city?: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  // Paramètres du médecin, renvoyés par l'API pour recalculer les créneaux
  slot_duration?: number;
  available_slots?: string | string[];
  working_days?: string | number[];
  off_days?: string | string[];
  blocked_slots?: string | string[];
  /** 'cabinet' ou 'video'. Les rendez-vous antérieurs à cette fonctionnalité
   *  n'ont pas de valeur : ils sont traités comme des consultations au cabinet. */
  consultation_type?: 'cabinet' | 'video';
  /** Salle de visio, renvoyée uniquement au patient concerné et à son médecin. */
  video_room?: string | null;
  /* Rendez-vous pris pour un enfant mineur. Le parent doit retrouver de qui
     il s'agit : avec plusieurs enfants, une liste de dates sans nom devient
     vite illisible. */
  child_first_name?: string | null;
  child_last_name?: string | null;
  child_age?: number | null;
}

interface PatientAccountProps {
  patientUser: { id: number; name: string; email: string };
  onBackToHome: () => void;
  onOpenProfessional: () => void;
  onDoctorClick?: () => void;
  onLogout: () => void;
  onProfileUpdated: (user: { id: number; name: string; email: string }) => void;
}

const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

function formatDate(iso: string, isArabic: boolean): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  if (isArabic) return iso;
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

export default function PatientAccount({ patientUser, onBackToHome, onOpenProfessional, onDoctorClick, onLogout, onProfileUpdated }: PatientAccountProps) {
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const [videoRoom, setVideoRoom] = useState<string | null>(null);
  const [tab, setTab] = useState<'appointments' | 'settings'>('appointments');

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingRdv, setLoadingRdv] = useState(true);
  const [reviewedDoctors, setReviewedDoctors] = useState<Set<number>>(new Set());

  const [name, setName] = useState(patientUser.name || '');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await appointmentsAPI.getMy();
        if (alive) setAppointments(Array.isArray(data) ? data : []);
      } catch {
        if (alive) setAppointments([]);
      } finally {
        if (alive) setLoadingRdv(false);
      }
    })();
    (async () => {
      try {
        const profile = await patientAPI.getProfile();
        if (alive) {
          setName(profile.name || '');
          setPhone(profile.phone || '');
        }
      } catch {
        // profil optionnel
      }
    })();
    (async () => {
      const mine = await reviewsAPI.getMine();
      if (alive) setReviewedDoctors(new Set(mine.map((m) => m.doctor_id)));
    })();
    return () => { alive = false; };
  }, []);

  const isPast = (a: Appointment) =>
    new Date(`${a.appointment_date}T${a.appointment_time || '00:00'}`).getTime() < Date.now();

  /* Le calcul des créneaux disponibles vivait ici pour le formulaire de
     reprogrammation. Celui-ci ayant été retiré, ce code est parti avec : cet
     écran ne fait plus que consulter, annuler et noter. Les créneaux se
     choisissent là où on les choisit vraiment — dans la recherche et la page
     de réservation, qui partagent le même module utils/slots. */

  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState('');

  const handleCancel = async (id: number) => {
    if (!window.confirm(isArabic ? 'إلغاء هذا الموعد؟' : 'Annuler ce rendez-vous ?')) return;
    setBusyId(id);
    setActionError('');
    try {
      const updated = await appointmentsAPI.cancel(id);
      setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, ...updated } : a)));
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusyId(null);
    }
  };

  const [reviewId, setReviewId] = useState<number | null>(null);
  const [rStars, setRStars] = useState(5);
  const [rComment, setRComment] = useState('');

  const openReview = (a: Appointment) => {
    setReviewId(a.id);
    setRStars(5);
    setRComment('');
    setActionError('');
  };

  const handleReview = async (a: Appointment) => {
    setBusyId(a.id);
    setActionError('');
    try {
      await reviewsAPI.submit(a.doctor_id, rStars, rComment);
      setReviewedDoctors((prev) => new Set(prev).add(a.doctor_id));
      setReviewId(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusyId(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const updated = await patientAPI.updateProfile({ name, phone });
      const user = { id: updated.id, name: updated.name, email: updated.email };
      localStorage.setItem('chifak_patient_user', JSON.stringify(user));
      onProfileUpdated(user);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const statusLabel = (s: string) => {
    if (s === 'cancelled') return isArabic ? 'ملغى' : 'Annulé';
    if (s === 'completed') return isArabic ? 'منتهٍ' : 'Terminé';
    return isArabic ? 'مؤكد' : 'Confirmé';
  };
  const statusClass = (s: string) =>
    s === 'cancelled' ? 'bg-red-50 text-red-600' : s === 'completed' ? 'bg-gray-100 text-gray-600' : 'bg-green-50 text-green-700';

  return (
    <div className="min-h-screen bg-gray-50" dir={isArabic ? 'rtl' : 'ltr'}>
      <Header
        onHomeClick={onBackToHome}
        onBack={onBackToHome}
        onDoctorClick={onDoctorClick}
        onOpenProfessional={onOpenProfessional}
        patientUser={patientUser}
        onLogout={onLogout}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1" style={{ color: NAVY }}>
          {isArabic ? 'حسابي' : 'Mon compte'}
        </h1>
        <p className="text-gray-500 mb-6">{patientUser.name} · {patientUser.email}</p>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200 mb-6">
          <button
            onClick={() => setTab('appointments')}
            className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === 'appointments' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Icon name="calendar" className="w-4 h-4" strokeWidth={2} />
            {isArabic ? 'مواعيدي' : 'Mes rendez-vous'}
          </button>
          <button
            onClick={() => setTab('settings')}
            className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === 'settings' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <Icon name="settings" className="w-4 h-4" strokeWidth={2} />
            {isArabic ? 'الإعدادات' : 'Paramètres'}
          </button>
        </div>

        {/* Appointments */}
        {tab === 'appointments' && (
          <div>
            {(() => {
              const toReview = appointments.filter((a) => a.status !== 'cancelled' && isPast(a) && !reviewedDoctors.has(a.doctor_id));
              if (toReview.length === 0) return null;
              return (
                <div className="mb-5 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <span className="flex-shrink-0 w-9 h-9 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                    <Icon name="calendar" className="w-5 h-5" strokeWidth={2} />
                  </span>
                  <div>
                    <p className="font-semibold text-amber-800">
                      {isArabic
                        ? `لديك ${toReview.length} استشارة بانتظار تقييمك`
                        : `Vous avez ${toReview.length} consultation${toReview.length > 1 ? 's' : ''} à évaluer`}
                    </p>
                    <p className="text-sm text-amber-700">
                      {isArabic ? 'قيّم طبيبك لمساعدة المرضى الآخرين.' : 'Donnez votre avis pour aider les autres patients.'}
                    </p>
                  </div>
                </div>
              );
            })()}
            {loadingRdv ? (
              <p className="text-gray-500">{isArabic ? 'جاري التحميل…' : 'Chargement…'}</p>
            ) : appointments.filter((a) => a.status !== 'cancelled').length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
                  <Icon name="calendar" className="w-6 h-6" />
                </div>
                <h3 className="font-semibold mb-1" style={{ color: NAVY }}>
                  {isArabic ? 'لا مواعيد بعد' : 'Aucun rendez-vous'}
                </h3>
                <p className="text-gray-500 mb-6">{isArabic ? 'ابحث عن طبيب واحجز موعدك.' : 'Recherchez un médecin et réservez votre premier rendez-vous.'}</p>
                <button onClick={onBackToHome} className="btn-pro inline-flex px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors">
                  {isArabic ? 'ابحث عن طبيب' : 'Trouver un médecin'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {appointments.filter((a) => a.status !== 'cancelled').map((a) => (
                  <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold" style={{ color: NAVY }}>{a.doctor_name}</h3>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusClass(a.status)}`}>{statusLabel(a.status)}</span>
                        </div>
                        {a.child_first_name && (
                          <p className="text-sm mb-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full"
                            style={{ background: '#FDF3E3', color: '#9A6410' }}>
                            {isArabic ? 'لأجل ' : 'Pour '}
                            <strong>{a.child_first_name} {a.child_last_name}</strong>
                            {a.child_age !== null && a.child_age !== undefined && ` · ${a.child_age} ${isArabic ? 'سنة' : 'ans'}`}
                          </p>
                        )}
                        <p className="text-blue-600 text-sm font-medium">{a.specialty}</p>
                        {a.city && (
                          <p className="flex items-center gap-1.5 text-sm text-gray-500 mt-1">
                            <Icon name="pin" className="w-4 h-4 text-gray-400" />{a.city}
                          </p>
                        )}
                      </div>
                      <div className="text-start sm:text-end">
                        <div className="flex items-center gap-1.5 font-medium" style={{ color: NAVY }}>
                          <Icon name="calendar" className="w-4 h-4 text-blue-600" />
                          {formatDate(a.appointment_date, isArabic)}
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-500 text-sm mt-1 sm:justify-end">
                          <Icon name="clock" className="w-4 h-4 text-gray-400" />
                          {a.appointment_time}
                        </div>
                      </div>
                    </div>

                    {a.status !== 'cancelled' && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        {reviewId === a.id ? (
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((n) => (
                                <button key={n} type="button" onClick={() => setRStars(n)} aria-label={`${n}`} className="p-0.5">
                                  <svg className={`w-6 h-6 ${n <= rStars ? 'text-amber-400' : 'text-gray-300'}`} viewBox="0 0 24 24" fill="currentColor">
                                    <path d="m12 3 2.6 5.5 6 .9-4.3 4.2 1 6-5.3-2.8L6.7 19.6l1-6L3.4 9.4l6-.9L12 3Z" />
                                  </svg>
                                </button>
                              ))}
                            </div>
                            <textarea value={rComment} onChange={(e) => setRComment(e.target.value)} rows={2}
                              placeholder={isArabic ? 'تعليقك (اختياري)' : 'Votre commentaire (facultatif)'}
                              className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                            <div className="flex gap-2">
                              <button onClick={() => handleReview(a)} disabled={busyId === a.id}
                                className="btn-pro px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:bg-gray-300 transition-colors">
                                {busyId === a.id ? '…' : (isArabic ? 'إرسال' : "Envoyer l'avis")}
                              </button>
                              <button onClick={() => { setReviewId(null); setActionError(''); }}
                                className="px-4 py-2 text-gray-500 text-sm hover:text-gray-800">
                                {isArabic ? 'تراجع' : 'Annuler'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {!isPast(a) && (
                              <>
                                {/* Le bouton n'existe que pour un rendez-vous
                                    réellement pris en visio, et la salle vient
                                    du serveur — elle n'est jamais reconstruite
                                    à partir de l'identifiant. */}
                                {a.consultation_type === 'video' && a.video_room && (
                                  <button onClick={() => setVideoRoom(a.video_room!)}
                                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors inline-flex items-center gap-1.5">
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>
                                    {isArabic ? 'انضم للفيديو' : 'Rejoindre la visio'}
                                  </button>
                                )}
                                <button onClick={() => handleCancel(a.id)} disabled={busyId === a.id}
                                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-red-300 hover:text-red-600 transition-colors">
                                  {isArabic ? 'إلغاء' : 'Annuler le RDV'}
                                </button>
                                {/* On dit ce qu'il faut faire pour déplacer un
                                    rendez-vous, plutôt que de laisser le
                                    patient chercher un bouton qui n'existe
                                    plus. Le créneau libéré redevient
                                    disponible pour tout le monde. */}
                                <span className="text-xs text-gray-400 self-center">
                                  {isArabic
                                    ? 'لتغيير الموعد: ألغِ ثم احجز من جديد.'
                                    : 'Pour changer de créneau : annulez, puis reprenez rendez-vous.'}
                                </span>
                              </>
                            )}
                            {isPast(a) && (
                              reviewedDoctors.has(a.doctor_id) ? (
                                <span className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-green-600">
                                  <Icon name="check" className="w-4 h-4" strokeWidth={2.5} />
                                  {isArabic ? 'شكرًا على تقييمك' : 'Merci pour votre avis'}
                                </span>
                              ) : (
                                <button onClick={() => openReview(a)}
                                  className="btn-pro inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 transition-colors">
                                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="m12 3 2.6 5.5 6 .9-4.3 4.2 1 6-5.3-2.8L6.7 19.6l1-6L3.4 9.4l6-.9L12 3Z" /></svg>
                                  {isArabic ? 'اترك تقييمًا' : 'Laisser un avis'}
                                </button>
                              )
                            )}
                          </div>
                        )}
                        {actionError && reviewId === a.id && <p className="text-sm text-red-600 mt-2">{actionError}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Settings */}
        {tab === 'settings' && (
          <form onSubmit={handleSave} className="bg-white rounded-2xl border border-gray-200 p-6 max-w-lg">
            <h3 className="font-semibold mb-5" style={{ color: NAVY }}>
              {isArabic ? 'معلوماتي الشخصية' : 'Mes informations personnelles'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{isArabic ? 'الاسم الكامل' : 'Nom complet'}</label>
                <div className="relative">
                  <span className="absolute inset-y-0 ltr:left-3 rtl:right-3 flex items-center text-gray-400 pointer-events-none"><Icon name="user" className="w-5 h-5" /></span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full ltr:pl-11 rtl:pr-11 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800 transition"
                    placeholder={isArabic ? 'اسمك' : 'Votre nom'}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{isArabic ? 'الهاتف' : 'Téléphone'}</label>
                <div className="relative">
                  <span className="absolute inset-y-0 ltr:left-3 rtl:right-3 flex items-center text-gray-400 pointer-events-none"><Icon name="phone" className="w-5 h-5" /></span>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full ltr:pl-11 rtl:pr-11 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800 transition"
                    placeholder="0555 12 34 56"
                    inputMode="tel"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{isArabic ? 'البريد الإلكتروني' : 'Email'}</label>
                <div className="relative">
                  <span className="absolute inset-y-0 ltr:left-3 rtl:right-3 flex items-center text-gray-400 pointer-events-none"><Icon name="mail" className="w-5 h-5" /></span>
                  <input
                    value={patientUser.email}
                    disabled
                    className="w-full ltr:pl-11 rtl:pr-11 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">{isArabic ? 'لا يمكن تغيير البريد الإلكتروني.' : "L'email ne peut pas être modifié."}</p>
              </div>
            </div>

            {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
            {saved && (
              <p className="flex items-center gap-1.5 text-sm text-green-600 mt-4">
                <Icon name="check" className="w-4 h-4" strokeWidth={2.5} />
                {isArabic ? 'تم الحفظ' : 'Modifications enregistrées'}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="btn-pro mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-xl font-semibold text-sm transition-colors"
            >
              {saving ? (isArabic ? 'جاري الحفظ…' : 'Enregistrement…') : (isArabic ? 'حفظ' : 'Enregistrer')}
            </button>
          </form>
        )}
      </div>

      {videoRoom && (
        <VideoCall
          room={videoRoom}
          displayName={patientUser.name}
          isArabic={isArabic}
          onClose={() => setVideoRoom(null)}
        />
      )}
    </div>
  );
}
