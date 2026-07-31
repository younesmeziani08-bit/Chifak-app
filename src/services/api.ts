import { Doctor } from '../App';
import { API_URL } from '../config';

const DEMO_APPOINTMENTS_KEY = 'chifak_demo_appointments';

// Récupérer le token du localStorage
const getToken = (): string | null => {
  return localStorage.getItem('chifak_admin_token');
};

// Headers avec authentification
const getAuthHeaders = () => {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

// ==================== AUTH ====================

export const authAPI = {
  login: async (username: string, password: string) => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erreur de connexion');
    }

    const data = await response.json();
    
    // Sauvegarder le token
    localStorage.setItem('chifak_admin_token', data.token);
    
    return data;
  },

  verify: async () => {
    const response = await fetch(`${API_URL}/auth/verify`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Token invalide');
    }

    return await response.json();
  },

  logout: () => {
    localStorage.removeItem('chifak_admin_token');
  }
};

export const doctorAuthAPI = {
  login: async (doctorCode: string) => {
    const response = await fetch(`${API_URL}/auth/login-doctor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doctorCode })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Code médecin invalide');
    }

    const data = await response.json();
    localStorage.setItem('chifak_doctor_token', data.token);
    return data;
  },

  logout: () => {
    localStorage.removeItem('chifak_doctor_token');
  }
};

// ==================== DOCTORS ====================

export interface DoctorCreate {
  name: string;
  specialty: string;
  address: string;
  city: string;
  phone?: string;
  email?: string;
  doctorCode?: string;
  image?: string;
  availableSlots?: string[];
  nextAvailable?: string;
  slotDuration?: number;
  workingDays?: number[];
  latitude?: number;
  longitude?: number;
  mapsUrl?: string;
}

export const doctorsAPI = {
  getAll: async (specialty?: string, location?: string): Promise<Doctor[]> => {
    const params = new URLSearchParams();
    if (specialty) params.append('specialty', specialty);
    if (location) params.append('location', location);

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

// ==================== APPOINTMENTS ====================

export interface AppointmentCreate {
  doctorId: number;
  doctorName?: string;
  doctorSpecialty?: string;
  doctorAddress?: string;
  doctorCity?: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  appointmentDate: string;
  appointmentTime: string;
  reason?: string;
}

export const appointmentsAPI = {
  create: async (appointment: AppointmentCreate) => {
    const patientToken = localStorage.getItem('chifak_patient_token');

    // Mode démo local: persiste les rendez-vous sans backend patient token valide
    if (patientToken === 'demo-local-token') {
      const existing = JSON.parse(localStorage.getItem(DEMO_APPOINTMENTS_KEY) || '[]');
      const demoItem = {
        id: Date.now(),
        doctor_name: appointment.doctorName || `Dr. #${appointment.doctorId}`,
        specialty: appointment.doctorSpecialty || '',
        address: appointment.doctorAddress || '',
        city: appointment.doctorCity || '',
        appointment_date: appointment.appointmentDate,
        appointment_time: appointment.appointmentTime,
        status: 'confirmed',
      };
      localStorage.setItem(DEMO_APPOINTMENTS_KEY, JSON.stringify([demoItem, ...existing]));
      return demoItem;
    }

    const response = await fetch(`${API_URL}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appointment)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erreur lors de la création du rendez-vous');
    }

    return await response.json();
  },

  getAll: async () => {
    const response = await fetch(`${API_URL}/appointments`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des rendez-vous');
    }

    return await response.json();
  },

  getMy: async () => {
    const patientToken = localStorage.getItem('chifak_patient_token');

    if (patientToken === 'demo-local-token') {
      return JSON.parse(localStorage.getItem(DEMO_APPOINTMENTS_KEY) || '[]');
    }

    const response = await fetch(`${API_URL}/patient/appointments`, {
      headers: {
        'Content-Type': 'application/json',
        ...(patientToken && { Authorization: `Bearer ${patientToken}` }),
      },
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération de vos rendez-vous');
    }

    return await response.json();
  },

  // Créneaux déjà pris un jour donné (tous médecins) -> [{ doctor_id, appointment_time }]
  getBookedSlots: async (date: string): Promise<{ doctor_id: number; appointment_time: string }[]> => {
    try {
      const response = await fetch(`${API_URL}/booked-slots?date=${encodeURIComponent(date)}`);
      if (!response.ok) return [];
      return await response.json();
    } catch {
      return [];
    }
  }
};

// ==================== PATIENT (profil) ====================

export interface PatientProfile {
  id: number;
  email: string;
  name: string;
  phone: string;
  balance?: number;
}

const patientHeaders = () => {
  const token = localStorage.getItem('chifak_patient_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

export const patientAPI = {
  getProfile: async (): Promise<PatientProfile> => {
    const response = await fetch(`${API_URL}/patient/profile`, { headers: patientHeaders() });
    if (!response.ok) throw new Error('Erreur lors de la récupération de votre profil');
    return await response.json();
  },

  updateProfile: async (data: { name?: string; phone?: string }): Promise<PatientProfile> => {
    const response = await fetch(`${API_URL}/patient/profile`, {
      method: 'PUT',
      headers: patientHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Erreur lors de la mise à jour du profil');
    }
    return await response.json();
  },
};

// ==================== CONSULTATIONS ====================

export interface ConsultationCreate {
  patientName: string;
  patientPhone?: string;
  patientEmail?: string;
  stateDescription?: string;
  progressNotes?: string;
  nextAppointmentId?: number;
}

export const consultationsAPI = {
  create: async (consultation: ConsultationCreate) => {
    const token = localStorage.getItem('chifak_doctor_token');
    const response = await fetch(`${API_URL}/consultations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      body: JSON.stringify(consultation)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erreur lors de l\'enregistrement');
    }

    return await response.json();
  },

  getMy: async () => {
    const token = localStorage.getItem('chifak_doctor_token');
    const response = await fetch(`${API_URL}/consultations`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des consultations');
    }

    return await response.json();
  }
};

// ==================== STATS ====================

export const statsAPI = {
  get: async () => {
    const response = await fetch(`${API_URL}/stats`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des statistiques');
    }

    return await response.json();
  }
};
