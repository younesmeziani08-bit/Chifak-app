import { Doctor } from '../App';
import { API_URL, getAuthHeaders } from './http';

// ==================== DOCTORS ====================

export interface DoctorCreate {
  name: string;
  specialty: string;
  address: string;
  city: string;
  phone?: string;
  email?: string;
  doctorCode?: string;
  password?: string;
  image?: string;
  availableSlots?: string[];
  nextAvailable?: string;
  slotDuration?: number;
  workingDays?: number[];
  latitude?: number;
  longitude?: number;
  mapsUrl?: string;
  /** Le praticien accepte-t-il les téléconsultations ? */
  acceptsVideo?: boolean;
}

export const doctorsAPI = {
  /** `videoOnly` filtre en base : le navigateur ne reçoit que les praticiens
   *  concernés, au lieu de tout télécharger pour trier ensuite. */
  getAll: async (specialty?: string, location?: string, videoOnly?: boolean): Promise<Doctor[]> => {
    const params = new URLSearchParams();
    if (specialty) params.append('specialty', specialty);
    if (location) params.append('location', location);
    if (videoOnly) params.append('video', '1');

    const url = API_URL + '/doctors' + (params.toString() ? '?' + params.toString() : '');
    
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des médecins');
    }

    return await response.json();
  },

  getById: async (id: number): Promise<Doctor> => {
    const response = await fetch(`${API_URL}/doctors/${id}`);

    if (!response.ok) {
      throw new Error('Médecin non trouvé');
    }

    return await response.json();
  },

  create: async (doctor: DoctorCreate): Promise<Doctor> => {
    const response = await fetch(`${API_URL}/doctors`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(doctor)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erreur lors de la création du médecin');
    }

    return await response.json();
  },

  update: async (id: number, doctor: Partial<DoctorCreate>): Promise<Doctor> => {
    const response = await fetch(`${API_URL}/doctors/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(doctor)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erreur lors de la modification du médecin');
    }

    return await response.json();
  },

  delete: async (id: number): Promise<void> => {
    const response = await fetch(`${API_URL}/doctors/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erreur lors de la suppression du médecin');
    }
  }
};

