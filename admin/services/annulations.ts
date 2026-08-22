import { API_URL, getAuthHeaders } from '../../src/services/http';

/**
 * Annulation d'un rendez-vous par le cabinet.
 *
 * Ce fichier vit dans admin/ et non dans src/ : la route qu'il appelle est une
 * route d'administration, et le paquet livré aux patients n'a aucune raison de
 * la citer. Écrite dans src/, elle se lisait dans la console de n'importe quel
 * visiteur — `npm run contrats` l'a signalé aussitôt.
 *
 * Ouverte à tout le personnel, pas seulement aux administrateurs : c'est
 * l'accueil qui décroche quand un patient appelle pour dire qu'il ne viendra
 * pas, et lui refuser ce geste reviendrait à ne pas annuler du tout.
 */

async function attendreJson<T>(response: Response, defaut: string): Promise<T> {
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.error || `${defaut} (${response.status})`);
  }
  return response.json();
}

export const annulationsCabinetAPI = {
  annuler: async (id: number, reason?: string): Promise<{ message: string }> =>
    attendreJson(
      await fetch(`${API_URL}/admin/appointments/${id}/cancel`, {
        method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ reason }),
      }),
      'Annulation impossible',
    ),
};
