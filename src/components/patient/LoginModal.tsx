import { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { API_URL, AUTH_FACEBOOK_URL, AUTH_GOOGLE_URL } from '../../config';
import { startOAuth } from '../../utils/nativeAuth';
import { motDePasseAPI } from '../../services/motDePasse';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSignup: () => void;
  onLoginSuccess: () => void;
}

/**
 * Trois écrans dans une même fenêtre.
 *
 * `connexion` est le cas normal. `demande` et `code` forment le parcours de
 * récupération, qui n'existait pas : un bouton « Oublié ? » avait même été
 * retiré parce qu'il ne menait à rien. Une personne qui oubliait son mot de
 * passe perdait son compte et tout son historique de rendez-vous,
 * définitivement.
 */
type Etape = 'connexion' | 'demande' | 'code';

const champ = 'w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl '
  + 'focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all '
  + 'text-gray-800 font-bold placeholder:text-gray-300 outline-none';

const etiquette = 'block text-[10px] font-black uppercase tracking-widest text-blue-900/40 ml-1';

export default function LoginModal({ isOpen, onClose, onOpenSignup, onLoginSuccess }: LoginModalProps) {
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const langue = isArabic ? 'ar' : 'fr';

  const [etape, setEtape] = useState<Etape>('connexion');
  /* Champs vides. Ils arrivaient pré-remplis avec le compte de démonstration
     et son mot de passe : chaque patient ouvrait la connexion sur une adresse
     qui n'était pas la sienne, et l'identifiant de démonstration s'affichait
     en clair à tout visiteur. */
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  if (!isOpen) return null;

  const allerA = (suivante: Etape) => {
    setEtape(suivante);
    setError('');
    setInfo('');
  };

  const fermer = () => {
    allerA('connexion');
    setPassword('');
    setCode('');
    setNouveau('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/auth/login-patient`, {
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

  /**
   * Demande d'un code.
   *
   * Le serveur répond la même chose que l'adresse soit inscrite ou non — sur
   * un service de santé, savoir qui possède un compte revient à savoir qui se
   * soigne ici. L'écran affiche donc la même phrase dans tous les cas : la
   * distinguer rétablirait par l'affichage ce que le serveur s'applique à
   * taire.
   */
  const demanderCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await motDePasseAPI.demander(email, langue);
      // `allerA` remet le bandeau à zéro : on le renseigne donc après.
      allerA('code');
      setInfo(isArabic
        ? 'إذا كان هناك حساب بهذا البريد، فقد أُرسل رمز إليه. تحقّق من صندوق الوارد.'
        : 'Si un compte existe pour cette adresse, un code vient d’y être envoyé. Vérifiez votre boîte de réception.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /** Le serveur ouvre la session dans la foulée : rien à ressaisir. */
  const reinitialiser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await motDePasseAPI.reinitialiser(email, code, nouveau, langue);
      localStorage.setItem('chifak_patient_token', data.token);
      localStorage.setItem('chifak_patient_user', JSON.stringify(data.user));
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const titres: Record<Etape, { titre: string; sous: string }> = {
    connexion: {
      titre: isArabic ? 'تسجيل الدخول' : 'Connexion',
      sous: isArabic ? 'مرحباً بك مجدداً' : 'Ravi de vous revoir',
    },
    demande: {
      titre: isArabic ? 'نسيت كلمة المرور' : 'Mot de passe oublié',
      sous: isArabic ? 'سنرسل لك رمزًا' : 'Nous vous envoyons un code',
    },
    code: {
      titre: isArabic ? 'كلمة مرور جديدة' : 'Nouveau mot de passe',
      sous: isArabic ? 'أدخل الرمز المستلم' : 'Saisissez le code reçu',
    },
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={fermer} />

      <div className="relative w-full max-w-md bg-white rounded-4xl shadow-3xl overflow-y-auto max-h-[90vh] animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 to-cyan-400" />

        <div className="p-6 sm:p-10">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h2 className="text-3xl font-black text-gray-900 tracking-tight">{titres[etape].titre}</h2>
              <p className="text-gray-500 font-medium mt-1">{titres[etape].sous}</p>
            </div>
            <button onClick={fermer} aria-label={isArabic ? 'إغلاق' : 'Fermer'} className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {info && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-2xl text-xs font-bold text-blue-700">
              {info}
            </div>
          )}

          {etape === 'connexion' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="cx-email" className={etiquette}>Email</label>
                <input
                  id="cx-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={champ}
                  placeholder="votre@email.dz"
                />
              </div>

              <div className="space-y-2">
                <div className="px-1 flex items-center justify-between gap-3">
                  <label htmlFor="cx-mdp" className="block text-[10px] font-black uppercase tracking-widest text-blue-900/40">
                    {isArabic ? 'كلمة المرور' : 'Mot de passe'}
                  </label>
                  {/* Ce bouton avait été retiré parce qu'il ne menait à rien.
                      Le parcours existe désormais : voir routes/motDePasse.js. */}
                  <button
                    type="button"
                    onClick={() => allerA('demande')}
                    className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:underline"
                  >
                    {isArabic ? 'نسيتها؟' : 'Oublié ?'}
                  </button>
                </div>
                <input
                  id="cx-mdp"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={champ}
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-xs font-bold text-red-600 animate-fadeInUp" role="alert">
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
          )}

          {etape === 'demande' && (
            <form onSubmit={demanderCode} className="space-y-6">
              <p className="text-sm text-gray-500 leading-relaxed">
                {isArabic
                  ? 'أدخل بريدك الإلكتروني. إن وُجد حساب، سنرسل إليه رمزًا صالحًا لمدة 15 دقيقة.'
                  : 'Saisissez votre adresse e-mail. Si un compte existe, nous y envoyons un code valable 15 minutes.'}
              </p>

              <div className="space-y-2">
                <label htmlFor="ou-email" className={etiquette}>Email</label>
                <input
                  id="ou-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={champ}
                  placeholder="votre@email.dz"
                />
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-xs font-bold text-red-600" role="alert">⚠️ {error}</div>
              )}

              <button type="submit" disabled={loading} className="btn-pro w-full py-5 bg-blue-600 text-white font-black uppercase tracking-[0.2em] text-sm rounded-2xl shadow-2xl shadow-blue-600/30 active:scale-[0.98] disabled:opacity-50">
                {loading ? (isArabic ? 'جارٍ الإرسال...' : 'Envoi...') : (isArabic ? 'إرسال الرمز' : 'Envoyer le code')}
              </button>

              <button type="button" onClick={() => allerA('connexion')} className="w-full text-center text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-700">
                {isArabic ? 'العودة لتسجيل الدخول' : 'Retour à la connexion'}
              </button>
            </form>
          )}

          {etape === 'code' && (
            <form onSubmit={reinitialiser} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="rz-code" className={etiquette}>{isArabic ? 'الرمز المستلم' : 'Code reçu'}</label>
                <input
                  id="rz-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  pattern="\d{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className={`${champ} text-center tracking-[0.5em] text-xl`}
                  placeholder="000000"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="rz-mdp" className={etiquette}>{isArabic ? 'كلمة المرور الجديدة' : 'Nouveau mot de passe'}</label>
                <input
                  id="rz-mdp"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={nouveau}
                  onChange={(e) => setNouveau(e.target.value)}
                  className={champ}
                  placeholder="••••••••"
                />
                <p className="text-[11px] text-gray-400 px-1">
                  {isArabic ? '8 أحرف على الأقل، مع أرقام وحروف.' : 'Au moins 8 caractères, avec des lettres et des chiffres.'}
                </p>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-xs font-bold text-red-600" role="alert">⚠️ {error}</div>
              )}

              <button type="submit" disabled={loading} className="btn-pro w-full py-5 bg-blue-600 text-white font-black uppercase tracking-[0.2em] text-sm rounded-2xl shadow-2xl shadow-blue-600/30 active:scale-[0.98] disabled:opacity-50">
                {loading ? (isArabic ? 'جارٍ الحفظ...' : 'Enregistrement...') : (isArabic ? 'حفظ والدخول' : 'Enregistrer et se connecter')}
              </button>

              <button type="button" onClick={() => allerA('demande')} className="w-full text-center text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-700">
                {isArabic ? 'إعادة إرسال الرمز' : 'Renvoyer un code'}
              </button>
            </form>
          )}

          {etape === 'connexion' && (
            <div className="mt-10 pt-8 border-t border-gray-50">
              <p className="text-center text-sm font-medium text-gray-500 mb-8">
                {isArabic ? 'ليس لديك حساب؟' : 'Nouveau sur chifak ?'}
                <button onClick={onOpenSignup} className="ml-2 text-blue-600 font-black uppercase tracking-widest text-[10px] hover:underline">
                  {isArabic ? 'إنشاء حساب' : 'Créer un compte'}
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
          )}
        </div>
      </div>
    </div>
  );
}
