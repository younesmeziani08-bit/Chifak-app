import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import HomePage from './components/HomePage';
import SearchResults from './components/SearchResults';
import PatientAccount from './components/PatientAccount';
import BookingPage from './components/BookingPage';
import ConfirmationPage from './components/ConfirmationPage';
import LoginModal from './components/LoginModal';
import SignupModal from './components/auth/SignupModal';
import OAuthCallback from './components/auth/OAuthCallback';
import AdminLogin from './components/admin/AdminLogin';
import AdminDashboard from './components/admin/AdminDashboard';
import DoctorSpace from './components/DoctorSpace';
import ProfessionalModal from './components/ProfessionalModal';
import { useAdminAuth } from './contexts/AdminAuthContext';
import { appointmentsAPI } from './services/api';
import PageTransition from './components/PageTransition';

export interface Doctor {
  id: number;
  name: string;
  specialty: string;
  address: string;
  city: string;
  rating: number;
  reviewCount: number;
  image: string;
  doctorCode?: string;
  availableSlots: string[];
  nextAvailable: string;
  slotDuration?: number;
  workingDays?: number[];
  offDays?: string[];
  description?: string;
  bio?: string;
  latitude?: number;
  longitude?: number;
  mapsUrl?: string;
}

export interface Booking {
  doctor: Doctor;
  date: string;
  time: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  reason: string;
}

function isOAuthCallbackPath() {
  return window.location.pathname === '/auth/callback';
}

