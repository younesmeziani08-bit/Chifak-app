import { useState } from 'react';
import { useDoctors } from '../../contexts/DoctorsContext';
import { useLanguage } from '../../contexts/LanguageContext';

export default function DoctorsList() {
  const { doctors, deleteDoctor, updateDoctor } = useDoctors();
  const { language } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');

  const isArabic = language === 'ar';

  const handleResetPassword = async (id: number, name: string) => {
    const pwd = window.prompt(
      isArabic
        ? `كلمة مرور جديدة للطبيب ${name} (8 أحرف على الأقل، حروف وأرقام):`
        : `Nouveau mot de passe pour ${name} (8 caractères min., lettres + chiffres) :`
    );
    if (pwd === null) return; // annulé
    if (pwd.length < 8 || !/[A-Za-z]/.test(pwd) || !/[0-9]/.test(pwd)) {
      alert(isArabic
        ? 'كلمة المرور يجب أن تحتوي على 8 أحرف على الأقل مع حروف وأرقام.'
        : 'Le mot de passe doit contenir au moins 8 caractères avec lettres et chiffres.');
      return;
    }
    try {
      await updateDoctor(id, { password: pwd });
      alert(isArabic
        ? 'تم تعيين كلمة المرور. سيُطلب من الطبيب تغييرها عند أول اتصال.'
        : 'Mot de passe défini. Le médecin devra le changer à sa prochaine connexion.');
    } catch (error) {
      alert(isArabic ? 'خطأ أثناء تعيين كلمة المرور' : 'Erreur lors de la réinitialisation');
      console.error(error);
    }
  };

  const filteredDoctors = doctors.filter(doctor =>
    doctor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doctor.specialty.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doctor.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async (id: number, name: string) => {
    if (window.confirm(isArabic 
      ? `هل أنت متأكد من حذف ${name}؟` 
      : `Êtes-vous sûr de vouloir supprimer ${name} ?`
    )) {
      try {
        await deleteDoctor(id);
      } catch (error) {
        alert(isArabic ? 'خطأ في حذف الطبيب' : 'Erreur lors de la suppression');
        console.error(error);
      }
    }
  };

  return (
    <div>
      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder={isArabic ? 'البحث عن طبيب...' : 'Rechercher un médecin...'}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* ── Vue mobile : cartes (le tableau est illisible sur téléphone) ── */}
      <div className="md:hidden space-y-3">
        {filteredDoctors.length === 0 ? (
          <p className="text-center text-gray-500 py-10">
            {isArabic ? 'لم يتم العثور على أطباء' : 'Aucun médecin trouvé'}
          </p>
        ) : (
          filteredDoctors.map((doctor) => (
            <div key={doctor.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{doctor.name}</p>
                  <p className="text-sm text-blue-600 mt-0.5">{doctor.specialty}</p>
                  <p className="text-sm text-gray-500 mt-1 break-words">{doctor.city}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleResetPassword(doctor.id, doctor.name)}
                    title={isArabic ? 'إعادة تعيين كلمة المرور' : 'Réinitialiser le mot de passe'}
                    className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(doctor.id, doctor.name)}
                    title={isArabic ? 'حذف' : 'Supprimer'}
                    className="w-10 h-10 flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50 transition"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100 text-sm">
                <span className="font-mono font-semibold text-blue-600">{doctor.doctorCode || '-'}</span>
                <span className={doctor.hasPassword ? 'text-green-600' : 'text-gray-400'}>
                  {doctor.hasPassword
                    ? (isArabic ? '• كلمة مرور مُعيّنة' : '• Mot de passe défini')
                    : (isArabic ? '• بدون كلمة مرور' : '• Sans mot de passe')}
                </span>
                <span className="text-gray-500 ms-auto">
                  ★ {doctor.rating} ({doctor.reviewCount})
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Vue bureau : tableau ── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {isArabic ? 'الطبيب' : 'Médecin'}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {isArabic ? 'التخصص' : 'Spécialité'}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {isArabic ? 'الموقع' : 'Localisation'}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {isArabic ? 'الرمز' : 'Code'}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {isArabic ? 'التقييم' : 'Note'}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                {isArabic ? 'الإجراءات' : 'Actions'}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredDoctors.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  {isArabic ? 'لم يتم العثور على أطباء' : 'Aucun médecin trouvé'}
                </td>
              </tr>
            ) : (
              filteredDoctors.map((doctor) => (
                <tr key={doctor.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="text-3xl mr-3">{doctor.image}</div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{doctor.name}</div>
                        <div className="text-sm text-gray-500">{doctor.address}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {doctor.specialty}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {doctor.city}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-blue-600 font-bold">
                    <div className="flex items-center gap-2">
                      <span>{doctor.doctorCode || '-'}</span>
                      {doctor.hasPassword ? (
                        <span title={isArabic ? 'كلمة المرور مُعيّنة' : 'Mot de passe défini'} className="inline-flex items-center text-green-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </span>
                      ) : (
                        <span title={isArabic ? 'بدون كلمة مرور' : 'Aucun mot de passe'} className="inline-flex items-center text-gray-300">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2M6 21h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                          </svg>
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <svg className="w-4 h-4 text-yellow-400 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span className="text-sm font-medium text-gray-900">{doctor.rating}</span>
                      <span className="text-sm text-gray-500 ml-1">({doctor.reviewCount})</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => handleResetPassword(doctor.id, doctor.name)}
                        title={isArabic ? 'إعادة تعيين كلمة المرور' : 'Réinitialiser le mot de passe'}
                        className="text-gray-500 hover:text-blue-600 transition"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(doctor.id, doctor.name)}
                        title={isArabic ? 'حذف' : 'Supprimer'}
                        className="text-red-600 hover:text-red-900 transition"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="mt-6 text-sm text-gray-600">
        {isArabic 
          ? `إجمالي: ${filteredDoctors.length} طبيب`
          : `Total : ${filteredDoctors.length} médecin(s)`
        }
      </div>
    </div>
  );
}
