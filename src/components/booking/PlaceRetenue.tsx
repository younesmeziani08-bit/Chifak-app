import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { placeAPI, type PlaceRetenue as Place } from '../../services/listeAttente';

/**
 * /place/&lt;jeton&gt; — « une place s'est libérée, la voulez-vous ? »
 *
 * ── Ce que cette page doit réussir ──
 *
 * La personne s'est inscrite sur une liste d'attente il y a peut-être trois
 * semaines. Elle reçoit un courrier, ouvre ce lien, et doit décider en
 * quelques secondes. Trois informations, dans cet ordre : quel créneau,
 * combien de temps il lui reste, et deux boutons.
 *
 * ── Le décompte n'est pas une décoration ──
 *
 * La place est retenue deux heures et pas une minute de plus. Annoncer
 * « réservée pour vous » sans dire jusqu'à quand, c'est promettre quelque
 * chose qu'on retirera sans prévenir. Le temps restant est donc affiché, et
 * il descend sous les yeux.
 *
 * ── Refuser n'est pas renoncer ──
 *
 * Le bouton dit « ce créneau ne me convient pas », pas « me désinscrire ». La
 * personne reste sur la liste et la place repart au suivant tout de suite —
 * c'est le geste le plus utile qu'elle puisse faire pour quelqu'un d'autre,
 * et il ne doit rien lui coûter.
 */

interface Props {
  jeton: string;
  onRetourAccueil: () => void;
}

type Etape = 'choix' | 'confirme' | 'refuse';

