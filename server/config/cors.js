/** Politique CORS : liste blanche stricte en production, souple en développement. */
import '../env.js';

// ── CORS ──
// En production : liste blanche stricte d'origines (ALLOWED_ORIGINS séparées par des virgules,
// ou FRONTEND_URL). En développement : on reflète l'origine pour autoriser le réseau local.
export const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

/**
 * Origines de l'application mobile (Capacitor).
 *
 * Une application native ne s'exécute pas depuis un domaine : la WebView sert
 * les fichiers embarqués depuis un pseudo-domaine local. Android emploie
 * « https://localhost », iOS « capacitor://localhost ».
 *
 * Ces valeurs sont donc l'application ELLE-MÊME, pas un site tiers. Les
 * inscrire ici plutôt que dans une variable d'environnement est délibéré :
 * une liste blanche qu'il faut penser à compléter finit toujours par être
 * oubliée, et l'application entière échouerait alors dès son lancement,
 * sans autre message qu'une erreur réseau.
 *
 * Elles n'élargissent pas la surface d'attaque : aucun site web ne peut se
 * présenter avec l'une de ces origines, seul un binaire installé sur
 * l'appareil le peut.
 */
const ORIGINES_APPLICATION = [
  'capacitor://localhost',  // iOS
  'https://localhost',      // Android
];

/* `http://localhost` a été retiré de la liste permanente.
   Capacitor n'en a pas besoin — iOS emploie « capacitor:// » et Android
   « https:// » — mais l'accepter en production ouvrait, avec credentials,
   une origine qu'un serveur local hostile sur le poste d'un patient pouvait
   revendiquer. Il reste autorisé en développement par la règle ci-dessous,
   qui accepte tout hors production. */

export const optionsCors = {
  origin(origin, callback) {
    // Requêtes sans origine (curl, health checks, certaines WebView) : autorisées
    if (!origin) return callback(null, true);
    if (ORIGINES_APPLICATION.includes(origin)) return callback(null, true);
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origine non autorisée par la politique CORS'));
  },
  credentials: true,
  /* Méthodes et en-têtes énumérés. Par défaut, `cors` reflète ce que le
     navigateur demande au contrôle préalable : la réponse annonce donc tout
     ce qu'on lui présente, y compris des méthodes qu'aucune route n'expose. */
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'If-None-Match'],
  maxAge: 600,
};

