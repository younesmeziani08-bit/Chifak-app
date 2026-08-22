import { useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { listeAttenteAPI, type InscriptionAttente } from '../../services/listeAttente';

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

  const cadre = (contenu: React.ReactNode) => (
    <div
      className="min-h-screen flex items-start sm:items-center justify-center p-4 py-8"
      style={{ background: 'var(--bg-2)' }}
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-6 sm:p-8">{contenu}</div>
    </div>
  );

  if (chargement) {
    return cadre(
      <div className="text-center py-10">
        <div className="inline-block animate-spin rounded-full h-9 w-9 border-b-2 border-blue-600 mb-3" />
        <p className="text-sm text-gray-500">{isArabic ? 'جارٍ التحميل…' : 'Chargement…'}</p>
      </div>,
    );
  }

  if (!inscription) {
    return cadre(
      <div className="text-center py-6">
        <div className="text-4xl mb-4" aria-hidden="true">🔗</div>
        <h1 className="text-xl font-black text-gray-900 mb-2">
          {isArabic ? 'رابط غير صالح' : 'Lien invalide ou expiré'}
        </h1>
        <button
          type="button"
          onClick={onRetourAccueil}
          className="w-full mt-5 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold"
        >
          {isArabic ? 'الذهاب إلى chifak' : 'Aller sur chifak'}
        </button>
      </div>,
    );
  }

  const encoreEnListe = !retire && (inscription.statut === 'waiting' || inscription.statut === 'notified');
  const message = retire ? ETATS.parti : ETATS[inscription.statut];

  return cadre(
    <>
      <div className="text-center mb-6">
        <div className="text-4xl mb-3" aria-hidden="true">{encoreEnListe ? '🔔' : '✓'}</div>
        <h1 className="text-xl font-black text-gray-900 tracking-tight">
          {isArabic ? 'قائمة الانتظار' : 'Liste d’attente'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {inscription.doctor_name} · {inscription.specialty}
        </p>
      </div>

      <div className="rounded-2xl p-4 mb-6" style={{ background: 'var(--bg-2)' }}>
        <p className="text-sm text-gray-700 leading-relaxed text-center">
          {isArabic ? message.ar : message.fr}
        </p>
      </div>

      {erreur && (
        <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-2xl text-sm font-medium text-red-600" role="alert">
          {erreur}
        </div>
      )}

      {encoreEnListe ? (
        <button
          type="button"
          onClick={seRetirer}
          disabled={envoi}
          className="w-full py-3.5 border-2 border-red-200 text-red-600 rounded-2xl font-bold text-sm hover:bg-red-50 disabled:opacity-50 transition-colors"
        >
          {envoi
            ? (isArabic ? 'جارٍ…' : 'Retrait…')
            : (isArabic ? 'الخروج من القائمة' : 'Me retirer de la liste')}
        </button>
      ) : null}

      <button
        type="button"
        onClick={onRetourAccueil}
        className="w-full mt-3 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-700"
      >
        {isArabic ? 'العودة للرئيسية' : 'Retour à l’accueil'}
      </button>
    </>,
  );
}
