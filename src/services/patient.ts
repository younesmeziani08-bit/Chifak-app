import { API_URL } from './http';

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

