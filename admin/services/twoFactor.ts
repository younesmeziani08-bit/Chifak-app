import { API_URL, getAuthHeaders } from '../../src/services/http';

/**
 * Double authentification du personnel.
 *
 * Le mot de passe ne rend plus une session : quand le second facteur est
 * actif, `authAPI.login` renvoie un jeton intermédiaire qui n'ouvre rien, et
 * c'est `terminerConnexion` qui rend la vraie session contre un code.
 */

export interface EtatDeuxiemeFacteur {
  actif: boolean;
  activeLe: string | null;
  codesDeSecoursRestants: number;
}

/** Lit le message du serveur, même quand la réponse n'est pas du JSON. */
async function erreurDe(response: Response, defaut: string): Promise<Error> {
  const detail = await response.json().catch(() => null);
  return new Error(detail?.error || `${defaut} (${response.status})`);
}

export const deuxiemeFacteurAPI = {
  /** Second temps de la connexion : le code transforme le jeton intermédiaire en session. */
  terminerConnexion: async (jetonIntermediaire: string, code: string) => {
    const response = await fetch(`${API_URL}/auth/login-2fa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jetonIntermediaire, code }),
    });
    if (!response.ok) throw await erreurDe(response, 'Code refusé');
    const data = await response.json();
    localStorage.setItem('chifak_admin_token', data.token);
    return data as {
      token: string;
      user: { id: number; username: string; role: 'admin' | 'employee' };
      codesDeSecoursRestants: number;
    };
  },

  /** État du second facteur sur MON compte. */
  etat: async (): Promise<EtatDeuxiemeFacteur> => {
    const response = await fetch(`${API_URL}/staff/2fa`, { headers: getAuthHeaders() });
    if (!response.ok) throw await erreurDe(response, 'Lecture impossible');
    return response.json();
  },

  /** Tire un secret. Rien n'est activé tant que le code n'a pas été prouvé. */
  preparer: async (): Promise<{ secret: string; adresse: string }> => {
    const response = await fetch(`${API_URL}/staff/2fa/preparer`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw await erreurDe(response, 'Préparation impossible');
    return response.json();
  },

  /** Active après vérification. Les codes de secours ne sont rendus qu'ici, une seule fois. */
  activer: async (code: string): Promise<{ actif: true; codesDeSecours: string[] }> => {
    const response = await fetch(`${API_URL}/staff/2fa/activer`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ code }),
    });
    if (!response.ok) throw await erreurDe(response, 'Activation impossible');
    return response.json();
  },

  /** Retire le second facteur. Exige un code valide, pas seulement une session. */
  desactiver: async (code: string): Promise<{ actif: false }> => {
    const response = await fetch(`${API_URL}/staff/2fa/desactiver`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ code }),
    });
    if (!response.ok) throw await erreurDe(response, 'Désactivation impossible');
    return response.json();
  },
};
