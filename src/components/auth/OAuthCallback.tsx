import { useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { API_URL } from '../../config';
import { parseJwtPayload } from '../../utils/auth';

interface OAuthCallbackProps {
  onComplete: () => void;
}

export default function OAuthCallback({ onComplete }: OAuthCallbackProps) {
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const authError = params.get('auth_error');

    if (authError) {
      setError(
        isArabic
          ? 'فشل تسجيل الدخول. حاول مرة أخرى أو استخدم البريد الإلكتروني.'
          : 'Échec de la connexion. Réessayez ou utilisez votre email.'
      );
      return;
    }

    if (!token) {
      setError(isArabic ? 'رابط غير صالح' : 'Lien invalide');
      return;
    }

    const finish = async () => {
      localStorage.setItem('chifak_patient_token', token);

      const nameFromUrl = params.get('name');
      const emailFromUrl = params.get('email');
      const payload = parseJwtPayload(token);

      let user = {
        id: payload?.id as number | undefined,
        email: emailFromUrl || (payload?.email as string) || '',
        name: nameFromUrl || '',
      };

      try {
        const profileRes = await fetch(`${API_URL}/patient/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (profileRes.ok) {
          const profile = await profileRes.json();
          user = {
            id: profile.id,
            email: profile.email,
            name: profile.name || user.name,
          };
        }
      } catch {
        // Profil optionnel si l'API est indisponible
      }

      if (!user.name && user.email) {
        user.name = user.email.split('@')[0];
      }

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
