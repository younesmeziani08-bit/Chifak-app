/** Politique CORS : liste blanche stricte en production, souple en développement. */
import '../env.js';

// ── CORS ──
// En production : liste blanche stricte d'origines (ALLOWED_ORIGINS séparées par des virgules,
// ou FRONTEND_URL). En développement : on reflète l'origine pour autoriser le réseau local.
export const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

export const optionsCors = {
  origin(origin, callback) {
    // Requêtes sans origine (applications mobiles, curl, health checks) : autorisées
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origine non autorisée par la politique CORS'));
  },
  credentials: true,
};

