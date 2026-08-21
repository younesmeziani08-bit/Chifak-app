import { useState } from 'react';
import { API_URL, AUTH_FACEBOOK_URL, AUTH_GOOGLE_URL } from '../../config';
import { startOAuth } from '../../utils/nativeAuth';
import { useLanguage } from '../../contexts/LanguageContext';

interface SignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenLogin: () => void;
  onSuccess: () => void;
}

export default function SignupModal({ isOpen, onClose, onOpenLogin, onSuccess }: SignupModalProps) {
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [verificationCode, setVerificationCode] = useState('');
  const [renvoi, setRenvoi] = useState('');

  if (!isOpen) return null;

  /* Une réponse d'erreur n'est pas toujours du JSON : une passerelle en panne
     renvoie du HTML, et `res.json()` remplace alors le vrai problème par un
     « Unexpected token < » que personne ne peut comprendre. */
  const lireErreur = async (res: Response, defaut: string) => {
    const detail = await res.json().catch(() => null);
    return detail?.error || `${defaut} (${res.status})`;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError(isArabic ? 'كلمات المرور غير متطابقة' : 'Les mots de passe ne correspondent pas');
      return;
    }
    setLoading(true);
    setError('');
    try {
      /* Route « register », et non « signup » : ce formulaire appelait une
         adresse qui n'existe pas côté serveur. Toute inscription se terminait
         donc sur « Route introuvable », quels que soient les champs saisis. */
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          language,
        }),
      });
      if (!res.ok) throw new Error(await lireErreur(res, 'Inscription impossible'));
      setStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      /* « verify-code » : « /auth/verify » est la route qui contrôle un jeton
         déjà émis, en GET. L'appeler en POST tombait sur le filet à 404. */
      const res = await fetch(`${API_URL}/auth/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, code: verificationCode })
      });
      if (!res.ok) throw new Error(await lireErreur(res, 'Code refusé'));
      const data = await res.json();

      localStorage.setItem('chifak_patient_token', data.token);
      localStorage.setItem('chifak_patient_user', JSON.stringify(data.user));
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /* Le bouton « Renvoyer le code » n'était relié à rien. Un code perdu ou
     expiré laissait le compte inachevé, sans aucun moyen d'aboutir. */
  const handleResend = async () => {
    setLoading(true);
    setError('');
    setRenvoi('');
    try {
      const res = await fetch(`${API_URL}/auth/resend-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, language }),
      });
      if (!res.ok) throw new Error(await lireErreur(res, 'Envoi impossible'));
      setRenvoi(isArabic ? 'تم إرسال رمز جديد.' : 'Un nouveau code vient d’être envoyé.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
      
      <div className="relative w-full max-w-lg bg-white rounded-4xl shadow-3xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 to-cyan-400" />
        
        <div className="p-8 sm:p-10">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-3xl font-black text-gray-900 tracking-tight">
                {step === 1 ? (isArabic ? 'إنشاء حساب' : 'Inscription') : (isArabic ? 'تأكيد الحساب' : 'Vérification')}
              </h2>
              <p className="text-gray-500 font-medium mt-1">
                {step === 1 ? (isArabic ? 'انضم إلى مجتمع شفاك' : 'Rejoignez la santé de demain') : (isArabic ? 'أدخل الرمز المرسل' : 'Saisissez le code reçu par mail')}
              </p>
            </div>
            <button onClick={onClose} className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {step === 1 ? (
            <div className="space-y-8">
              <form onSubmit={handleSignup} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2 sm:col-span-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-blue-900/40 ml-1">{isArabic ? 'الاسم الكامل' : 'Nom complet'}</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all text-gray-800 font-bold placeholder:text-gray-300 outline-none"
                      placeholder="Ex: Karim Benali"
                    />
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-blue-900/40 ml-1">Email</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all text-gray-800 font-bold placeholder:text-gray-300 outline-none"
                      placeholder="karim@email.dz"
                    />
                  </div>

                  {/* ── Téléphone ──
                      Obligatoire ici, et c'est délibéré : les coordonnées du
                      rendez-vous sont relues sur le compte, jamais saisies au
                      moment de réserver. Un compte sans numéro menait donc à
                      un bouton « Finaliser » qui ne répondait pas. */}
                  <div className="space-y-2 sm:col-span-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-blue-900/40 ml-1">
                      {isArabic ? 'الهاتف' : 'Téléphone'}
                    </label>
                    <input
                      type="tel"
                      required
                      autoComplete="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all text-gray-800 font-bold placeholder:text-gray-300 outline-none"
                      placeholder="0555 12 34 56"
                    />
                    <p className="text-[11px] text-gray-400 ml-1">
                      {isArabic
                        ? 'يستعمله الطبيب للاتصال بك عند الحاجة.'
                        : 'Le cabinet s’en sert pour vous joindre en cas de besoin.'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-blue-900/40 ml-1">{isArabic ? 'كلمة المرور' : 'Mot de passe'}</label>
                    <input
                      type="password"
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all text-gray-800 font-bold placeholder:text-gray-300 outline-none"
                      placeholder="••••••••"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-blue-900/40 ml-1">{isArabic ? 'تأكيد كلمة المرور' : 'Confirmation'}</label>
                    <input
                      type="password"
                      required
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all text-gray-800 font-bold placeholder:text-gray-300 outline-none"
                      placeholder="••••••••"
                    />
                  </div>
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
                  {loading ? (isArabic ? 'جاري المعالجة...' : 'Création...') : (isArabic ? 'إنشاء الحساب' : 'S\'inscrire gratuitement')}
                </button>
              </form>

              <div className="pt-8 border-t border-gray-50">
                <p className="text-center text-sm font-medium text-gray-500 mb-8">
                  {isArabic ? 'لديك حساب بالفعل؟' : 'Déjà inscrit ?'}
                  <button onClick={onOpenLogin} className="ml-2 text-blue-600 font-black uppercase tracking-widest text-[10px] hover:underline">
                    {isArabic ? 'تسجيل الدخول' : 'Se connecter'}
                  </button>
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <button type="button" onClick={() => startOAuth(AUTH_GOOGLE_URL)} className="flex items-center justify-center gap-3 px-4 py-4 border-2 border-gray-50 rounded-2xl hover:bg-gray-50 transition-all group">
                    <span className="text-lg">G</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 group-hover:text-gray-900">Google</span>
                  </button>
                  <button type="button" onClick={() => startOAuth(AUTH_FACEBOOK_URL)} className="flex items-center justify-center gap-3 px-4 py-4 border-2 border-gray-50 rounded-2xl hover:bg-gray-50 transition-all group">
                    <span className="text-lg text-blue-600">f</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 group-hover:text-gray-900">Facebook</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleVerify} className="space-y-8 animate-fadeInUp">
              <div className="p-6 bg-blue-50 border border-blue-100 rounded-3xl text-sm font-bold text-blue-800 text-center">
                {isArabic ? `لقد أرسلنا رمزاً إلى ${formData.email}` : `Un code de confirmation a été envoyé à ${formData.email}`}
              </div>

              <div className="space-y-4 text-center">
                <label className="block text-[10px] font-black uppercase tracking-widest text-blue-900/40">{isArabic ? 'رمز التحقق' : 'Code de vérification'}</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center text-4xl tracking-[0.5em] py-6 bg-gray-50 border-2 border-transparent rounded-3xl focus:bg-white focus:border-blue-500 transition-all font-black text-blue-700 outline-none"
                  placeholder="000000"
                />
              </div>

              {error && (
                <div role="alert" className="p-4 bg-red-50 border border-red-100 rounded-2xl text-xs font-bold text-red-600">
                  ⚠️ {error}
                </div>
              )}

              {renvoi && (
                <div role="status" className="p-4 bg-green-50 border border-green-100 rounded-2xl text-xs font-bold text-green-700">
                  {renvoi}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || verificationCode.length !== 6}
                className="btn-pro w-full py-5 bg-blue-600 text-white font-black uppercase tracking-[0.2em] text-sm rounded-2xl shadow-2xl shadow-blue-600/30 active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? (isArabic ? 'جاري التأكيد...' : 'Vérification...') : (isArabic ? 'تأكيد' : 'Vérifier mon compte')}
              </button>

              <button
                type="button"
                onClick={handleResend}
                disabled={loading}
                className="w-full text-[10px] font-black uppercase tracking-widest text-blue-600 hover:underline disabled:opacity-40"
              >
                {isArabic ? 'إعادة إرسال الرمز' : 'Renvoyer le code'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
