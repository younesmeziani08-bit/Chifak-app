import { useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { API_URL } from '../../config';
/* `parseJwtPayload` n'est plus utilisé ici : l'identité vient de la réponse du
   serveur, pas du contenu du jeton. Lire un jeton côté navigateur ne prouve
   rien — sa charge utile se lit sans clé, et se réécrit tout aussi bien. */

interface OAuthCallbackProps {
  onComplete: () => void;
}

export default function OAuthCallback({ onComplete }: OAuthCallbackProps) {
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const [error, setError] = useState('');

  useEffect(() => {
    /* ── Le jeton arrive par le FRAGMENT ──
       Une chaîne de requête est journalisée par l'hébergeur, par les caches
       intermédiaires, et repart dans le Referer de la première ressource que
       charge la page. Le fragment ne quitte jamais le navigateur.

       La chaîne de requête reste lue en second : le serveur et l'application
       se déploient séparément, et pendant le temps où l'un est à jour et pas
       l'autre, personne ne doit se retrouver devant une connexion cassée.
       Les motifs d'erreur, eux, n'ont rien de confidentiel et restent en
       clair dans l'adresse. */
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const params = new URLSearchParams(window.location.search);
    const token = fragment.get('token') || params.get('token');
    const authError = params.get('auth_error');

    if (authError) {
      /* Le serveur joint désormais un motif quand il en a un — par exemple
         qu'un compte existe déjà avec cette adresse et qu'il faut passer par
         le mot de passe. Sans lui, la personne relance indéfiniment la même
         connexion sociale qui ne peut pas aboutir. */
      const motif = params.get('motif');
      setError(motif || (isArabic
        ? 'فشل تسجيل الدخول. حاول مرة أخرى أو استخدم البريد الإلكتروني.'
        : 'Échec de la connexion. Réessayez ou utilisez votre e-mail.'));
      return;
    }

    if (!token) {
      setError(isArabic ? 'رابط غير صالح' : 'Lien invalide');
      return;
    }

    const finish = async () => {
      /* ── Le jeton est éprouvé AVANT d'être conservé ──
         L'ancienne version l'enregistrait dès son arrivée, puis tentait de
         lire le profil. Deux conséquences. Un jeton refusé restait en place :
         l'application se croyait connectée et chaque appel repartait en 403,
         sans que rien n'explique pourquoi. Et n'importe quelle adresse de la
         forme « /auth/callback?token=… » suffisait à déposer un jeton dans le
         navigateur de quelqu'un — un lien envoyé par message, et la victime
         se retrouvait dans le compte de l'expéditeur sans s'en apercevoir.

         Ici, le jeton n'est retenu que si le serveur reconnaît son porteur.
         L'identité affichée vient de cette réponse, jamais de l'adresse : les
         paramètres « name » et « email » de l'URL se réécrivent d'un clic. */
      let profil: { id: number; email: string; name?: string } | null = null;
      try {
        const reponse = await fetch(`${API_URL}/patient/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (reponse.ok) profil = await reponse.json();
      } catch {
        /* Réseau injoignable : traité comme un échec ci-dessous. */
      }

      if (!profil) {
        setError(isArabic
          ? 'تعذّر إتمام تسجيل الدخول. حاول مرة أخرى.'
          : 'La connexion n’a pas pu être finalisée. Réessayez.');
        return;
      }

      const user = {
        id: profil.id,
        email: profil.email,
        name: profil.name || profil.email.split('@')[0],
      };

      localStorage.setItem('chifak_patient_token', token);
      localStorage.setItem('chifak_patient_user', JSON.stringify(user));
      window.history.replaceState({}, '', '/');
      onComplete();
    };

    finish();
  }, [isArabic, onComplete]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <a href="/" className="text-blue-600 font-semibold hover:underline">
            {isArabic ? 'العودة للرئيسية' : "Retour à l'accueil"}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4" />
        <p className="text-gray-600">
          {isArabic ? 'جاري تسجيل الدخول...' : 'Connexion en cours...'}
        </p>
      </div>
    </div>
  );
}
