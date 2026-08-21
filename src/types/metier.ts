/**
 * Types métier partagés par les deux applications.
 *
 * Ils vivaient dans `App.tsx`. Les écrans d'administration les y importaient,
 * ce qui aurait suffi à entraîner toute l'application patiente — recherche,
 * réservation, assistant, page d'accueil — dans le paquet livré à
 * l'administration. Un type n'a aucune raison de traîner une application
 * derrière lui : il vit désormais seul.
 */

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
  /* Rendez-vous pris pour un enfant mineur : le compte reste celui du parent,
     seul le nom présenté au praticien change. */
  forChild?: boolean;
  childFirstName?: string;
  childLastName?: string;
  childAge?: number;
}
