import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { assistantAPI, AssistantMessage } from '../services/api';

// Petit robot médecin (blouse blanche + stéthoscope)
function RobotMascot({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 128" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Antenne */}
      <line x1="60" y1="26" x2="60" y2="16" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
      <circle cx="60" cy="12" r="4.5" fill="#0e75c4" />
      {/* Oreilles / boulons */}
      <rect x="27" y="42" width="6" height="14" rx="3" fill="#cbd5e1" />
      <rect x="87" y="42" width="6" height="14" rx="3" fill="#cbd5e1" />
      {/* Tête */}
      <rect x="32" y="26" width="56" height="44" rx="15" fill="#eef2f7" stroke="#cbd5e1" strokeWidth="2.5" />
      {/* Visage (écran) */}
      <rect x="39" y="34" width="42" height="28" rx="11" fill="#0f2a4a" />
      {/* Yeux */}
      <circle cx="52" cy="48" r="4.5" fill="#7dd3fc" />
      <circle cx="68" cy="48" r="4.5" fill="#7dd3fc" />
      <circle cx="53.5" cy="46.5" r="1.4" fill="#fff" />
      <circle cx="69.5" cy="46.5" r="1.4" fill="#fff" />
      {/* Sourire */}
      <path d="M53 55 Q60 60 67 55" stroke="#7dd3fc" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      {/* Cou */}
      <rect x="54" y="69" width="12" height="7" fill="#cbd5e1" />
      {/* Blouse blanche */}
      <path d="M28 118 C28 92 40 78 60 78 C80 78 92 92 92 118 Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2.5" strokeLinejoin="round" />
      {/* Bras */}
      <rect x="22" y="86" width="9" height="24" rx="4.5" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="2" />
      <rect x="89" y="86" width="9" height="24" rx="4.5" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="2" />
      {/* Col de la blouse */}
      <path d="M60 78 L51 96 L60 92 Z" fill="#eef2f7" stroke="#cbd5e1" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M60 78 L69 96 L60 92 Z" fill="#eef2f7" stroke="#cbd5e1" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Poche */}
      <rect x="72" y="100" width="12" height="10" rx="2" fill="none" stroke="#cbd5e1" strokeWidth="1.8" />
      {/* Stéthoscope */}
      <path d="M50 82 C46 98 50 108 60 108 C70 108 72 100 72 96" stroke="#0e75c4" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="50" cy="81" r="2.6" fill="#0e75c4" />
      <circle cx="72" cy="95" r="5" fill="#0e75c4" />
      <circle cx="72" cy="95" r="2" fill="#7dd3fc" />
    </svg>
  );
}

