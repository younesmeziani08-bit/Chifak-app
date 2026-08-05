import { Doctor } from '../App';
import { API_URL } from '../config';
import type { BlockedSlotEntry } from '../utils/slots';

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

// ==================== ASSISTANT SANTÉ (IA) ====================

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Langue de conversation choisie par le patient au démarrage. */
export type AssistantLang = 'ar' | 'fr';

export interface AssistantReply {
  reply: string;
  /** Spécialité suggérée, ou null tant que l'assistant n'a pas assez d'éléments. */
  orientation: string | null;
  /** Réponses rapides à proposer au patient. Vide une fois l'orientation donnée. */
  options: string[];
}

/** Levée quand la session patient manque ou a expiré (HTTP 401 / 403). */
export class AssistantAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssistantAuthError';
  }
}

export const assistantAPI = {
  chat: async (messages: AssistantMessage[], lang: AssistantLang): Promise<AssistantReply> => {
    const token = localStorage.getItem('chifak_patient_token');
    const response = await fetch(`${API_URL}/assistant/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ messages, lang }),
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401 || response.status === 403) {
      throw new AssistantAuthError(data.error || 'Session expirée');
    }
    if (!response.ok) {
      // Le backend renvoie souvent un champ "reply" lisible même en cas d'erreur
      throw new Error(data.reply || data.error || 'Erreur de l\'assistant');
    }
    return {
      reply: data.reply || '',
      orientation: data.orientation ?? null,
      options: Array.isArray(data.options) ? data.options : [],
    };
  },
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
  login: async (doctorCode: string, password?: string) => {
    const response = await fetch(`${API_URL}/auth/login-doctor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doctorCode, password })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Code médecin invalide');
    }

    const data = await response.json();
    localStorage.setItem('chifak_doctor_token', data.token);
    return data; // { token, user, mustChangePassword }
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    const token = localStorage.getItem('chifak_doctor_token');
    const response = await fetch(`${API_URL}/doctor/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
      body: JSON.stringify({ currentPassword, newPassword })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Erreur lors du changement de mot de passe');
    }
    const data = await response.json();
    // Le serveur renvoie un jeton neuf (sans l'obligation de changement) : on le remplace.
    if (data.token) localStorage.setItem('chifak_doctor_token', data.token);
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
  /** 'cabinet' (défaut) ou 'video'. Le serveur refuse 'video' si le
   *  praticien n'a pas activé la téléconsultation sur son compte. */
  consultationType?: 'cabinet' | 'video';
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
  },

  cancel: async (id: number) => {
    const token = localStorage.getItem('chifak_patient_token');
    const response = await fetch(`${API_URL}/patient/appointments/${id}/cancel`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Erreur lors de l'annulation");
    }
    return await response.json();
  },

  reschedule: async (id: number, appointmentDate: string, appointmentTime: string) => {
    const token = localStorage.getItem('chifak_patient_token');
    const response = await fetch(`${API_URL}/patient/appointments/${id}/reschedule`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
      body: JSON.stringify({ appointmentDate, appointmentTime }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Erreur lors de la reprogrammation');
    }
    return await response.json();
  }
};

// ==================== AVIS (REVIEWS) ====================

export const reviewsAPI = {
  getForDoctor: async (doctorId: number) => {
    try {
      const response = await fetch(`${API_URL}/doctors/${doctorId}/reviews`);
      if (!response.ok) return [];
      return await response.json();
    } catch {
      return [];
    }
  },

  submit: async (doctorId: number, rating: number, comment: string) => {
    const token = localStorage.getItem('chifak_patient_token');
    const response = await fetch(`${API_URL}/doctors/${doctorId}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
      body: JSON.stringify({ rating, comment }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Erreur lors de l'envoi de l'avis");
    }
    return await response.json();
  },

  // Patient : médecins qu'il a déjà notés
  getMine: async (): Promise<{ doctor_id: number }[]> => {
    const token = localStorage.getItem('chifak_patient_token');
    try {
      const response = await fetch(`${API_URL}/patient/reviews`, {
        headers: { ...(token && { Authorization: `Bearer ${token}` }) },
      });
      if (!response.ok) return [];
      return await response.json();
    } catch {
      return [];
    }
  },

  // Admin : tous les avis
  getAll: async () => {
    const response = await fetch(`${API_URL}/reviews`, { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('Erreur lors de la récupération des avis');
    return await response.json();
  },

  // Admin : supprimer un avis
  remove: async (id: number) => {
    const response = await fetch(`${API_URL}/reviews/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Erreur lors de la suppression');
    }
    return await response.json();
  },
};

// ==================== ESPACE MÉDECIN ====================

const doctorHeaders = () => {
  const token = localStorage.getItem('chifak_doctor_token');
  return { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) };
};

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

// ==================== PERSONNEL (ADMIN) ====================

export interface Employee {
  id: number;
  username: string;
  full_name: string | null;
  role: 'admin' | 'employee';
  staff_code: string | null;
  feedback_token: string | null;
  active: number;
  created_at: string;
  created_count: string | number;
  deleted_count: string | number;
  feedback_count: string | number;
  avg_rating: string | number | null;
}

export interface EmployeeStats {
  from: string;
  to: string;
  created: number;
  deleted: number;
  recent: { action: string; doctor_name: string | null; created_at: string }[];
}

export interface EmployeeFeedback {
  id: number;
  staff_code: string | null;
  employee_name: string | null;
  doctor_name: string | null;
  doctor_code: string | null;
  rating: number;
  comment: string | null;
  suggestion: string | null;
  created_at: string;
}

const attendreJson = async (response: Response, defaut: string) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || defaut);
  return data;
};

export const employeesAPI = {
  getAll: async (): Promise<Employee[]> =>
    attendreJson(await fetch(`${API_URL}/admin/employees`, { headers: getAuthHeaders() }), 'Erreur de chargement'),

  create: async (data: { username: string; fullName?: string; password: string }): Promise<Employee> =>
    attendreJson(
      await fetch(`${API_URL}/admin/employees`, {
        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data),
      }),
      'Erreur lors de la création'
    ),

  remove: async (id: number): Promise<void> => {
    await attendreJson(
      await fetch(`${API_URL}/admin/employees/${id}`, { method: 'DELETE', headers: getAuthHeaders() }),
      'Erreur lors de la suppression'
    );
  },

  stats: async (id: number, from?: string, to?: string): Promise<EmployeeStats> => {
    const p = new URLSearchParams();
    if (from) p.append('from', from);
    if (to) p.append('to', to);
    const suffixe = p.toString() ? `?${p}` : '';
    return attendreJson(
      await fetch(`${API_URL}/admin/employees/${id}/stats${suffixe}`, { headers: getAuthHeaders() }),
      'Erreur de chargement'
    );
  },

  feedback: async (): Promise<EmployeeFeedback[]> =>
    attendreJson(await fetch(`${API_URL}/admin/feedback`, { headers: getAuthHeaders() }), 'Erreur de chargement'),
};

/** Formulaire public atteint par le QR code — aucun jeton d'authentification. */
export const feedbackAPI = {
  whoIs: async (token: string): Promise<{ name: string; staffCode: string | null }> =>
    attendreJson(await fetch(`${API_URL}/feedback/${encodeURIComponent(token)}`), 'Lien invalide'),

  submit: async (
    token: string,
    data: { rating: number; doctorName?: string; doctorCode?: string; comment?: string; suggestion?: string }
  ): Promise<{ message: string }> =>
    attendreJson(
      await fetch(`${API_URL}/feedback/${encodeURIComponent(token)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      }),
      'Envoi impossible'
    ),
};
