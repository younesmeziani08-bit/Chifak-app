import { API_URL } from './http';

/**
 * Dépôt d'une demande d'inscription — partie PUBLIQUE.
 *
 * La file d'examen, l'acceptation et le refus vivent dans l'application
 * d'administration (admin/services/applications.ts). Les garder ici les
 * faisait voyager dans le paquet livré à chaque patient, où ils
 * documentaient l'API d'administration à qui ouvrait la console.
 *
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
  /** Wilaya et commune, issues du même référentiel que la recherche patient. */
  city: string;
  /** Rue et numéro. C'est ce que le patient lit pour se rendre au cabinet. */
  address: string;
  phone: string;
  email: string;
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
  /** Code de connexion du praticien, une fois la demande acceptée. */
  doctor_code?: string | null;
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
  }
};
