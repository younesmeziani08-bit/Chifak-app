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
 * ── Pourquoi il ne fait plus appel à grep ──
 *
 * Il s'appuyait sur `grep -rnoP`, donc sur les expressions Perl. Le grep de
 * macOS ne connaît pas l'option -P : chaque appel échouait, le try/catch
 * renvoyait une chaîne vide, et le script concluait « ✅ Les contrats sont
 * respectés » sur un ensemble vide. Il annonçait « 0 routes déclarées » alors
 * qu'il y en a cinquante-sept, et personne ne lisait cette ligne.
 *
 * Un outil de vérification qui ment coûte plus cher que le bug qu'il cache.
 * Il lit donc les fichiers lui-même, avec les expressions régulières de
 * JavaScript : même comportement sur macOS, sur Linux et en intégration
 * continue. Et il refuse désormais de conclure quoi que ce soit s'il ne
 * trouve rien à analyser — voir le garde-fou en bas de fichier.
 *
 *   Usage :  npm run contrats
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

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

const EXTENSIONS = new Set(['.js', '.mjs', '.ts', '.tsx', '.jsx']);
const IGNORES = new Set(['node_modules', 'dist', 'dist-admin', 'dist-ssr', '.git', 'ios', 'android']);

/** Tous les fichiers de code sous un dossier, en profondeur. */
function fichiersDe(dossier) {
  const sortie = [];
  if (!existsSync(dossier)) return sortie;
  for (const entree of readdirSync(dossier)) {
    if (IGNORES.has(entree)) continue;
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) {
      sortie.push(...fichiersDe(chemin));
    } else if (EXTENSIONS.has(entree.slice(entree.lastIndexOf('.')))) {
      sortie.push(chemin);
    }
  }
  return sortie;
}

/**
 * Applique une expression régulière à chaque fichier d'un dossier.
 * Renvoie { fichier, capture } pour chaque correspondance, la capture étant
 * le premier groupe — l'équivalent du \K de PCRE, en portable.
 */
function chercher(dossier, motif) {
  const trouvailles = [];
  for (const fichier of fichiersDe(dossier)) {
    const contenu = readFileSync(fichier, 'utf8');
    const re = new RegExp(motif.source, motif.flags.includes('g') ? motif.flags : `${motif.flags}g`);
    let m;
    while ((m = re.exec(contenu)) !== null) {
      trouvailles.push({ fichier: relative(process.cwd(), fichier), capture: m[1] });
    }
  }
  return trouvailles;
}

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

// ── 1. Ce que le serveur déclare ──
const routes = new Map();
for (const { fichier, capture } of chercher(
  'server/routes',
  /router\.(?:get|post|put|patch|delete)\('(\/api\/[^']+)'/,
)) {
  const chemin = capture.replace(/:[a-zA-Z_]+/g, ':x');
  if (!routes.has(chemin)) routes.set(chemin, fichier);
}

// ── 2. Ce que les navigateurs appellent ──
const appels = new Map();
for (const dossier of ['src', 'admin']) {
  for (const { fichier, capture } of chercher(dossier, /API_URL\}([^`'"]*)/)) {
    const chemin = '/api' + normaliser(capture);
    if (!appels.has(chemin)) appels.set(chemin, fichier);
  }
}

let erreurs = 0;
const dire = (ok, texte) => { if (!ok) erreurs++; console.log(`  ${ok ? '✅' : '❌'} ${texte}`); };

console.log(`\n${routes.size} routes déclarées · ${appels.size} adresses appelées\n`);

/* ── Garde-fou : ne jamais conclure sur du vide ──
   C'est la leçon de la panne silencieuse. Un ensemble vide n'est pas la
   preuve que tout va bien, c'est la preuve que l'analyse n'a pas eu lieu :
   dossier déplacé, motif obsolète, script lancé depuis le mauvais endroit.
   Dans ce cas on s'arrête en erreur, bruyamment, plutôt que d'afficher un
   feu vert que personne ne pourra plus croire. */
if (routes.size === 0 || appels.size === 0) {
  console.error('❌ Rien à analyser — ce n\'est PAS un succès.');
  console.error('   Le script n\'a trouvé aucune route ou aucun appel, ce qui');
  console.error('   signifie que l\'analyse a échoué, pas que le code est sain.');
  console.error('   À vérifier : lancement depuis la racine du dépôt, présence');
  console.error('   de server/routes/, src/ et admin/.\n');
  process.exit(1);
}

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
const fuitesAdmin = [...new Set(
  chercher('src', /(API_URL\}\/admin\/)/).map((t) => t.fichier),
)];
dire(fuitesAdmin.length === 0,
  fuitesAdmin.length === 0
    ? 'aucune route d\'administration citée dans l\'application patiente'
    : `routes d'administration citées dans src/ : ${fuitesAdmin.join(', ')}`);

const importsInverses = [...new Set(
  chercher('src', /(from\s+'[^']*\.\.\/admin\/)/).map((t) => t.fichier),
)];
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
