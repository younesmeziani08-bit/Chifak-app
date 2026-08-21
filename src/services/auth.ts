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
      /* `.json()` sans garde : une passerelle en panne renvoie du HTML, et
         l'analyse échouait alors en « Unexpected token < », remplaçant le vrai
         problème par un charabia. Le message du serveur porte notamment le
         délai d'attente après plusieurs tentatives — il doit passer intact. */
      const detail = await response.json().catch(() => null);
      throw new Error(detail?.error || `Erreur de connexion (${response.status})`);
    }

    const data = await response.json();

    /* Second facteur actif : le serveur ne rend PAS de session, seulement un
       jeton intermédiaire de cinq minutes qui n'ouvre aucune route. On ne
       l'enregistre donc pas comme jeton d'administration — l'écran de
       connexion le garde en mémoire le temps de saisir le code. */
    if (data.deuxiemeFacteurRequis) return data;

    localStorage.setItem('chifak_admin_token', data.token);

    return data;
  },

  verify: async () => {
    const response = await fetch(`${API_URL}/auth/verify`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      /* Le code HTTP accompagne l'erreur : l'appelant referme la session sur
         un 401/403, mais PAS sur un serveur momentanément injoignable. Sans
         cette distinction, un réveil lent de l'hébergement déconnectait
         l'administration à chaque ouverture de l'écran. */
      const err = new Error(
        response.status === 401 || response.status === 403
          ? 'Session expirée'
          : 'Vérification impossible'
      ) as Error & { status?: number };
      err.status = response.status;
      throw err;
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

