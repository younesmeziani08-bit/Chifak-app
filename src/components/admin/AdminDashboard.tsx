import { useState } from 'react';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { useDoctors } from '../../contexts/DoctorsContext';
import { useLanguage } from '../../contexts/LanguageContext';
import LanguageToggle from '../LanguageToggle';
import AddDoctorForm from './AddDoctorForm';
import DoctorsList from './DoctorsList';
import AdminReviews from './AdminReviews';

type Tab = 'add' | 'list' | 'reviews';

interface AdminDashboardProps {
  onBackToHome: () => void;
}

export default function AdminDashboard({ onBackToHome }: AdminDashboardProps) {
  const { adminUser, logout } = useAdminAuth();
  const { doctors } = useDoctors();
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState<Tab>('add');
  const isArabic = language === 'ar';

  const stats = [
    {
      label: isArabic ? 'مجموع الأطباء' : 'Médecins enregistrés',
      value: doctors.length,
      icon: '👨‍⚕️',
      color: 'bg-blue-50 border-blue-200',
      textColor: 'text-blue-700',
    },
    {
      label: isArabic ? 'التخصصات' : 'Spécialités',
      value: new Set(doctors.map(d => d.specialty)).size,
      icon: '🏥',
      color: 'bg-green-50 border-green-200',
      textColor: 'text-green-700',
    },
    {
      label: isArabic ? 'المدن' : 'Villes',
      value: new Set(doctors.map(d => d.city.split(',')[0]?.trim())).size,
      icon: '📍',
      color: 'bg-purple-50 border-purple-200',
      textColor: 'text-purple-700',
    },
    {
      label: isArabic ? 'بموقع GPS' : 'Avec GPS',
      value: doctors.filter(d => d.latitude || d.mapsUrl).length,
      icon: '🗺️',
      color: 'bg-cyan-50 border-cyan-200',
      textColor: 'text-cyan-700',
    },
  ];

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'add', label: isArabic ? 'إضافة طبيب' : 'Ajouter un médecin', icon: '➕' },
    { key: 'list', label: isArabic ? 'قائمة الأطباء' : 'Liste des médecins', icon: '📋' },
    { key: 'reviews', label: isArabic ? 'التقييمات' : 'Avis', icon: '⭐' },
  ];

  return (
    <div className="min-h-screen bg-gray-50" dir={isArabic ? 'rtl' : 'ltr'}>
      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToHome}
              title={isArabic ? 'العودة للصفحة الرئيسية' : "Retour à l'accueil"}
              className="flex items-center gap-1.5 p-2 -ml-2 text-gray-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition font-medium text-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={isArabic ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'}
                />
              </svg>
              <span className="hidden sm:inline">
                {isArabic ? 'الرئيسية' : 'Accueil'}
              </span>
            </button>
            <span className="h-6 w-px bg-gray-200 hidden sm:block" aria-hidden />
            <span className="h-8 w-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-lg" aria-hidden>
              🏥
            </span>
            <button
              type="button"
              onClick={onBackToHome}
              title={isArabic ? 'العودة للصفحة الرئيسية' : "Retour à l'accueil"}
              className="text-left rounded-lg hover:opacity-80 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <span className="text-lg font-extrabold text-blue-700 uppercase tracking-tight">CHIFAK</span>
              <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                {isArabic ? 'لوحة التحكم' : 'Dashboard'}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <LanguageToggle />
            <div className="hidden sm:flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5">
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                {adminUser?.username?.[0]?.toUpperCase()}
              </div>
              <span className="text-sm font-medium text-gray-700">{adminUser?.username}</span>
              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium capitalize">
                {adminUser?.role}
              </span>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">{isArabic ? 'خروج' : 'Déconnexion'}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-gray-900">
            {isArabic ? `مرحبًا، ${adminUser?.username} 👋` : `Bonjour, ${adminUser?.username} 👋`}
          </h1>
          <p className="text-gray-500 mt-1">
            {isArabic ? 'إدارة منصة شفاك' : 'Gestion de la plateforme chifak'}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((s, i) => (
            <div key={i} className={`bg-white border-2 rounded-2xl p-5 ${s.color}`}>
              <div className="text-3xl mb-2">{s.icon}</div>
              <div className={`text-3xl font-extrabold mb-1 ${s.textColor}`}>{s.value}</div>
              <div className="text-sm text-gray-600 font-medium">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="border-b border-gray-100">
            <div className="flex">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold border-b-2 transition ${
                    activeTab === tab.key
                      ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="p-6">
            {activeTab === 'add' ? <AddDoctorForm /> : activeTab === 'reviews' ? <AdminReviews /> : <DoctorsList />}
          </div>
        </div>
      </div>
    </div>
  );
}
