/**
 * Préparation d'une photo de praticien choisie depuis l'ordinateur.
 *
 * La photo est réduite et recompressée DANS LE NAVIGATEUR avant d'être envoyée.
 * Sans cela, une photo d'appareil moderne (4 à 8 Mo) partirait telle quelle en
 * base et se retrouverait dans chaque réponse de l'annuaire : à mille médecins,
 * la liste pèserait plusieurs gigaoctets.
 *
 * Réglage retenu : 256 × 256, JPEG qualité 0,72 — environ 10 à 18 Ko, soit la
 * taille d'une petite icône, pour un rendu net sur les vignettes de 44 à 80 px
 * utilisées dans l'application.
 */

/** Côté du carré final, en pixels. */
const TAILLE = 256;
/** Qualité JPEG. Au-delà de 0,8 le gain visuel est nul sur une vignette. */
const QUALITE = 0.72;
/** Refus au-delà : garde-fou si la compression échoue à réduire suffisamment. */
export const POIDS_MAX = 200 * 1024;

export class ImageTropLourdeError extends Error {}
export class ImageInvalideError extends Error {}

/**
 * Lit le fichier, le recadre en carré centré, le réduit et renvoie une adresse
 * `data:` prête à être stockée.
 */
export async function preparerPhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new ImageInvalideError('Le fichier choisi n’est pas une image.');
  }

  const bitmap = await chargerImage(file);

  const canvas = document.createElement('canvas');
  canvas.width = TAILLE;
  canvas.height = TAILLE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImageInvalideError('Impossible de préparer l’image.');

  // Recadrage carré centré : on prend le plus grand carré possible au centre,
  // plutôt que de déformer le visage en étirant l'image.
  const cote = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - cote) / 2;
  const sy = (bitmap.height - cote) / 2;

  // Fond blanc : un PNG transparent deviendrait noir une fois converti en JPEG.
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, TAILLE, TAILLE);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, sx, sy, cote, cote, 0, 0, TAILLE, TAILLE);

  const dataUrl = canvas.toDataURL('image/jpeg', QUALITE);

  // Longueur de la chaîne ≈ poids transféré : on la contrôle après compression,
  // pas avant, puisque c'est le résultat compressé qui sera stocké.
  if (dataUrl.length > POIDS_MAX) {
    throw new ImageTropLourdeError('Image trop lourde après compression.');
  }
  return dataUrl;
}

/** Poids approximatif d'une adresse `data:` en octets. */
export function poidsApproximatif(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] || '';
  return Math.round((base64.length * 3) / 4);
}

function chargerImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageInvalideError('Image illisible.'));
    };
    img.src = url;
  });
}
