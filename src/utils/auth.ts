import { API_URL } from '../config';

export function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split('.')[1];
    if (!base64) return null;
    const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export interface PatientUser {
  id: number;
  email: string;
  name: string;
}

/**
 * Enregistre la session après une connexion OAuth (partagé web et natif).
 *
 * Le jeton est éprouvé AVANT d'être conservé, et l'identité vient de la
 * réponse du serveur — jamais des paramètres reçus.
 *
 * L'ancienne version faisait l'inverse : elle stockait le jeton dès son
 * arrivée, puis tentait de lire le profil « à titre optionnel ». Un jeton
 * refusé restait donc en place, l'application se croyait connectée, et chaque
 * appel repartait en erreur sans que rien ne l'explique. Quant au nom et à
 * l'adresse, ils étaient repris du lien d'arrivée : deux valeurs qu'on
 * réécrit en modifiant l'adresse dans la barre du navigateur.
 *
 * Lève une erreur si le jeton n'est pas reconnu : l'appelant doit alors
 * traiter cela comme un échec de connexion, pas comme un détail.
 */
export async function persistOAuthLogin(
  token: string,
  _name?: string | null,
  _email?: string | null,
): Promise<PatientUser> {
  let profil: { id: number; email: string; name?: string } | null = null;
  try {
    const res = await fetch(`${API_URL}/patient/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) profil = await res.json();
  } catch {
    /* Réseau injoignable : traité comme un refus ci-dessous. */
  }

  if (!profil) {
    throw new Error('La connexion n’a pas pu être finalisée. Réessayez.');
  }

  const user: PatientUser = {
    id: profil.id,
    email: profil.email,
    name: profil.name || profil.email.split('@')[0],
  };

  localStorage.setItem('chifak_patient_token', token);
  localStorage.setItem('chifak_patient_user', JSON.stringify(user));
  return user;
}
