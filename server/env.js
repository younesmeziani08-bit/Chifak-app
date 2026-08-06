import dotenv from 'dotenv';

/**
 * Chargement des variables d'environnement, à importer AVANT tout le reste.
 *
 * Pourquoi un fichier séparé plutôt qu'un simple `dotenv.config()` dans
 * server.js : en modules ES, les `import` sont tous évalués avant la première
 * ligne de code du fichier qui les demande. Or database.js crée son pool
 * PostgreSQL au moment où il est évalué, en lisant `process.env.DATABASE_URL`.
 * L'appel à `dotenv.config()` placé dans le corps de server.js arrivait donc
 * trop tard : le pool était déjà construit, avec une adresse vide.
 *
 * En production cela ne se voyait pas — Render place ses variables dans
 * l'environnement réel du processus, elles existent avant même le démarrage.
 * En local, où elles viennent du fichier .env, la connexion retombait sur les
 * réglages par défaut de PostgreSQL : utilisateur et base nommés d'après le
 * compte du système, d'où l'erreur « database "admin" does not exist ».
 *
 * Importer ce module en premier garantit que .env est lu avant que quoi que
 * ce soit d'autre ne consulte process.env.
 */
dotenv.config();

export default process.env;
