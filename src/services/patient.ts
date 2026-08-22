import { API_URL } from './http';

// ==================== PATIENT (profil) ====================

export interface PatientProfile {
  id: number;
  email: string;
  name: string;
  phone: string;
  /* `balance` a disparu de cette interface. Le serveur la renvoyait, l'écran
     l'affichait, et rien ne l'alimentait : la route de rechargement avait été
     retirée parce qu'elle créditait sans paiement. Un solde qui ne peut jamais
     bouger promet une fonctionnalité qui n'existe pas. À rétablir le jour où un
     vrai paiement existera. */
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
    if (!response.ok) {
      /* Le code HTTP est porté par l'erreur. Sans lui, l'appelant ne peut pas
         distinguer « ta session a expiré » — auquel cas il faut la refermer —
         d'une panne réseau passagère, où déconnecter quelqu'un serait
         gratuitement hostile. */
      const err = new Error(
        response.status === 401 || response.status === 403
          ? 'Session expirée'
          : 'Erreur lors de la récupération de votre profil'
      ) as Error & { status?: number };
      err.status = response.status;
      throw err;
    }
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

