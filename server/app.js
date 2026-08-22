/**
 * Assemblage de l'application Express.
 *
 * Ce fichier ne contient AUCUNE logique métier : il branche, dans un ordre
 * qui compte, les protections puis les domaines. Pour trouver une route,
 * ouvrir le fichier du domaine dans routes/ ; pour changer une protection,
 * config/ ou middleware/. L'ordre ci-dessous est le chemin exact que suit
 * chaque requête.
 */
import './env.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import session from 'express-session';
import passport from './passport-config.js';
import { assertStrongSecrets } from './security.js';

import { allowedOrigins, optionsCors } from './config/cors.js';
import { fabriqueMagasin } from './config/redis.js';
import { generalLimiter, authLimiter, assistantLimiter, CHEMINS_SENSIBLES } from './config/limiters.js';
import { middlewareSession } from './config/session.js';
import { rapportPreparation } from './config/diagnostic.js';

import routesAuth from './routes/auth.js';
import routesDoctors from './routes/doctors.js';
import routesAppointments from './routes/appointments.js';
import routesReviews from './routes/reviews.js';
import routesConsultations from './routes/consultations.js';
import routesDoctorSpace from './routes/doctorSpace.js';
import routesAssistant from './routes/assistant.js';
import routesStaff from './routes/staff.js';
import routesApplications from './routes/applications.js';
import routesDeuxiemeFacteur from './routes/twoFactor.js';
import routesMotDePasse from './routes/motDePasse.js';
import routesAnnulations from './routes/annulations.js';

// SÉCURITÉ : on refuse de démarrer en production avec des secrets absents ou faibles.
assertStrongSecrets();

const app = express();

// Derrière le proxy de Render : nécessaire pour lire la vraie IP (rate-limiting, cookies sécurisés).
app.set('trust proxy', 1);

// Masque l'en-tête « X-Powered-By: Express » (moins d'informations pour un attaquant)
app.disable('x-powered-by');

// ── 1. Protections transversales ──
/* Politique de contenu. Elle était entièrement désactivée : « ce serveur ne
   sert que du JSON, donc elle ne sert à rien ». C'est faux sur deux points.
   Il sert aussi des images — la route des photos de praticiens — et surtout
   toute réponse affichée directement par un navigateur (une erreur, une
   redirection OAuth) hérite alors d'une page sans aucune restriction.

   Celle-ci est volontairement fermée : rien à charger, rien à exécuter, et
   surtout `frame-ancestors 'none'` qui interdit d'enfermer nos réponses dans
   un cadre — un écran de connexion OAuth encadré par un site tiers est le
   point de départ classique d'un détournement de clic. */
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'none'"],
      imgSrc: ["'self'", 'data:'],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
    },
  },
  // Les photos de praticiens sont lues depuis un autre domaine (le front sur
  // Vercel, l'application mobile) : la politique par défaut les bloquerait.
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  referrerPolicy: { policy: 'no-referrer' },
  // HSTS : une fois le site visité en HTTPS, le navigateur refuse le HTTP.
  hsts: process.env.NODE_ENV === 'production'
    ? { maxAge: 15552000, includeSubDomains: true }
    : false,
}));
app.use(compression());
app.use(cors(optionsCors));
/* Plafonds de charge utile, par usage réel.
   1 Mo était appliqué partout, alors qu'il n'est justifié que pour la fiche
   d'un praticien : elle porte sa photo encodée, jusqu'à 220 Ko. Partout
   ailleurs, quelques kilo-octets suffisent — et accorder un mégaoctet à
   chaque route revient à offrir un mégaoctet d'analyse JSON par requête à qui
   veut occuper le processus.

   Le premier `express.json` qui traite la requête pose le corps ; les
   suivants le constatent et passent leur tour. L'ordre est donc décroissant
   en spécificité. */
app.use('/api/doctors', express.json({ limit: '1mb' }));
// L'assistant transporte l'historique de la conversation : douze messages
// bornés à 4 000 caractères, soit près de 50 Ko dans le pire des cas.
app.use('/api/assistant', express.json({ limit: '128kb' }));
app.use(express.json({ limit: '64kb' }));

// ── 2. Limitation de débit ──
app.use('/api/', generalLimiter);
CHEMINS_SENSIBLES.forEach((chemin) => app.use(chemin, authLimiter));
app.use('/api/assistant', assistantLimiter);

// ── 3. Session (poignée de main OAuth uniquement) + Passport ──
app.use(middlewareSession);
app.use(passport.initialize());
app.use(passport.session());

// ── 4. Surveillance ──
/* Surveillance. Le rapport de préparation y figure pour qu'on puisse relire
   l'état du service sans fouiller les journaux de l'hébergeur — des états
   uniquement, jamais une valeur de configuration. */
app.get('/health', (req, res) => {
  const preparation = rapportPreparation();
  res.json({
    status: preparation.etat === 'bloquant' ? 'degraded' : 'ok',
    uptime: process.uptime(),
    preparation,
  });
});

// Route de vérification de déploiement : quelle version tourne réellement,
// sans lire les logs. On expose des états, jamais de valeurs sensibles.
app.get('/', (req, res) => {
  res.json({
    message: 'API chifak fonctionne ! 🏥',
    features: {
      assistantLangChoice: true,
      assistantOrientation: true,
      assistantRequiresPatientAuth: true,
      staffAccounts: true,
      randomStaffLogin: true,
      publicFeedback: true,
      modularServer: true,
    },
    cors: {
      production: process.env.NODE_ENV === 'production',
      allowedOriginsCount: allowedOrigins.length,
      // Les origines Capacitor sont toujours acceptées : ce sont celles de
      // l'application mobile elle-même, pas d'un site tiers.
      mobileApp: true,
    },
    rateLimit: {
      shared: !!fabriqueMagasin,
      backend: fabriqueMagasin ? 'redis' : 'memory',
    },
  });
});

// ── 5. Domaines métier ──
// Chaque routeur déclare ses chemins en absolu : la liste complète des
// routes d'un domaine se lit dans son fichier, sans préfixe à reconstituer.
app.use(routesAuth);          // connexions, inscription, OAuth, profil patient
app.use(routesDoctors);       // annuaire public + gestion des fiches praticiens
app.use(routesAppointments);  // réservation, agenda patient, vue admin
app.use(routesReviews);       // avis publics des patients
app.use(routesConsultations); // dossiers de consultation (espace médecin)
app.use(routesDoctorSpace);   // profil et rendez-vous du praticien connecté
app.use(routesAssistant);     // assistant santé (IA)
app.use(routesStaff);         // comptes employés, QR d'avis, agendas manuels
app.use(routesApplications);  // demandes d'inscription des praticiens
app.use(routesDeuxiemeFacteur); // double authentification du personnel
app.use(routesMotDePasse);      // oubli, réinitialisation et changement du mot de passe patient
app.use(routesAnnulations);     // annulation par le patient, l'invité, le praticien ou le cabinet

// ── 6. Filets ──
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Route introuvable' });
});

app.use((err, req, res, next) => {
  console.error('Erreur non gérée:', err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: 'Erreur serveur' });
});

export default app;
