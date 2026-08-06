import { API_URL } from './http';

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

