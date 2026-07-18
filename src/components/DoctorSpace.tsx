import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { doctorAuthAPI, consultationsAPI, doctorsAPI, appointmentsAPI, AppointmentCreate } from '../services/api';

export default function DoctorSpace({ onBackToHome }: { onBackToHome: () => void }) {
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [doctorCode, setDoctorCode] = useState('');
  const [doctorInfo, setDoctorInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'consultation' | 'history'>('consultation');

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
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await doctorAuthAPI.login(doctorCode);
      setDoctorInfo(data.user);
      setIsAuthenticated(true);
      fetchConsultations();
    } catch (err: any) {
      setError(err.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
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

  // Fetch doctor slots for next appointment
  useEffect(() => {
    if (isAuthenticated && doctorInfo && selectedDate) {
      const fetchSlots = async () => {
        try {
          const doctor = await doctorsAPI.getById(doctorInfo.id);
          setAvailableSlots(doctor.availableSlots);
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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4" dir={isArabic ? 'rtl' : 'ltr'}>
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
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
            onClick={() => setActiveTab('consultation')}
            className={`flex-1 py-3 text-sm font-bold rounded-lg transition ${
              activeTab === 'consultation' ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {isArabic ? 'سجل متابعة جديد' : 'Nouveau suivi'}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 text-sm font-bold rounded-lg transition ${
              activeTab === 'history' ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {isArabic ? 'تاريخ المعاينات' : 'Historique'}
          </button>
        </div>

        {activeTab === 'consultation' ? (
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
        ) : (
          /* Liste historique */
          <div className="space-y-4">
            {consultations.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
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
    </div>
  );
}
