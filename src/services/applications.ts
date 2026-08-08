import { API_URL, getAuthHeaders } from './http';

/**
 * Demandes d'inscription des praticiens.
 *
 * Un médecin ne crée pas sa fiche : il dépose une demande qu'un administrateur
 * examine. Le côté public ne connaît donc qu'une seule opération — déposer.
 */

export type ApplicationKind = 'registration' | 'demo';

export interface ApplicationInput {
  kind: ApplicationKind;
  fullName: string;
  specialty: string;
  city: string;
  address?: string;
  phone: string;
  email: string;
  licenseNumber?: string;
  message?: string;
  /** Uniquement pour une inscription : le praticien choisit son mot de passe. */
  password?: string;
  /* Résultat du contrôle facial fait dans le navigateur du praticien.
     Déclaratif : il s'exécute chez lui, donc il est falsifiable. Il oriente
     l'examen humain, il ne le remplace pas. */
  identityChecked?: boolean;
  identityScore?: number;
}

export interface Application {
  id: number;
  kind: ApplicationKind;
  full_name: string;
  specialty: string;
  city: string;
  address: string | null;
  phone: string;
  email: string;
  license_number: string | null;
  message: string | null;
  identity_checked: boolean | null;
  identity_score: number | null;
  status: 'pending' | 'approved' | 'rejected';
  review_note: string | null;
  reviewed_at: string | null;
  reviewed_by_name: string | null;
  doctor_id: number | null;
  created_at: string;
}

export const applicationsAPI = {
  /** Dépôt public. */
  submit: async (input: ApplicationInput): Promise<{ message: string }> => {
    const response = await fetch(`${API_URL}/professional-applications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Erreur lors de l'envoi de la demande");
    return data;
  },

  /** File d'examen, réservée à l'administration. */
  list: async (status: Application['status'] = 'pending'): Promise<Application[]> => {
    const response = await fetch(`${API_URL}/admin/applications?status=${status}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Erreur lors de la récupération des demandes');
    return await response.json();
  },

  /** Acceptation : crée la fiche du praticien et renvoie son code de connexion. */
  approve: async (id: number, note?: string): Promise<{ doctorId: number; doctorCode: string }> => {
    const response = await fetch(`${API_URL}/admin/applications/${id}/approve`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ note }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Erreur lors de l'acceptation");
    return data;
  },

  /** Refus. Le motif est obligatoire côté serveur. */
  reject: async (id: number, note: string): Promise<{ message: string }> => {
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
