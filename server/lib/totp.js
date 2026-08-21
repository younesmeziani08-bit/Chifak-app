/**
 * Double authentification par code à usage unique (TOTP, RFC 6238).
 *
 * ── Pourquoi sans bibliothèque ──
 *
 * L'algorithme tient en quarante lignes et il est entièrement spécifié : un
 * compteur de trente secondes, un HMAC-SHA1, une troncature. Node fournit
 * déjà tout. Ajouter une dépendance pour cela, c'est ajouter un arbre de
 * paquets à surveiller — et le projet en compte déjà sept à corriger.
 *
 * ── Pourquoi TOTP plutôt qu'un code par SMS ──
 *
 * Le SMS coûte à chaque envoi, dépend d'un opérateur, et se détourne : le
 * transfert de numéro est la voie d'attaque la plus courante contre les
 * seconds facteurs. Une application d'authentification fonctionne hors ligne,
 * gratuitement, et ne dépend de personne.
 *
 * ── Ce que ce fichier ne fait pas ──
 *
 * Il ne décide pas qui a le droit d'entrer : il répond seulement « ce code
 * correspond-il à ce secret, maintenant ? ». Le rejeu, le freinage et les
 * droits se traitent dans la route.
 */
import crypto from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PERIODE = 30;      // secondes par code, valeur standard
const CHIFFRES = 6;
/* Tolérance d'une période avant et après. Les horloges de téléphone dérivent,
   et la personne finit toujours de taper après l'affichage. Zéro tolérance
   produit des refus incompréhensibles ; au-delà de un, on allonge inutilement
   la fenêtre pendant laquelle un code intercepté reste utilisable. */
const TOLERANCE = 1;

