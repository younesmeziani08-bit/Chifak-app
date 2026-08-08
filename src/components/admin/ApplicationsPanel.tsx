import { useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { applicationsAPI, type Application } from '../../services/api';

/**
 * File d'examen des demandes d'inscription.
 *
 * C'est ici que se joue la seule vérification réelle : aucun code ne peut
 * établir qu'une personne est cardiologue. Un humain regarde le dossier,
 * appelle si besoin, puis tranche. L'écran est donc conçu pour rendre la
 * décision facile, pas pour l'accélérer.
 *
 * Deux garde-fous délibérés :
 * — le refus exige un motif écrit, sans quoi la décision serait intraçable ;
 * — le code de connexion créé à l'acceptation s'affiche une fois, en clair,
 *   avec la consigne de le transmettre au praticien.
 */
export default function ApplicationsPanel() {
  const { language } = useLanguage();
  const isArabic = language === 'ar';

  const [statut, setStatut] = useState<Application['status']>('pending');
  const [demandes, setDemandes] = useState<Application[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState<number | null>(null);
  /** Code fraîchement créé, à transmettre au praticien. */
  const [codeCree, setCodeCree] = useState<{ nom: string; code: string } | null>(null);

  const charger = async (s: Application['status']) => {
    setChargement(true);
    setErreur('');
    try {
      setDemandes(await applicationsAPI.list(s));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur de chargement.');
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => { charger(statut); }, [statut]);

  const accepter = async (d: Application) => {
    const confirmation = isArabic
      ? `قبول ${d.full_name}؟ سيُنشأ ملفه ويظهر للمرضى.`
      : `Accepter ${d.full_name} ? Sa fiche sera créée et visible des patients.`;
    if (!window.confirm(confirmation)) return;

    setEnCours(d.id);
    try {
      const { doctorCode } = await applicationsAPI.approve(d.id);
      setCodeCree({ nom: d.full_name, code: doctorCode });
      await charger(statut);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur.');
    } finally {
      setEnCours(null);
    }
  };

  const refuser = async (d: Application) => {
    const motif = window.prompt(isArabic
      ? `سبب رفض ${d.full_name} (إجباري):`
      : `Motif du refus de ${d.full_name} (obligatoire) :`);
    if (motif === null) return;
    if (!motif.trim()) {
      alert(isArabic ? 'السبب إجباري.' : 'Le motif est obligatoire.');
      return;
    }
    setEnCours(d.id);
    try {
      await applicationsAPI.reject(d.id, motif.trim());
      await charger(statut);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur.');
    } finally {
      setEnCours(null);
    }
  };

  const onglets: { cle: Application['status']; label: string }[] = [
    { cle: 'pending', label: isArabic ? 'قيد الانتظار' : 'En attente' },
    { cle: 'approved', label: isArabic ? 'مقبولة' : 'Acceptées' },
    { cle: 'rejected', label: isArabic ? 'مرفوضة' : 'Refusées' },
  ];

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'}>
      {/* Code créé : affiché une seule fois, il faut le transmettre */}
      {codeCree && (
        <div
          className="mb-6 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3"
          style={{ background: 'var(--accent-bg)', border: '1px solid var(--color-blue-200)' }}
        >
          <p className="text-sm" style={{ color: 'var(--ink)' }}>
            {isArabic ? 'رمز الدخول لـ ' : 'Code de connexion de '}
            <strong>{codeCree.nom}</strong>{' : '}
            <code className="font-mono text-base px-2 py-0.5 rounded" style={{ background: '#FFFFFF' }}>
              {codeCree.code}
            </code>
            <span className="block mt-1 text-xs" style={{ color: 'var(--ink-2)' }}>
              {isArabic
                ? 'أرسله للطبيب. كلمة المرور هي التي اختارها عند التسجيل.'
                : 'Transmettez-le au praticien. Son mot de passe est celui qu’il a choisi lors de sa demande.'}
            </span>
          </p>
          <button type="button" onClick={() => setCodeCree(null)} className="btn-secondary">
            {isArabic ? 'حسنًا' : 'J’ai noté'}
          </button>
        </div>
      )}

      <div className="flex gap-1 mb-6">
        {onglets.map((o) => (
          <button
            key={o.cle}
            type="button"
            onClick={() => setStatut(o.cle)}
            className="rounded-full px-4 py-2 text-sm font-semibold transition-colors"
            style={{
              background: statut === o.cle ? 'var(--accent)' : 'var(--bg-2)',
              color: statut === o.cle ? '#FFFFFF' : 'var(--ink-2)',
            }}
          >
            {o.label}
          </button>
        ))}
      </div>

      {erreur && <p role="alert" className="text-sm mb-4" style={{ color: 'var(--danger)' }}>{erreur}</p>}

      {chargement ? (
        <p className="text-sm" style={{ color: 'var(--ink-3)' }}>{isArabic ? 'جارٍ التحميل…' : 'Chargement…'}</p>
      ) : demandes.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
          {statut === 'pending'
            ? (isArabic ? 'لا يوجد طلب قيد الانتظار.' : 'Aucune demande en attente.')
            : (isArabic ? 'لا شيء هنا.' : 'Rien ici.')}
        </p>
      ) : (
        <ul className="space-y-3">
          {demandes.map((d) => (
            <li
              key={d.id}
              className="rounded-xl p-4 sm:p-5"
              style={{ background: '#FFFFFF', border: '1px solid var(--tint-10)' }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold" style={{ color: 'var(--ink)' }}>{d.full_name}</p>
                    {d.kind === 'demo' && (
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: 'var(--bg-2)', color: 'var(--ink-2)' }}
                      >
                        {isArabic ? 'عرض توضيحي' : 'Démo'}
                      </span>
                    )}
                  </div>
                  <p className="text-sm" style={{ color: 'var(--ink-2)' }}>
                    {d.specialty} · {d.city}
                  </p>
                </div>
                <p className="text-xs" style={{ color: 'var(--ink-3)' }}>
                  {new Date(d.created_at).toLocaleDateString(isArabic ? 'ar-DZ' : 'fr-FR', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </p>
              </div>

              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm mb-3">
                <div className="flex gap-2">
                  <dt style={{ color: 'var(--ink-3)' }}>{isArabic ? 'الهاتف' : 'Téléphone'}</dt>
                  <dd style={{ color: 'var(--ink)' }}>{d.phone}</dd>
                </div>
                <div className="flex gap-2 min-w-0">
                  <dt style={{ color: 'var(--ink-3)' }}>{isArabic ? 'البريد' : 'E-mail'}</dt>
                  <dd className="truncate" style={{ color: 'var(--ink)' }}>{d.email}</dd>
                </div>
                {d.license_number && (
                  <div className="flex gap-2">
                    <dt style={{ color: 'var(--ink-3)' }}>{isArabic ? 'رقم النقابة' : 'N° Ordre'}</dt>
                    <dd style={{ color: 'var(--ink)' }}>{d.license_number}</dd>
                  </div>
                )}
              </dl>

              {/* Contrôle facial : affiché comme un indice, jamais comme une preuve.
                  Il s'exécute dans le navigateur du praticien, donc il est
                  falsifiable — la formulation doit empêcher qu'on s'y fie. */}
              {d.identity_checked !== null && (
                <p
                  className="text-xs rounded-lg px-3 py-2 mb-3"
                  style={{
                    background: d.identity_checked ? '#E7F5EE' : '#FDF3E3',
                    color: d.identity_checked ? 'var(--success)' : 'var(--color-amber-600)',
                  }}
                >
                  {d.identity_checked
                    ? (isArabic ? 'التحقق الذاتي: الوجه يطابق البطاقة' : 'Auto-contrôle : visage concordant avec la pièce')
                    : (isArabic ? 'التحقق الذاتي: لم تتأكد المطابقة' : 'Auto-contrôle : correspondance non confirmée')}
                  {d.identity_score !== null && ` · ${Math.round(d.identity_score * 100)} %`}
                  <span className="block mt-0.5" style={{ color: 'var(--ink-3)' }}>
                    {isArabic
                      ? 'مؤشر فقط: يتم الفحص في جهاز الطبيب ويمكن التلاعب به.'
                      : 'Indice seulement : effectué sur l’appareil du praticien, donc falsifiable.'}
                  </span>
                </p>
              )}

              {d.message && (
                <p className="text-sm rounded-lg px-3 py-2 mb-3" style={{ background: 'var(--bg-2)', color: 'var(--ink-2)' }}>
                  {d.message}
                </p>
              )}

              {d.status === 'pending' ? (
                <div className="flex flex-wrap gap-2">
                  {d.kind === 'registration' && (
                    <button
                      type="button"
                      disabled={enCours === d.id}
                      onClick={() => accepter(d)}
                      className="btn-primary"
                      style={{ height: '40px', fontSize: '14px' }}
                    >
                      {isArabic ? 'قبول وإنشاء الملف' : 'Accepter et créer la fiche'}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={enCours === d.id}
                    onClick={() => refuser(d)}
                    className="btn-secondary"
                    style={{ height: '40px', fontSize: '14px', color: 'var(--danger)' }}
                  >
                    {isArabic ? 'رفض' : 'Refuser'}
                  </button>
                </div>
              ) : (
                <p className="text-xs" style={{ color: 'var(--ink-3)' }}>
                  {d.status === 'approved'
                    ? (isArabic ? 'مقبولة' : 'Acceptée')
                    : (isArabic ? 'مرفوضة' : 'Refusée')}
                  {d.reviewed_by_name && ` · ${d.reviewed_by_name}`}
                  {d.review_note && ` · ${d.review_note}`}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
