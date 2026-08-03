import { useState, useMemo, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { healthArticles, CATEGORY_LABELS, Article, ArticleCategory } from '../data/healthArticles';

// Icônes par catégorie (vectorielles, pas d'emoji)
function CategoryIcon({ category, className = 'w-5 h-5' }: { category: ArticleCategory; className?: string }) {
  const common = { className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (category) {
    case 'prevention':
      return <svg {...common}><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" /><path d="M9.5 12l1.8 1.8 3.2-3.6" /></svg>;
    case 'chronic':
      return <svg {...common}><path d="M3 12h4l2 5 4-12 2 7h6" /></svg>;
    case 'mother-child':
      return <svg {...common}><circle cx="12" cy="7" r="3" /><path d="M6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" /></svg>;
    case 'wellbeing':
      return <svg {...common}><path d="M12 21s-7-4.5-7-10a4 4 0 018-1 4 4 0 018 1c0 5.5-9 10-9 10z" /></svg>;
  }
}

const CATEGORY_ORDER: ArticleCategory[] = ['prevention', 'chronic', 'mother-child', 'wellbeing'];

export default function HealthArticles() {
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const [filter, setFilter] = useState<ArticleCategory | 'all'>('all');
  const [active, setActive] = useState<Article | null>(null);

  const articles = useMemo(
    () => (filter === 'all' ? healthArticles : healthArticles.filter((a) => a.category === filter)),
    [filter]
  );

  // Bloque le défilement de fond quand le lecteur est ouvert
  useEffect(() => {
    document.body.style.overflow = active ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [active]);

  // Fermer avec Échap
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setActive(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  const filters: { key: ArticleCategory | 'all'; label: string }[] = [
    { key: 'all', label: isArabic ? 'الكل' : 'Tous' },
    ...CATEGORY_ORDER.map((c) => ({ key: c, label: isArabic ? CATEGORY_LABELS[c].ar : CATEGORY_LABELS[c].fr })),
  ];

  return (
    <section
      id="sante-prevention"
      style={{ background: 'var(--bg)', borderTop: '1px solid rgba(0,0,0,0.06)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-12 sm:py-20">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--accent)' }}>
            {isArabic ? 'توثيق' : 'Documentation'}
          </p>
          <h2
            className="text-3xl sm:text-4xl font-extrabold tracking-tight"
            style={{ color: 'var(--ink)' }}
          >
            {isArabic ? 'الصحة والوقاية' : 'Santé & Prévention'}
          </h2>
          <p className="mt-3 max-w-2xl text-base" style={{ color: 'var(--ink-2)' }}>
            {isArabic
              ? 'مقالات موثوقة لتفهم صحتك بشكل أفضل وتقي نفسك وعائلتك.'
              : 'Des articles fiables pour mieux comprendre votre santé et protéger votre famille.'}
          </p>
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-2 mb-8">
          {filters.map((f) => {
            const activeF = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="px-4 py-2 rounded-full text-sm font-semibold transition-colors"
                style={
                  activeF
                    ? { background: 'var(--accent)', color: '#fff' }
                    : { background: 'var(--bg-2, #f1f5f9)', color: 'var(--ink-2)', border: '1px solid rgba(0,0,0,0.06)' }
                }
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Grille d'articles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {articles.map((a) => (
            <button
              key={a.id}
              onClick={() => setActive(a)}
              className="group text-start bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md hover:border-blue-200 transition-all"
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-bg, #eff6ff)', color: 'var(--accent)' }}>
                  <CategoryIcon category={a.category} />
                </span>
                <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
                  {isArabic ? CATEGORY_LABELS[a.category].ar : CATEGORY_LABELS[a.category].fr}
                </span>
              </div>
              <h3 className="text-lg font-bold leading-snug mb-2 group-hover:text-blue-700 transition-colors" style={{ color: 'var(--ink)' }}>
                {isArabic ? a.titleAr : a.title}
              </h3>
              <p className="text-sm leading-relaxed mb-4 line-clamp-3" style={{ color: 'var(--ink-2)' }}>
                {isArabic ? a.excerptAr : a.excerpt}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--ink-3, #94a3b8)' }}>
                  {a.readTime} {isArabic ? 'دقائق قراءة' : 'min de lecture'}
                </span>
                <span className="text-sm font-semibold inline-flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                  {isArabic ? 'اقرأ' : 'Lire'}
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d={isArabic ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
                  </svg>
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Lecteur en modal */}
      {active && (
        <div
          className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-0 sm:p-6"
          style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => setActive(null)}
          dir={isArabic ? 'rtl' : 'ltr'}
        >
          <article
            className="bg-white w-full sm:max-w-2xl sm:rounded-2xl shadow-2xl max-h-screen sm:max-h-[88vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* En-tête collant */}
            <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                <CategoryIcon category={active.category} className="w-4 h-4" />
                {isArabic ? CATEGORY_LABELS[active.category].ar : CATEGORY_LABELS[active.category].fr}
              </span>
              <button
                onClick={() => setActive(null)}
                aria-label={isArabic ? 'إغلاق' : 'Fermer'}
                className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <div className="px-6 sm:px-8 py-6">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2" style={{ color: 'var(--ink)' }}>
                {isArabic ? active.titleAr : active.title}
              </h1>
              <p className="text-sm mb-6" style={{ color: 'var(--ink-3, #94a3b8)' }}>
                {active.readTime} {isArabic ? 'دقائق قراءة' : 'min de lecture'}
              </p>

              <div className="space-y-6">
                {(isArabic ? active.sectionsAr : active.sections).map((s, i) => (
                  <div key={i}>
                    <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--ink)' }}>{s.heading}</h2>
                    <p className="text-[15px] leading-7" style={{ color: 'var(--ink-2)' }}>{s.body}</p>
                  </div>
                ))}
              </div>

              {/* Points clés */}
              <div className="mt-8 p-5 rounded-2xl" style={{ background: 'var(--accent-bg, #eff6ff)', border: '1px solid rgba(37,99,235,0.15)' }}>
                <p className="text-sm font-bold mb-3" style={{ color: 'var(--accent)' }}>
                  {isArabic ? 'النقاط الأساسية' : 'À retenir'}
                </p>
                <ul className="space-y-2">
                  {(isArabic ? active.keyPointsAr : active.keyPoints).map((k, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--ink)' }}>
                      <svg className="w-4 h-4 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{k}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Avertissement */}
              <p className="mt-6 text-xs leading-relaxed" style={{ color: 'var(--ink-3, #94a3b8)' }}>
                {isArabic
                  ? 'هذا المقال لأغراض التوعية فقط ولا يُغني عن استشارة طبية. عند وجود أعراض أو شكّ، استشر طبيبًا.'
                  : 'Cet article est fourni à titre informatif et ne remplace pas un avis médical. En cas de symptôme ou de doute, consultez un médecin.'}
              </p>
            </div>
          </article>
        </div>
      )}
    </section>
  );
}
