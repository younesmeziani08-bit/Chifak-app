import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { employeesAPI, EmployeeFeedback } from '../services/api';

/**
 * Avis et suggestions déposés par les médecins via le QR code des employés.
 * Accessible à l'administration seule : un employé ne doit pouvoir ni lire ni
 * corriger ce qui est dit de lui, sans quoi les retours perdent toute valeur.
 */
export default function EmployeeFeedbackPanel() {
  const { language } = useLanguage();
  const isArabic = language === 'ar';

  const [items, setItems] = useState<EmployeeFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  /** N'afficher que les retours porteurs d'une proposition d'amélioration. */
  const [onlySuggestions, setOnlySuggestions] = useState(false);

  useEffect(() => {
    let alive = true;
    employeesAPI.feedback()
      .then((rows) => { if (alive) setItems(rows); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Erreur'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const employees = useMemo(
    () => [...new Set(items.map((i) => i.employee_name || i.staff_code || '—'))].sort(),
    [items]
  );

  const filtered = items.filter((i) => {
    const nom = i.employee_name || i.staff_code || '—';
    if (employeeFilter && nom !== employeeFilter) return false;
    if (onlySuggestions && !i.suggestion) return false;
    return true;
  });

  const moyenne = filtered.length
    ? (filtered.reduce((s, i) => s + i.rating, 0) / filtered.length).toFixed(1)
    : null;

  if (loading) return <p className="text-gray-500">{isArabic ? 'جارٍ التحميل…' : 'Chargement…'}</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <select
          value={employeeFilter}
          onChange={(e) => setEmployeeFilter(e.target.value)}
          className="px-4 py-2.5 border border-gray-300 rounded-lg bg-white"
        >
          <option value="">{isArabic ? 'كل الموظفين' : 'Tous les employés'}</option>
          {employees.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>

        <button
          type="button"
          onClick={() => setOnlySuggestions((v) => !v)}
          aria-pressed={onlySuggestions}
          className={`px-4 py-2.5 rounded-lg border text-sm font-medium transition ${
            onlySuggestions ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300 text-gray-700'
          }`}
        >
          {isArabic ? 'اقتراحات فقط' : 'Suggestions seulement'}
        </button>

        <span className="text-sm text-gray-500">
          {filtered.length} {isArabic ? 'رأي' : filtered.length > 1 ? 'avis' : 'avis'}
          {moyenne && <span className="text-amber-600"> · {moyenne} ★</span>}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-10 text-center">
          <p className="text-gray-500">
            {isArabic
              ? 'لا توجد آراء بعد. شارك رمز QR الخاص بالموظف مع الأطباء.'
              : 'Aucun avis pour le moment. Partagez le QR code d’un employé avec les médecins qu’il accompagne.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((f) => (
            <li key={f.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">
                    {f.employee_name || (isArabic ? 'حساب محذوف' : 'Compte supprimé')}
                    {f.staff_code && <span className="ms-2 text-xs font-mono text-gray-400">{f.staff_code}</span>}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {isArabic ? 'من' : 'Par'} {f.doctor_name || (isArabic ? 'طبيب' : 'un praticien')}
                    {f.doctor_code && ` · ${f.doctor_code}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-amber-500" aria-label={`${f.rating} sur 5`}>
                    {'★'.repeat(f.rating)}<span className="text-gray-200">{'★'.repeat(5 - f.rating)}</span>
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(f.created_at).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              </div>

              {f.comment && <p className="text-sm text-gray-700 leading-relaxed">{f.comment}</p>}

              {f.suggestion && (
                <div className="mt-3 bg-blue-50 border border-blue-100 rounded-lg p-3">
                  <p className="text-xs font-semibold text-blue-800 mb-1">
                    {isArabic ? 'اقتراح تحسين' : 'Proposition d’amélioration'}
                  </p>
                  <p className="text-sm text-blue-900 leading-relaxed">{f.suggestion}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
