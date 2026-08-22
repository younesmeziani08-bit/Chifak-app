import { API_URL, patientHeaders } from './http';

/**
 * Droits du patient sur ses propres données : les obtenir, les effacer.
 *
 * Aucun des deux n'existait. Sur un service qui traite des données de santé,
 * c'était le seul domaine où l'application ne proposait strictement aucun
 * geste.
 */

async function attendreJson<T>(response: Response, defaut: string): Promise<T> {
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    const err = new Error(detail?.error || `${defaut} (${response.status})`) as Error & {
      confirmationRequise?: boolean;
    };
    err.confirmationRequise = detail?.confirmationRequise;
    throw err;
  }
  return response.json();
}

export const donneesAPI = {
  /** Tout ce que le service détient, en JSON lisible. */
  exporter: async (): Promise<unknown> =>
    attendreJson(
      await fetch(`${API_URL}/patient/mes-donnees`, { headers: patientHeaders() }),
      'Export impossible',
    ),

  /**
   * Efface le compte. Définitif.
   *
   * Le mot de passe est exigé — un jeton volé ne doit pas suffire à détruire
   * le compte de quelqu'un. Un compte créé par Google ou Facebook n'en a pas :
   * le serveur demande alors de taper « SUPPRIMER », pour que le geste reste
   * délibéré même sans secret à vérifier.
   */
  supprimerCompte: async (
    password: string,
    confirmation: string,
    language: 'fr' | 'ar',
  ): Promise<{ message: string }> =>
    attendreJson(
      await fetch(`${API_URL}/patient/mon-compte`, {
        method: 'DELETE',
        headers: patientHeaders(),
        body: JSON.stringify({ password, confirmation, language }),
      }),
      'Suppression impossible',
    ),
};

/**
 * Propose l'export au téléchargement.
 *
 * Un objet Blob plutôt qu'une adresse `data:` : les données de santé de
 * quelqu'un n'ont rien à faire dans une barre d'adresse, où elles se
 * retrouveraient dans l'historique du navigateur.
 */
export function telechargerExport(donnees: unknown): void {
  const contenu = JSON.stringify(donnees, null, 2);
  const blob = new Blob([contenu], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = `chifak-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  // Sans cette libération, le contenu reste en mémoire tant que l'onglet vit.
  URL.revokeObjectURL(url);
}
