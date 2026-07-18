import { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { appointmentsAPI } from '../services/api';
import { API_URL, AUTH_FACEBOOK_URL, AUTH_GOOGLE_URL } from '../config';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSignup: () => void;
  onLoginSuccess: () => void;
}

export default function LoginModal({ isOpen, onClose, onOpenSignup, onLoginSuccess }: LoginModalProps) {
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const [email, setEmail] = useState('demo.patient@chifak.dz');
  const [password, setPassword] = useState('patient123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erreur de connexion');

      localStorage.setItem('chifak_patient_token', data.token);
      localStorage.setItem('chifak_patient_user', JSON.stringify(data.user));
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-white rounded-4xl shadow-3xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 to-cyan-400" />
        
        <div className="p-8 sm:p-10">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h2 className="text-3xl font-black text-gray-900 tracking-tight">{isArabic ? 'تسجيل الدخول' : 'Connexion'}</h2>
              <p className="text-gray-500 font-medium mt-1">{isArabic ? 'مرحباً بك مجدداً' : 'Ravi de vous revoir'}</p>
            </div>
            <button onClick={onClose} className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-widest text-blue-900/40 ml-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all text-gray-800 font-bold placeholder:text-gray-300 outline-none"
                placeholder="votre@email.dz"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="block text-[10px] font-black uppercase tracking-widest text-blue-900/40">Mot de passe</label>
                <button type="button" className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:underline">Oublié ?</button>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all text-gray-800 font-bold placeholder:text-gray-300 outline-none"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-xs font-bold text-red-600 animate-fadeInUp">
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-pro w-full py-5 bg-blue-600 text-white font-black uppercase tracking-[0.2em] text-sm rounded-2xl shadow-2xl shadow-blue-600/30 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (isArabic ? 'جاري التحميل...' : 'Connexion...') : (isArabic ? 'دخول' : 'Se connecter')}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-gray-50">
            <p className="text-center text-sm font-medium text-gray-500 mb-8">
              {isArabic ? 'ليس لديك حساب؟' : 'Nouveau sur chifak ?'}
              <button onClick={onOpenSignup} className="ml-2 text-blue-600 font-black uppercase tracking-widest text-[10px] hover:underline">
                {isArabic ? 'إنشاء حساب' : 'Créer un compte'}
              </button>
            </p>

            <div className="grid grid-cols-2 gap-4">
              <a href={AUTH_GOOGLE_URL} className="flex items-center justify-center gap-3 px-4 py-4 border-2 border-gray-50 rounded-2xl hover:bg-gray-50 transition-all group">
                <span className="text-lg">G</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 group-hover:text-gray-900">Google</span>
              </a>
              <a href={AUTH_FACEBOOK_URL} className="flex items-center justify-center gap-3 px-4 py-4 border-2 border-gray-50 rounded-2xl hover:bg-gray-50 transition-all group">
                <span className="text-lg text-blue-600">f</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 group-hover:text-gray-900">Facebook</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
