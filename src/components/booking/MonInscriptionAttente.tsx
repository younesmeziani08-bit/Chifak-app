import { useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { listeAttenteAPI, type InscriptionAttente } from '../../services/listeAttente';
import { Alerte, Bouton, Chargement, Entete, PageCarte } from '../shared/Carte';

/**
 * /attente/&lt;jeton&gt; — mon inscription sur une liste d'attente.
 *
 * Le lien figure dans le courrier de confirmation d'inscription. Il sert à une
 * seule chose : en sortir.
 *
 * ── Pourquoi cette page existe ──
 *
 * S'inscrire à une liste d'attente sans pouvoir en sortir, c'est accepter de
 * recevoir des courriers indéfiniment. Les gens ne s'inscriraient pas — ou se
 * plaindraient, ce qui est pire. Le lien de sortie figure donc dans le premier
 * courrier, avant même la première proposition.
 *
 * ── Ce qu'elle n'affiche pas ──
 *
 * Le rang dans la file. Il bouge à chaque inscription et à chaque annulation,
 * il n'aide personne à décider quoi que ce soit, et il déçoit toujours :
 * « vous êtes 7ᵉ » se lit comme « n'espérez pas ».
 */

interface Props {
  jeton: string;
  onRetourAccueil: () => void;
}

const ETATS: Record<InscriptionAttente['statut'], { fr: string; ar: string }> = {
  waiting: {
    fr: 'Vous êtes sur la liste. Nous vous préviendrons dès qu’une place se libère.',
    ar: 'أنت في القائمة. سنُعلمك فور تحرّر موعد.',
  },
  notified: {
    fr: 'Une place vous est réservée en ce moment — regardez votre boîte de réception.',
    ar: 'هناك موعد محجوز لك الآن — تحقّق من بريدك.',
  },
  converti: {
    fr: 'Vous avez pris un rendez-vous. Vous n’êtes plus sur cette liste.',
    ar: 'لقد حجزت موعدًا. لم تعد في هذه القائمة.',
  },
  parti: {
    fr: 'Vous n’êtes plus sur cette liste d’attente.',
    ar: 'لم تعد في قائمة الانتظار هذه.',
  },
};

export default function MonInscriptionAttente({ jeton, onRetourAccueil }: Props) {
  const { language } = useLanguage();
  const isArabic = language === 'ar';

  const [inscription, setInscription] = useState<InscriptionAttente | null>(null);
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [retire, setRetire] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    let vivant = true;
    listeAttenteAPI.lire(jeton)
      .then((i) => { if (vivant) setInscription(i); })
      .catch((e: Error) => { if (vivant) setErreur(e.message); })
      .finally(() => { if (vivant) setChargement(false); });
    return () => { vivant = false; };
  }, [jeton]);

  const seRetirer = async () => {
    setEnvoi(true);
    setErreur('');
    try {
      await listeAttenteAPI.seRetirer(jeton);
      setRetire(true);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Retrait impossible');
    } finally {
      setEnvoi(false);
    }
  };

  if (chargement) {
    return <PageCarte isArabic={isArabic}><Chargement isArabic={isArabic} /></PageCarte>;
  }

  if (!inscription) {
    return (
      <PageCarte isArabic={isArabic}>
        <Entete icone="lienRompu" ton="sourdine" titre={isArabic ? 'رابط غير صالح' : 'Lien invalide ou expiré'} />
        <p className="text-[15px] leading-relaxed mb-6" style={{ color: 'var(--ink-2)' }}>
          {isArabic
            ? 'تحقّق من الرابط في البريد الذي استلمته.'
            : 'Vérifiez le lien dans l’e-mail que vous avez reçu — il est peut-être incomplet.'}
        </p>
        <Bouton onClick={onRetourAccueil}>{isArabic ? 'الذهاب إلى chifak' : 'Aller sur chifak'}</Bouton>
      </PageCarte>
    );
  }

  const encoreEnListe = !retire && (inscription.statut === 'waiting' || inscription.statut === 'notified');
  const message = retire ? ETATS.parti : ETATS[inscription.statut];

  return (
    <PageCarte isArabic={isArabic}>
      <Entete
        icone={encoreEnListe ? 'cloche' : 'coche'}
        ton={encoreEnListe ? 'accent' : 'sourdine'}
        titre={isArabic ? 'قائمة الانتظار' : 'Liste d’attente'}
      />

      {/* Le praticien concerné : c'est la seule chose qui distingue cette
          inscription d'une autre, et elle doit se lire avant le statut. */}
      <div
        className="p-4 mb-4"
        style={{ background: 'var(--accent-bg)', borderRadius: 'var(--r-lg)' }}
      >
        <p className="text-[15px] leading-snug" style={{ color: 'var(--ink)', fontWeight: 600 }}>
          {inscription.doctor_name}
        </p>
        <p className="text-[13px] leading-snug mt-0.5" style={{ color: 'var(--ink-2)' }}>
          {inscription.specialty}
        </p>
      </div>

      <p className="text-[15px] leading-relaxed mb-6" style={{ color: 'var(--ink-2)' }}>
        {isArabic ? message.ar : message.fr}
      </p>

      {erreur && <Alerte>{erreur}</Alerte>}

      {encoreEnListe && (
        <Bouton variante="danger" onClick={seRetirer} disabled={envoi}>
          {envoi
            ? (isArabic ? 'جارٍ…' : 'Retrait…')
            : (isArabic ? 'الخروج من القائمة' : 'Me retirer de la liste')}
        </Bouton>
      )}

      <div className="mt-2.5">
        <Bouton variante="discret" onClick={onRetourAccueil}>
          {isArabic ? 'العودة للرئيسية' : 'Retour à l’accueil'}
        </Bouton>
      </div>
    </PageCarte>
  );
}
