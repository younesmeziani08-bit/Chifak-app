import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { assistantAPI, AssistantMessage } from '../services/api';

export default function AssistantChat() {
  const { language } = useLanguage();
  const isArabic = language === 'ar';

  const [open, setOpen] = useState(false);
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

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'}>
      {/* Bouton flottant */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={isArabic ? 'المساعد الصحي' : 'Assistant santé'}
          className="fixed bottom-5 z-[90] flex items-center gap-2 rounded-full shadow-lg text-white transition-transform hover:scale-105 active:scale-95"
          style={{ [isArabic ? 'left' : 'right']: '20px', background: 'var(--accent, #0e75c4)', padding: '14px 18px' } as React.CSSProperties}
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
          </svg>
          <span className="font-semibold text-sm hidden sm:inline">{isArabic ? 'مساعد صحي' : 'Assistant santé'}</span>
        </button>
      )}

      {/* Panneau de chat */}
      {open && (
        <div
          className="fixed z-[95] bg-white shadow-2xl flex flex-col overflow-hidden border border-gray-100
                     inset-0 sm:inset-auto sm:bottom-5 sm:h-[560px] sm:w-[390px] sm:max-h-[85vh] sm:rounded-2xl"
          style={{ [isArabic ? 'left' : 'right']: '20px' } as React.CSSProperties}
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
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#f8fafc]">
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
