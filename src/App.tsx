import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import HomePage from './components/home/HomePage';
import SearchResults from './components/booking/SearchResults';
import PatientAccount from './components/patient/PatientAccount';
import BookingPage from './components/booking/BookingPage';
import ConfirmationPage from './components/booking/ConfirmationPage';
import LoginModal from './components/patient/LoginModal';
import SignupModal from './components/auth/SignupModal';
import OAuthCallback from './components/auth/OAuthCallback';
import AdminLogin from './components/admin/AdminLogin';
import AdminDashboard from './components/admin/AdminDashboard';
import DoctorSpace from './components/doctor/DoctorSpace';
import ProfessionalModal from './components/shared/ProfessionalModal';
import FeedbackPage from './components/doctor/FeedbackPage';
import { useAdminAuth } from './contexts/AdminAuthContext';
import { appointmentsAPI } from './services/api';
import PageTransition from './components/shared/PageTransition';

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
  hasPassword?: boolean;
  availableSlots: string[];
  nextAvailable: string;
  slotDuration?: number;
  workingDays?: number[];
  offDays?: string[];
  blockedSlots?: string[];
  /** Le praticien accepte-t-il les téléconsultations ? */
  acceptsVideo?: boolean;
  /** Heures ouvertes à la vidéo, sous-ensemble de availableSlots. */
  videoSlots?: string[];
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
  /** Mode retenu par le patient. 'cabinet' si le praticien ne fait pas de visio. */
  consultationType: 'cabinet' | 'video';
}

function isOAuthCallbackPath() {
  return window.location.pathname === '/auth/callback';
}

/** /avis/<jeton> : page publique ouverte par le QR code d'un employé. */
function feedbackTokenFromPath(): string | null {
  const m = window.location.pathname.match(/^\/avis\/([A-Za-z0-9_-]{8,64})\/?$/);
  return m ? m[1] : null;
}

export default function App() {
  const { isAuthenticated } = useAdminAuth();
  const [oauthDone, setOauthDone] = useState(!isOAuthCallbackPath());
  const [currentPage, setCurrentPage] = useState<'home' | 'search' | 'booking' | 'confirmation' | 'admin' | 'doctor' | 'account'>('home');
  const [searchQuery, setSearchQuery] = useState({ specialty: '', location: '', date: '' });
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  /* Créneau déjà cliqué dans la liste de résultats, à reporter tel quel sur
     la page de réservation. Un patient connecté ne doit choisir sa date et
     son heure qu'une seule fois ; un invité, en revanche, passe par la
     connexion avant de revenir ici, et ce détour lui fait de toute façon
     perdre le contexte de la recherche — autant le laisser resélectionner. */
  const [prefilledSlot, setPrefilledSlot] = useState<{ date: string; time: string; consultationType: 'cabinet' | 'video' } | null>(null);
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

  /* Page d'avis : rendue avant tout le reste, sans en-tête ni session — le
     médecin qui scanne le QR code ne doit pas avoir à se connecter. */
  const feedbackToken = feedbackTokenFromPath();
  if (feedbackToken) {
    return <FeedbackPage token={feedbackToken} />;
  }

  const handleSearch = (specialty: string, location: string, date: string) => {
    setSearchQuery({ specialty, location, date });
    setCurrentPage('search');
  };

  const handleDoctorSelect = (doctor: Doctor, date?: string, time?: string, consultationType?: 'cabinet' | 'video') => {
    const patientToken = localStorage.getItem('chifak_patient_token');
    if (!patientToken) {
      setPendingDoctor(doctor);
      setAuthModal('login');
      return;
    }

    setSelectedDoctor(doctor);
    setPrefilledSlot(date && time ? { date, time, consultationType: consultationType || 'cabinet' } : null);
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
        consultationType: bookingData.consultationType,
      });

      setBooking(bookingData);
      setPrefilledSlot(null);
      setCurrentPage('confirmation');
    } catch (error) {
      alert('Erreur lors de l\'enregistrement du rendez-vous. Réessayez.');
    }
  };

  const handleBackToHome = () => {
    setCurrentPage('home');
    setSearchQuery({ specialty: '', location: '', date: '' });
    setSelectedDoctor(null);
    setPrefilledSlot(null);
    setBooking(null);
  };

  const handleBackToSearch = () => {
    setCurrentPage('search');
    setSelectedDoctor(null);
    setPrefilledSlot(null);
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
            initialDate={prefilledSlot?.date}
            initialTime={prefilledSlot?.time}
            initialConsultationType={prefilledSlot?.consultationType}
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

      {/* L'assistant d'orientation n'est plus une bulle flottante : il vit
          dans le hero de la page d'accueil (onglet « Je ne sais pas qui
          consulter »), là où le patient hésite réellement. */}
    </div>
  );
}
