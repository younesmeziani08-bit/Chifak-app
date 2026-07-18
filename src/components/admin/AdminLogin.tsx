import { useState } from 'react';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import LanguageToggle from '../LanguageToggle';
import FloatingShapes from '../FloatingShapes';

interface AdminLoginProps {
  onLoginSuccess: () => void;
  onBackToHome: () => void;
}

export default function AdminLogin({ onLoginSuccess, onBackToHome }: AdminLoginProps) {
  const { login } = useAdminAuth();
  const { language } = useLanguage();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const isArabic = language === 'ar';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const success = await login(username, password);
    if (success) {
      onLoginSuccess();
    } else {
      setError(isArabic ? 'اسم المستخدم أو كلمة المرور غير صحيحة' : 'Identifiants incorrects');
    }
    setLoading(false);
  };

  const demoAccounts = [
    { user: 'admin', pass: 'chifak2026', role: isArabic ? 'مسؤول' : 'Administrateur' },
    { user: 'employee1', pass: 'chifak123', role: isArabic ? 'موظف 1' : 'Employé 1' },
    { user: 'employee2', pass: 'chifak456', role: isArabic ? 'موظف 2' : 'Employé 2' },
  ];

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

          {/* Demo accounts */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <button
              onClick={() => setShowDemo(!showDemo)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 mx-auto"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {isArabic ? 'عرض بيانات الدخول التجريبية' : 'Afficher les comptes de démo'}
            </button>

            {showDemo && (
              <div className="mt-4 space-y-2">
                {demoAccounts.map((acc, i) => (
                  <button
                    key={i}
                    onClick={() => { setUsername(acc.user); setPassword(acc.pass); }}
                    className="w-full flex items-center justify-between text-xs bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 rounded-xl px-4 py-2.5 transition"
                  >
                    <span className="font-semibold text-gray-700">{acc.role}</span>
                    <span className="font-mono text-gray-500">{acc.user} / {acc.pass}</span>
                  </button>
                ))}
                <p className="text-xs text-gray-400 text-center mt-2">
                  {isArabic ? 'انقر على الحساب لملء البيانات تلقائيًا' : 'Cliquez pour remplir automatiquement'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