export default function AssistantChat() {
  const { language } = useLanguage();
  const isArabic = language === 'ar';

  const [open, setOpen] = useState(false);
  const [bubbleOpen, setBubbleOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
  const [viewport, setViewport] = useState<{ height: number; top: number } | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const welcome = isArabic
    ? 'مرحبًا! أنا مساعد شفاك الصحي. صِف لي ما تشعر به (مكان الألم، منذ متى، شدّته) وسأوجّهك إلى التخصّص المناسب وأنصحك بما تفعله في انتظار الطبيب.'
    : "Bonjour ! Je suis l'assistant santé chifak. Décrivez-moi ce que vous ressentez (où, depuis quand, l'intensité) et je vous orienterai vers la bonne spécialité, avec des conseils en attendant le médecin.";

  const suggestions = isArabic
    ? ['عندي صداع منذ يومين', 'ألم في الأسنان', 'كيف أحجز موعدًا؟']
    : ['J\'ai mal à la tête depuis 2 jours', 'Une douleur dentaire', 'Comment prendre rendez-vous ?'];

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, open]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  // Invitation proactive : la bulle apparaît peu après le chargement de la page
  useEffect(() => {
    const t = setTimeout(() => setBubbleOpen((prev) => (open ? prev : true)), 1400);
    return () => clearTimeout(t);
  }, [open]);

  const openChat = () => { setOpen(true); setBubbleOpen(false); };

  // Détecte le mobile pour adapter la mise en page du panneau
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Suit la zone réellement visible (au-dessus du clavier) pour garder la barre d'écriture accessible
  useEffect(() => {
    const vv = window.visualViewport;
    if (!open || !isMobile || !vv) { setViewport(null); return; }
    const update = () => setViewport({ height: vv.height, top: vv.offsetTop });
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [open, isMobile]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || loading) return;
    setError('');
    const next: AssistantMessage[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const reply = await assistantAPI.chat(next);
      setMessages([...next, { role: 'assistant', content: reply }]);
    } catch (err: any) {
      setError(err.message || (isArabic ? 'حدث خطأ. حاول مرة أخرى.' : 'Une erreur est survenue. Réessayez.'));
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  // Position/taille du panneau. Sur mobile : petite fenêtre en bas qui remonte au-dessus du clavier.
  const layoutH = typeof window !== 'undefined' ? window.innerHeight : 800;
  const panelStyle: React.CSSProperties = isMobile
    ? (() => {
        const visH = viewport ? viewport.height : layoutH;
        const keyboard = viewport ? Math.max(0, layoutH - viewport.height - viewport.top) : 0;
        const height = Math.min(Math.round(layoutH * 0.6), visH - 16);
        return { left: '10px', right: '10px', bottom: `${keyboard + 10}px`, top: 'auto', height: `${height}px` };
      })()
    : ({ [isArabic ? 'left' : 'right']: '20px' } as React.CSSProperties);

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'}>
      {/* Keyframes de flottement */}
      <style>{`
        @keyframes chifakFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }
        @keyframes chifakBubbleIn { from { opacity: 0; transform: translateY(6px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>

      {/* Robot flottant + bulle d'invitation */}
      {!open && (
        <div
          className="fixed bottom-5 z-[90] flex flex-col items-end gap-2"
          style={{ [isArabic ? 'left' : 'right']: '18px', alignItems: isArabic ? 'flex-start' : 'flex-end' } as React.CSSProperties}
        >
          {/* Bulle d'invitation */}
          {bubbleOpen && (
            <div
              className="relative max-w-[220px] bg-white rounded-2xl shadow-xl border border-gray-100 px-4 py-3 mb-1"
              style={{ animation: 'chifakBubbleIn 0.35s ease-out both' }}
            >
              <button
                onClick={(e) => { e.stopPropagation(); setBubbleOpen(false); }}
                aria-label={isArabic ? 'إغلاق' : 'Fermer'}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200 transition-colors shadow"
                style={isArabic ? { right: 'auto', left: '-8px' } : undefined}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
              <button onClick={openChat} className="text-start">
                <p className="text-sm font-semibold text-gray-800 leading-snug">
                  {isArabic ? 'مرحبًا! هل لديك سؤال صحي؟' : 'Bonjour ! Une question de santé ?'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {isArabic ? 'لنتحدّث قبل أن تبدأ.' : 'Discutons-en avant de commencer.'}
                </p>
              </button>
            </div>
          )}

          {/* Le robot */}
          <button
            onClick={openChat}
            aria-label={isArabic ? 'المساعد الصحي' : 'Assistant santé'}
            className="relative transition-transform hover:scale-105 active:scale-95 focus:outline-none"
            style={{ animation: 'chifakFloat 3s ease-in-out infinite' }}
          >
            {/* Ombre douce au sol */}
            <span className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-12 h-2.5 rounded-full bg-black/10 blur-[3px]" />
            {/* Halo */}
            <span className="absolute inset-0 rounded-full" style={{ boxShadow: '0 10px 30px rgba(14,117,196,0.28)' }} />
            <span className="relative block rounded-full bg-white p-1.5 shadow-lg border border-gray-100">
              <RobotMascot size={62} />
            </span>
            {/* Pastille de notification */}
            {!bubbleOpen && (
              <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" />
            )}
          </button>
        </div>
      )}

      {/* Panneau de chat */}
      {open && (
        <div
          className="fixed z-[95] bg-white shadow-2xl flex flex-col overflow-hidden border border-gray-100 rounded-2xl
                     sm:left-auto sm:top-auto sm:bottom-5 sm:w-[390px] sm:h-[560px] sm:max-h-[85vh]"
          style={panelStyle}
        >
          {/* En-tête */}
          <div className="flex items-center justify-between px-4 py-3 text-white" style={{ background: 'var(--accent, #0e75c4)' }}>
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 21s-7-4.5-7-10a4 4 0 018-1 4 4 0 018 1c0 5.5-9 10-9 10z" />
                </svg>
              </span>
              <div>
                <p className="font-bold text-sm leading-tight">{isArabic ? 'المساعد الصحي' : 'Assistant santé'}</p>
                <p className="text-[11px] text-white/80 leading-tight">{isArabic ? 'توجيه ونصائح' : 'Orientation & conseils'}</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label={isArabic ? 'إغلاق' : 'Fermer'}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/15 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3 bg-[#f8fafc]">
            {/* Bulle d'accueil */}
            <div className="flex">
              <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white border border-gray-100 px-3.5 py-2.5 text-sm text-gray-700 leading-relaxed">
                {welcome}
              </div>
            </div>

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'rounded-2xl rounded-tr-sm text-white'
                      : 'rounded-2xl rounded-tl-sm bg-white border border-gray-100 text-gray-700'
                  }`}
                  style={m.role === 'user' ? { background: 'var(--accent, #0e75c4)' } : undefined}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {/* Indicateur de saisie */}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-tl-sm bg-white border border-gray-100 px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            {/* Suggestions (avant le premier message) */}
            {messages.length === 0 && !loading && (
              <div className="flex flex-wrap gap-2 pt-1">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-xs px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>
            )}
          </div>

          {/* Avertissement */}
          <div className="px-4 py-1.5 text-[10px] text-center text-gray-400 border-t border-gray-100 bg-white">
            {isArabic ? 'ليس تشخيصًا طبيًا. للطوارئ اتصل بـ 14 أو 115.' : 'Pas un diagnostic médical. Urgence : appelez le 14 ou 115.'}
          </div>

          {/* Saisie */}
          <div className="p-3 border-t border-gray-100 bg-white flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={isArabic ? 'اكتب رسالتك…' : 'Écrivez votre message…'}
              className="flex-1 resize-none max-h-28 px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 outline-none transition"
            />
            <button
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              aria-label={isArabic ? 'إرسال' : 'Envoyer'}
              className="w-10 h-10 flex-shrink-0 rounded-xl text-white flex items-center justify-center disabled:opacity-40 transition-opacity"
              style={{ background: 'var(--accent, #0e75c4)' }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ transform: isArabic ? 'scaleX(-1)' : undefined }}>
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
