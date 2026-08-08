/**
 * Socle des appels réseau : adresse de l'API et fabrique d'en-têtes.
 * Trois populations, trois jetons, trois fabriques — le nom dit qui parle.
 */
import { API_URL } from '../config';

export { API_URL };

/** Jeton du personnel (admin / employé). */
export const getAuthHeaders = () => {
  const token = localStorage.getItem('chifak_admin_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

/** Jeton du praticien connecté. */
export const doctorHeaders = () => {
  const token = localStorage.getItem('chifak_doctor_token');
  return { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) };
};

/** Jeton du patient connecté. */
export const patientHeaders = () => {
  const token = localStorage.getItem('chifak_patient_token');
  return { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) };
};

/**
 * `fetch` avec ré-essais pour les lectures (GET).
 *
 * Le backend est hébergé sur le palier gratuit de Render, qui met le
 * service en veille après une période d'inactivité. La requête qui le
 * réveille échoue souvent une première fois (erreur réseau, ou 5xx le temps
 * que le pool PostgreSQL se rétablisse) avant de fonctionner normalement à
 * la tentative suivante — observé en pratique sur /api/doctors. Sans cela,
 * un patient ouvrant l'app après une pause voit un annuaire vide alors que
 * les praticiens sont bien enregistrés.
 */
export async function fetchWithRetry(url: string, attempts = 3, delayMs = 1500): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url);
      if (response.ok || (response.status >= 400 && response.status < 500)) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (err) {
      lastError = err;
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
  }
  throw lastError instanceof Error ? lastError : new Error('Erreur réseau');
}
