import { useEffect, useState } from 'react';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { employeesAPI, Employee, EmployeeStats } from '../services/api';
import QrCode from '../../src/components/shared/QrCode';

/**
 * Gestion du personnel : création, suppression, activité par période,
 * et QR code d'avis. Réservé à l'administration côté serveur également —
 * masquer l'onglet ne suffirait pas, les routes exigent le rôle admin.
 */

/**
 * Adresse ouverte par le médecin en scannant.
 *
 * Elle désigne l'application PATIENTE, pas celle-ci. C'est là que vit la page
 * /avis/<jeton> (voir src/App.tsx) ; l'administration, elle, n'a aucun
 * routage — elle affiche la connexion ou le tableau de bord, rien d'autre.
 *
 * Le lien était bâti sur `window.location.origin`, c'est-à-dire le domaine de
 * l'administration, puisque c'est ici que le code s'exécute. Les deux
 * applications se déployant sur deux domaines distincts, le médecin qui
 * scannait arrivait sur l'écran de connexion de l'administration. La
 * fonctionnalité d'avis du personnel ne fonctionnait donc pas en production.
 *
 * En développement les deux tournent sur la même machine et l'origine
 * courante fait un repli correct.
 */
function lienAvis(token: string) {
  const base = (import.meta.env.VITE_PATIENT_URL || window.location.origin).replace(/\/$/, '');
  return `${base}/avis/${token}`;
}

const cls = 'px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 w-full';

