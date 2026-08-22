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
import AnnulationParLien from './components/booking/AnnulationParLien';
import PagesLegales from './components/legal/PagesLegales';
import { memoriser, reprendre, oublier } from './utils/reservationEnAttente';
import ReservationDevantLaPorte from './components/booking/ReservationDevantLaPorte';
import PlaceRetenue from './components/booking/PlaceRetenue';
import MonInscriptionAttente from './components/booking/MonInscriptionAttente';
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

/**
 * /rdv/<jeton> : voir et annuler un rendez-vous SANS COMPTE.
 *
 * Le lien part dans l'e-mail de confirmation. Il existe parce qu'une seule
 * route pouvait annuler un rendez-vous, et qu'elle exigeait un jeton patient :
 * celui qui avait réservé en invité — un parcours que l'application propose
 * délibérément — n'avait aucun moyen de se décommander.
 */
function jetonRendezVousDepuisUrl(): string | null {
  const m = window.location.pathname.match(/^\/rdv\/([A-Za-z0-9_-]{8,64})\/?$/);
  return m ? m[1] : null;
}

/**
 * /dr/<id> — le QR code affiché sur la porte d'un cabinet.
 *
 * Quelqu'un s'est déplacé et se tient devant une porte, souvent fermée. Il
 * scanne, voit les créneaux libres de CE praticien, en choisit un, et repart
 * avec un rendez-vous. Pas de recherche, pas de compte, pas de code par
 * courrier à attendre sur un trottoir.
 *
 * L'adresse porte l'identifiant du praticien, en clair : un QR code s'imprime
 * une fois et reste collé des années sur une porte. Un jeton aléatoire, lui,
 * se révoque — et le jour où l'on en révoquerait un, toutes les affiches déjà
 * posées deviendraient muettes sans que personne ne comprenne pourquoi.
 * Il n'y a d'ailleurs rien à protéger ici : les horaires d'un praticien sont
 * publics, c'est même le but.
 */
function idMedecinDepuisUrl(): number | null {
  const m = window.location.pathname.match(/^\/dr\/(\d{1,9})\/?$/);
  return m ? Number(m[1]) : null;
}

/**
 * /place/<jeton> — « une place s'est libérée, la voulez-vous ? »
 * /attente/<jeton> — mon inscription sur une liste d'attente.
 *
 * Les deux ouvrent depuis un courrier, sans compte. Un créneau qui se libère
 * repartait auparavant dans le tas sans que personne ne le sache ; il est
 * maintenant proposé au premier de la file, et retenu deux heures le temps
 * qu'il réponde.
 */
function jetonDepuisUrl(prefixe: string): string | null {
  const m = window.location.pathname.match(
    new RegExp(`^/${prefixe}/([A-Za-z0-9_-]{8,64})/?$`),
  );
  return m ? m[1] : null;
}

/**
 * Pages légales : conditions, confidentialité, mentions.
 *
 * Elles n'existaient pas. Le service collecte des motifs de consultation, des
 * téléphones et l'identité de mineurs sans dire nulle part ce qu'il en fait,
 * combien de temps, ni quels droits ont les personnes concernées.
 *
 * Adresses en clair plutôt qu'un état d'application : ces pages doivent
 * pouvoir être liées depuis un e-mail, un contrat, ou une capture d'écran.
 */
const PAGES_LEGALES = {
  '/conditions': 'conditions',
  '/confidentialite': 'confidentialite',
  '/mentions-legales': 'mentions',
} as const;

function pageLegaleDepuisUrl(): 'conditions' | 'confidentialite' | 'mentions' | null {
  const chemin = window.location.pathname.replace(/\/$/, '');
  return PAGES_LEGALES[chemin as keyof typeof PAGES_LEGALES] ?? null;
}

