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

// Enregistre la session après une connexion OAuth (partagé web + natif).
export async function persistOAuthLogin(
  token: string,
  name?: string | null,
  email?: string | null,
): Promise<PatientUser> {
  localStorage.setItem('chifak_patient_token', token);
  const payload = parseJwtPayload(token);

  let user: PatientUser = {
    id: (payload?.id as number) ?? 0,
    email: email || (payload?.email as string) || '',
    name: name || '',
  };

  try {
    const res = await fetch(`${API_URL}/patient/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const p = await res.json();
      user = { id: p.id, email: p.email, name: p.name || user.name };
    }
  } catch {
    // profil optionnel
  }

  if (!user.name && user.email) user.name = user.email.split('@')[0];

  localStorage.setItem('chifak_patient_user', JSON.stringify(user));
  return user;
}
