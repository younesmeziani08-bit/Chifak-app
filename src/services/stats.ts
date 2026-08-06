import { API_URL, getAuthHeaders } from './http';

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

