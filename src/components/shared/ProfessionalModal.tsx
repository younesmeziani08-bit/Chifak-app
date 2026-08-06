import { useLanguage } from '../../contexts/LanguageContext';

interface ProfessionalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfessionalModal({ isOpen, onClose }: ProfessionalModalProps) {
  const { t, language } = useLanguage();
  const isRTL = language === 'ar';
  const isArabic = language === 'ar';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
      
      <div className="relative w-full max-w-5xl bg-white rounded-4xl shadow-3xl overflow-y-auto max-h-[90vh] animate-in zoom-in-95 slide-in-from-bottom-10 duration-500" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 to-cyan-400" />
        
        <div className="p-8 sm:p-12">
          {/* Header - Pro Max */}
          <div className="flex justify-between items-start mb-12">
            <div className="animate-fadeInUp">
              <span className="inline-block text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 mb-4 bg-blue-50 px-4 py-2 rounded-full border border-blue-100">
                {isArabic ? 'للأطباء والمراكز' : 'Solution Business'}
              </span>
              <h2 className="text-3xl sm:text-5xl font-black text-gray-900 tracking-tight mb-4">
                {t('pro.title')}
              </h2>
              <p className="text-gray-500 text-lg sm:text-xl font-medium max-w-2xl">
                {t('pro.subtitle')}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-all hover:rotate-90"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Benefits Grid - Pro Max */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            {[
              { id: '1', color: 'blue', icon: '📅' },
              { id: '2', color: 'blue', icon: '📈' },
              { id: '3', color: 'blue', icon: '🔔' },
              { id: '4', color: 'blue', icon: '📱' },
            ].map((benefit, i) => (
              <div key={benefit.id} className="group bg-gray-50 hover:bg-white rounded-3xl p-8 border-2 border-transparent hover:border-blue-100 hover:shadow-2xl transition-all duration-500 animate-fadeInUp" style={{ animationDelay: `${i * 0.1}s` }}>
                <div className={`w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 group-hover:rotate-6 transition-all`}>
                  {benefit.icon}
                </div>
                <h3 className="text-xl font-black text-gray-900 mb-3 tracking-tight">
                  {t(`pro.benefit${benefit.id}Title`)}
                </h3>
                <p className="text-gray-500 font-medium leading-relaxed">
                  {t(`pro.benefit${benefit.id}Desc`)}
                </p>
              </div>
            ))}
          </div>

          {/* Statistics - Pro Max */}
          <div className="bg-gray-900 rounded-4xl p-10 sm:p-16 mb-16 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-600/20 via-transparent to-transparent" />
            <h3 className="text-2xl sm:text-3xl font-black mb-12 text-center text-white relative z-10">
              {t('pro.trustUs')}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-12 text-center relative z-10">
              <div>
                <div className="text-3xl sm:text-5xl font-black text-cyan-400 mb-3 tracking-tighter">300K+</div>
                <div className="text-gray-400 text-xs font-black uppercase tracking-widest">{t('pro.professionals')}</div>
              </div>
              <div>
                <div className="text-3xl sm:text-5xl font-black text-cyan-400 mb-3 tracking-tighter">95%</div>
                <div className="text-gray-400 text-xs font-black uppercase tracking-widest">{t('pro.satisfaction')}</div>
              </div>
              <div>
                <div className="text-3xl sm:text-5xl font-black text-cyan-400 mb-3 tracking-tighter">-60%</div>
                <div className="text-gray-400 text-xs font-black uppercase tracking-widest">{t('pro.absences')}</div>
              </div>
            </div>
          </div>

          {/* CTA - Pro Max */}
          <div className="bg-blue-600 rounded-4xl p-10 sm:p-16 text-center shadow-3xl shadow-blue-600/20">
            <h3 className="text-3xl sm:text-4xl font-black text-white mb-4 tracking-tight">
              {t('pro.ready')}
            </h3>
            <p className="text-blue-100 text-lg font-medium mb-10 max-w-xl mx-auto">
              {t('pro.tryFree30')}
            </p>
            <div className="flex flex-col sm:flex-row gap-5 justify-center">
              <button className="btn-pro px-10 py-5 bg-white text-blue-700 font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl hover:shadow-blue-500/20 active:scale-95 transition-all">
                {t('pro.createProAccount')}
              </button>
              <button className="btn-pro px-10 py-5 border-2 border-white/30 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-white/10 active:scale-95 transition-all">
                {t('pro.scheduleDemo')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
