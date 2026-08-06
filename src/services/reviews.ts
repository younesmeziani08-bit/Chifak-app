import { API_URL, getAuthHeaders } from './http';

// ==================== AVIS (REVIEWS) ====================

export interface ReviewSummary {
  total: number;
  moyenne: number;
  repartition: Record<number, number>;
  reviews: {
    id: number;
    patient_name: string | null;
    rating: number;
    comment: string | null;
    created_at: string;
  }[];
}

const RESUME_VIDE: ReviewSummary = {
  total: 0,
  moyenne: 0,
  repartition: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  reviews: [],
};

export const reviewsAPI = {
  /**
   * Résumé complet : moyenne et répartition calculées en base, puis les cent
   * avis les plus récents. Le serveur renvoyait autrefois un simple tableau ;
   * on accepte encore cette forme pour qu'un navigateur en cache ne casse pas
   * pendant les minutes qui suivent un déploiement.
   */
  getSummaryForDoctor: async (doctorId: number): Promise<ReviewSummary> => {
    try {
      const response = await fetch(`${API_URL}/doctors/${doctorId}/reviews`);
      if (!response.ok) return RESUME_VIDE;
      const data = await response.json();

      if (Array.isArray(data)) {
        const total = data.length;
        const somme = data.reduce((s: number, r: { rating: number }) => s + r.rating, 0);
        const repartition: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        for (const r of data) repartition[r.rating] = (repartition[r.rating] || 0) + 1;
        return {
          total,
          moyenne: total ? Math.round((somme / total) * 10) / 10 : 0,
          repartition,
          reviews: data,
        };
      }

      return {
        total: Number(data?.total) || 0,
        moyenne: Number(data?.moyenne) || 0,
        repartition: data?.repartition || RESUME_VIDE.repartition,
        reviews: Array.isArray(data?.reviews) ? data.reviews : [],
      };
    } catch {
      return RESUME_VIDE;
    }
  },

  /** Liste seule, pour l'espace du praticien. */
  getForDoctor: async (doctorId: number) => {
    const resume = await reviewsAPI.getSummaryForDoctor(doctorId);
    return resume.reviews;
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

  // La suppression d'un avis n'existe plus : voir la note dans server.js.
};

