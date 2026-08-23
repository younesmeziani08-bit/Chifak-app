import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { placeAPI, type PlaceRetenue as Place } from '../../services/listeAttente';
import { Alerte, Bouton, CarteRdv, Chargement, Decompte, Entete, Icone, PageCarte } from '../shared/Carte';

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
    return <PageCarte isArabic={isArabic}><Chargement isArabic={isArabic} /></PageCarte>;
  }

  // ── La place n'existe plus, ou le délai est passé ──
  if (!place || place.expiree || (etape === 'choix' && !restant)) {
    return (
      <PageCarte isArabic={isArabic}>
        <Entete icone="horloge" ton="sourdine" titre={isArabic ? 'انتهت مهلة هذه الفرصة' : 'Le délai est passé'} />
        <p className="text-[15px] leading-relaxed mb-6" style={{ color: 'var(--ink-2)' }}>
          {isArabic
            ? 'أُعيد الموعد إلى مريض آخر. تبقى في قائمة الانتظار للمرة القادمة.'
            : 'La place a été proposée à quelqu’un d’autre. Vous restez sur la liste d’attente pour la prochaine fois.'}
        </p>
        <Bouton onClick={onRetourAccueil}>{isArabic ? 'الذهاب إلى chifak' : 'Aller sur chifak'}</Bouton>
      </PageCarte>
    );
  }

  if (etape === 'confirme') {
    return (
      <PageCarte isArabic={isArabic}>
        <Entete icone="coche" ton="succes" titre={isArabic ? 'تم تأكيد موعدك' : 'Rendez-vous confirmé'} />
        <div className="mb-6">
          <CarteRdv
            praticien={place.doctor_name}
            specialite={place.specialty}
            date={place.appointment_date}
            heure={place.appointment_time}
            adresse={place.consultation_type !== 'video' ? `${place.address}, ${place.city}` : null}
            isArabic={isArabic}
          />
        </div>
        <p className="text-[14px] leading-relaxed mb-6" style={{ color: 'var(--ink-2)' }}>
          {isArabic
            ? 'أُرسل بريد تأكيد يحتوي على رابط للإلغاء إن لزم الأمر.'
            : 'Un e-mail de confirmation vient de partir. Il contient un lien pour annuler si vous ne pouvez plus venir.'}
        </p>
        <Bouton onClick={onRetourAccueil}>{isArabic ? 'اكتشف chifak' : 'Découvrir chifak'}</Bouton>
      </PageCarte>
    );
  }

  if (etape === 'refuse') {
    return (
      <PageCarte isArabic={isArabic}>
        <Entete icone="coche" ton="sourdine" titre={isArabic ? 'شكرًا' : 'C’est noté'} />
        <p className="text-[15px] leading-relaxed mb-6" style={{ color: 'var(--ink-2)' }}>
          {isArabic
            ? 'عُرض الموعد فورًا على مريض آخر، وتبقى أنت في قائمة الانتظار.'
            : 'La place vient d’être proposée à quelqu’un d’autre, et vous restez sur la liste d’attente pour un prochain créneau.'}
        </p>
        <Bouton onClick={onRetourAccueil}>{isArabic ? 'الذهاب إلى chifak' : 'Aller sur chifak'}</Bouton>
      </PageCarte>
    );
  }

  // ── Le choix ──
  return (
    <PageCarte isArabic={isArabic}>
      <Entete icone="cloche" titre={isArabic ? 'تحرّر موعد' : 'Une place s’est libérée'} />

      <p className="text-[15px] leading-relaxed mb-5" style={{ color: 'var(--ink-2)' }}>
        {isArabic
          ? 'ألغى مريض موعده. نعرضه عليك أوّلًا.'
          : 'Un patient a annulé. Nous vous le proposons en premier.'}
      </p>

      <div className="mb-6">
        <CarteRdv
          praticien={place.doctor_name}
          specialite={place.specialty}
          date={place.appointment_date}
          heure={place.appointment_time}
          adresse={place.consultation_type !== 'video' ? `${place.address}, ${place.city}` : null}
          isArabic={isArabic}
        >
          {restant && <Decompte heures={restant.heures} minutes={restant.minutes} isArabic={isArabic} />}
        </CarteRdv>
      </div>

      {erreur && <Alerte>{erreur}</Alerte>}

      <div className="space-y-2.5">
        <Bouton onClick={confirmer} disabled={envoi}>
          {envoi
            ? (isArabic ? 'جارٍ…' : 'Confirmation…')
            : (<><Icone nom="coche" className="w-[18px] h-[18px]" />{isArabic ? 'نعم، أحجز هذا الموعد' : 'Je prends ce rendez-vous'}</>)}
        </Bouton>
        <Bouton variante="contour" onClick={refuser} disabled={envoi}>
          {isArabic ? 'لا يناسبني هذا الموعد' : 'Ce créneau ne me convient pas'}
        </Bouton>
      </div>

      <p className="text-[13px] text-center mt-5 leading-relaxed" style={{ color: 'var(--ink-3)' }}>
        {isArabic
          ? 'في الحالتين تبقى في قائمة الانتظار.'
          : 'Dans les deux cas, vous restez sur la liste d’attente.'}
      </p>
    </PageCarte>
  );
}
