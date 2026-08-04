/**
 * Utilitaires de sécurité : validation et nettoyage des entrées utilisateur.
 * Règle d'or : ne jamais faire confiance à ce qui vient du client.
 */

// ── Échappement HTML (anti-XSS / injection dans les e-mails) ──
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Chaîne nettoyée et bornée ──
// Retire les caractères de contrôle et limite la longueur (anti-saturation de la base).
export function cleanString(value, maxLength = 255) {
  if (typeof value !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const stripped = Array.from(value)
    .map((ch) => (ch.codePointAt(0) < 32 || ch.codePointAt(0) === 127 ? ' ' : ch))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  if (!stripped) return null;
  return stripped.slice(0, maxLength);
}

// ── Formats ──
// Jeu de caractères volontairement restreint : rejette < > " ' ; et autres charges utiles
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
// Numéros algériens et internationaux courants
const PHONE_RE = /^\+?[0-9 ().-]{8,20}$/;

export function isValidEmail(value) {
  return typeof value === 'string' && value.length <= 254 && EMAIL_RE.test(value.trim());
}

export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  // La date doit se réécrire à l'identique (rejette 2026-02-31)
  return d.toISOString().slice(0, 10) === value;
}

export function isValidTime(value) {
  return typeof value === 'string' && TIME_RE.test(value);
}

export function isValidPhone(value) {
  return typeof value === 'string' && PHONE_RE.test(value.trim());
}

// ── Entier borné (ids, pagination, notes) ──
export function toBoundedInt(value, { min, max, fallback = null }) {
  const n = Number(value);
  if (!Number.isInteger(n)) return fallback;
  if (min !== undefined && n < min) return fallback;
  if (max !== undefined && n > max) return fallback;
  return n;
}

export function isValidId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n <= Number.MAX_SAFE_INTEGER;
}

// ── Mots de passe ──
export function passwordStrengthError(pwd) {
  if (typeof pwd !== 'string' || pwd.length < 8) {
    return 'Le mot de passe doit contenir au moins 8 caractères.';
  }
  if (pwd.length > 128) {
    return 'Le mot de passe est trop long (128 caractères maximum).';
  }
  if (!/[A-Za-z]/.test(pwd) || !/[0-9]/.test(pwd)) {
    return 'Le mot de passe doit contenir des lettres et des chiffres.';
  }
  return null;
}

// Distance de Levenshtein (comparaison de similarité)
export function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const prev = Array.from({ length: n + 1 }, (_, i) => i);
  const cur = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = cur[j];
  }
  return prev[n];
}

// Le nouveau mot de passe ne doit pas ressembler à l'ancien
export function isTooSimilar(oldPwd, newPwd) {
  if (!oldPwd) return false;
  const a = String(oldPwd).toLowerCase();
  const b = String(newPwd).toLowerCase();
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  if (dist <= 3) return true;
  if (dist / maxLen < 0.34) return true;
  return false;
}

// ── Secrets : refuser de démarrer avec une configuration faible ──
const WEAK_SECRETS = new Set([
  'secret', 'changeme', 'password', 'chifak', 'chifak_secret',
  'chifak_session_secret', 'your_jwt_secret', 'test', 'dev',
]);

/**
 * Valide la photo d'un praticien.
 *
 * Trois formes acceptées : vide, adresse http(s), ou image encodée en `data:`.
 * Le plafond de 220 Ko protège la base et l'annuaire : la photo est renvoyée
 * dans chaque fiche, donc une image non compressée par un navigateur détourné
 * alourdirait toutes les réponses. Le client réduit déjà à ~15 Ko ; cette borne
 * n'est là que pour les appels qui ne passent pas par lui.
 */
export const DOCTOR_IMAGE_MAX = 220 * 1024;

export function isValidDoctorImage(value) {
  if (value === undefined || value === null || value === '') return true;
  if (typeof value !== 'string') return false;
  if (value.length > DOCTOR_IMAGE_MAX) return false;
  if (/^https?:\/\/[^\s]+$/i.test(value)) return true;
  if (/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value)) return true;
  // Les anciennes fiches contiennent un émoji : on les laisse passer sans
  // les casser, mais on borne leur longueur.
  return value.length <= 16;
}

export function assertStrongSecrets() {
  const problems = [];
  const isProd = process.env.NODE_ENV === 'production';

  for (const name of ['JWT_SECRET', 'SESSION_SECRET']) {
    const value = process.env[name];
    if (!value) {
      problems.push(`${name} est absent.`);
      continue;
    }
    if (value.length < 32) {
      problems.push(`${name} est trop court (32 caractères minimum).`);
    }
    if (WEAK_SECRETS.has(value.toLowerCase())) {
      problems.push(`${name} utilise une valeur trop évidente.`);
    }
  }

  if (problems.length === 0) return;

  const message = `Configuration de sécurité invalide :\n  - ${problems.join('\n  - ')}\n` +
    `Générez des secrets avec : node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`;

  if (isProd) {
    // En production, on refuse de démarrer plutôt que de tourner en mode vulnérable.
    throw new Error(message);
  }
  console.warn(`⚠️  ${message}`);
}
