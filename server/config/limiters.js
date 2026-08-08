/** Limiteurs de débit. Compteurs partagés via Redis quand il est disponible. */
import rateLimit from 'express-rate-limit';
import { magasin } from './redis.js';

// Limiteur général : plafonne les requêtes par IP pour absorber les pics / abus.
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: Number(process.env.RATE_LIMIT_MAX) || 300, // 300 req/min/IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes, réessayez dans un instant.' },
  ...magasin('general'),
});

// Limiteur strict sur les endpoints sensibles (connexion/inscription) : anti brute-force.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
  ...magasin('auth'),
});
export const CHEMINS_SENSIBLES = [
  '/api/auth/login',
  '/api/auth/login-patient',
  '/api/auth/login-doctor',
  '/api/auth/register',
  '/api/auth/verify-code',   // anti-force brute du code à 6 chiffres
  '/api/auth/resend-code',   // anti-spam d'e-mails
  '/api/doctor/change-password',
];

// Limiteur dédié à l'assistant IA (appels coûteux) : plafonne les messages par IP.
export const assistantLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.ASSISTANT_RATE_LIMIT_MAX) || 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { reply: 'Vous envoyez des messages trop vite. Patientez un instant avant de réessayer.' },
  ...magasin('assistant'),
});

/* Limiteur propre à la réservation : la route est publique (pas de compte
   exigé pour prendre rendez-vous), mais sans plafond dédié un script pouvait
   déposer des centaines de faux rendez-vous au nom de n'importe qui, chacun
   déclenchant un e-mail vers la victime. */
export const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.BOOKING_RATE_LIMIT_MAX) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de réservations depuis cette connexion. Réessayez plus tard.' },
  ...magasin('booking'),
});

/* Dépôt de demande d'inscription praticien. Route publique qui écrit en base :
   sans plafond, un script remplirait la file d'examen de fausses demandes et
   noierait les vraies. Trois par heure et par adresse IP — un praticien n'en
   dépose qu'une. */
export const applicationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.APPLICATION_RATE_LIMIT_MAX) || 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de demandes depuis cette connexion. Réessayez plus tard.' },
  ...magasin('application'),
});
