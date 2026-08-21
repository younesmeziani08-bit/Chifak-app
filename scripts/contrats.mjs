#!/usr/bin/env node
/**
 * Contrôle des contrats entre le navigateur et le serveur.
 *
 * ── Pourquoi ce script existe ──
 *
 * Les bugs qui ont réellement cassé cette application n'étaient pas des
 * erreurs de calcul : c'étaient des ruptures entre deux couches.
 * L'inscription appelait « /auth/signup », une route qui n'existait pas — et
 * la compilation passait, les tests unitaires passaient, personne ne pouvait
 * créer de compte. La réservation n'envoyait pas le jeton, ce qui annulait
 * silencieusement le verrouillage des coordonnées.
 *
 * Aucun test unitaire n'attrape cela : chaque moitié est juste, c'est le lien
 * qui manque. Ce script compare les deux moitiés, en deux secondes, sans
 * aucune dépendance.
 *
 * Il vérifie trois choses :
 *
 *   1. Toute adresse appelée par un navigateur atteint une route déclarée.
 *   2. Toute route déclarée est appelée par quelqu'un — sinon c'est une
 *      surface exposée sans usage, comme /api/patient/recharge l'était.
 *   3. La séparation des deux applications tient : `src/` (patients) ne cite
 *      jamais une route d'administration, et n'importe jamais de `admin/`.
 *
 *   Usage :  npm run contrats
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const sh = (c) => { try { return execSync(c, { encoding: 'utf8' }); } catch { return ''; } };
const lignes = (s) => s.trim().split('\n').filter(Boolean);

/* Routes que personne n'appelle par `${API_URL}/…`, et c'est normal.
   Chacune doit porter sa raison : une liste d'exceptions sans explication
   finit par tout absoudre. */
const TOLEREES = new Map([
  ['/api/doctors/:x/photo', 'adresse construite par le serveur (lib/photos.js), utilisée en <img src>'],
  ['/api/auth/google', 'ouverte par redirection, via AUTH_GOOGLE_URL'],
  ['/api/auth/google/callback', 'retour du fournisseur, jamais appelé par nous'],
  ['/api/auth/facebook', 'ouverte par redirection, via AUTH_FACEBOOK_URL'],
  ['/api/auth/facebook/callback', 'retour du fournisseur, jamais appelé par nous'],
  ['/api/admin/daily-agendas', 'déclenchement manuel des agendas, sans écran'],
  ['/api/admin/rappels', 'déclenchement manuel des rappels, sans écran'],
]);

/**
 * Normalise un chemin écrit en JavaScript.
 *
 * `${id}` entre deux barres obliques est un paramètre de route → « :x ».
 * `${suffixe}` collé à un mot est une chaîne de requête → on l'enlève.
 * Sans cette distinction, « /stats${suffixe} » devenait « /stats:x » et le
 * script signalait une route inexistante qui existait pourtant.
 */
function normaliser(chemin) {
  return chemin
    .replace(/\/\$\{[^}]*\}/g, '/:x')   // segment complet → paramètre
    .replace(/\$\{[^}]*\}/g, '')        // reste collé à un mot → suffixe
    .replace(/\?.*$/, '')               // chaîne de requête
    .replace(/\/+$/, '');               // barre finale
}

/**
 * Découpe une ligne de `grep -rnoP` : « fichier:numéro:correspondance ».
 *
 * Découper sur le DERNIER deux-points serait faux — les chemins de routes en
 * contiennent : « /api/doctors/:id/photo » deviendrait « id/photo ». On ne
 * coupe donc que les deux premiers.
 */
function decouper(ligne) {
  const a = ligne.indexOf(':');
  const b = ligne.indexOf(':', a + 1);
  return { fichier: ligne.slice(0, a), texte: ligne.slice(b + 1) };
}

// ── 1. Ce que le serveur déclare ──
const routes = new Map();
for (const l of lignes(sh(`grep -rnoP "router\\.(get|post|put|patch|delete)\\('\\K/api/[^']+" server/routes/`))) {
  const { fichier, texte } = decouper(l);
  const chemin = texte.replace(/:[a-zA-Z_]+/g, ':x');
  if (!routes.has(chemin)) routes.set(chemin, fichier);
}

// ── 2. Ce que les navigateurs appellent ──
const appels = new Map();
for (const dossier of ['src', 'admin']) {
  if (!existsSync(dossier)) continue;
  for (const l of lignes(sh(`grep -rnoP "API_URL\\}\\K[^\\\`'\\"]+" ${dossier}/ 2>/dev/null`))) {
    const { fichier, texte } = decouper(l);
    const chemin = '/api' + normaliser(texte);
    if (!appels.has(chemin)) appels.set(chemin, fichier);
  }
}

let erreurs = 0;
const dire = (ok, texte) => { if (!ok) erreurs++; console.log(`  ${ok ? '✅' : '❌'} ${texte}`); };

console.log(`\n${routes.size} routes déclarées · ${appels.size} adresses appelées\n`);

// ── Appels vers le vide ──
console.log('── Chaque appel atteint-il une route ? ──');
const orphelins = [...appels].filter(([c]) => !routes.has(c));
if (orphelins.length === 0) console.log('  ✅ oui, sans exception');
for (const [chemin, fichier] of orphelins) {
  dire(false, `${chemin}  ← ${fichier}  (aucune route ne répond)`);
}

// ── Routes sans usage ──
console.log('\n── Chaque route sert-elle à quelque chose ? ──');
const inutilisees = [...routes].filter(([c]) => !appels.has(c) && !TOLEREES.has(c));
if (inutilisees.length === 0) console.log('  ✅ oui, sans exception');
for (const [chemin, fichier] of inutilisees) {
  dire(false, `${chemin}  ← ${fichier}  (déclarée, jamais appelée : surface exposée sans usage)`);
}

// ── La séparation des applications ──
console.log('\n── La séparation patients / administration tient-elle ? ──');
const fuitesAdmin = lignes(sh(`grep -rlP "API_URL\\}/admin/" src/ 2>/dev/null`));
dire(fuitesAdmin.length === 0,
  fuitesAdmin.length === 0
    ? 'aucune route d\'administration citée dans l\'application patiente'
    : `routes d'administration citées dans src/ : ${fuitesAdmin.join(', ')}`);

const importsInverses = lignes(sh(`grep -rlP "from '.*\\.\\./admin/" src/ 2>/dev/null`));
dire(importsInverses.length === 0,
  importsInverses.length === 0
    ? 'src/ n\'importe rien de admin/ — le paquet patient reste propre'
    : `src/ importe de admin/ : ${importsInverses.join(', ')}`);

// ── Tolérances, affichées pour rester honnêtes ──
const actives = [...TOLEREES].filter(([c]) => routes.has(c));
if (actives.length) {
  console.log('\n── Routes tolérées sans appel direct ──');
  for (const [c, raison] of actives) console.log(`  · ${c.padEnd(34)} ${raison}`);
}

console.log(erreurs === 0
  ? '\n✅ Les contrats sont respectés.\n'
  : `\n❌ ${erreurs} rupture(s) de contrat.\n`);
process.exit(erreurs === 0 ? 0 : 1);
