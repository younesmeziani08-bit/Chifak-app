import { API_URL, getAuthHeaders } from './http';

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

