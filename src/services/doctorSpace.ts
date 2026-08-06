import type { BlockedSlotEntry } from '../utils/slots';
import { API_URL, doctorHeaders } from './http';

// ==================== ESPACE MÉDECIN ====================


export interface DoctorProfile {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  specialty: string;
  doctorCode?: string;
  description: string;
  bio: string;
  slotDuration: number;
  offDays: string[];
  /** Créneaux réservés par le médecin (chaîne ou objet avec le patient) */
  blockedSlots?: BlockedSlotEntry[];
  /** Le praticien accepte-t-il les téléconsultations ? */
  acceptsVideo?: boolean;
  /** Heures ouvertes à la vidéo, sous-ensemble de availableSlots. */
  videoSlots?: string[];
  availableSlots?: string[];
  workingDays?: number[];
}

export const doctorAPI = {
  getProfile: async (): Promise<DoctorProfile> => {
    const response = await fetch(`${API_URL}/doctor/profile`, { headers: doctorHeaders() });
    if (!response.ok) throw new Error('Erreur lors de la récupération du profil');
    return await response.json();
  },

  updateProfile: async (data: { description?: string; bio?: string; slotDuration?: number; offDays?: string[]; blockedSlots?: BlockedSlotEntry[]; acceptsVideo?: boolean; videoSlots?: string[] }) => {
    const response = await fetch(`${API_URL}/doctor/profile`, {
      method: 'PUT',
      headers: doctorHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Erreur lors de la mise à jour');
    }
    return await response.json();
  },

  getAppointments: async () => {
    const response = await fetch(`${API_URL}/doctor/appointments`, { headers: doctorHeaders() });
    if (!response.ok) throw new Error('Erreur lors de la récupération des rendez-vous');
    return await response.json();
  },

  saveNotes: async (id: number, notes: string) => {
    const response = await fetch(`${API_URL}/doctor/appointments/${id}/notes`, {
      method: 'PATCH',
      headers: doctorHeaders(),
      body: JSON.stringify({ notes }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Erreur lors de l\'enregistrement');
    }
    return await response.json();
  },
};

