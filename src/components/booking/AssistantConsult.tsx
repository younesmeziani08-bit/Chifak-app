import { useState, useRef, useEffect } from 'react';
import { assistantAPI, AssistantAuthError, AssistantMessage, AssistantLang } from '../../services/api';

/**
 * Conversation d'orientation, intégrée au hero.
 *
 * Trois garde-fous portés par ce composant :
 * - l'accès suppose une session patient (la conversation porte sur des symptômes) ;
 * - la langue est choisie explicitement avant le premier message ;
 * - la spécialité proposée reste une ORIENTATION, jamais un diagnostic : elle
 *   pré-remplit la recherche mais le patient garde la main pour la changer.
 */

/** Libellé français renvoyé par le serveur -> clé de traduction de l'application. */
const SPECIALTY_KEYS: Record<string, string> = {
  'Médecin généraliste': 'specialty.generalDoctor',
  Dentiste: 'specialty.dentist',
  Ophtalmologue: 'specialty.ophthalmologist',
  Dermatologue: 'specialty.dermatologist',
  Cardiologue: 'specialty.cardiologist',
  Pédiatre: 'specialty.pediatrician',
  Gynécologue: 'specialty.gynecologist',
  ORL: 'specialty.ent',
  Kinésithérapeute: 'specialty.physiotherapist',
  Psychologue: 'specialty.psychologist',
  Ostéopathe: 'specialty.osteopath',
  'Sage-femme': 'specialty.midwife',
};

const LANGS: { id: AssistantLang; label: string; hint: string }[] = [
  { id: 'fr', label: 'Français', hint: 'Français' },
  { id: 'ar', label: 'العربية', hint: 'Arabe' },
];

/** Textes de l'interface, par langue de conversation. */
const UI = {
  ar: {
    welcome: 'مرحباً! صف لي ما تشعر به — أين الألم، منذ متى، وما شدته — لأوجّهك إلى التخصص المناسب.',
    placeholder: 'اكتب هنا…',
    send: 'إرسال',
    suggestions: ['أعاني من صداع منذ يومين', 'ألم في الأسنان', 'لا أعرف أي طبيب أزور'],
    orientation: 'التوجيه المقترح',
    cta: 'عرض الأطباء المتاحين',
    change: 'يمكنك تغيير التخصص من نموذج البحث.',
    disclaimer: 'ليس تشخيصاً طبياً. للطوارئ اتصل بـ 14 أو 115.',
    restart: 'ابدأ من جديد',
  },
  fr: {
    welcome: 'Bonjour ! Décrivez-moi ce que vous ressentez — où, depuis quand, et à quel point — et je vous orienterai vers la bonne spécialité.',
    placeholder: 'Écrivez ici…',
    send: 'Envoyer',
    suggestions: ['J’ai mal à la tête depuis 2 jours', 'Une douleur dentaire', 'Je ne sais pas qui consulter'],
    orientation: 'Orientation suggérée',
    cta: 'Voir les praticiens disponibles',
    change: 'Vous pouvez changer de spécialité dans le formulaire de recherche.',
    disclaimer: 'Ce n’est pas un diagnostic médical. Urgence : appelez le 14 ou le 115.',
    restart: 'Recommencer',
  },
} as const;

interface Props {
  patientUser?: { id: number; name: string; email: string } | null;
  onOpenLogin: () => void;
  /** Reçoit la clé de spécialité (ex. « specialty.dermatologist »). */
  onOrientation: (specialtyKey: string) => void;
  isArabic: boolean;
}