export default function App() {
  const [oauthDone, setOauthDone] = useState(!isOAuthCallbackPath());
  const [currentPage, setCurrentPage] = useState<'home' | 'search' | 'booking' | 'confirmation' | 'doctor' | 'account'>('home');
  const [searchQuery, setSearchQuery] = useState<{
    specialty: string; location: string; date: string; videoOnly?: boolean;
  }>({ specialty: '', location: '', date: '' });
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  /* Créneau déjà cliqué dans la liste de résultats, reporté tel quel sur la
     page de réservation.

     Il était perdu dès qu'on demandait au visiteur de se connecter : seul le
     praticien était retenu, et la personne devait rechercher son créneau une
     seconde fois — celui qu'elle venait de choisir trente secondes plus tôt.
     Le choix survit maintenant à la connexion, y compris à celle par Google
     qui recharge entièrement la page. Voir utils/reservationEnAttente.ts. */
  const [prefilledSlot, setPrefilledSlot] = useState<{ date: string; time: string; consultationType: 'cabinet' | 'video' } | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [authModal, setAuthModal] = useState<'login' | 'signup' | null>(null);
  const [isProModalOpen, setIsProModalOpen] = useState(false);
  const [patientUser, setPatientUser] = useState<{ id: number; name: string; email: string } | null>(null);

  /* ── Reprise après une connexion qui a rechargé la page ──
     Google et Facebook quittent l'application : le navigateur revient sur une
     page entièrement redémarrée, où aucun état React n'a survécu. Sans cette
     reprise, le visiteur qui avait cliqué « 09:00 » se retrouvait sur
     l'accueil, sans praticien ni créneau, et sans comprendre pourquoi.

     `oauthDone` retarde la reprise jusqu'à ce que le jeton soit posé : lancée
     plus tôt, elle ne verrait pas encore de session et jetterait le choix. */
  useEffect(() => {
    if (!oauthDone) return;
    if (!localStorage.getItem('chifak_patient_token')) return;

    const attente = reprendre();
    if (attente) {
      ouvrirReservation(attente.doctor, attente.date, attente.time, attente.consultationType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oauthDone]);

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

  /* Réservation depuis la porte du cabinet : avant tout le reste, sans
     en-tête ni session. C'est le chemin le plus court qui existe dans
     l'application, et il doit le rester. */
  const idMedecin = idMedecinDepuisUrl();
  if (idMedecin) {
    return (
      <ReservationDevantLaPorte
        doctorId={idMedecin}
        onRetourAccueil={() => { window.location.href = '/'; }}
      />
    );
  }

  /* Liste d'attente : la place proposée, et l'inscription elle-même. Avant
     tout le reste, sans en-tête ni session — le lien vient d'un courrier. */
  const jetonPlace = jetonDepuisUrl('place');
  if (jetonPlace) {
    return (
      <PlaceRetenue jeton={jetonPlace} onRetourAccueil={() => { window.location.href = '/'; }} />
    );
  }

  const jetonAttente = jetonDepuisUrl('attente');
  if (jetonAttente) {
    return (
      <MonInscriptionAttente jeton={jetonAttente} onRetourAccueil={() => { window.location.href = '/'; }} />
    );
  }

  /* Pages légales : publiques, sans session, avant tout le reste. */
  const pageLegale = pageLegaleDepuisUrl();
  if (pageLegale) {
    return <PagesLegales page={pageLegale} onRetour={() => { window.location.href = '/'; }} />;
  }

  /* Annulation par lien : même principe, aucune session requise. Le jeton du
     courrier de confirmation tient lieu d'authentification. */
  const jetonRdv = jetonRendezVousDepuisUrl();
  if (jetonRdv) {
    return (
      <AnnulationParLien
        jeton={jetonRdv}
        onRetourAccueil={() => { window.location.href = '/'; }}
      />
    );
  }

  const handleSearch = (specialty: string, location: string, date: string, videoOnly?: boolean) => {
    setSearchQuery({ specialty, location, date, videoOnly });
    setCurrentPage('search');
  };

  /** Ouvre la réservation sur le praticien et le créneau choisis. */
  const ouvrirReservation = (
    doctor: Doctor, date?: string, time?: string, consultationType?: 'cabinet' | 'video',
  ) => {
    setSelectedDoctor(doctor);
    setPrefilledSlot(date && time ? { date, time, consultationType: consultationType || 'cabinet' } : null);
    setCurrentPage('booking');
  };

  const handleDoctorSelect = (doctor: Doctor, date?: string, time?: string, consultationType?: 'cabinet' | 'video') => {
    const patientToken = localStorage.getItem('chifak_patient_token');
    if (!patientToken) {
      /* Le créneau part en attente AVEC le praticien. Il était laissé de côté
         ici, et la personne devait le rechercher après s'être connectée. */
      memoriser({ doctor, date, time, consultationType });
      setAuthModal('login');
      return;
    }

    ouvrirReservation(doctor, date, time, consultationType);
  };

  const handlePatientLogout = () => {
    // Un choix mis de côté n'a plus de titulaire : on l'oublie.
    oublier();
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

    /* On reprend le praticien ET le créneau : c'est tout l'intérêt: la
       personne retrouve la page de réservation à l'heure qu'elle avait déjà
       choisie, sans avoir à la rechercher. */
    const attente = reprendre();
    if (attente) {
      ouvrirReservation(attente.doctor, attente.date, attente.time, attente.consultationType);
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
      {/* Fermer la fenêtre sans aller au bout, c'est renoncer : on oublie le
          créneau mis de côté. Sans cela, il resurgirait à la prochaine
          connexion — la personne se retrouverait devant un formulaire de
          réservation qu'elle n'a pas redemandé, pour une heure choisie une
          heure plus tôt. Passer de la connexion à l'inscription, en revanche,
          n'est pas un renoncement : le choix reste. */}
      <LoginModal
        isOpen={authModal === 'login'}
        onClose={() => { oublier(); setAuthModal(null); }}
        onOpenSignup={() => setAuthModal('signup')}
        onLoginSuccess={handlePatientLoginSuccess}
      />
      <SignupModal
        isOpen={authModal === 'signup'}
        onClose={() => { oublier(); setAuthModal(null); }}
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
