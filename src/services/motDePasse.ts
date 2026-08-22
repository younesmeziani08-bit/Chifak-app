import { API_URL, patientHeaders } from './http';

/**
 * Récupération et changement du mot de passe patient.
 *
 * Il n'existait aucun moyen de récupérer un compte : une personne qui oubliait
 * son mot de passe perdait son compte et tout son historique de rendez-vous,
 * définitivement.
 *
 * Le serveur répond volontairement la même chose que l'adresse existe ou non.
 * L'écran ne doit donc RIEN déduire de cette réponse — il affiche la même
 * phrase dans tous les cas, sans quoi il rétablirait par l'affichage ce que le
 * serveur s'applique à ne pas dire.
 */

async function attendreJson<T>(response: Response, defaut: string): Promise<T> {
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.error || `${defaut} (${response.status})`);
  }
  return response.json();
}

export interface SessionPatient {
  token: string;
  user: { id: number; email: string; name: string };
}

export const motDePasseAPI = {
  /** Demande un code. La réponse ne dit jamais si l'adresse est inscrite. */
  demander: async (email: string, language: 'fr' | 'ar'): Promise<{ message: string }> =>
    attendreJson(
      await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, language }),
      }),
      'Demande impossible',
    ),

  /**
   * Pose le nouveau mot de passe et ouvre la session dans la foulée.
   * La personne vient de prouver qu'elle lit les courriers de cette adresse ;
   * lui redemander de se connecter n'ajouterait rien qu'une occasion
   * d'abandonner.
   */
  reinitialiser: async (
    email: string,
    code: string,
    newPassword: string,
    language: 'fr' | 'ar',
  ): Promise<SessionPatient & { message: string }> =>
    attendreJson(
      await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword, language }),
      }),
      'Code invalide ou expiré',
    ),

  /**
   * Change le mot de passe en étant connecté.
   * Le serveur rend un jeton neuf : les autres sessions viennent d'être
   * coupées, y compris celle du navigateur qui appelle. Sans le remplacer,
   * l'écran se déconnecterait au premier appel suivant.
   */
  changer: async (
    currentPassword: string,
    newPassword: string,
    language: 'fr' | 'ar',
  ): Promise<{ message: string; token: string }> =>
    attendreJson(
      await fetch(`${API_URL}/patient/password`, {
        method: 'PUT',
        headers: patientHeaders(),
        body: JSON.stringify({ currentPassword, newPassword, language }),
      }),
      'Changement impossible',
    ),
};
