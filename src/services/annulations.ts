import { API_URL, doctorHeaders } from './http';

/**
 * Annuler un rendez-vous, et constater qui s'est présenté.
 *
 * Une seule route d'annulation existait, réservée aux patients connectés. Ni
 * l'invité qui avait réservé sans compte, ni le praticien, ni le cabinet ne
 * pouvaient annuler — le créneau restait bloqué et chacun attendait l'autre.
 */

async function attendreJson<T>(response: Response, defaut: string): Promise<T> {
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.error || `${defaut} (${response.status})`);
  }
  return response.json();
}

/** Ce qu'un lien d'annulation laisse voir : rien de plus que l'écran n'affiche. */
export interface RendezVousParJeton {
  id: number;
  patient_name: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  consultation_type: string;
  doctor_name: string;
  specialty: string;
  address: string;
  city: string;
}

/** Le jeton EST l'authentification : aucun compte n'est nécessaire. */
export const rendezVousParJetonAPI = {
  lire: async (jeton: string): Promise<RendezVousParJeton> =>
    attendreJson(
      await fetch(`${API_URL}/appointments/by-token/${encodeURIComponent(jeton)}`),
      'Lien invalide ou expiré',
    ),

  annuler: async (jeton: string): Promise<{ message: string; deja?: boolean }> =>
    attendreJson(
      await fetch(`${API_URL}/appointments/by-token/${encodeURIComponent(jeton)}/cancel`, {
        method: 'POST',
      }),
      'Annulation impossible',
    ),
};

export const annulationsAPI = {
  /**
   * Le praticien annule. Le motif est facultatif mais fortement souhaitable :
   * sans lui, le patient ne sait pas s'il doit reprendre rendez-vous ailleurs
   * ou attendre qu'on le rappelle.
   */
  parPraticien: async (id: number, reason?: string): Promise<{ message: string }> =>
    attendreJson(
      await fetch(`${API_URL}/doctor/appointments/${id}/cancel`, {
        method: 'PATCH', headers: doctorHeaders(), body: JSON.stringify({ reason }),
      }),
      'Annulation impossible',
    ),

  /* L'annulation par le cabinet vit dans admin/services/annulations.ts.
     Elle citait une route d'administration depuis ce fichier, donc depuis le
     paquet livré aux patients : la liste des appels d'administration se
     lisait dans la console de n'importe quel visiteur. C'est précisément ce
     que la séparation des deux applications cherche à éviter, et ce que
     `npm run contrats` vérifie. */

  /**
   * Qui s'est présenté. Deux issues seulement : honoré, ou absent.
   * C'est ce constat qui décide ensuite du droit de laisser un avis — une
   * absence ne permet pas de noter une consultation qu'on a manquée.
   */
  constaterPresence: async (
    id: number,
    status: 'completed' | 'no_show',
  ): Promise<{ message: string }> =>
    attendreJson(
      await fetch(`${API_URL}/doctor/appointments/${id}/attendance`, {
        method: 'PATCH', headers: doctorHeaders(), body: JSON.stringify({ status }),
      }),
      'Enregistrement impossible',
    ),
};