export default function App() {
  const { isAuthenticated } = useAdminAuth();
  const [oauthDone, setOauthDone] = useState(!isOAuthCallbackPath());
  const [currentPage, setCurrentPage] = useState<'home' | 'search' | 'booking' | 'confirmation' | 'admin' | 'doctor' | 'account'>('home');
  const [searchQuery, setSearchQuery] = useState({ specialty: '', location: '', date: '' });
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [authModal, setAuthModal] = useState<'login' | 'signup' | null>(null);
  const [isProModalOpen, setIsProModalOpen] = useState(false);
  const [pendingDoctor, setPendingDoctor] = useState<Doctor | null>(null);
  const [patientUser, setPatientUser] = useState<{ id: number; name: string; email: string } | null>(null);

  useEffect(() => {
    const rawUser = localStorage.getItem('chifak_patient_user');
    if (rawUser) {
      try {
        setPatientUser(JSON.parse(rawUser));
      } catch (e) {
        console.error('Failed to parse patient user');
      }
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('login') === '1' || params.get('auth_error') === '1') {
      setAuthModal('login');
      window.history.replaceState({}, '', window.location.pathname);
    }
    const oauth = params.get('oauth');
    if (oauth === 'unconfigured') {
      const provider = params.get('provider') === 'facebook' ? 'Facebook' : 'Google';
      alert(
        `Connexion ${provider} non configurée.\nUtilisez le compte démo : demo.patient@chifak.dz / patient123`
      );
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // App native : écoute le retour OAuth via lien profond (chifak://auth/callback?token=...)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cleanup: (() => void) | undefined;
    import('./utils/nativeAuth').then((m) => {
      cleanup = m.registerOAuthDeepLink((user) => {
        setPatientUser(user);
        setAuthModal(null);
      });
    });
    return () => cleanup?.();
  }, []);

  if (isOAuthCallbackPath() && !oauthDone) {
    return <OAuthCallback onComplete={() => setOauthDone(true)} />;
  }

  const handleSearch = (specialty: string, location: string, date: string) => {
    setSearchQuery({ specialty, location, date });
    setCurrentPage('search');
  };

  const handleDoctorSelect = (doctor: Doctor) => {
    const patientToken = localStorage.getItem('chifak_patient_token');
    if (!patientToken) {
      setPendingDoctor(doctor);
      setAuthModal('login');
      return;
    }

    setSelectedDoctor(doctor);
    setCurrentPage('booking');
  };

  const handlePatientLogout = () => {
    localStorage.removeItem('chifak_patient_token');
    localStorage.removeItem('chifak_patient_user');
    setPatientUser(null);
    setCurrentPage('home');
  };

  const handleOpenAccount = () => {
    if (patientUser) {
      setCurrentPage('account');
    } else {
      setAuthModal('login');
    }
  };

  const handleProfileUpdated = (user: { id: number; name: string; email: string }) => {
    setPatientUser(user);
  };

  const handlePatientLoginSuccess = () => {
    const rawUser = localStorage.getItem('chifak_patient_user');
    if (rawUser) {
      setPatientUser(JSON.parse(rawUser));
    }
    setAuthModal(null);
    if (pendingDoctor) {
      setSelectedDoctor(pendingDoctor);
      setCurrentPage('booking');
      setPendingDoctor(null);
    }
  };

  const handleBookingComplete = async (bookingData: Booking) => {
    try {
      await appointmentsAPI.create({
        doctorId: bookingData.doctor.id,
        doctorName: bookingData.doctor.name,
        doctorSpecialty: bookingData.doctor.specialty,
        doctorAddress: bookingData.doctor.address,
        doctorCity: bookingData.doctor.city,
        patientName: bookingData.patientName,
        patientEmail: bookingData.patientEmail,
        patientPhone: bookingData.patientPhone,
        appointmentDate: bookingData.date,
        appointmentTime: bookingData.time,
        reason: bookingData.reason,
      });

      setBooking(bookingData);
      setCurrentPage('confirmation');
    } catch (error) {
      alert('Erreur lors de l\'enregistrement du rendez-vous. Réessayez.');
    }
  };

  const handleBackToHome = () => {
    setCurrentPage('home');
    setSearchQuery({ specialty: '', location: '', date: '' });
    setSelectedDoctor(null);
    setBooking(null);
  };

  const handleBackToSearch = () => {
    setCurrentPage('search');
    setSelectedDoctor(null);
  };

  // Check if we're on doctor space
  if (currentPage === 'doctor') {
    return <DoctorSpace onBackToHome={handleBackToHome} />;
  }

  // Check if we're on admin page
  if (currentPage === 'admin') {
    if (!isAuthenticated) {
      return <AdminLogin onLoginSuccess={() => setCurrentPage('admin')} onBackToHome={handleBackToHome} />;
    }
    return <AdminDashboard onBackToHome={handleBackToHome} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <LoginModal
        isOpen={authModal === 'login'}
        onClose={() => setAuthModal(null)}
        onOpenSignup={() => setAuthModal('signup')}
        onLoginSuccess={handlePatientLoginSuccess}
      />
      <SignupModal
        isOpen={authModal === 'signup'}
        onClose={() => setAuthModal(null)}
        onOpenLogin={() => setAuthModal('login')}
        onSuccess={() => {
          handlePatientLoginSuccess();
          setAuthModal(null);
        }}
      />

      <ProfessionalModal 
        isOpen={isProModalOpen} 
        onClose={() => setIsProModalOpen(false)} 
      />

      {currentPage === 'home' && (
        <PageTransition pageKey="home">
          <HomePage
            onSearch={handleSearch}
            onAdminClick={() => setCurrentPage('admin')}
            onDoctorClick={() => setCurrentPage('doctor')}
            onOpenLogin={() => setAuthModal('login')}
            onOpenSignup={() => setAuthModal('signup')}
            onOpenProfessional={() => setIsProModalOpen(true)}
            onOpenAccount={handleOpenAccount}
            patientUser={patientUser}
            onLogout={handlePatientLogout}
          />
        </PageTransition>
      )}
      {currentPage === 'search' && (
        <PageTransition pageKey="search">
          <SearchResults
            searchQuery={searchQuery}
            onDoctorSelect={handleDoctorSelect}
            onBackToHome={handleBackToHome}
            onDoctorClick={() => setCurrentPage('doctor')}
            onOpenLogin={() => setAuthModal('login')}
            onOpenSignup={() => setAuthModal('signup')}
            onOpenProfessional={() => setIsProModalOpen(true)}
            onOpenAccount={handleOpenAccount}
            patientUser={patientUser}
            onLogout={handlePatientLogout}
          />
        </PageTransition>
      )}
      {currentPage === 'account' && patientUser && (
        <PageTransition pageKey="account">
          <PatientAccount
            patientUser={patientUser}
            onBackToHome={handleBackToHome}
            onOpenProfessional={() => setIsProModalOpen(true)}
            onDoctorClick={() => setCurrentPage('doctor')}
            onLogout={handlePatientLogout}
            onProfileUpdated={handleProfileUpdated}
          />
        </PageTransition>
      )}
      {currentPage === 'booking' && selectedDoctor && (
        <PageTransition pageKey="booking">
          <BookingPage
            doctor={selectedDoctor}
            onBookingComplete={handleBookingComplete}
            onBack={handleBackToSearch}
            onBackToHome={handleBackToHome}
            onDoctorClick={() => setCurrentPage('doctor')}
            onOpenLogin={() => setAuthModal('login')}
            onOpenSignup={() => setAuthModal('signup')}
            onOpenProfessional={() => setIsProModalOpen(true)}
            patientUser={patientUser}
            onLogout={handlePatientLogout}
          />
        </PageTransition>
      )}
      {currentPage === 'confirmation' && booking && (
        <PageTransition pageKey="confirmation">
          <ConfirmationPage
            booking={booking}
            onBackToHome={handleBackToHome}
            onOpenProfessional={() => setIsProModalOpen(true)}
            onOpenLogin={() => setAuthModal('login')}
            onOpenSignup={() => setAuthModal('signup')}
            patientUser={patientUser}
            onLogout={handlePatientLogout}
          />
        </PageTransition>
      )}
    </div>
  );
}
