import { API_URL, getAuthHeaders } from './http';

const DEMO_APPOINTMENTS_KEY = 'chifak_demo_appointments';

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

  /**
   * Compteurs de rendez-vous à venir, calculés en base.
   *
   * Le tableau de bord n'a besoin que de nombres. Les obtenir en téléchargeant
   * la liste complète des rendez-vous faisait transiter le nom, le téléphone
   * et l'e-mail de chaque patient jusqu'au navigateur, pour n'en afficher
   * aucun.
   */
  getUpcomingStats: async (): Promise<{ total: number; parMedecin: Record<number, number> }> => {
    const response = await fetch(`${API_URL}/appointments/upcoming-stats`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Erreur lors du comptage des rendez-vous');
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

