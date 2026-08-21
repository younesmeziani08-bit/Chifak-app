import { API_URL } from './http';

/**
 * Dépôt d'un avis par un praticien — PUBLIC.
 *
 * Cette page s'ouvre en scannant le QR code d'un employé, sans compte ni
 * jeton. Elle appartient donc à l'application patiente, pas à celle de
 * l'administration : la sortir avec le reste aurait cassé le parcours.
 *
 * La lecture des avis déposés, elle, reste réservée à l'administration.
 */

/** Réponse JSON, ou l'erreur du serveur telle qu'il l'a formulée. */
async function attendreJson<T>(response: Response, defaut: string): Promise<T> {
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.error || `${defaut} (${response.status})`);
  }
  return response.json();
}

/** Formulaire public atteint par le QR code — aucun jeton d'authentification. */
export const feedbackAPI = {
  whoIs: async (token: string): Promise<{ name: string; staffCode: string | null }> =>
    attendreJson(await fetch(`${API_URL}/feedback/${encodeURIComponent(token)}`), 'Lien invalide'),

  submit: async (
    token: string,
    data: { rating: number; doctorName?: string; doctorCode?: string; comment?: string; suggestion?: string }
  ): Promise<{ message: string }> =>
    attendreJson(
      await fetch(`${API_URL}/feedback/${encodeURIComponent(token)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      }),
      'Envoi impossible'
    ),
};