/** Encodage base32 (RFC 4648), sans remplissage — format attendu par les applications. */
export function base32Encoder(octets) {
  let bits = 0;
  let valeur = 0;
  let sortie = '';
  for (const octet of octets) {
    valeur = (valeur << 8) | octet;
    bits += 8;
    while (bits >= 5) {
      sortie += ALPHABET[(valeur >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) sortie += ALPHABET[(valeur << (5 - bits)) & 31];
  return sortie;
}

/** Décodage base32. Tolère les espaces et les minuscules : on saisit à la main. */
export function base32Decoder(texte) {
  const propre = String(texte).toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let valeur = 0;
  const octets = [];
  for (const caractere of propre) {
    const index = ALPHABET.indexOf(caractere);
    if (index === -1) throw new Error('Caractère invalide dans le secret.');
    valeur = (valeur << 5) | index;
    bits += 5;
    if (bits >= 8) {
      octets.push((valeur >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(octets);
}

/**
 * Nouveau secret, 20 octets tirés au sort.
 *
 * Vingt octets, soit 160 bits : c'est la taille recommandée par la RFC pour
 * HMAC-SHA1, et celle qu'attendent toutes les applications courantes.
 */
export function genererSecret() {
  return base32Encoder(crypto.randomBytes(20));
}

/** Code attendu pour un secret à un instant donné. */
export function codePour(secretBase32, compteur) {
  const cle = base32Decoder(secretBase32);

  // Le compteur occupe huit octets, poids fort en tête.
  const tampon = Buffer.alloc(8);
  tampon.writeUInt32BE(Math.floor(compteur / 2 ** 32), 0);
  tampon.writeUInt32BE(compteur >>> 0, 4);

  const empreinte = crypto.createHmac('sha1', cle).update(tampon).digest();

  /* Troncature dynamique : les quatre bits de poids faible du dernier octet
     désignent où lire les quatre octets qui portent le code. Le bit de signe
     est masqué, sinon le nombre serait négatif sur certaines plateformes. */
  const decalage = empreinte[empreinte.length - 1] & 0x0f;
  const nombre = ((empreinte[decalage] & 0x7f) << 24)
    | ((empreinte[decalage + 1] & 0xff) << 16)
    | ((empreinte[decalage + 2] & 0xff) << 8)
    | (empreinte[decalage + 3] & 0xff);

  return String(nombre % 10 ** CHIFFRES).padStart(CHIFFRES, '0');
}

/**
 * Le code proposé est-il valable ?
 *
 * Renvoie le compteur accepté — que l'appelant DOIT mémoriser pour refuser le
 * même code une seconde fois — ou `null`. Sans cette mémorisation, un code lu
 * par-dessus l'épaule reste utilisable pendant une minute et demie.
 *
 * La comparaison est à temps constant : une comparaison ordinaire s'arrête au
 * premier caractère différent, et la durée de la réponse révèle alors combien
 * de chiffres étaient corrects.
 */
export function verifierCode(secretBase32, codePropose, { maintenant = Date.now(), dernierCompteur = null } = {}) {
  const code = String(codePropose || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) return null;

  const compteurActuel = Math.floor(maintenant / 1000 / PERIODE);

  for (let ecart = -TOLERANCE; ecart <= TOLERANCE; ecart += 1) {
    const compteur = compteurActuel + ecart;
    // Rejeu : ce compteur, ou un plus ancien, a déjà servi.
    if (dernierCompteur !== null && compteur <= dernierCompteur) continue;

    const attendu = codePour(secretBase32, compteur);
    const a = Buffer.from(attendu);
    const b = Buffer.from(code);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return compteur;
  }
  return null;
}

/**
 * Adresse « otpauth:// » à saisir dans l'application d'authentification.
 *
 * Elle porte le secret : elle ne doit JAMAIS transiter par un service tiers.
 * C'est la raison pour laquelle le QR n'est pas fabriqué par api.qrserver.com
 * comme celui des employés — envoyer cette adresse à un tiers reviendrait à
 * lui remettre le second facteur.
 */
export function adresseOtpauth({ secret, compte, emetteur = 'chifak' }) {
  const libelle = encodeURIComponent(`${emetteur}:${compte}`);
  const parametres = new URLSearchParams({
    secret,
    issuer: emetteur,
    algorithm: 'SHA1',
    digits: String(CHIFFRES),
    period: String(PERIODE),
  });
  return `otpauth://totp/${libelle}?${parametres.toString()}`;
}

/** Secret présenté par groupes de quatre : on le recopie à la main sans se perdre. */
export function secretLisible(secret) {
  return secret.replace(/(.{4})/g, '$1 ').trim();
}

/* ── Chiffrement du secret au repos ──

   Le secret vaut le mot de passe : qui le lit fabrique des codes valides
   indéfiniment. Une sauvegarde de base égarée, ou un accès en lecture seule,
   suffirait donc à contourner la double authentification — ce qui la rendrait
   décorative.

   On le chiffre avec une clé dérivée de JWT_SECRET. La protection vaut ce que
   vaut ce secret : si l'attaquant l'obtient aussi, il déchiffre. C'est une
   défense en profondeur, pas une garantie absolue — mais elle couvre le cas
   le plus courant, qui est la fuite de la base seule. */
const cleChiffrement = () => crypto.createHash('sha256')
  .update(`totp:${process.env.JWT_SECRET || ''}`)
  .digest();

export function chiffrerSecret(secret) {
  const vecteur = crypto.randomBytes(12);
  const chiffreur = crypto.createCipheriv('aes-256-gcm', cleChiffrement(), vecteur);
  const contenu = Buffer.concat([chiffreur.update(secret, 'utf8'), chiffreur.final()]);
  return `${vecteur.toString('base64')}.${chiffreur.getAuthTag().toString('base64')}.${contenu.toString('base64')}`;
}

export function dechiffrerSecret(stocke) {
  const [v, tag, contenu] = String(stocke).split('.');
  if (!v || !tag || !contenu) throw new Error('Secret illisible.');
  const dechiffreur = crypto.createDecipheriv('aes-256-gcm', cleChiffrement(), Buffer.from(v, 'base64'));
  dechiffreur.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([dechiffreur.update(Buffer.from(contenu, 'base64')), dechiffreur.final()]).toString('utf8');
}

/**
 * Codes de secours, à usage unique.
 *
 * Un téléphone se perd, se casse, se réinitialise. Sans ces codes, le compte
 * est définitivement inaccessible et il faut intervenir dans la base — au
 * pire moment, sous pression. Ils sont hachés comme des mots de passe : la
 * liste stockée ne permet pas de les retrouver.
 */
export function genererCodesDeSecours(nombre = 8) {
  return Array.from({ length: nombre }, () => {
    const brut = crypto.randomBytes(5).toString('hex').toUpperCase(); // 10 caractères
    return `${brut.slice(0, 5)}-${brut.slice(5)}`;
  });
}

/** Empreinte d'un code de secours. SHA-256 suffit : le code est aléatoire et long. */
export function empreinteCodeDeSecours(code) {
  return crypto.createHash('sha256')
    .update(String(code).toUpperCase().replace(/[\s-]/g, ''))
    .digest('hex');
}
