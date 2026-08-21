import { API_URL, getAuthHeaders } from '../../src/services/http';
import type { Application } from '../../src/services/applications';

/**
 * File d'examen des demandes praticiens — réservée à l'administration.
 *
 * Ces trois appels vivaient dans le paquet public. Ils n'y servaient à rien
 * et y documentaient l'API d'administration : les chemins, les paramètres et
 * la manœuvre complète se lisaient dans la console de n'importe quel patient.
 * Le serveur les protège par le rôle admin — mais on ne publie pas le plan
 * d'un bâtiment sous prétexte que les portes sont fermées.
 */
export const applicationsAdminAPI = {
  /** File d'examen, réservée à l'administration. */
  list: async (status: Application['status'] = 'pending'): Promise<Application[]> => {
    const response = await fetch(`${API_URL}/admin/applications?status=${status}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Erreur lors de la récupération des demandes');
    return await response.json();
  },

  /**
   * Acceptation : crée la fiche du praticien et renvoie son code de connexion.
   *
   * `emailEnvoye` dit si le praticien a bien été prévenu. L'acceptation
   * réussit même quand le courrier échoue — la fiche est en ligne, ce serait
   * absurde de la refuser pour un incident de messagerie — mais l'employé
   * doit le savoir, sinon il repart en croyant le praticien informé.
   */
  approve: async (id: number, note?: string): Promise<{ doctorId: number; doctorCode: string; emailEnvoye?: boolean }> => {
    const response = await fetch(`${API_URL}/admin/applications/${id}/approve`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ note }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Erreur lors de l'acceptation");
    return data;
  },

  /** Refus. Le motif est obligatoire côté serveur, et transmis au praticien. */
  reject: async (id: number, note: string): Promise<{ message: string; emailEnvoye?: boolean }> => {
    const response = await fetch(`${API_URL}/admin/applications/${id}/reject`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ note }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Erreur lors du refus');
    return data;
  },
};
