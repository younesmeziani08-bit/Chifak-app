/// <reference types="vite/client" />

// Par défaut, on utilise des URL relatives : le serveur de dev (Vite) redirige
// /api vers le backend (voir le proxy dans vite.config.ts). Résultat : tout passe
// par un seul port (5173), donc pas de souci de CORS ni d'IP côté téléphone.
export const API_BASE_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '';

export const API_URL = `${API_BASE_URL}/api`;

export const AUTH_GOOGLE_URL = `${API_URL}/auth/google`;
export const AUTH_FACEBOOK_URL = `${API_URL}/auth/facebook`;
