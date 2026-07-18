import { useState } from 'react';
import { useDoctors } from '../../contexts/DoctorsContext';
import { useLanguage } from '../../contexts/LanguageContext';
import LocationSelector from '../LocationSelector';

export default function AddDoctorForm() {
  const { addDoctor } = useDoctors();
  const { t, language } = useLanguage();
  const [formData, setFormData] = useState({
    name: '',
    specialty: '',
    address: '',
    city: '',
    phone: '',
    email: '',
    doctorCode: '',
    image: '👨‍⚕️',
    slotDuration: '30',
    workingDays: [1, 2, 3, 4, 5] as number[],
    latitude: '',
    longitude: '',
    mapsUrl: ''
  });
  const [success, setSuccess] = useState(false);

  const isArabic = language === 'ar';

  const specialties = [
    'specialty.generalDoctor',
    'specialty.dentist',
    'specialty.ophthalmologist',
    'specialty.dermatologist',
    'specialty.cardiologist',
    'specialty.pediatrician',
    'specialty.gynecologist',
    'specialty.ent',
    'specialty.physiotherapist',
    'specialty.psychologist',
    'specialty.osteopath',
    'specialty.midwife',
  ];

  const avatars = ['👨‍⚕️', '👩‍⚕️', '🧑‍⚕️'];

  const buildSlots = (durationMinutes: number): string[] => {
    const ranges = [
      { start: '08:00', end: '12:00' },
      { start: '14:00', end: '18:00' },
    ];

    const toMinutes = (hhmm: string) => {
      const [h, m] = hhmm.split(':').map(Number);
      return h * 60 + m;
    };

    const toHHMM = (minutes: number) => {
      const h = String(Math.floor(minutes / 60)).padStart(2, '0');
      const m = String(minutes % 60).padStart(2, '0');
      return `${h}:${m}`;
    };

    const slots: string[] = [];
    for (const range of ranges) {
      let current = toMinutes(range.start);
      const end = toMinutes(range.end);
      while (current + durationMinutes <= end) {
        slots.push(toHHMM(current));
        current += durationMinutes;
      }
    }
    return slots;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.workingDays.length === 0) {
      alert(isArabic ? 'اختر يوم عمل واحد على الأقل' : 'Sélectionnez au moins un jour de travail');
      return;
    }

    try {
      const slotDuration = Number(formData.slotDuration) || 30;
      const generatedSlots = buildSlots(slotDuration);

      const newDoctor = {
        name: formData.name,
        specialty: t(formData.specialty),
        address: formData.address,
        city: formData.city,
        phone: formData.phone,
        email: formData.email,
        doctorCode: formData.doctorCode,
        image: formData.image,
        latitude: formData.latitude ? parseFloat(formData.latitude) : undefined,
        longitude: formData.longitude ? parseFloat(formData.longitude) : undefined,
        mapsUrl: formData.mapsUrl || undefined,
        slotDuration,
        workingDays: formData.workingDays,
        availableSlots: generatedSlots,
        nextAvailable: isArabic ? 'متاح الآن' : 'Disponible maintenant'
      };

      await addDoctor(newDoctor);
      
      // Reset form
      setFormData({
        name: '',
        specialty: '',
        address: '',
        city: '',
        phone: '',
        email: '',
        doctorCode: '',
        image: '👨‍⚕️',
        slotDuration: '30',
        workingDays: [1, 2, 3, 4, 5],
        latitude: '',
        longitude: '',
        mapsUrl: ''
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      alert(isArabic ? 'خطأ في إضافة الطبيب' : 'Erreur lors de l\'ajout du médecin');
      console.error(error);
    }
  };

  return (
    <div>
      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {isArabic ? 'تمت إضافة الطبيب بنجاح!' : 'Médecin ajouté avec succès !'}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {(() => {
          const weekDays = [
            { value: 1, fr: 'Lundi', ar: 'الاثنين' },
            { value: 2, fr: 'Mardi', ar: 'الثلاثاء' },
            { value: 3, fr: 'Mercredi', ar: 'الأربعاء' },
            { value: 4, fr: 'Jeudi', ar: 'الخميس' },
            { value: 5, fr: 'Vendredi', ar: 'الجمعة' },
            { value: 6, fr: 'Samedi', ar: 'السبت' },
            { value: 0, fr: 'Dimanche', ar: 'الأحد' },
          ];

          const toggleWorkingDay = (day: number) => {
            const exists = formData.workingDays.includes(day);
            const next = exists
              ? formData.workingDays.filter((d) => d !== day)
              : [...formData.workingDays, day].sort((a, b) => a - b);
            setFormData({ ...formData, workingDays: next });
          };

          return (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {isArabic ? 'أيام العمل *' : 'Jours de travail *'}
              </label>
              <div className="flex flex-wrap gap-2">
                {weekDays.map((day) => {
                  const active = formData.workingDays.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleWorkingDay(day.value)}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium transition ${
                        active
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                      }`}
                    >
                      {isArabic ? day.ar : day.fr}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {isArabic
                  ? 'اختر الأيام التي يعمل فيها الطبيب. سيظهر الحجز فقط في هذه الأيام.'
                  : 'Choisissez les jours travaillés. Les créneaux seront réservables uniquement ces jours.'}
              </p>
            </div>
          );
        })()}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Nom complet */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {isArabic ? 'الاسم الكامل *' : 'Nom complet *'}
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={isArabic ? 'د. أحمد بن علي' : 'Dr. Ahmed Benali'}
            />
          </div>

          {/* Spécialité */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {isArabic ? 'التخصص *' : 'Spécialité *'}
            </label>
            <select
              required
              value={formData.specialty}
              onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">{isArabic ? 'اختر التخصص' : 'Sélectionnez une spécialité'}</option>
              {specialties.map((spec) => (
                <option key={spec} value={spec}>
                  {t(spec)}
                </option>
              ))}
            </select>
          </div>

          {/* Adresse */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {isArabic ? 'العنوان *' : 'Adresse *'}
            </label>
            <input
              type="text"
              required
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={isArabic ? '15 شارع ديدوش مراد' : '15 Rue Didouche Mourad'}
            />
          </div>

          {/* Localisation */}
          <div>
            <LocationSelector onLocationChange={(location) => setFormData({ ...formData, city: location })} />
          </div>

          {/* Téléphone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {isArabic ? 'الهاتف' : 'Téléphone'}
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={isArabic ? '0555 123 456' : '0555 123 456'}
            />
          </div>

          {/* Durée des créneaux */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {isArabic ? 'مدة الموعد (دقائق) *' : 'Durée des créneaux (minutes) *'}
            </label>
            <select
              required
              value={formData.slotDuration}
              onChange={(e) => setFormData({ ...formData, slotDuration: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {[10, 15, 20, 30, 45, 60].map((value) => (
                <option key={value} value={String(value)}>
                  {value} {isArabic ? 'دقيقة' : 'minutes'}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {isArabic
                ? 'سيتم إنشاء المواعيد تلقائيًا حسب هذه المدة'
                : 'Les créneaux seront générés automatiquement selon cette durée'}
            </p>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {isArabic ? 'البريد الإلكتروني' : 'Email'}
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="docteur@example.com"
            />
          </div>

          {/* Code Médecin (Spécial ID) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {isArabic ? 'رمز الطبيب (ID خاص) *' : 'Code Médecin (ID spécial) *'}
            </label>
            <input
              type="text"
              required
              value={formData.doctorCode}
              onChange={(e) => setFormData({ ...formData, doctorCode: e.target.value.toUpperCase() })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="MED-001"
            />
            <p className="text-xs text-gray-500 mt-1">
              {isArabic 
                ? 'هذا الرمز سيسمح للطبيب بالوصول إلى مساحته الخاصة' 
                : 'Ce code permettra au médecin d\'accéder à son espace privé'
              }
            </p>
          </div>
        </div>

        {/* Section Localisation Google Maps */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {isArabic ? '📍 موقع خرائط Google' : '📍 Localisation Google Maps'}
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            {isArabic 
              ? 'أضف رابط خرائط Google أو الإحداثيات (اختياري)' 
              : 'Ajoutez un lien Google Maps ou les coordonnées GPS (optionnel)'
            }
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* URL Google Maps */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {isArabic ? 'رابط خرائط Google' : 'URL Google Maps'}
              </label>
              <input
                type="url"
                value={formData.mapsUrl}
                onChange={(e) => setFormData({ ...formData, mapsUrl: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="https://maps.google.com/..."
              />
              <p className="text-xs text-gray-500 mt-1">
                {isArabic 
                  ? 'انسخ الرابط من خرائط Google (الخيار الموصى به)' 
                  : 'Copiez le lien depuis Google Maps (option recommandée)'
                }
              </p>
            </div>

            <div className="md:col-span-2 text-center text-sm text-gray-500">
              {isArabic ? 'أو' : 'OU'}
            </div>

            {/* Latitude */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {isArabic ? 'خط العرض (Latitude)' : 'Latitude'}
              </label>
              <input
                type="number"
                step="any"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="36.7372"
              />
            </div>

            {/* Longitude */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {isArabic ? 'خط الطول (Longitude)' : 'Longitude'}
              </label>
              <input
                type="number"
                step="any"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="3.0865"
              />
            </div>
          </div>

          {/* Guide rapide */}
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-900 mb-2">
              {isArabic ? '💡 كيفية الحصول على الموقع:' : '💡 Comment obtenir la localisation :'}
            </p>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>
                {isArabic 
                  ? 'افتح خرائط Google وابحث عن العنوان' 
                  : 'Ouvrez Google Maps et cherchez l\'adresse'
                }
              </li>
              <li>
                {isArabic 
                  ? 'انقر بزر الماوس الأيمن على الموقع' 
                  : 'Clic droit sur l\'emplacement'
                }
              </li>
              <li>
                {isArabic 
                  ? 'انسخ الإحداثيات أو انقر على "مشاركة" ← "نسخ الرابط"' 
                  : 'Copiez les coordonnées ou cliquez "Partager" → "Copier le lien"'
                }
              </li>
            </ol>
          </div>
        </div>

        {/* Avatar */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {isArabic ? 'الصورة الرمزية' : 'Avatar'}
          </label>
          <div className="flex space-x-4">
            {avatars.map((avatar) => (
              <button
                key={avatar}
                type="button"
                onClick={() => setFormData({ ...formData, image: avatar })}
                className={`text-4xl p-4 rounded-lg border-2 transition ${
                  formData.image === avatar
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                {avatar}
              </button>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => setFormData({
              name: '',
              specialty: '',
              address: '',
              city: '',
              phone: '',
              email: '',
              doctorCode: '',
              image: '👨‍⚕️',
              slotDuration: '30',
              workingDays: [1, 2, 3, 4, 5],
              latitude: '',
              longitude: '',
              mapsUrl: ''
            })}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition"
          >
            {isArabic ? 'إعادة تعيين' : 'Réinitialiser'}
          </button>
          <button
            type="submit"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition shadow-lg"
          >
            {isArabic ? 'إضافة الطبيب' : 'Ajouter le médecin'}
          </button>
        </div>
      </form>
    </div>
  );
}
