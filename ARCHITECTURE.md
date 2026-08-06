# Architecture de chifak

Ce document explique où vit chaque chose et pourquoi. Règle générale : **le
backend et le frontend sont découpés par les mêmes domaines métier**. Pour
suivre une fonctionnalité de bout en bout, ouvrir le fichier du même nom des
deux côtés.

## Vue d'ensemble

```
chifak-app/
├── server/          Backend Express + PostgreSQL (déployé sur Render)
└── src/             Frontend React + Vite (déployé sur Vercel)
```

## Backend (`server/`)

Une requête traverse les couches dans cet ordre :

```
server.js  →  app.js  →  config/  →  middleware/  →  routes/  →  lib/  →  database.js
(entrée)      (câblage)   (protections) (authentification) (métier)  (partagé)  (données)
```

| Chemin | Rôle |
|---|---|
| `env.js` | Charge `.env` **avant tout le reste** (l'ordre des imports ES compte : le pool PostgreSQL se construit à l'import). |
| `server.js` | Point d'entrée minimal : init base, écoute, cron des agendas. |
| `app.js` | Assemblage Express. L'ordre des `app.use` y est le chemin exact de chaque requête. Aucune logique métier. |
| `config/redis.js` | Client Redis **facultatif** (limiteur + sessions). Sans `REDIS_URL`, tout marche en mémoire. |
| `config/limiters.js` | Tous les limiteurs de débit : général, authentification, assistant IA, réservation. |
| `config/cors.js` | Liste blanche d'origines (stricte en production). |
| `config/session.js` | Session, utilisée uniquement pour la poignée de main OAuth. |
| `middleware/auth.js` | Un middleware par population : personnel, patient, médecin. Chacun vérifie le **type** du jeton — un jeton patient n'ouvre jamais une route d'administration. |
| `routes/auth.js` | Connexions, inscription, OAuth, profil patient. |
| `routes/doctors.js` | Annuaire public, fiche, photo, gestion admin des praticiens. |
| `routes/appointments.js` | Réservation, agenda du patient, vue admin. |
| `routes/reviews.js` | Avis publics des patients (non supprimables, par principe). |
| `routes/consultations.js` | Dossiers de consultation de l'espace médecin. |
| `routes/doctorSpace.js` | Profil et rendez-vous du praticien connecté. |
| `routes/assistant.js` | Assistant santé (IA) : consigne système et extraction des marqueurs. |
| `routes/staff.js` | Comptes employés, statistiques, avis par QR code. |
| `lib/publicData.js` | **La seule porte** par laquelle `blocked_slots` et les fiches de rendez-vous sortent du serveur, réduites au strict nécessaire. |
| `lib/photos.js` | Photos servies par adresse (`/api/doctors/:id/photo`), jamais en base64 dans les listes. |
| `lib/staff.js` | Identifiants tirés au sort, matricules, journal d'actions. |
| `database.js` | Schéma, migrations idempotentes, index, semis (démo en dev uniquement). |
| `security.js` | Validation des entrées, exigences sur les secrets. |

**Ajouter une route** : ouvrir le fichier du domaine dans `routes/`, déclarer
le chemin en absolu (`router.get('/api/...')`), choisir le bon middleware
d'authentification. Si le domaine n'existe pas : nouveau fichier dans
`routes/`, une ligne `app.use(...)` dans `app.js`.

### Invariants de sécurité (à ne jamais casser)

- Jamais de `SELECT *` sur une route qui répond à un patient ou au public —
  colonnes citées une à une.
- `blocked_slots` ne sort que via `horairesBloquesPublics()`.
- Les jetons sont vérifiés avec `algorithms: ['HS256']` épinglé.
- Aucun identifiant connu d'avance en production (voir le semis dans
  `database.js`).
- Les secrets ne sont jamais écrits dans les logs ni dans les réponses.
- Toute nouvelle requête de liste porte un `LIMIT`.

## Frontend (`src/`)

| Chemin | Rôle |
|---|---|
| `services/` | Appels réseau, **un fichier par domaine, en miroir de `server/routes/`**. `api.ts` est une façade de ré-export : les imports existants restent valides. `http.ts` porte les trois fabriques d'en-têtes (personnel, praticien, patient). |
| `components/home/` | Accueil, articles santé, sélecteur de wilaya. |
| `components/booking/` | Recherche, réservation, confirmation, assistant, avis, visio. |
| `components/patient/` | Compte patient, connexion. |
| `components/auth/` | Inscription, retour OAuth. |
| `components/doctor/` | Espace praticien, page d'avis QR. |
| `components/admin/` | Tableau de bord, fiches, employés, retours. |
| `components/shared/` | En-tête, avatar, bascule de langue — utilisés partout. |
| `contexts/` | État global : langue, annuaire, session admin. |
| `utils/` | Logique pure : créneaux (`slots.ts` est la source de vérité), photos, images. |

**Ajouter un écran** : le placer dans le dossier de son domaine ; s'il ouvre
un nouveau domaine, créer le dossier. Les appels réseau vont dans le service
du même domaine, jamais dans le composant.

## Environnement

Variables lues par le backend (`server/.env` en local, tableau de bord Render
en production) :

| Variable | Obligatoire | Rôle |
|---|---|---|
| `DATABASE_URL` | oui | PostgreSQL. |
| `JWT_SECRET` | oui (≥ 32 car.) | Signature des jetons. Le changer déconnecte tout le monde. |
| `SESSION_SECRET` | oui (≥ 32 car.) | Cookie de session OAuth. |
| `NODE_ENV` | oui en prod (`production`) | Active liste blanche CORS, cookies `secure`, et désactive données démo et logs de codes. |
| `ALLOWED_ORIGINS` | oui en prod | Origines autorisées, séparées par des virgules. |
| `REDIS_URL` | non | Limiteur et sessions partagés entre instances. |
| `EMAIL_USER` / `EMAIL_PASSWORD` | oui en prod | Envoi des codes et confirmations. |
| `AI_API_KEY` | non | Assistant santé. |
| `PUBLIC_API_URL` | non | Base des adresses de photos si le serveur est derrière un autre domaine. |
