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
