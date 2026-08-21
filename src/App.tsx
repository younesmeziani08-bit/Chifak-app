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
import DoctorSpace from './components/doctor/DoctorSpace';
import ProfessionalModal from './components/shared/ProfessionalModal';
import FeedbackPage from './components/doctor/FeedbackPage';
import { appointmentsAPI, patientAPI } from './services/api';
import PageTransition from './components/shared/PageTransition';

/* Les types Doctor et Booking vivent désormais dans types/metier.ts.
   Les écrans d'administration les importaient d'ici, ce qui aurait entraîné
   toute cette application dans leur paquet. Ils sont réexportés pour que les
   imports existants continuent de fonctionner. */
import type { Doctor, Booking } from './types/metier';
export type { Doctor, Booking };

function isOAuthCallbackPath() {
  return window.location.pathname === '/auth/callback';
}

/** /avis/<jeton> : page publique ouverte par le QR code d'un employé. */
function feedbackTokenFromPath(): string | null {
  const m = window.location.pathname.match(/^\/avis\/([A-Za-z0-9_-]{8,64})\/?$/);
  return m ? m[1] : null;
}

export default function App() {
  const [oauthDone, setOauthDone] = useState(!isOAuthCallbackPath());
  const [currentPage, setCurrentPage] = useState<'home' | 'search' | 'booking' | 'confirmation' | 'doctor' | 'account'>('home');
  const [searchQuery, setSearchQuery] = useState<{
    specialty: string; location: string; date: string; videoOnly?: boolean;
  }>({ specialty: '', location: '', date: '' });
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
    /* ── La session affichée doit être une session réelle ──
       Le nom du patient était repris du stockage local et affiché tel quel,
       sans jamais demander au serveur si le jeton valait encore quelque chose.
       Les jetons expirent au bout de vingt-quatre heures : quelqu'un qui
       revenait le lendemain se voyait connecté, ouvrait ses rendez-vous, et
       tombait sur une liste vide ou une erreur — sans le moindre indice que
       sa session avait simplement expiré.

       On affiche d'abord la session mémorisée, pour ne pas faire clignoter
       l'interface, puis on la confirme auprès du serveur. Si elle est
       refusée, on la referme proprement. */
    const rawUser = localStorage.getItem('chifak_patient_user');
    const token = localStorage.getItem('chifak_patient_token');

    if (rawUser && token) {
      try {
        setPatientUser(JSON.parse(rawUser));
      } catch {
        localStorage.removeItem('chifak_patient_user');
      }
    } else if (rawUser || token) {
      // L'un sans l'autre : reste d'une session interrompue.
      localStorage.removeItem('chifak_patient_user');
      localStorage.removeItem('chifak_patient_token');
    }

    if (token) {
      patientAPI.getProfile()
        .then((profil) => {
          const frais = { id: profil.id, email: profil.email, name: profil.name || profil.email };
          setPatientUser(frais);
          localStorage.setItem('chifak_patient_user', JSON.stringify(frais));
        })
        .catch((err: Error & { status?: number }) => {
          /* Une panne réseau n'est pas une session invalide : on ne déconnecte
             que si le serveur a répondu qu'il ne reconnaît pas le jeton. */
          if (err?.status !== 401 && err?.status !== 403) return;
          localStorage.removeItem('chifak_patient_token');
          localStorage.removeItem('chifak_patient_user');
          setPatientUser(null);
        });
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('login') === '1' || params.get('auth_error') === '1') {
      /* Le refus d'une connexion sociale porte parfois un motif — « un compte
         existe déjà avec cette adresse, connectez-vous par mot de passe ».
         Il était ignoré : la fenêtre de connexion s'ouvrait vide, et la
         personne relançait la même connexion sociale qui ne peut pas aboutir.
         On l'affiche avant d'ouvrir la fenêtre. */
      const motif = params.get('motif');
      if (motif) alert(motif);
      setAuthModal('login');
      window.history.replaceState({}, '', window.location.pathname);
    }
    const oauth = params.get('oauth');
    if (oauth === 'unconfigured') {
      /* Le message citait le compte de démonstration et son mot de passe, en
         clair, à tout visiteur cliquant sur « Continuer avec Google ». On
         renvoie désormais vers l'inscription normale — la seule chose utile à
         quelqu'un qui voulait créer un compte. */
      const provider = params.get('provider') === 'facebook' ? 'Facebook' : 'Google';
      alert(
        `La connexion ${provider} n'est pas disponible pour le moment.\n`
        + 'Créez un compte avec votre adresse e-mail.'
      );
      setAuthModal('signup');
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

  const handleSearch = (specialty: string, location: string, date: string, videoOnly?: boolean) => {
    setSearchQuery({ specialty, location, date, videoOnly });
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
        forChild: bookingData.forChild,
        childFirstName: bookingData.childFirstName,
        childLastName: bookingData.childLastName,
        childAge: bookingData.childAge,
      });

      setBooking(bookingData);
      setPrefilledSlot(null);
      setCurrentPage('confirmation');
    } catch (error) {
      /* Le message du serveur est affiché tel quel.

         L'ancien texte générique — « Erreur lors de l'enregistrement,
         réessayez » — masquait tout : créneau déjà pris, âge d'enfant
         invalide, session expirée. Le patient réessayait indéfiniment la même
         chose, et personne ne pouvait diagnostiquer quoi que ce soit. Le
         serveur formule déjà des messages clairs et sans détail technique :
         autant les montrer. */
      alert(error instanceof Error && error.message
        ? error.message
        : 'Erreur lors de l\'enregistrement du rendez-vous. Réessayez.');
      console.error('Échec de la réservation :', error);
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

  /* L'espace d'administration ne vit plus ici.
     C'est une application distincte, servie depuis un autre domaine — voir
     admin/. Cette page en portait les deux écrans, donc leur code partait
     dans le navigateur de chaque patient : deux mille six cents lignes qui
     décrivaient, à qui ouvrait la console, l'intégralité de la surface
     d'administration. */

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
            /* Espace patient, et non espace médecin : c'est là que se
               corrigent le nom, l'e-mail et le téléphone que la réservation
               relit sur le compte. */
            onOpenAccount={() => setCurrentPage('account')}
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