export default function PlaceRetenue({ jeton, onRetourAccueil }: Props) {
  const { language } = useLanguage();
  const isArabic = language === 'ar';

  const [place, setPlace] = useState<Place | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [etape, setEtape] = useState<Etape>('choix');
  const [maintenant, setMaintenant] = useState(() => Date.now());

  useEffect(() => {
    let vivant = true;
    placeAPI.lire(jeton)
      .then((p) => { if (vivant) setPlace(p); })
      .catch((e: Error) => { if (vivant) setErreur(e.message); })
      .finally(() => { if (vivant) setChargement(false); });
    return () => { vivant = false; };
  }, [jeton]);

  /* Le décompte bat à la seconde tant qu'il reste du temps. On s'arrête à
     l'expiration : un compteur qui continue en négatif inquiète sans informer. */
  useEffect(() => {
    if (etape !== 'choix' || !place || place.expiree) return;
    const battement = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(battement);
  }, [etape, place]);

  const restant = useMemo(() => {
    if (!place?.hold_expire_le) return null;
    const ms = new Date(place.hold_expire_le).getTime() - maintenant;
    if (ms <= 0) return null;
    const minutes = Math.floor(ms / 60000);
    return { heures: Math.floor(minutes / 60), minutes: minutes % 60 };
  }, [place, maintenant]);

  const dateLisible = (iso: string) => new Intl.DateTimeFormat(isArabic ? 'ar' : 'fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(`${iso}T12:00:00`));

  const confirmer = async () => {
    setEnvoi(true);
    setErreur('');
    try {
      await placeAPI.confirmer(jeton);
      setEtape('confirme');
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Confirmation impossible');
    } finally {
      setEnvoi(false);
    }
  };

  const refuser = async () => {
    setEnvoi(true);
    setErreur('');
    try {
      await placeAPI.refuser(jeton);
      setEtape('refuse');
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Opération impossible');
    } finally {
      setEnvoi(false);
    }
  };

  if (chargement) {
    return (
      <Cadre isArabic={isArabic}>
        <div className="text-center py-10">
          <div className="inline-block animate-spin rounded-full h-9 w-9 border-b-2 border-blue-600 mb-3" />
          <p className="text-sm text-gray-500">{isArabic ? 'جارٍ التحميل…' : 'Chargement…'}</p>
        </div>
      </Cadre>
    );
  }

  // ── La place n'existe plus, ou le délai est passé ──
  if (!place || place.expiree || (etape === 'choix' && !restant)) {
    return (
      <Cadre isArabic={isArabic}>
        <div className="text-center py-6">
          <div className="text-4xl mb-4" aria-hidden="true">⏳</div>
          <h1 className="text-xl font-black text-gray-900 mb-2">
            {isArabic ? 'انتهت مهلة هذه الفرصة' : 'Le délai est passé'}
          </h1>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            {isArabic
              ? 'أُعيد الموعد إلى مريض آخر. تبقى في قائمة الانتظار للمرة القادمة.'
              : 'La place a été proposée à quelqu’un d’autre. Vous restez sur la liste d’attente pour la prochaine fois.'}
          </p>
          <BoutonPlein onClick={onRetourAccueil}>
            {isArabic ? 'الذهاب إلى chifak' : 'Aller sur chifak'}
          </BoutonPlein>
        </div>
      </Cadre>
    );
  }

  if (etape === 'confirme') {
    return (
      <Cadre isArabic={isArabic}>
        <div className="text-center py-4">
          <div className="w-16 h-16 rounded-full bg-green-50 text-green-600 flex items-center justify-center mx-auto mb-5 text-3xl" aria-hidden="true">✓</div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">
            {isArabic ? 'تم تأكيد موعدك' : 'Rendez-vous confirmé'}
          </h1>
          <p className="text-[15px] text-gray-600 leading-relaxed mb-6">
            {isArabic ? 'مع ' : 'Avec '}<strong>{place.doctor_name}</strong><br />
            {dateLisible(place.appointment_date)} {isArabic ? 'على' : 'à'} <strong>{place.appointment_time}</strong>
          </p>
          <div className="rounded-2xl p-4 text-start mb-6" style={{ background: 'var(--bg-2)' }}>
            <p className="text-sm text-gray-600 leading-relaxed">
              {isArabic
                ? 'أُرسل بريد تأكيد يحتوي على رابط للإلغاء إن لزم الأمر.'
                : 'Un e-mail de confirmation vient de partir. Il contient un lien pour annuler si vous ne pouvez plus venir.'}
            </p>
          </div>
          <BoutonPlein onClick={onRetourAccueil}>
            {isArabic ? 'اكتشف chifak' : 'Découvrir chifak'}
          </BoutonPlein>
        </div>
      </Cadre>
    );
  }

  if (etape === 'refuse') {
    return (
      <Cadre isArabic={isArabic}>
        <div className="text-center py-6">
          <div className="text-4xl mb-4" aria-hidden="true">👍</div>
          <h1 className="text-xl font-black text-gray-900 mb-2">
            {isArabic ? 'شكرًا' : 'C’est noté'}
          </h1>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            {isArabic
              ? 'عُرض الموعد فورًا على مريض آخر، وتبقى أنت في قائمة الانتظار.'
              : 'La place vient d’être proposée à quelqu’un d’autre, et vous restez sur la liste d’attente pour un prochain créneau.'}
          </p>
          <BoutonPlein onClick={onRetourAccueil}>
            {isArabic ? 'الذهاب إلى chifak' : 'Aller sur chifak'}
          </BoutonPlein>
        </div>
      </Cadre>
    );
  }

  // ── Le choix ──
  return (
    <Cadre isArabic={isArabic}>
      <div className="text-center mb-6">
        <div className="text-4xl mb-3" aria-hidden="true">🔔</div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight leading-tight">
          {isArabic ? 'تحرّر موعد' : 'Une place s’est libérée'}
        </h1>
      </div>

      <dl className="rounded-2xl p-5 mb-4 space-y-3" style={{ background: 'var(--bg-2)' }}>
        <Ligne libelle={isArabic ? 'الطبيب' : 'Praticien'} valeur={place.doctor_name} gras />
        <Ligne libelle={isArabic ? 'التخصص' : 'Spécialité'} valeur={place.specialty} />
        <Ligne libelle={isArabic ? 'التاريخ' : 'Date'} valeur={dateLisible(place.appointment_date)} />
        <Ligne libelle={isArabic ? 'الساعة' : 'Heure'} valeur={place.appointment_time} gras />
        {place.consultation_type !== 'video' && (
          <Ligne libelle={isArabic ? 'العنوان' : 'Adresse'} valeur={`${place.address}, ${place.city}`} />
        )}
      </dl>

      {/* Le décompte : la place n'est gardée que jusque-là. */}
      {restant && (
        <div className="rounded-2xl p-4 mb-5 border border-amber-200 bg-amber-50 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-1">
            {isArabic ? 'محجوز لك لمدة' : 'Réservé pour vous encore'}
          </p>
          <p className="text-2xl font-black text-amber-900 tabular-nums">
            {restant.heures > 0 && `${restant.heures} h `}{restant.minutes} min
          </p>
        </div>
      )}

      {erreur && (
        <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-2xl text-sm font-medium text-red-600" role="alert">
          {erreur}
        </div>
      )}

      <button
        type="button"
        onClick={confirmer}
        disabled={envoi}
        className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-colors"
      >
        {envoi
          ? (isArabic ? 'جارٍ…' : 'Confirmation…')
          : (isArabic ? 'نعم، أحجز هذا الموعد' : 'Oui, je prends ce rendez-vous')}
      </button>

      <button
        type="button"
        onClick={refuser}
        disabled={envoi}
        className="w-full mt-3 py-3.5 border border-gray-200 text-gray-600 rounded-2xl text-sm font-semibold hover:bg-gray-50 transition-colors"
      >
        {isArabic ? 'لا يناسبني هذا الموعد' : 'Ce créneau ne me convient pas'}
      </button>

      <p className="text-xs text-gray-400 text-center mt-4 leading-relaxed">
        {isArabic
          ? 'في الحالتين تبقى في قائمة الانتظار.'
          : 'Dans les deux cas, vous restez sur la liste d’attente.'}
      </p>
    </Cadre>
  );
}

function Cadre({ children, isArabic }: { children: React.ReactNode; isArabic: boolean }) {
  return (
    <div
      className="min-h-screen flex items-start sm:items-center justify-center p-4 py-8"
      style={{ background: 'var(--bg-2)' }}
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-6 sm:p-8">{children}</div>
    </div>
  );
}

function Ligne({ libelle, valeur, gras = false }: { libelle: string; valeur: string; gras?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-xs font-bold uppercase tracking-wider text-gray-400 flex-shrink-0">{libelle}</dt>
      <dd className={`text-sm text-end ${gras ? 'font-bold text-gray-900' : 'text-gray-700'}`}>{valeur}</dd>
    </div>
  );
}

function BoutonPlein({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold transition-colors"
    >
      {children}
    </button>
  );
}
