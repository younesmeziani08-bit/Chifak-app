import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import VideoCall from './VideoCall';
import { slotsForDay, todayIso, maxBookingIso, blockedKey, BlockedSlotEntry } from '../utils/slots';
import { doctorAuthAPI, consultationsAPI, doctorsAPI, appointmentsAPI, reviewsAPI, doctorAPI, AppointmentCreate } from '../services/api';

export default function DoctorSpace({ onBackToHome }: { onBackToHome: () => void }) {
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [doctorCode, setDoctorCode] = useState('');
  const [password, setPassword] = useState('');
  const [doctorInfo, setDoctorInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Changement de mot de passe obligatoire (1re connexion)
  const [mustChange, setMustChange] = useState(false);
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'consultation' | 'history' | 'reviews' | 'appointments' | 'profile'>('appointments');
  const [reviews, setReviews] = useState<any[]>([]);

  // Espace médecin — profil éditable + rendez-vous + remarques
  const [docAppointments, setDocAppointments] = useState<any[]>([]);
  const [videoRoom, setVideoRoom] = useState<string | null>(null);
  const [apptSearch, setApptSearch] = useState('');
  const [noteEdits, setNoteEdits] = useState<Record<number, string>>({});
  const [noteSavedId, setNoteSavedId] = useState<number | null>(null);
  const [pDesc, setPDesc] = useState('');
  const [pBio, setPBio] = useState('');
  const [pDuration, setPDuration] = useState(30);
  const [pOffDays, setPOffDays] = useState<string[]>([]);
  const [pOffInput, setPOffInput] = useState('');
  // Créneaux réservés par le médecin (« AAAA-MM-JJ HH:MM ») + date en cours d'édition
  const [pBlockedSlots, setPBlockedSlots] = useState<BlockedSlotEntry[]>([]);
  const [blockDate, setBlockDate] = useState('');
  const [blockFrom, setBlockFrom] = useState('');
  const [blockTo, setBlockTo] = useState('');
  // Patient à qui la plage est réservée (facultatif)
  const [blockPatient, setBlockPatient] = useState({ name: '', phone: '', email: '', note: '' });
  const [pSaving, setPSaving] = useState(false);
  const [pSaved, setPSaved] = useState(false);
  const [docProfile, setDocProfile] = useState<any>(null);

  // Consultation form state
  const [patientData, setPatientData] = useState({
    name: '',
    phone: '',
    email: '',
    stateDescription: '',
    progressNotes: '',
  });

  // Next appointment state
  const [showAppointmentPicker, setShowAppointmentPicker] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [nextAppointmentId, setNextAppointmentId] = useState<number | null>(null);

  const [consultations, setConsultations] = useState<any[]>([]);

  // Login handler
  const enterSpace = (user: any) => {
    setDoctorInfo(user);
    setIsAuthenticated(true);
    fetchConsultations();
    if (user?.id) {
      reviewsAPI.getForDoctor(user.id).then(setReviews).catch(() => setReviews([]));
    }
    loadDoctorProfile();
    loadDoctorAppointments();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await doctorAuthAPI.login(doctorCode, password);
      if (data.mustChangePassword) {
        // On garde le token (stocké par login) mais on bloque l'accès tant que le mdp n'est pas changé
        setDoctorInfo(data.user);
        setMustChange(true);
      } else {
        enterSpace(data.user);
      }
    } catch (err: any) {
      setError(err.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  // Vérif locale : le nouveau mdp ne doit pas ressembler à l'ancien
  const tooSimilar = (oldP: string, newP: string) => {
    if (!oldP) return false;
    const a = oldP.toLowerCase(), b = newP.toLowerCase();
    if (a === b) return true;
    if (a.includes(b) || b.includes(a)) return true;
    // distance de Levenshtein
    const m = a.length, n = b.length;
    const prev = Array.from({ length: n + 1 }, (_, i) => i);
    const cur = new Array(n + 1).fill(0);
    for (let i = 1; i <= m; i++) {
      cur[0] = i;
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      }
      for (let j = 0; j <= n; j++) prev[j] = cur[j];
    }
    const dist = prev[n];
    const maxLen = Math.max(m, n);
    return dist <= 3 || dist / maxLen < 0.34;
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');
    if (newPwd.length < 8 || !/[A-Za-z]/.test(newPwd) || !/[0-9]/.test(newPwd)) {
      setPwdError(isArabic
        ? 'يجب أن تحتوي كلمة المرور على 8 أحرف على الأقل مع حروف وأرقام.'
        : 'Le mot de passe doit contenir au moins 8 caractères avec lettres et chiffres.');
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError(isArabic ? 'كلمتا المرور غير متطابقتين.' : 'Les deux mots de passe ne correspondent pas.');
      return;
    }
    if (tooSimilar(password, newPwd)) {
      setPwdError(isArabic
        ? 'كلمة المرور الجديدة قريبة جدًا من القديمة. اختر كلمة مختلفة.'
        : 'Le nouveau mot de passe est trop proche de l\'ancien. Choisissez-en un différent.');
      return;
    }
    setPwdLoading(true);
    try {
      await doctorAuthAPI.changePassword(password, newPwd);
      setMustChange(false);
      setNewPwd(''); setConfirmPwd(''); setPassword('');
      enterSpace(doctorInfo);
    } catch (err: any) {
      setPwdError(err.message || 'Erreur lors du changement de mot de passe');
    } finally {
      setPwdLoading(false);
    }
  };

  const fetchConsultations = async () => {
    try {
      const data = await consultationsAPI.getMy();
      setConsultations(data);
    } catch (err) {
      console.error('Erreur chargement consultations:', err);
    }
  };

  const loadDoctorProfile = async () => {
    try {
      const p = await doctorAPI.getProfile();
      setPDesc(p.description || '');
      setPBio(p.bio || '');
      setPDuration(p.slotDuration || 30);
      setPOffDays(p.offDays || []);
      setPBlockedSlots(p.blockedSlots || []);

      // Les plages horaires et jours travaillés ne sont pas toujours renvoyés par le profil :
      // on complète depuis la fiche publique du médecin pour toujours avoir des créneaux.
      let merged: any = p;
      if (!p.availableSlots || p.availableSlots.length === 0) {
        try {
          const full = await doctorsAPI.getById(p.id);
          merged = {
            ...p,
            availableSlots: full.availableSlots || [],
            workingDays: full.workingDays || p.workingDays || [1, 2, 3, 4, 5],
          };
        } catch {
          // fiche publique indisponible : on garde le profil tel quel
        }
      }
      setDocProfile(merged);
    } catch (err) {
      console.error('Erreur chargement profil médecin:', err);
    }
  };

  const loadDoctorAppointments = async () => {
    try {
      const data = await doctorAPI.getAppointments();
      setDocAppointments(Array.isArray(data) ? data : []);
      const edits: Record<number, string> = {};
      (data || []).forEach((a: any) => { edits[a.id] = a.doctor_notes || ''; });
      setNoteEdits(edits);
    } catch (err) {
      console.error('Erreur chargement rendez-vous médecin:', err);
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setPSaving(true);
    setPSaved(false);
    try {
      await doctorAPI.updateProfile({
        description: pDesc,
        bio: pBio,
        slotDuration: pDuration,
        offDays: pOffDays,
        blockedSlots: pBlockedSlots,
      });
      setPSaved(true);
    } catch (err: any) {
      setError(err.message || 'Erreur');
    } finally {
      setPSaving(false);
    }
  };

  const addOffDay = () => {
    if (pOffInput && !pOffDays.includes(pOffInput)) {
      setPOffDays([...pOffDays, pOffInput].sort());
      setPOffInput('');
    }
  };
  const removeOffDay = (d: string) => setPOffDays(pOffDays.filter((x) => x !== d));

  // Tous les créneaux du jour choisi (y compris ceux déjà bloqués, pour pouvoir les rouvrir)
  const slotsOfBlockDate = blockDate
    ? slotsForDay(
        {
          availableSlots: docProfile?.availableSlots || [],
          slotDuration: pDuration,
          workingDays: docProfile?.workingDays || [1, 2, 3, 4, 5],
          offDays: pOffDays,
        },
        blockDate
      )
    : [];

  /**
   * Bloque tous les créneaux de la plage choisie (bornes incluses).
   * Si un patient est renseigné, la plage lui est nominativement réservée.
   */
  const blockRange = () => {
    if (!blockDate || !blockFrom || !blockTo) return;
    const [start, end] = blockFrom <= blockTo ? [blockFrom, blockTo] : [blockTo, blockFrom];
    const times = slotsOfBlockDate.filter((t) => t >= start && t <= end);
    if (times.length === 0) return;

    const patient = {
      ...(blockPatient.name.trim() ? { patientName: blockPatient.name.trim() } : {}),
      ...(blockPatient.phone.trim() ? { patientPhone: blockPatient.phone.trim() } : {}),
      ...(blockPatient.email.trim() ? { patientEmail: blockPatient.email.trim() } : {}),
      ...(blockPatient.note.trim() ? { note: blockPatient.note.trim() } : {}),
    };
    const hasPatient = Object.keys(patient).length > 0;

    const entries: BlockedSlotEntry[] = times.map((t) => {
      const slot = `${blockDate} ${t}`;
      return hasPatient ? { slot, ...patient } : slot;
    });

    setPBlockedSlots((prev) => {
      const newKeys = new Set(entries.map(blockedKey));
      // On remplace d'éventuels blocages existants sur ces mêmes créneaux
      const kept = prev.filter((e) => !newKeys.has(blockedKey(e)));
      return [...kept, ...entries].sort((a, b) => blockedKey(a).localeCompare(blockedKey(b)));
    });

    setBlockFrom('');
    setBlockTo('');
    setBlockPatient({ name: '', phone: '', email: '', note: '' });
  };

  /**
   * Regroupe les créneaux bloqués en plages continues, par jour.
   * Ex. 10:00, 10:15, 10:30 → « 10:00 – 10:45 » (fin = dernier créneau + durée).
   */
  const blockedRanges = (() => {
    const addMinutes = (t: string, m: number) => {
      const [h, min] = t.split(':').map(Number);
      const total = h * 60 + min + m;
      return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    };

    // Regroupement par jour, en conservant les informations du patient
    type Item = { time: string; info?: { patientName?: string; patientPhone?: string; patientEmail?: string; note?: string } };
    const byDate = new Map<string, Item[]>();
    for (const entry of pBlockedSlots) {
      const [d, t] = blockedKey(entry).split(' ');
      if (!d || !t) continue;
      const info = typeof entry === 'string' ? undefined : entry;
      byDate.set(d, [...(byDate.get(d) || []), { time: t, info }]);
    }

    const label = (i?: Item['info']) =>
      i ? [i.patientName, i.patientPhone, i.patientEmail, i.note].filter(Boolean).join(' | ') : '';

    const out: {
      date: string; from: string; toEnd: string; keys: string[];
      patientName?: string; patientPhone?: string; patientEmail?: string; note?: string;
    }[] = [];

    for (const [date, items] of [...byDate.entries()].sort()) {
      const sorted = [...items].sort((a, b) => a.time.localeCompare(b.time));
      let group: Item[] = [];
      const flush = () => {
        if (!group.length) return;
        const info = group[0].info;
        out.push({
          date,
          from: group[0].time,
          toEnd: addMinutes(group[group.length - 1].time, pDuration),
          keys: group.map((g) => `${date} ${g.time}`),
          patientName: info?.patientName,
          patientPhone: info?.patientPhone,
          patientEmail: info?.patientEmail,
          note: info?.note,
        });
        group = [];
      };
      for (const it of sorted) {
        const contiguous = group.length && addMinutes(group[group.length - 1].time, pDuration) === it.time;
        const samePatient = group.length && label(group[0].info) === label(it.info);
        if (group.length && (!contiguous || !samePatient)) flush();
        group.push(it);
      }
      flush();
    }
    return out;
  })();

  const saveNote = async (id: number) => {
    try {
      await doctorAPI.saveNotes(id, noteEdits[id] || '');
      setNoteSavedId(id);
      setTimeout(() => setNoteSavedId((cur) => (cur === id ? null : cur)), 2000);
    } catch (err: any) {
      window.alert(err.message || 'Erreur');
    }
  };

  const filteredAppointments = docAppointments.filter((a) => {
    const q = apptSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      (a.patient_name || '').toLowerCase().includes(q) ||
      (a.patient_phone || '').toLowerCase().includes(q) ||
      (a.patient_email || '').toLowerCase().includes(q)
    );
  });

  // Fetch doctor slots for next appointment
  useEffect(() => {
    if (isAuthenticated && doctorInfo && selectedDate) {
      const fetchSlots = async () => {
        try {
          const doctor = await doctorsAPI.getById(doctorInfo.id);
          // Mêmes créneaux que ceux vus par le patient (durée de consultation appliquée)
          setAvailableSlots(slotsForDay(doctor, selectedDate));
        } catch (err) {
          console.error('Erreur slots:', err);
        }
      };
      fetchSlots();
    }
  }, [isAuthenticated, doctorInfo, selectedDate]);

  const handleConsultationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await consultationsAPI.create({
        patientName: patientData.name,
        patientPhone: patientData.phone,
        patientEmail: patientData.email,
        stateDescription: patientData.stateDescription,
        progressNotes: patientData.progressNotes,
        nextAppointmentId: nextAppointmentId || undefined,
      });

      alert(isArabic ? 'تم حفظ بيانات المريض بنجاح' : 'Données du patient enregistrées avec succès');
      
      // Reset form
      setPatientData({
        name: '',
        phone: '',
        email: '',
        stateDescription: '',
        progressNotes: '',
      });
      setNextAppointmentId(null);
      setSelectedDate('');
      setSelectedSlot('');
      setShowAppointmentPicker(false);
      fetchConsultations();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBookNextAppointment = async () => {
    if (!selectedDate || !selectedSlot) {
      alert(isArabic ? 'اختر التاريخ والوقت' : 'Sélectionnez une date et un créneau');
      return;
    }

    try {
      setLoading(true);
      const appData: AppointmentCreate = {
        doctorId: doctorInfo.id,
        patientName: patientData.name,
        patientEmail: patientData.email || 'rdv.suivi@chifak.dz', // Email par défaut pour suivi si vide
        patientPhone: patientData.phone,
        appointmentDate: selectedDate,
        appointmentTime: selectedSlot,
        reason: isArabic ? 'موعد متابعة' : 'Rendez-vous de suivi',
      };

      const newApp = await appointmentsAPI.create(appData);
      setNextAppointmentId(newApp.id);
      alert(isArabic ? 'تم حجز الموعد القادم بنجاح' : 'Prochain rendez-vous réservé avec succès');
      setShowAppointmentPicker(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Écran obligatoire : changer le mot de passe à la première connexion
  if (mustChange) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4" dir={isArabic ? 'rtl' : 'ltr'}>
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-5 sm:p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              {isArabic ? 'تغيير كلمة المرور' : 'Changez votre mot de passe'}
            </h2>
            <p className="text-gray-600 mt-2 text-sm">
              {isArabic
                ? 'لأول اتصال، يجب عليك تعيين كلمة مرور جديدة خاصة بك.'
                : 'Pour votre première connexion, choisissez un nouveau mot de passe personnel.'}
            </p>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {isArabic ? 'كلمة المرور الجديدة' : 'Nouveau mot de passe'}
              </label>
              <input
                type="password"
                required
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="••••••••"
              />
              <p className="text-xs text-gray-500 mt-1">
                {isArabic ? '8 أحرف على الأقل، حروف وأرقام، مختلفة عن القديمة.' : '8 caractères min., lettres + chiffres, différent de l\'ancien.'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {isArabic ? 'تأكيد كلمة المرور' : 'Confirmez le mot de passe'}
              </label>
              <input
                type="password"
                required
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="••••••••"
              />
            </div>

            {pwdError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
                {pwdError}
              </div>
            )}

            <button
              type="submit"
              disabled={pwdLoading}
              className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 transition transform active:scale-95 disabled:opacity-50"
            >
              {pwdLoading ? (isArabic ? 'جاري الحفظ...' : 'Enregistrement...') : (isArabic ? 'حفظ والمتابعة' : 'Enregistrer et continuer')}
            </button>
          </form>

          <button
            onClick={() => { setMustChange(false); doctorAuthAPI.logout(); setPassword(''); }}
            className="w-full mt-4 py-3 text-gray-500 font-medium hover:text-gray-700 transition"
          >
            {isArabic ? 'إلغاء' : 'Annuler'}
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4" dir={isArabic ? 'rtl' : 'ltr'}>
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-5 sm:p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <span className="text-3xl">🩺</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              {isArabic ? 'دخول الأطباء' : 'Espace Médecin'}
            </h2>
            <p className="text-gray-600 mt-2">
              {isArabic ? 'أدخل رمز الطبيب الخاص بك للوصول' : 'Saisissez votre code médecin pour accéder à votre espace'}
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {isArabic ? 'رمز الطبيب' : 'Code Médecin'}
              </label>
              <input
                type="text"
                required
                value={doctorCode}
                onChange={(e) => setDoctorCode(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="MED-XXX"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {isArabic ? 'كلمة المرور' : 'Mot de passe'}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:bg-blue-700 transition transform active:scale-95 disabled:opacity-50"
            >
              {loading ? (isArabic ? 'جاري التحميل...' : 'Chargement...') : (isArabic ? 'دخول' : 'Se connecter')}
            </button>
          </form>

          <button
            onClick={onBackToHome}
            className="w-full mt-4 py-3 text-gray-500 font-medium hover:text-gray-700 transition"
          >
            {isArabic ? 'العودة للرئيسية' : 'Retour à l\'accueil'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12" dir={isArabic ? 'rtl' : 'ltr'}>
      {/* Header Espace Médecin */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <button 
                onClick={onBackToHome}
                className="p-2 hover:bg-gray-100 rounded-full transition"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isArabic ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"} />
                </svg>
              </button>
              <h1 className="text-xl font-bold text-gray-900">
                {isArabic ? `د. ${doctorInfo.name}` : `Dr. ${doctorInfo.name}`}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { doctorAuthAPI.logout(); setIsAuthenticated(false); }}
                className="text-sm font-medium text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition"
              >
                {isArabic ? 'خروج' : 'Déconnexion'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {/* Onglets */}
        <div className="flex bg-white rounded-xl p-1 shadow-sm mb-8">
          <button
            onClick={() => setActiveTab('appointments')}
            className={`flex-1 py-3 px-1 text-xs sm:text-sm font-bold rounded-lg transition ${
              activeTab === 'appointments' ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {isArabic ? 'المواعيد' : 'Rendez-vous'}
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-3 px-1 text-xs sm:text-sm font-bold rounded-lg transition ${
              activeTab === 'profile' ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {isArabic ? 'ملفي' : 'Mon profil'}
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={`flex-1 py-3 px-1 text-xs sm:text-sm font-bold rounded-lg transition ${
              activeTab === 'reviews' ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {isArabic ? `التقييمات (${reviews.length})` : `Avis (${reviews.length})`}
          </button>
        </div>

        {activeTab === 'appointments' ? (
          /* ── Rendez-vous : coordonnées patients + remarques ── */
          <div className="space-y-4">
            <input
              type="text"
              value={apptSearch}
              onChange={(e) => setApptSearch(e.target.value)}
              placeholder={isArabic ? 'ابحث عن مريض (اسم، هاتف، بريد)…' : 'Rechercher un patient (nom, téléphone, email)…'}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {docAppointments.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 sm:p-12 text-center shadow-sm border border-gray-100">
                <span className="text-5xl block mb-4">📅</span>
                <p className="text-gray-500 font-medium">{isArabic ? 'لا مواعيد محجوزة' : 'Aucun rendez-vous réservé'}</p>
              </div>
            ) : filteredAppointments.length === 0 ? (
              <div className="bg-white rounded-2xl p-5 sm:p-8 text-center shadow-sm border border-gray-100">
                <p className="text-gray-500 font-medium">{isArabic ? 'لا يوجد مريض مطابق' : 'Aucun patient trouvé'}</p>
              </div>
            ) : (
              filteredAppointments.map((a) => (
                <div key={a.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-gray-900">{a.patient_name}</div>
                      <div className="text-sm text-gray-500 mt-1 space-y-0.5">
                        <div>📞 {a.patient_phone}</div>
                        <div>✉️ {a.patient_email}</div>
                        {a.reason && <div>📝 {a.reason}</div>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-blue-700">{a.appointment_date}</div>
                      <div className="text-sm text-gray-500">{a.appointment_time}</div>
                      <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${a.status === 'cancelled' ? 'bg-red-50 text-red-600' : a.status === 'completed' ? 'bg-gray-100 text-gray-600' : 'bg-green-50 text-green-700'}`}>
                        {a.status === 'cancelled' ? (isArabic ? 'ملغى' : 'Annulé') : a.status === 'completed' ? (isArabic ? 'منتهٍ' : 'Terminé') : (isArabic ? 'مؤكد' : 'Confirmé')}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    {a.status !== 'cancelled' && (
                      <button
                        type="button"
                        onClick={() => setVideoRoom(`chifak-rdv-${a.id}`)}
                        className="mb-3 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition inline-flex items-center gap-1.5"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>
                        {isArabic ? 'انضم للفيديو' : 'Rejoindre la visio'}
                      </button>
                    )}
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      {isArabic ? 'ملاحظاتي (للزيارة القادمة)' : 'Mes remarques (pour la prochaine visite)'}
                    </label>
                    <textarea
                      value={noteEdits[a.id] || ''}
                      onChange={(e) => setNoteEdits({ ...noteEdits, [a.id]: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder={isArabic ? 'اكتب ملاحظاتك…' : 'Notez vos observations…'}
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <button type="button" onClick={() => saveNote(a.id)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition">
                        {isArabic ? 'حفظ' : 'Enregistrer'}
                      </button>
                      {noteSavedId === a.id && <span className="text-green-600 text-sm font-medium">✓ {isArabic ? 'تم الحفظ' : 'Enregistré'}</span>}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : activeTab === 'profile' ? (
          /* ── Mon profil ── */
          <form onSubmit={handleProfileSave} className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-bold text-gray-900 mb-4">{isArabic ? 'المعلومات (غير قابلة للتعديل)' : 'Coordonnées (non modifiables)'}</h3>
              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                {[
                  { l: isArabic ? 'الاسم' : 'Nom', v: docProfile?.name },
                  { l: isArabic ? 'التخصص' : 'Spécialité', v: docProfile?.specialty },
                  { l: isArabic ? 'الهاتف' : 'Téléphone', v: docProfile?.phone },
                  { l: 'Email', v: docProfile?.email },
                  { l: isArabic ? 'العنوان' : 'Adresse', v: `${docProfile?.address || ''}${docProfile?.city ? ', ' + docProfile.city : ''}` },
                ].map((f, i) => (
                  <div key={i}>
                    <div className="text-xs text-gray-400 mb-1">{f.l}</div>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-600">{f.v || '—'}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{isArabic ? 'وصف العلاجات المقترحة' : 'Descriptif des soins proposés'}</label>
                <textarea value={pDesc} onChange={(e) => setPDesc(e.target.value)} rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={isArabic ? 'مثال: استشارات عامة، متابعة…' : 'Ex : consultations générales, suivi, vaccinations…'} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{isArabic ? 'مساري المهني' : 'Mon parcours'}</label>
                <textarea value={pBio} onChange={(e) => setPBio(e.target.value)} rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={isArabic ? 'الدراسات، الخبرة، التخصصات…' : 'Études, expérience, spécialisations…'} />
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{isArabic ? 'مدة الموعد (دقائق)' : "Durée d'un créneau (minutes)"}</label>
                <select value={pDuration} onChange={(e) => setPDuration(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  {[15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{isArabic ? 'أيام عدم التوفر' : "Jours d'indisponibilité"}</label>
                <div className="flex gap-2">
                  <input type="date" min={new Date().toISOString().split('T')[0]} value={pOffInput} onChange={(e) => setPOffInput(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                  <button type="button" onClick={addOffDay} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">
                    {isArabic ? 'إضافة' : 'Ajouter'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {pOffDays.length === 0 && <span className="text-sm text-gray-400">{isArabic ? 'لا شيء' : 'Aucun'}</span>}
                  {pOffDays.map((d) => (
                    <span key={d} className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 text-sm px-3 py-1 rounded-full">
                      {d}
                      <button type="button" onClick={() => removeOffDay(d)} className="hover:text-red-900" aria-label="retirer">×</button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Réserver des créneaux précis (patients habitués, urgences…) ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-6">
              <h3 className="font-bold text-gray-900 mb-1">
                {isArabic ? 'حجز فترة زمنية' : 'Bloquer une plage horaire'}
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                {isArabic
                  ? 'اختر يومًا وفترة (مثلاً من 10:00 إلى 12:00). هذه الفترة فقط تُحجز لك، وليس اليوم كله.'
                  : "Choisissez un jour et une plage (ex. de 10:00 à 12:00). Seule cette plage vous est réservée, pas la journée entière."}
              </p>

              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{isArabic ? 'اليوم' : 'Jour'}</label>
                  <input
                    type="date"
                    value={blockDate}
                    min={todayIso()}
                    max={maxBookingIso()}
                    onChange={(e) => setBlockDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{isArabic ? 'من' : 'De'}</label>
                  <select
                    value={blockFrom}
                    onChange={(e) => setBlockFrom(e.target.value)}
                    disabled={slotsOfBlockDate.length === 0}
                    className="px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                  >
                    <option value="">--:--</option>
                    {slotsOfBlockDate.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{isArabic ? 'إلى' : 'À'}</label>
                  <select
                    value={blockTo}
                    onChange={(e) => setBlockTo(e.target.value)}
                    disabled={!blockFrom}
                    className="px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                  >
                    <option value="">--:--</option>
                    {slotsOfBlockDate.filter((t) => !blockFrom || t >= blockFrom).map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Réserver la plage à un patient précis (facultatif) */}
              <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-sm font-medium text-gray-700 mb-1">
                  {isArabic ? 'محجوز لمريض (اختياري)' : 'Réservé à un patient (facultatif)'}
                </p>
                <p className="text-xs text-gray-500 mb-3">
                  {isArabic
                    ? 'إذا كانت الفترة مخصّصة لمريض معتاد، أدخل معلوماته للتذكير.'
                    : "Si la plage est réservée à un patient habitué, renseignez ses informations pour vous en souvenir."}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={blockPatient.name}
                    onChange={(e) => setBlockPatient({ ...blockPatient, name: e.target.value })}
                    placeholder={isArabic ? 'الاسم واللقب' : 'Nom et prénom'}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <input
                    type="tel"
                    value={blockPatient.phone}
                    onChange={(e) => setBlockPatient({ ...blockPatient, phone: e.target.value })}
                    placeholder={isArabic ? 'الهاتف' : 'Téléphone'}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <input
                    type="email"
                    value={blockPatient.email}
                    onChange={(e) => setBlockPatient({ ...blockPatient, email: e.target.value })}
                    placeholder={isArabic ? 'البريد الإلكتروني' : 'Email'}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <input
                    type="text"
                    value={blockPatient.note}
                    onChange={(e) => setBlockPatient({ ...blockPatient, note: e.target.value })}
                    placeholder={isArabic ? 'ملاحظة (سبب الزيارة…)' : 'Note (motif…)'}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={blockRange}
                  disabled={!blockDate || !blockFrom || !blockTo}
                  className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:bg-gray-300 transition"
                >
                  {isArabic ? 'حجز الفترة' : 'Bloquer la plage'}
                </button>
              </div>
              {blockDate && slotsOfBlockDate.length === 0 && (
                <p className="text-sm text-gray-400 mt-2">
                  {isArabic ? 'لا تعمل في هذا اليوم.' : 'Vous ne consultez pas ce jour-là.'}
                </p>
              )}

              {/* Aperçu du jour sélectionné : ce que verra le patient */}
              {blockDate && slotsOfBlockDate.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-gray-500 mb-2">
                    {isArabic ? 'معاينة اليوم (الأحمر = محجوز لك)' : 'Aperçu de la journée (rouge = réservé pour vous)'}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {slotsOfBlockDate.map((t) => {
                      const isBlocked = pBlockedSlots.includes(`${blockDate} ${t}`);
                      return (
                        <span
                          key={t}
                          className={`px-2 py-1 rounded text-xs font-medium border ${
                            isBlocked
                              ? 'bg-red-50 border-red-200 text-red-600 line-through'
                              : 'bg-gray-50 border-gray-200 text-gray-600'
                          }`}
                        >
                          {t}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Plages bloquées, regroupées par jour */}
              {blockedRanges.length > 0 && (
                <div className="mt-5 pt-4 border-t border-gray-100">
                  <p className="text-sm font-medium text-gray-600 mb-2">
                    {isArabic ? 'الفترات المحجوزة' : 'Plages réservées'}
                  </p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {blockedRanges.map((r) => (
                      <div
                        key={`${r.date}-${r.from}`}
                        className="flex items-start justify-between gap-3 bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg"
                      >
                        <div className="min-w-0">
                          <p className="font-medium">
                            {r.date} · {r.from} – {r.toEnd}
                          </p>
                          {r.patientName || r.patientPhone || r.patientEmail || r.note ? (
                            <p className="text-xs text-red-600/90 mt-0.5 break-words">
                              {[r.patientName, r.patientPhone, r.patientEmail, r.note].filter(Boolean).join(' · ')}
                            </p>
                          ) : (
                            <p className="text-xs text-red-600/60 mt-0.5">
                              {isArabic ? 'محجوز لك' : 'Réservé pour vous'}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setPBlockedSlots((prev) => prev.filter((e) => !r.keys.includes(blockedKey(e))))
                          }
                          className="hover:text-red-900 font-medium flex-shrink-0"
                          aria-label={isArabic ? 'إلغاء' : 'Débloquer'}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {pSaved && <p className="text-green-600 text-sm font-medium">✓ {isArabic ? 'تم حفظ التغييرات' : 'Modifications enregistrées'}</p>}
            <button type="submit" disabled={pSaving} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold shadow hover:bg-blue-700 disabled:opacity-50 transition">
              {pSaving ? (isArabic ? 'جاري الحفظ…' : 'Enregistrement…') : (isArabic ? 'حفظ' : 'Enregistrer')}
            </button>
          </form>
        ) : activeTab === 'consultation' ? (
          <form onSubmit={handleConsultationSubmit} className="space-y-8">
            {/* Section Patient */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-blue-50 px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-bold text-blue-900">
                  {isArabic ? 'بيانات المريض' : 'Coordonnées du Patient'}
                </h3>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {isArabic ? 'اسم المريض *' : 'Nom du patient *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={patientData.name}
                    onChange={(e) => setPatientData({ ...patientData, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder={isArabic ? 'محمد علي' : 'Mohamed Ali'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {isArabic ? 'رقم الهاتف *' : 'Téléphone *'}
                  </label>
                  <input
                    type="tel"
                    required
                    value={patientData.phone}
                    onChange={(e) => setPatientData({ ...patientData, phone: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="0XXXXXXXXX"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {isArabic ? 'البريد الإلكتروني (اختياري)' : 'Email (optionnel)'}
                  </label>
                  <input
                    type="email"
                    value={patientData.email}
                    onChange={(e) => setPatientData({ ...patientData, email: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="patient@email.dz"
                  />
                </div>
              </div>
            </div>

            {/* Section État / Avancement */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-emerald-50 px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-bold text-emerald-900">
                  {isArabic ? 'الحالة الصحية والمتابعة' : 'État de santé et Suivi'}
                </h3>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {isArabic ? 'وصف حالة المريض' : 'Description de l\'état'}
                  </label>
                  <textarea
                    rows={3}
                    value={patientData.stateDescription}
                    onChange={(e) => setPatientData({ ...patientData, stateDescription: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                    placeholder={isArabic ? 'اكتب الأعراض الحالية...' : 'Décrivez les symptômes actuels...'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {isArabic ? 'ملاحظات التقدم / العلاج' : 'Progrès / Traitement'}
                  </label>
                  <textarea
                    rows={3}
                    value={patientData.progressNotes}
                    onChange={(e) => setPatientData({ ...patientData, progressNotes: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                    placeholder={isArabic ? 'التطور الملاحظ أو العلاج الموصوف...' : 'Évolution constatée ou traitement prescrit...'}
                  />
                </div>
              </div>
            </div>

            {/* Prochain Rendez-vous */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-purple-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-bold text-purple-900">
                  {isArabic ? 'الموعد القادم' : 'Prochain Rendez-vous'}
                </h3>
                {nextAppointmentId ? (
                  <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-1 rounded-full uppercase">
                    {isArabic ? 'تم الحجز' : 'Réservé'}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAppointmentPicker(!showAppointmentPicker)}
                    className="text-sm font-bold text-purple-600 hover:bg-purple-100 px-3 py-1 rounded-lg transition"
                  >
                    {showAppointmentPicker ? (isArabic ? 'إلغاء' : 'Annuler') : (isArabic ? 'تحديد موعد' : 'Planifier')}
                  </button>
                )}
              </div>
              
              <div className="p-6">
                {nextAppointmentId ? (
                  <div className="flex items-center gap-3 p-4 bg-purple-50 border border-purple-100 rounded-xl text-purple-900">
                    <span className="text-2xl">📅</span>
                    <div>
                      <p className="font-bold">{selectedDate}</p>
                      <p className="text-sm">{selectedSlot}</p>
                    </div>
                  </div>
                ) : showAppointmentPicker ? (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {isArabic ? 'اختر التاريخ' : 'Choisir une date'}
                      </label>
                      <input
                        type="date"
                        min={new Date().toISOString().split('T')[0]}
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </div>
                    {selectedDate && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {isArabic ? 'الخانات المتاحة' : 'Créneaux disponibles'}
                        </label>
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                          {availableSlots.map(slot => (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => setSelectedSlot(slot)}
                              className={`py-2 text-sm font-bold rounded-lg border transition ${
                                selectedSlot === slot 
                                  ? 'bg-purple-600 text-white border-purple-600 shadow-md' 
                                  : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
                              }`}
                            >
                              {slot}
                            </button>
                          ))}
                        </div>
                        
                        <button
                          type="button"
                          onClick={handleBookNextAppointment}
                          disabled={!selectedSlot || loading}
                          className="w-full mt-6 py-4 bg-purple-600 text-white rounded-xl font-bold shadow-lg hover:bg-purple-700 transition disabled:opacity-50"
                        >
                          {isArabic ? 'تأكيد حجز الموعد' : 'Confirmer la réservation'}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 italic text-center py-4">
                    {isArabic ? 'لا يوجد موعد قادم محدد بعد' : 'Aucun prochain rendez-vous planifié pour le moment'}
                  </p>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !patientData.name}
              className="w-full py-5 bg-blue-600 text-white rounded-2xl font-bold text-lg shadow-xl hover:bg-blue-700 transition transform active:scale-95 disabled:opacity-50"
            >
              {loading ? (isArabic ? 'جاري الحفظ...' : 'Enregistrement...') : (isArabic ? 'حفظ ملف المتابعة' : 'Enregistrer la fiche de suivi')}
            </button>
          </form>
        ) : activeTab === 'reviews' ? (
          /* Avis des patients */
          <div className="space-y-4">
            {reviews.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 sm:p-12 text-center shadow-sm border border-gray-100">
                <span className="text-5xl block mb-4">⭐</span>
                <p className="text-gray-500 font-medium">
                  {isArabic ? 'لا توجد تقييمات بعد' : 'Aucun avis pour le moment'}
                </p>
              </div>
            ) : (
              reviews.map((r) => (
                <div key={r.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-gray-900">{r.patient_name || (isArabic ? 'مريض' : 'Patient')}</span>
                    <span className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <svg key={n} className={`w-4 h-4 ${n <= r.rating ? 'text-amber-400' : 'text-gray-200'}`} viewBox="0 0 24 24" fill="currentColor">
                          <path d="m12 3 2.6 5.5 6 .9-4.3 4.2 1 6-5.3-2.8L6.7 19.6l1-6L3.4 9.4l6-.9L12 3Z" />
                        </svg>
                      ))}
                    </span>
                  </div>
                  {r.comment && <p className="text-gray-700 text-sm">{r.comment}</p>}
                  <p className="text-xs text-gray-400 mt-2">{new Date(r.created_at).toLocaleDateString(isArabic ? 'ar-DZ' : 'fr-FR')}</p>
                </div>
              ))
            )}
          </div>
        ) : (
          /* Liste historique */
          <div className="space-y-4">
            {consultations.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 sm:p-12 text-center shadow-sm border border-gray-100">
                <span className="text-5xl block mb-4">📋</span>
                <p className="text-gray-500 font-medium">
                  {isArabic ? 'لا توجد معاينات سابقة بعد' : 'Aucune consultation enregistrée pour le moment'}
                </p>
              </div>
            ) : (
              consultations.map((c) => (
                <div key={c.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:border-blue-200 transition">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-bold text-gray-900 text-lg">{c.patient_name}</h4>
                      <p className="text-gray-500 text-sm">{c.patient_phone}</p>
                    </div>
                    <span className="text-xs font-medium text-gray-400">
                      {new Date(c.created_at).toLocaleDateString(language)}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="p-3 bg-gray-50 rounded-xl">
                      <p className="text-xs font-bold text-gray-400 uppercase mb-1">
                        {isArabic ? 'الحالة' : 'État'}
                      </p>
                      <p className="text-sm text-gray-700">{c.state_description || '-'}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-xl">
                      <p className="text-xs font-bold text-gray-400 uppercase mb-1">
                        {isArabic ? 'التقدم' : 'Progrès'}
                      </p>
                      <p className="text-sm text-gray-700">{c.progress_notes || '-'}</p>
                    </div>
                  </div>

                  {c.next_appointment_id && (
                    <div className="mt-4 flex items-center gap-2 text-purple-600 text-sm font-bold bg-purple-50 p-2 rounded-lg">
                      <span>📅 {isArabic ? 'الموعد القادم:' : 'Prochain RDV :'}</span>
                      <span>{c.next_date} à {c.next_time}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {videoRoom && (
        <VideoCall
          room={videoRoom}
          displayName={doctorInfo?.name}
          isArabic={isArabic}
          onClose={() => setVideoRoom(null)}
        />
      )}
    </div>
  );
}
