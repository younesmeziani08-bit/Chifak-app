import { useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { employeesAPI, Employee, EmployeeStats } from '../../services/api';

/**
 * Gestion du personnel : création, suppression, activité par période,
 * et QR code d'avis. Réservé à l'administration côté serveur également —
 * masquer l'onglet ne suffirait pas, les routes exigent le rôle admin.
 */

/** Le QR est produit par un service public : aucune dépendance à installer. */
function qrUrl(contenu: string, taille = 220) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${taille}x${taille}&data=${encodeURIComponent(contenu)}`;
}

/** Adresse ouverte par le médecin en scannant. */
function lienAvis(token: string) {
  return `${window.location.origin}/avis/${token}`;
}

export default function EmployeesPanel() {
  const { language } = useLanguage();
  const isArabic = language === 'ar';

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [form, setForm] = useState({ username: '', fullName: '', password: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  /** Employé dont on consulte l'activité, avec sa période. */
  const [statsFor, setStatsFor] = useState<Employee | null>(null);
  const [stats, setStats] = useState<EmployeeStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const moisDernier = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(moisDernier);
  const [to, setTo] = useState(aujourdhui);

  /** Employé dont on affiche le QR code. */
  const [qrFor, setQrFor] = useState<Employee | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setEmployees(await employeesAPI.getAll());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!statsFor) { setStats(null); return; }
    let alive = true;
    setStatsLoading(true);
    employeesAPI.stats(statsFor.id, from, to)
      .then((s) => { if (alive) setStats(s); })
      .catch(() => { if (alive) setStats(null); })
      .finally(() => { if (alive) setStatsLoading(false); });
    return () => { alive = false; };
  }, [statsFor, from, to]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    try {
      await employeesAPI.create({
        username: form.username.trim().toLowerCase(),
        fullName: form.fullName.trim() || undefined,
        password: form.password,
      });
      setForm({ username: '', fullName: '', password: '' });
      await load();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (emp: Employee) => {
    const nom = emp.full_name || emp.username;
    if (!window.confirm(isArabic
      ? `حذف حساب ${nom}؟ يبقى سجلّ نشاطه محفوظًا.`
      : `Supprimer le compte de ${nom} ?\n\nSon historique d’activité et les avis le concernant sont conservés.`
    )) return;
    try {
      await employeesAPI.remove(emp.id);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const employesSeuls = employees.filter((e) => e.role === 'employee');

  return (
    <div className="space-y-8">
      {/* ── Création d'un compte ── */}
      <form onSubmit={handleCreate} className="bg-gray-50 border border-gray-200 rounded-xl p-5">
        <h3 className="font-bold text-gray-900 mb-4">
          {isArabic ? 'إضافة موظف' : 'Ajouter un employé'}
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            placeholder={isArabic ? 'الاسم الكامل' : 'Nom et prénom'}
            className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <input
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            placeholder={isArabic ? 'اسم الدخول' : 'Identifiant de connexion'}
            required
            className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder={isArabic ? 'كلمة المرور' : 'Mot de passe'}
            required
            className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <button
            type="submit"
            disabled={creating}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {creating ? (isArabic ? 'جارٍ…' : 'Création…') : (isArabic ? 'إنشاء الحساب' : 'Créer le compte')}
          </button>
          <p className="text-xs text-gray-500">
            {isArabic
              ? 'يُمنح رقم تسلسلي تلقائيًا، ويُنشأ رمز QR للآراء.'
              : 'Le matricule et le QR code d’avis sont attribués automatiquement.'}
          </p>
        </div>
        {createError && <p className="text-sm text-red-600 mt-2">{createError}</p>}
      </form>

      {/* ── Liste ── */}
      {loading ? (
        <p className="text-gray-500">{isArabic ? 'جارٍ التحميل…' : 'Chargement…'}</p>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : employesSeuls.length === 0 ? (
        <p className="text-gray-500">{isArabic ? 'لا يوجد موظفون بعد.' : 'Aucun employé pour le moment.'}</p>
      ) : (
        <div className="space-y-3">
          {employesSeuls.map((emp) => (
            <div key={emp.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{emp.full_name || emp.username}</p>
                  <p className="text-sm text-gray-500">@{emp.username}</p>
                  <p className="text-xs font-mono text-blue-700 mt-1">{emp.staff_code || '—'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => { setStatsFor(emp); setQrFor(null); }}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                  >
                    {isArabic ? 'النشاط' : 'Activité'}
                  </button>
                  <button
                    onClick={() => { setQrFor(qrFor?.id === emp.id ? null : emp); setStatsFor(null); }}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                  >
                    {isArabic ? 'رمز QR' : 'QR code'}
                  </button>
                  <button
                    onClick={() => handleDelete(emp)}
                    className="px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition"
                  >
                    {isArabic ? 'حذف' : 'Supprimer'}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-sm">
                <span className="text-gray-600">
                  {isArabic ? 'تسجيلات' : 'Inscriptions'} : <strong className="text-gray-900">{emp.created_count}</strong>
                </span>
                <span className="text-gray-600">
                  {isArabic ? 'حذف' : 'Suppressions'} : <strong className="text-gray-900">{emp.deleted_count}</strong>
                </span>
                <span className="text-gray-600">
                  {isArabic ? 'آراء' : 'Avis'} : <strong className="text-gray-900">{emp.feedback_count}</strong>
                  {emp.avg_rating ? <span className="text-amber-600"> · {emp.avg_rating} ★</span> : null}
                </span>
              </div>

              {/* QR code de l'employé */}
              {qrFor?.id === emp.id && emp.feedback_token && (
                <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-start gap-5">
                  <img
                    src={qrUrl(lienAvis(emp.feedback_token))}
                    alt={isArabic ? 'رمز QR للآراء' : 'QR code d’avis'}
                    width={220}
                    height={220}
                    className="rounded-lg border border-gray-200 bg-white"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {isArabic
                        ? 'يمسح الطبيب هذا الرمز ليقيّم مرافقة الموظف ويقترح تحسينات. النتائج مرئية للإدارة فقط.'
                        : 'Le médecin scanne ce code pour évaluer l’accompagnement de l’employé et proposer des améliorations. Les réponses ne sont visibles que par l’administration.'}
                    </p>
                    <p className="text-xs font-mono text-gray-500 mt-2 break-all">{lienAvis(emp.feedback_token)}</p>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard?.writeText(lienAvis(emp.feedback_token!))}
                      className="mt-2 text-xs font-medium text-blue-600 hover:underline"
                    >
                      {isArabic ? 'نسخ الرابط' : 'Copier le lien'}
                    </button>
                  </div>
                </div>
              )}

              {/* Activité sur une période */}
              {statsFor?.id === emp.id && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex flex-wrap items-end gap-3 mb-4">
                    <label className="text-sm">
                      <span className="block text-xs text-gray-500 mb-1">{isArabic ? 'من' : 'Du'}</span>
                      <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg" />
                    </label>
                    <label className="text-sm">
                      <span className="block text-xs text-gray-500 mb-1">{isArabic ? 'إلى' : 'Au'}</span>
                      <input type="date" value={to} min={from} max={aujourdhui} onChange={(e) => setTo(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg" />
                    </label>
                    <button
                      type="button"
                      onClick={() => { setFrom(moisDernier); setTo(aujourdhui); }}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      {isArabic ? '30 يومًا' : '30 jours'}
                    </button>
                  </div>

                  {statsLoading ? (
                    <p className="text-sm text-gray-500">{isArabic ? 'جارٍ…' : 'Chargement…'}</p>
                  ) : !stats ? (
                    <p className="text-sm text-gray-500">{isArabic ? 'لا بيانات.' : 'Aucune donnée.'}</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                          <div className="text-2xl font-extrabold text-green-700">{stats.created}</div>
                          <div className="text-sm text-gray-600">{isArabic ? 'أطباء مسجّلون' : 'Médecins inscrits'}</div>
                        </div>
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                          <div className="text-2xl font-extrabold text-red-700">{stats.deleted}</div>
                          <div className="text-sm text-gray-600">{isArabic ? 'حسابات محذوفة' : 'Comptes supprimés'}</div>
                        </div>
                      </div>

                      {stats.recent.length > 0 && (
                        <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
                          {stats.recent.map((r, i) => (
                            <li key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
                              <span className={r.action === 'doctor_created' ? 'text-green-600' : 'text-red-600'}>
                                {r.action === 'doctor_created' ? '+' : '−'}
                              </span>
                              <span className="text-gray-700 truncate">{r.doctor_name || '—'}</span>
                              <span className="ms-auto text-xs text-gray-400 flex-shrink-0">
                                {new Date(r.created_at).toLocaleDateString('fr-FR')}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