export default function EmployeesPanel() {
  const { language } = useLanguage();
  const isArabic = language === 'ar';

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const vide = {
    firstName: '', lastName: '', password: '',
    birthDate: '', birthPlace: '', phone: '', address: '', email: '',
    position: '', hiredAt: '', emergencyContact: '', notes: '',
  };
  const [form, setForm] = useState(vide);
  const champ = (cle: keyof typeof vide) => ({
    value: form[cle],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [cle]: e.target.value }),
  });

  /* Compte tout juste créé : l'identifiant étant tiré au sort, l'admin ne peut
     pas le deviner. Il faut donc le lui montrer une fois, clairement, pour
     qu'il le transmette à l'employé. */
  const [nouveauCompte, setNouveauCompte] = useState<Employee | null>(null);
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
      const nouveau = await employeesAPI.create({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        password: form.password,
        birthDate: form.birthDate || undefined,
        birthPlace: form.birthPlace.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        email: form.email.trim() || undefined,
        position: form.position.trim() || undefined,
        hiredAt: form.hiredAt || undefined,
        emergencyContact: form.emergencyContact.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      const cree = await employeesAPI.getAll();
      setEmployees(cree);
      setNouveauCompte(cree.find((c) => c.id === nouveau.id) ?? nouveau);
      setForm(vide);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setCreating(false);
    }
  };

  const regenerer = async (emp: Employee) => {
    if (!window.confirm(isArabic
      ? `رقم جديد لـ ${emp.full_name || emp.username}؟ الرقم القديم لن يعمل بعد الآن.`
      : `Attribuer un nouveau numéro à ${emp.full_name || emp.username} ?\n\nL’ancien cessera immédiatement de fonctionner : pensez à lui communiquer le nouveau.`
    )) return;
    try {
      const { username } = await employeesAPI.regenerateLogin(emp.id);
      const rafraichi = await employeesAPI.getAll();
      setEmployees(rafraichi);
      setNouveauCompte(rafraichi.find((c) => c.id === emp.id) ?? { ...emp, username });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur');
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
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
              {isArabic ? 'الهوية' : 'Identité'}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <input {...champ('firstName')} required placeholder={isArabic ? 'الاسم *' : 'Prénom *'} className={cls} />
              <input {...champ('lastName')} required placeholder={isArabic ? 'اللقب *' : 'Nom *'} className={cls} />
              <input {...champ('birthDate')} type="date" max={aujourdhui} placeholder="Date de naissance" className={cls} />
              <input {...champ('birthPlace')} placeholder={isArabic ? 'مكان الميلاد' : 'Lieu de naissance'} className={cls} />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
              {isArabic ? 'الاتصال' : 'Contact'}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <input {...champ('phone')} type="tel" placeholder={isArabic ? 'الهاتف' : 'Téléphone'} className={cls} />
              <input {...champ('email')} type="email" placeholder="Email" className={cls} />
              <input {...champ('address')} placeholder={isArabic ? 'العنوان' : 'Adresse'} className={`${cls} sm:col-span-2`} />
              {/* Utile pour un poste de terrain : l'employé se déplace chez les praticiens. */}
              <input {...champ('emergencyContact')} placeholder={isArabic ? 'شخص يُتصل به عند الطوارئ' : 'Personne à prévenir (nom et téléphone)'} className={`${cls} sm:col-span-2`} />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
              {isArabic ? 'المنصب' : 'Poste'}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <input {...champ('position')} placeholder={isArabic ? 'الوظيفة (مثال: مندوب ميداني)' : 'Fonction (ex : chargé de secteur)'} className={cls} />
              <label className="flex flex-col">
                <span className="text-xs text-gray-500 mb-1">{isArabic ? 'تاريخ التوظيف' : 'Date d’entrée'}</span>
                <input {...champ('hiredAt')} type="date" className={cls} />
              </label>
              <textarea {...champ('notes')} rows={2} placeholder={isArabic ? 'ملاحظات داخلية' : 'Notes internes'} className={`${cls} sm:col-span-2 resize-none`} />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
              {isArabic ? 'الدخول' : 'Accès'}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Rien à saisir : l'identifiant est tiré au sort à la création
                  et affiché juste après, puisqu'il ne se devine pas. */}
              <div className="flex flex-col justify-end">
                <span className="text-xs text-gray-500 mb-1">
                  {isArabic ? 'اسم الدخول' : 'Identifiant de connexion'}
                </span>
                <div className={`${cls} bg-gray-100 text-gray-500 flex items-center`}>
                  {isArabic ? 'رقم عشوائي يُمنح عند الإنشاء' : 'Numéro attribué à la création'}
                </div>
              </div>
              <label className="flex flex-col">
                <span className="text-xs text-gray-500 mb-1">{isArabic ? 'كلمة المرور *' : 'Mot de passe *'}</span>
                <input {...champ('password')} type="password" required className={cls} />
              </label>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-gray-200">
          <button
            type="submit"
            disabled={creating}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {creating ? (isArabic ? 'جارٍ…' : 'Création…') : (isArabic ? 'إنشاء الحساب' : 'Créer le compte')}
          </button>
          <p className="text-xs text-gray-500">
            {isArabic
              ? 'يُمنح رقم تسلسلي ورمز QR تلقائيًا. في حال التشابه يُضاف رقم لاسم الدخول.'
              : 'Matricule et QR code attribués automatiquement. En cas d’homonyme, un numéro est ajouté à l’identifiant.'}
          </p>
        </div>
        {createError && <p className="text-sm text-red-600 mt-2">{createError}</p>}
      </form>

      {/* Identifiant du compte tout juste créé. Affiché une fois, en grand :
          il est aléatoire, donc introuvable si l'admin ne le note pas ici. */}
      {nouveauCompte && (
        <div className="bg-green-50 border-2 border-green-300 rounded-xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-green-800 font-semibold mb-1">
                {isArabic ? 'تم إنشاء الحساب' : 'Compte créé'} — {nouveauCompte.full_name}
              </p>
              <p className="text-xs text-green-700 mb-3">
                {isArabic
                  ? 'سلّم هذا الرقم للموظف. لن يُعرض مرة أخرى بهذا الشكل.'
                  : 'Communiquez ce numéro à l’employé. Il reste consultable dans la liste ci-dessous.'}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-3xl font-mono font-bold tracking-widest text-green-900">
                  {nouveauCompte.username}
                </span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(nouveauCompte.username)}
                  className="text-xs font-medium text-green-700 underline"
                >
                  {isArabic ? 'نسخ' : 'Copier'}
                </button>
              </div>
              <p className="text-xs text-green-700 mt-2">
                {isArabic ? 'الرقم التسلسلي' : 'Matricule'} : <span className="font-mono">{nouveauCompte.staff_code}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setNouveauCompte(null)}
              className="text-green-700 hover:text-green-900 text-sm"
            >
              {isArabic ? 'إغلاق' : 'Fermer'}
            </button>
          </div>
        </div>
      )}

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
                  {emp.position && <p className="text-sm text-gray-500">{emp.position}</p>}
                  <div className="flex flex-wrap items-center gap-3 mt-1.5">
                    {/* L'identifiant est aléatoire : il doit rester consultable,
                        sinon un employé qui l'oublie ne peut plus se connecter. */}
                    <span className="text-sm font-mono font-semibold tracking-wider text-gray-900">
                      {emp.username}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard?.writeText(emp.username)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {isArabic ? 'نسخ' : 'Copier'}
                    </button>
                    {/* Les comptes créés avant le passage au tirage aléatoire
                        gardent un identifiant dérivé du nom : ce bouton permet
                        de les rattraper sans les recréer. */}
                    <button
                      type="button"
                      onClick={() => regenerer(emp)}
                      className="text-xs text-gray-500 hover:text-blue-600 hover:underline"
                    >
                      {isArabic ? 'رقم جديد' : 'Nouveau numéro'}
                    </button>
                    <span className="text-xs font-mono text-gray-400">{emp.staff_code || '—'}</span>
                  </div>
                  {(emp.phone || emp.email) && (
                    <p className="text-xs text-gray-500 mt-1">
                      {[emp.phone, emp.email].filter(Boolean).join(' · ')}
                    </p>
                  )}
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
                  <QrCode
                    valeur={lienAvis(emp.feedback_token)}
                    alt={isArabic ? 'رمز QR للآراء' : 'QR code d’avis'}
                    taille={220}
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
