import { useState } from 'react';
import { useAdminAuth } from '../AdminAuthContext';
import { useLanguage } from '../../src/contexts/LanguageContext';
import LanguageToggle from '../../src/components/shared/LanguageToggle';
import FloatingShapes from '../../src/components/home/FloatingShapes';

interface AdminLoginProps {
  onLoginSuccess: () => void;
  onBackToHome: () => void;
}

export default function AdminLogin({ onLoginSuccess, onBackToHome }: AdminLoginProps) {
  const { login, validerCode, derniereErreur } = useAdminAuth();
  const { language } = useLanguage();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  /* Deux temps : le mot de passe, puis le code. Tant que « code » n'est pas
     atteint, aucune session n'existe. */
  const [etape, setEtape] = useState<'identifiants' | 'code'>('identifiants');
  const [code, setCode] = useState('');
  const isArabic = language === 'ar';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const resultat = await login(username, password);
    if (resultat.etat === 'ouverte') {
      onLoginSuccess();
    } else if (resultat.etat === 'code-attendu') {
      /* Le mot de passe est juste, mais aucune session n'existe encore :
         le serveur n'a rendu qu'un jeton intermédiaire de cinq minutes. */
      setEtape('code');
    } else {
      /* Le message du serveur, s'il en a fourni un. Le libellé figé
         « identifiants incorrects » masquait le freinage après plusieurs
         échecs : la personne réessayait indéfiniment sans jamais apprendre
         qu'elle devait attendre quelques minutes. */
      setError(derniereErreur
        || (isArabic ? 'اسم المستخدم أو كلمة المرور غير صحيحة' : 'Identifiants incorrects'));
    }
    setLoading(false);
  };

  const handleCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    if (await validerCode(code)) {
      onLoginSuccess();
    } else {
      setError(derniereErreur || (isArabic ? 'رمز غير صحيح' : 'Code incorrect'));
      setCode('');
    }
    setLoading(false);
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 flex items-center justify-center p-4 overflow-hidden" dir={isArabic ? 'rtl' : 'ltr'}>
      <FloatingShapes variant="admin" />
      <button
        type="button"
        onClick={onBackToHome}
        className={`absolute top-6 flex items-center gap-2 text-white/90 hover:text-white font-medium text-sm transition ${isArabic ? 'right-6' : 'left-6'}`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={isArabic ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'}
          />
        </svg>
        {isArabic ? 'العودة للرئيسية' : "Retour à l'accueil"}
      </button>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <button
            type="button"
            onClick={onBackToHome}
            className="inline-flex items-center gap-3 mb-6 mx-auto hover:opacity-90 transition rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <span className="h-12 w-12 flex items-center justify-center bg-white rounded-xl text-2xl shadow">🏥</span>
            <span className="text-3xl font-extrabold text-white uppercase tracking-tight">CHIFAK</span>
          </button>
          <div className="flex justify-center mb-4">
            <LanguageToggle />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">
            {isArabic ? 'مساحة الموظفين' : 'Espace Employés'}
          </h1>
          <p className="text-blue-100 text-sm">
            {isArabic ? 'قم بتسجيل الدخول للمتابعة' : 'Connectez-vous pour continuer'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          {/* ── Second temps : le code ──
              Écran distinct plutôt que champ supplémentaire. Le mot de passe
              est déjà validé et n'a plus à rester à l'écran ; le clavier des
              téléphones s'ouvre en mode numérique ; et l'erreur qui s'affiche
              ici ne peut porter que sur le code. */}
          {etape === 'code' ? (
            <form onSubmit={handleCode} className="space-y-5">
              <div className="text-center">
                <span className="inline-flex w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 items-center justify-center mb-3">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                  </svg>
                </span>
                <h2 className="text-lg font-bold text-gray-900">
                  {isArabic ? 'رمز التحقق' : 'Code de vérification'}
                </h2>
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                  {isArabic
                    ? 'أدخل الرمز المعروض في تطبيق المصادقة الخاص بك.'
                    : 'Saisissez le code affiché par votre application d’authentification.'}
                </p>
              </div>

              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9A-Za-z-]/g, '').toUpperCase())}
                maxLength={11}
                required
                className="w-full text-center text-3xl tracking-[0.4em] py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition font-mono"
                placeholder="000000"
              />

              {error && (
                <div role="alert" className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || code.length < 6}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold rounded-xl transition shadow-lg text-lg"
              >
                {loading
                  ? (isArabic ? 'جاري التحقق...' : 'Vérification...')
                  : (isArabic ? 'تأكيد' : 'Valider')}
              </button>

              <p className="text-xs text-gray-500 text-center leading-relaxed">
                {isArabic
                  ? 'فقدت هاتفك؟ أدخل أحد رموز الطوارئ التي حفظتها عند التفعيل.'
                  : 'Téléphone perdu ? Saisissez l’un des codes de secours notés lors de l’activation.'}
              </p>

              <button
                type="button"
                onClick={() => { setEtape('identifiants'); setCode(''); setError(''); setPassword(''); }}
                className="w-full text-sm text-gray-500 hover:text-gray-700"
              >
                {isArabic ? 'العودة' : 'Retour'}
              </button>
            </form>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {isArabic ? 'اسم المستخدم' : "Nom d'utilisateur"}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  placeholder={isArabic ? 'أدخل اسم المستخدم' : "Entrez votre nom d'utilisateur"}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {isArabic ? 'كلمة المرور' : 'Mot de passe'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold rounded-xl transition shadow-lg text-lg"
            >
              {loading
                ? (isArabic ? 'جاري التحقق...' : 'Vérification...')
                : (isArabic ? 'تسجيل الدخول' : 'Se connecter')}
            </button>
          </form>
          )}

          {/* Le panneau « comptes de démonstration » a été supprimé.
              Il affichait, sur la page de connexion publique, trois
              identifiants d'administration complets — et un clic les
              recopiait dans le formulaire. Ces mots de passe étaient de plus
              écrits dans le fichier JavaScript livré à chaque visiteur.
              Un identifiant de test se transmet de la main à la main ; il ne
              s'imprime pas sur la porte. */}
        </div>
      </div>
    </div>
  );
}
