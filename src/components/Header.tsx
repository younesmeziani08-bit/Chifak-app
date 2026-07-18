import { useState } from 'react';
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
  patientUser?: { id: number; name: string; email: string } | null;
  onLogout?: () => void;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'M';
}

function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark className="h-10 w-10" />
      <span className="flex flex-col leading-none">
        <span className="text-xl font-bold tracking-tight" style={{ color: '#00264c' }}>chifak</span>
        <span className="text-[10px] font-medium tracking-wide text-gray-400">Santé Algérie</span>
      </span>
    </span>
  );
}

export default function Header({
  onAdminClick,
  onDoctorClick,
  onHomeClick,
  transparent = false,
  onScrollToSearch,
  onScrollToTeleconsult,
  onOpenProfessional,
  onOpenLogin,
  onOpenSignup,
  onOpenAccount,
  patientUser,
  onLogout,
}: HeaderProps) {
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLinkClick = (action?: () => void) => {
    action?.();
    setIsMenuOpen(false);
  };

  const navItems = [
    { label: isArabic ? 'ابحث عن طبيب' : 'Trouver un médecin', onClick: onScrollToSearch },
    { label: isArabic ? 'استشارة عن بُعد' : 'Téléconsultation', onClick: onScrollToTeleconsult },
    { label: isArabic ? 'أنت طبيب؟' : 'Vous êtes praticien ?', onClick: onOpenProfessional },
  ];

  return (
    <header
      className={`w-full z-50 ${transparent ? 'absolute top-0 bg-transparent' : 'sticky top-0 bg-white border-b border-gray-100'}`}
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          <button type="button" onClick={onHomeClick} title={isArabic ? 'الرئيسية' : "Accueil"} className="focus:outline-none">
            <Logo />
          </button>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-8">
            {navItems.map((item, i) => (
              <button
                key={i}
                type="button"
                onClick={item.onClick}
                className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:block">
              <LanguageToggle />
            </div>

            {onDoctorClick && !patientUser && (
              <button
                onClick={onDoctorClick}
                className="hidden md:inline-flex items-center text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:border-blue-300 hover:text-blue-600 transition-colors"
              >
                {isArabic ? 'مساحة الطبيب' : 'Espace médecin'}
              </button>
            )}

            {patientUser ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={onOpenAccount}
                  className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors px-2 py-1 rounded-lg"
                  title={isArabic ? 'حسابي' : 'Mon compte'}
                >
                  <span className="w-7 h-7 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-xs font-semibold">
                    {initialsOf(patientUser.name)}
                  </span>
                  <span className="hidden lg:inline">{patientUser.name}</span>
                </button>
                <button
                  onClick={onLogout}
                  className="hidden sm:inline-flex text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600 transition-colors"
                >
                  {isArabic ? 'خروج' : 'Déconnexion'}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={onOpenLogin}
                  className="hidden sm:inline-flex text-sm font-medium px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  {isArabic ? 'تسجيل الدخول' : 'Connexion'}
                </button>
                <button
                  onClick={onOpenSignup}
                  className="hidden sm:inline-flex text-sm font-semibold px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  {isArabic ? 'إنشاء حساب' : 'Créer un compte'}
                </button>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Menu"
              className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="lg:hidden bg-white border-b border-gray-100">
          <div className="px-4 sm:px-6 pt-2 pb-6 space-y-1">
            {navItems.map((item, i) => (
              <button
                key={i}
                onClick={() => handleLinkClick(item.onClick)}
                className="w-full text-start block px-4 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600 rounded-lg transition-colors"
              >
                {item.label}
              </button>
            ))}

            <div className="pt-4 flex flex-col gap-2">
              {patientUser ? (
                <>
                  <button
                    onClick={() => handleLinkClick(onOpenAccount)}
                    className="w-full py-3 bg-blue-50 text-blue-700 font-medium text-sm rounded-lg border border-blue-100 transition-colors"
                  >
                    {isArabic ? 'حسابي' : 'Mon compte'}
                  </button>
                  <button
                    onClick={() => handleLinkClick(onLogout)}
                    className="w-full py-3 bg-white text-red-600 font-medium text-sm rounded-lg border border-red-200 transition-colors"
                  >
                    {isArabic ? 'خروج' : 'Déconnexion'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleLinkClick(onOpenLogin)}
                    className="w-full py-3 bg-gray-50 text-gray-800 font-medium text-sm rounded-lg border border-gray-200 transition-colors"
                  >
                    {isArabic ? 'تسجيل الدخول' : 'Connexion'}
                  </button>
                  <button
                    onClick={() => handleLinkClick(onOpenSignup)}
                    className="w-full py-3 bg-blue-600 text-white font-semibold text-sm rounded-lg transition-colors"
                  >
                    {isArabic ? 'إنشاء حساب' : 'Créer un compte'}
                  </button>
                </>
              )}
              <div className="flex justify-center pt-3">
                <LanguageToggle />
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
