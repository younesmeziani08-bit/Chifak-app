import { useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { rendezVousParJetonAPI, type RendezVousParJeton } from '../../services/annulations';

/**
 * /rdv/&lt;jeton&gt; — voir et annuler un rendez-vous SANS COMPTE.
 *
 * ── Pourquoi cette page existe ──
 *
 * L'application propose délibérément de réserver sans créer de compte. Mais
 * une seule route pouvait annuler, et elle exigeait un jeton patient : celui
 * qui avait réservé en invité n'avait donc AUCUN moyen de se décommander. Le
 * créneau restait bloqué, et le praticien attendait quelqu'un qui ne viendrait
 * pas.
 *
 * Le lien qui mène ici part dans l'e-mail de confirmation. Le jeton tient lieu
 * d'authentification : il ne se devine pas, et il n'ouvre que ce rendez-vous —
 * ni un compte, ni un dossier, ni la liste des autres.
 *
 * La page sert aussi les patients qui ont un compte : c'est le chemin le plus
 * court, et il évite d'avoir à retrouver ses identifiants pour libérer un
 * créneau qu'on sait déjà ne pas pouvoir honorer.
 */

interface Props {
  jeton: string;
  onRetourAccueil: () => void;
}

const CADRE = 'min-h-screen flex items-center justify-center p-4';
const CARTE = 'w-full max-w-lg bg-white rounded-3xl shadow-xl p-8 sm:p-10';

export default function AnnulationParLien({ jeton, onRetourAccueil }: Props) {
  const { language } = useLanguage();
  const isArabic = language === 'ar';

  const [rdv, setRdv] = useState<RendezVousParJeton | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [confirmation, setConfirmation] = useState(false);
  const [annulation, setAnnulation] = useState(false);
  const [annule, setAnnule] = useState(false);

  useEffect(() => {
    let vivant = true;
    rendezVousParJetonAPI.lire(jeton)
      .then((r) => { if (vivant) { setRdv(r); setAnnule(r.status === 'cancelled'); } })
      .catch((e: Error) => { if (vivant) setErreur(e.message); })
      .finally(() => { if (vivant) setChargement(false); });
    return () => { vivant = false; };
  }, [jeton]);

  const annuler = async () => {
    setAnnulation(true);
    setErreur('');
    try {
      await rendezVousParJetonAPI.annuler(jeton);
      setAnnule(true);
      setConfirmation(false);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Annulation impossible');
    } finally {
      setAnnulation(false);
    }
  };

  const dateLisible = (iso: string) => {
    const d = new Date(`${iso}T12:00:00`);
    return new Intl.DateTimeFormat(isArabic ? 'ar' : 'fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }).format(d);
  };

  if (chargement) {
    return (
      <div className={CADRE} style={{ background: 'var(--bg-2)' }}>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3" />
          <p className="text-sm text-gray-500">{isArabic ? 'جارٍ التحميل…' : 'Chargement…'}</p>
        </div>
      </div>
    );
  }

  if (!rdv) {
    return (
      <div className={CADRE} style={{ background: 'var(--bg-2)' }}>
        <div className={`${CARTE} text-center`}>
          <div className="text-4xl mb-4" aria-hidden="true">🔗</div>
          <h1 className="text-xl font-black text-gray-900 mb-2">
            {isArabic ? 'رابط غير صالح' : 'Lien invalide ou expiré'}
          </h1>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            {isArabic
              ? 'قد يكون الموعد أُلغي بالفعل، أو أن الرابط غير مكتمل. تحقّق من البريد الإلكتروني الذي استلمته.'
              : 'Le rendez-vous a peut-être déjà été annulé, ou le lien est incomplet. Vérifiez l’e-mail que vous avez reçu.'}
          </p>
          <button onClick={onRetourAccueil} className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm">
            {isArabic ? 'العودة للرئيسية' : 'Retour à l’accueil'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={CADRE} style={{ background: 'var(--bg-2)' }}>
      <div className={CARTE}>
        <div className="text-center mb-8">
          <div className="text-4xl mb-3" aria-hidden="true">{annule ? '✓' : '📅'}</div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            {annule
              ? (isArabic ? 'أُلغي الموعد' : 'Rendez-vous annulé')
              : (isArabic ? 'موعدك' : 'Votre rendez-vous')}
          </h1>
        </div>

        <dl className="rounded-2xl p-5 mb-6 space-y-3" style={{ background: 'var(--bg-2)' }}>
          <div className="flex justify-between gap-4">
            <dt className="text-xs font-bold uppercase tracking-wider text-gray-400">{isArabic ? 'الطبيب' : 'Praticien'}</dt>
            <dd className="text-sm font-bold text-gray-900 text-right">{rdv.doctor_name}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-xs font-bold uppercase tracking-wider text-gray-400">{isArabic ? 'التخصص' : 'Spécialité'}</dt>
            <dd className="text-sm text-gray-700 text-right">{rdv.specialty}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-xs font-bold uppercase tracking-wider text-gray-400">{isArabic ? 'التاريخ' : 'Date'}</dt>
            <dd className="text-sm text-gray-700 text-right">{dateLisible(rdv.appointment_date)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-xs font-bold uppercase tracking-wider text-gray-400">{isArabic ? 'الساعة' : 'Heure'}</dt>
            <dd className="text-sm font-bold text-gray-900 text-right tabular-nums">{rdv.appointment_time}</dd>
          </div>
          {rdv.consultation_type !== 'video' && (
            <div className="flex justify-between gap-4">
              <dt className="text-xs font-bold uppercase tracking-wider text-gray-400">{isArabic ? 'العنوان' : 'Adresse'}</dt>
              <dd className="text-sm text-gray-700 text-right">{rdv.address}, {rdv.city}</dd>
            </div>
          )}
        </dl>

        {erreur && (
          <div className="mb-5 p-4 bg-red-50 border border-red-100 rounded-2xl text-xs font-bold text-red-600" role="alert">
            ⚠️ {erreur}
          </div>
        )}

        {annule ? (
          <>
            <p className="text-sm text-gray-500 leading-relaxed mb-6 text-center">
              {isArabic
                ? 'تم تحرير الموعد. يمكنك حجز موعد آخر متى شئت.'
                : 'Le créneau a été libéré. Vous pouvez reprendre rendez-vous quand vous le souhaitez.'}
            </p>
            <button onClick={onRetourAccueil} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs">
              {isArabic ? 'حجز موعد آخر' : 'Prendre un autre rendez-vous'}
            </button>
          </>
        ) : confirmation ? (
          <>
            <p className="text-sm text-gray-700 leading-relaxed mb-5 text-center font-medium">
              {isArabic
                ? 'هل تريد فعلاً إلغاء هذا الموعد؟ لا يمكن التراجع عن ذلك.'
                : 'Confirmez-vous l’annulation ? Le créneau sera aussitôt rendu disponible, et cette action est définitive.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={annuler}
                disabled={annulation}
                className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs disabled:opacity-50"
              >
                {annulation
                  ? (isArabic ? 'جارٍ الإلغاء…' : 'Annulation…')
                  : (isArabic ? 'نعم، ألغِ الموعد' : 'Oui, annuler')}
              </button>
              <button
                onClick={() => setConfirmation(false)}
                disabled={annulation}
                className="flex-1 py-4 bg-gray-100 text-gray-700 rounded-2xl font-black uppercase tracking-widest text-xs"
              >
                {isArabic ? 'تراجع' : 'Non, garder'}
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              onClick={() => setConfirmation(true)}
              className="w-full py-4 border-2 border-red-200 text-red-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-red-50 transition-colors"
            >
              {isArabic ? 'إلغاء هذا الموعد' : 'Annuler ce rendez-vous'}
            </button>
            <button onClick={onRetourAccueil} className="w-full mt-3 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-700">
              {isArabic ? 'العودة للرئيسية' : 'Retour à l’accueil'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