export default function AssistantConsult({ patientUser, onOpenLogin, onOrientation, isArabic }: Props) {
  /* L'assistant démarre replié : c'est une proposition d'aide posée à côté du
     formulaire, pas une étape du parcours. On peut réserver sans l'ouvrir. */
  const [openPanel, setOpenPanel] = useState(false);
  const [lang, setLang] = useState<AssistantLang | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [orientation, setOrientation] = useState<string | null>(null);
  /** Réponses rapides du tour en cours. Le patient clique plutôt que d'écrire. */
  const [options, setOptions] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const ui = UI[lang ?? (isArabic ? 'ar' : 'fr')];
  const rtl = lang === 'ar';

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, orientation]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || loading || !lang) return;
    setError('');
    const next: AssistantMessage[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setOptions([]);
    setLoading(true);
    try {
      const { reply, orientation: found, options: opts } = await assistantAPI.chat(next, lang);
      setMessages([...next, { role: 'assistant', content: reply }]);
      setOptions(opts);
      // Première orientation retenue seulement : on ne la remplace pas en
      // cours de route, pour ne pas faire bouger le formulaire sous le patient.
      if (found && !orientation) setOrientation(found);
    } catch (err) {
      if (err instanceof AssistantAuthError) {
        setError(isArabic ? 'انتهت الجلسة. سجّل الدخول من جديد.' : 'Session expirée. Reconnectez-vous.');
      } else {
        setError(err instanceof Error ? err.message : 'Erreur');
      }
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setMessages([]);
    setOrientation(null);
    setOptions([]);
    setError('');
    setInput('');
  };

  /* ── État replié : une simple proposition, refermable ── */
  if (!openPanel) {
    return (
      <aside
        className="rounded-2xl p-5"
        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.16)' }}
      >
        <p className="text-base mb-1.5" style={{ color: '#FFFFFF', fontFamily: 'var(--font-display)' }}>
          {isArabic ? 'لا تعرف أي طبيب تستشير؟' : 'Vous ne savez pas qui consulter ?'}
        </p>
        <p className="text-sm leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.66)' }}>
          {isArabic
            ? 'صف لنا ما تشعر به، ويقترح عليك المساعد التخصص المناسب. ليس تشخيصاً طبياً.'
            : 'Décrivez ce que vous ressentez, l’assistant vous suggère une spécialité. Ce n’est pas un diagnostic.'}
        </p>
        <button
          type="button"
          onClick={() => setOpenPanel(true)}
          className="btn-primary w-full"
          style={{ background: 'rgba(255,255,255,0.14)', color: '#FFFFFF', height: '42px' }}
        >
          {isArabic ? 'ابدأ الحديث' : 'Discuter avec l’assistant'}
        </button>
      </aside>
    );
  }

  /* Bouton de repli, présent dans tous les états ouverts : on doit pouvoir
     refermer la proposition aussi facilement qu'on l'a ouverte. */
  const closeButton = (
    <button
      type="button"
      onClick={() => setOpenPanel(false)}
      aria-label={isArabic ? 'إغلاق' : 'Fermer'}
      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ background: 'var(--bg-2)', color: 'var(--ink-3)' }}
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  );

  /* ── Non connecté : on n'ouvre pas la conversation ── */
  if (!patientUser) {
    return (
      <div className="rounded-2xl p-6 sm:p-7" style={{ background: 'var(--bg)', boxShadow: 'var(--shadow-lg)' }}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="text-lg" style={{ color: 'var(--ink)' }}>
            {isArabic ? 'سجّل الدخول للتحدّث مع المساعد' : 'Connectez-vous pour discuter avec l’assistant'}
          </h3>
          {closeButton}
        </div>
        <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--ink-2)' }}>
          {isArabic
            ? 'تتناول المحادثة أعراضك، وهي معطيات صحية. لا تُعالَج إلا في إطار حسابك.'
            : 'La conversation porte sur vos symptômes, donc sur des données de santé. Elles ne sont traitées que dans le cadre de votre compte.'}
        </p>
        <button type="button" onClick={onOpenLogin} className="btn-primary" style={{ height: '46px', padding: '0 1.4rem' }}>
          {isArabic ? 'تسجيل الدخول' : 'Se connecter'}
        </button>
      </div>
    );
  }

  /* ── Choix de la langue, avant tout échange ── */
  if (!lang) {
    return (
      <div className="rounded-2xl p-6 sm:p-7" style={{ background: 'var(--bg)', boxShadow: 'var(--shadow-lg)' }}>
        <div className="flex items-start justify-between gap-3 mb-1.5">
          <h3 className="text-lg" style={{ color: 'var(--ink)' }}>
            {isArabic ? 'بأي لغة تفضّل التحدّث؟' : 'Dans quelle langue préférez-vous discuter ?'}
          </h3>
          {closeButton}
        </div>
        <p className="text-sm mb-5" style={{ color: 'var(--ink-2)' }}>
          {isArabic ? 'يمكنك تغييرها في أي وقت.' : 'Vous pourrez en changer à tout moment.'}
        </p>
        <div className="flex flex-wrap gap-2.5">
          {LANGS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setLang(l.id)}
              className="rounded-xl px-4 py-3 text-start transition-colors"
              style={{ background: 'var(--bg-2)', border: '1.5px solid var(--tint-10)', minWidth: '9rem' }}
            >
              <span className="block text-base font-semibold" style={{ color: 'var(--ink)' }}>{l.label}</span>
              <span className="block text-xs mt-0.5" style={{ color: 'var(--ink-3)' }}>{l.hint}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* ── Conversation ── */
  return (
    <div
      className="rounded-2xl flex flex-col overflow-hidden"
      style={{ background: 'var(--bg)', boxShadow: 'var(--shadow-lg)', maxHeight: 'var(--h-assistant, 24rem)' }}
      dir={rtl ? 'rtl' : 'ltr'}
    >
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: '1px solid var(--tint-10)' }}
      >
        <p className="text-xs" style={{ color: 'var(--ink-3)' }}>{ui.disclaimer}</p>
        <div className="flex items-center gap-2 flex-shrink-0 ms-3">
          <button
            type="button"
            onClick={() => { setLang(null); reset(); }}
            className="text-xs underline"
            style={{ color: 'var(--ink-3)' }}
          >
            {LANGS.find((l) => l.id === lang)?.label}
          </button>
          {closeButton}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3" style={{ background: 'var(--bg-2)' }}>
        <div className="flex">
          <div className="max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed" style={{ background: 'var(--bg)', color: 'var(--ink-2)' }}>
            {ui.welcome}
          </div>
        </div>

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className="max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap"
              style={
                m.role === 'user'
                  ? { background: 'var(--accent)', color: '#FFFFFF' }
                  : { background: 'var(--bg)', color: 'var(--ink-2)' }
              }
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex">
            <div className="rounded-2xl px-4 py-3" style={{ background: 'var(--bg)' }}>
              <div className="flex gap-1">
                {[0, 150, 300].map((d) => (
                  <span key={d} className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--bg-3)', animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Orientation retenue : proposée, jamais imposée */}
        {orientation && (
          <div className="rounded-xl p-4" style={{ background: 'var(--accent-bg)', border: '1px solid var(--tint-20)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--ink-2)' }}>{ui.orientation}</p>
            <p className="text-lg mb-3" style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>
              {orientation}
            </p>
            <button
              type="button"
              onClick={() => onOrientation(SPECIALTY_KEYS[orientation] ?? 'specialty.generalDoctor')}
              className="btn-primary w-full sm:w-auto"
              style={{ height: '44px', padding: '0 1.25rem' }}
            >
              {ui.cta}
            </button>
            <p className="text-xs mt-2.5" style={{ color: 'var(--ink-3)' }}>{ui.change}</p>
          </div>
        )}

        {/* Réponses à choisir : suggestions de départ, puis options du tour
            en cours. Le patient clique, il n'a normalement rien à écrire —
            le champ de saisie reste là pour les cas non couverts. */}
        {!loading && !orientation && (messages.length === 0 || options.length > 0) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {(messages.length === 0 ? [...ui.suggestions] : options).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="text-sm px-3.5 py-2 rounded-full transition-colors"
                style={{ background: 'var(--bg)', border: '1.5px solid var(--tint-20)', color: 'var(--accent)' }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {error && (
          <p className="text-xs rounded-lg px-3 py-2" style={{ color: 'var(--danger)', background: '#FEF3F2' }}>{error}</p>
        )}
      </div>

      <div className="p-3 flex items-end gap-2" style={{ borderTop: '1px solid var(--tint-10)' }}>
        <textarea
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
          }}
          placeholder={ui.placeholder}
          className="field flex-1 resize-none max-h-28"
          style={{ paddingTop: '0.65rem', paddingBottom: '0.65rem' }}
        />
        <button
          type="button"
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
          aria-label={ui.send}
          className="btn-primary flex-shrink-0"
          style={{ height: '44px', width: '44px', padding: 0 }}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ transform: rtl ? 'scaleX(-1)' : undefined }}>
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
