import { API_URL } from './http';

/**
 * Liste d'attente : être prévenu quand un créneau se libère.
 *
 * Un patient ouvrait la fiche d'un praticien complet, lisait « aucun
 * créneau », et ne revenait jamais. Pendant ce temps des créneaux se
 * libéraient — quelqu'un annule toujours — et repartaient à qui passait par là.
 *
 * Aucun compte n'est exigé : quelqu'un qui vient de lire « complet » ne va pas
 * s'inscrire pour espérer. Le jeton reçu par courrier tient lieu
 * d'authentification.
 */

async function attendreJson<T>(response: Response, defaut: string): Promise<T> {
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.error || `${defaut} (${response.status})`);
  }
  return response.json();
}

export interface InscriptionAttente {
  statut: 'waiting' | 'notified' | 'converti' | 'parti';
  doctor_name: string;
  specialty: string;
  city: string;
}

/** La place retenue le temps d'une réponse. */
export interface PlaceRetenue {
  id: number;
  appointment_date: string;
  appointment_time: string;
  status: string;
  consultation_type: string;
  hold_expire_le: string;
  doctor_name: string;
  specialty: string;
  address: string;
  city: string;
  expiree: boolean;
}

export const listeAttenteAPI = {
  /** S'inscrire chez un praticien. */
  sInscrire: async (
    doctorId: number,
    data: { patientName: string; patientEmail: string; patientPhone: string },
    language: 'fr' | 'ar',
  ): Promise<{ message: string; heuresDeReponse: number }> =>
    attendreJson(
      await fetch(`${API_URL}/doctors/${doctorId}/liste-attente`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, language }),
      }),
      'Inscription impossible',
    ),

  lire: async (jeton: string): Promise<InscriptionAttente> =>
    attendreJson(
      await fetch(`${API_URL}/liste-attente/${encodeURIComponent(jeton)}`),
      'Lien invalide ou expiré',
    ),

  seRetirer: async (jeton: string): Promise<{ message: string }> =>
    attendreJson(
      await fetch(`${API_URL}/liste-attente/${encodeURIComponent(jeton)}`, { method: 'DELETE' }),
      'Retrait impossible',
    ),
};

export const placeAPI = {
  lire: async (jeton: string): Promise<PlaceRetenue> =>
    attendreJson(
      await fetch(`${API_URL}/place/${encodeURIComponent(jeton)}`),
      'Cette place n’est plus disponible',
    ),

  confirmer: async (jeton: string): Promise<{ message: string; date: string; heure: string; doctorName: string }> =>
    attendreJson(
      await fetch(`${API_URL}/place/${encodeURIComponent(jeton)}/confirmer`, { method: 'POST' }),
      'Confirmation impossible',
    ),

  /**
   * Décliner. La place repart au suivant immédiatement, et l'on RESTE sur la
   * liste : refuser un créneau qui ne convient pas n'est pas renoncer à en
   * chercher un.
   */
  refuser: async (jeton: string): Promise<{ message: string }> =>
    attendreJson(
      await fetch(`${API_URL}/place/${encodeURIComponent(jeton)}/refuser`, { method: 'POST' }),
      'Opération impossible',
    ),
};
