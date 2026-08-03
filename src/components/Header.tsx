import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import LanguageToggle from './LanguageToggle';
import LogoMark from './LogoMark';

interface HeaderProps {
  onAdminClick?: () => void;
  onDoctorClick?: () => void;
  onHomeClick?: () => void;
  transparent?: boolean;
  onScrollToSearch?: () => void;
  onScrollToTeleconsult?: () => void;
  onOpenProfessional?: () => void;
  onOpenLogin?: () => void;
  onOpenSignup?: () => void;
  onOpenAccount?: () => void;
  onBack?: () => void;
  patientUser?: { id: number; name: string; email: string } | null;
  onLogout?: () => void;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'M';
}

export default function Header({
  onAdminClick: _onAdminClick,
  onDoctorClick,
  onHomeClick,
  onScrollToSearch,
  onScrollToTeleconsult,
  onOpenProfessional,
  onOpenLogin,
  onOpenSignup,
  onOpenAccount,
  onBack,
  patientUser,
  onLogout,
}: HeaderProps) {
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const navLinks = [
    { label: isArabic ? 'ابحث عن طبيب' : 'Trouver un médecin', action: onScrollToSearch },
    { label: isArabic ? 'استشارة عن بُعد' : 'Téléconsultation', action: onScrollToTeleconsult },
    { label: isArabic ? 'أنت طبيب؟' : 'Vous êtes praticien ?', action: onOpenProfessional },
  ];

  const close = (fn?: () => void) => { fn?.(); setMenuOpen(false); };

  return (
    <header
      dir={isArabic ? 'rtl' : 'ltr'}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: scrolled ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.80)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: scrolled ? '1px solid rgba(0,0,0,0.08)' : '1px solid transparent',
        transition: 'background-color 0.2s, border-color 0.2s',
      }}
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="flex items-center justify-between" style={{ height: '56px' }}>

          {/* Retour + Logo */}
          <div className="flex items-center gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label={isArabic ? 'رجوع' : 'Retour'}
              title={isArabic ? 'رجوع' : 'Retour'}
              className="flex items-center justify-center w-9 h-9 rounded-full border border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d={isArabic ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'} />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={onHomeClick}
            title={isArabic ? 'الرئيسية' : 'Accueil'}
            className="flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-lg"
          >
            <LogoMark className="h-8 w-8" />
            <span style={{
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              fontWeight: 700,
              fontSize: '17px',
              letterSpacing: '-0.01em',
              color: 'var(--ink)',
              lineHeight: 1,
            }}>
              chifak
            </span>
          </button>
          </div>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-7">
            {navLinks.map((link, i) => (
              <button key={i} type="button" onClick={link.action} className="nav-link">
                {link.label}
              </button>
            ))}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Bascule de langue : visible aussi sur mobile */}
            <div className="block">
              <LanguageToggle />
            </div>

            {onDoctorClick && !patientUser && (
              <button
                onClick={onDoctorClick}
                className="btn-secondary hidden md:inline-flex"
                style={{ fontSize: '13px', height: '34px', padding: '0 0.875rem' }}
              >
                {isArabic ? 'مساحة الطبيب' : 'Espace médecin'}
              </button>
            )}

            {patientUser ? (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={onOpenAccount}
                  className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 transition-colors hover:bg-gray-50"
                  title={isArabic ? 'حسابي' : 'Mon compte'}
                >
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: 'var(--accent-bg)', color: 'var(--accent)', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
                    {initialsOf(patientUser.name)}
                  </span>
                  <span className="hidden lg:inline text-sm font-medium" style={{ color: 'var(--ink)' }}>
                    {patientUser.name.split(' ')[0]}
                  </span>
                </button>
                <button
                  onClick={onLogout}
                  className="hidden sm:inline-flex items-center text-sm px-3 rounded-lg transition-colors hover:text-red-600 hover:border-red-300"
                  style={{ height: '34px', border: '1.5px solid var(--bg-3)', color: 'var(--ink-2)', fontWeight: 500 }}
                >
                  {isArabic ? 'خروج' : 'Déconnexion'}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  onClick={onOpenLogin}
                  className="hidden sm:inline-flex items-center text-sm font-medium px-4 rounded-xl transition-colors hover:bg-gray-100"
                  style={{ height: '36px', color: 'var(--ink-2)' }}
                >
                  {isArabic ? 'تسجيل الدخول' : 'Connexion'}
                </button>
                <button
                  onClick={onOpenSignup}
                  className="btn-primary hidden sm:inline-flex"
                  style={{ height: '36px', padding: '0 1rem', fontSize: '14px' }}
                >
                  {isArabic ? 'إنشاء حساب' : 'Créer un compte'}
                </button>
              </div>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menu"
              className="lg:hidden p-2 rounded-lg transition-colors hover:bg-gray-100"
              style={{ color: 'var(--ink-2)' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                {menuOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          className="lg:hidden animate-slideDown"
          style={{
            background: 'rgba(255,255,255,0.96)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderTop: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          <div className="max-w-7xl mx-auto px-5 py-4 space-y-0.5">
            {navLinks.map((link, i) => (
              <button
                key={i}
                onClick={() => close(link.action)}
                className="w-full text-start px-3 py-3 rounded-xl text-[15px] font-medium transition-colors hover:bg-gray-50"
                style={{ color: 'var(--ink)' }}
              >
                {link.label}
              </button>
            ))}

            {onDoctorClick && !patientUser && (
              <button
                onClick={() => close(onDoctorClick)}
                className="w-full text-start px-3 py-3 rounded-xl text-[15px] font-medium transition-colors hover:bg-gray-50"
                style={{ color: 'var(--ink)' }}
              >
                {isArabic ? 'مساحة الطبيب' : 'Espace médecin'}
              </button>
            )}

            <div className="pt-3 space-y-2" style={{ borderTop: '1px solid rgba(0,0,0,0.06)', marginTop: '8px', paddingTop: '16px' }}>
              {patientUser ? (
                <>
                  <button
                    onClick={() => close(onOpenAccount)}
                    className="w-full py-3 rounded-2xl text-[15px] font-semibold text-center transition-colors"
                    style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}
                  >
                    {isArabic ? 'حسابي' : 'Mon compte'}
                  </button>
                  <button
                    onClick={() => close(onLogout)}
                    className="w-full py-3 rounded-2xl text-[15px] font-medium text-center border transition-colors hover:bg-red-50"
                    style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#DC2626' }}
                  >
                    {isArabic ? 'خروج' : 'Déconnexion'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => close(onOpenLogin)}
                    className="w-full py-3 rounded-2xl text-[15px] font-medium text-center transition-colors hover:bg-gray-100"
                    style={{ background: 'var(--bg-2)', color: 'var(--ink)' }}
                  >
                    {isArabic ? 'تسجيل الدخول' : 'Connexion'}
                  </button>
                  <button
                    onClick={() => close(onOpenSignup)}
                    className="btn-primary w-full"
                    style={{ height: '48px', fontSize: '15px', borderRadius: '16px' }}
                  >
                    {isArabic ? 'إنشاء حساب' : 'Créer un compte'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
