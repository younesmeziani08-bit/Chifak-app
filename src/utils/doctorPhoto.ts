import { Doctor } from '../App';

/**
 * Politique d'avatar : on n'affiche une photo que si le praticien en a
 * réellement fourni une. Sinon on rend un monogramme déterministe.
 *
 * Choix délibéré : afficher des portraits de banque d'images à la place de
 * vrais médecins est trompeur pour le patient, et ces photos sont immédiatement
 * reconnaissables. Un monogramme assumé inspire davantage confiance.
 */

/**
 * Monogrammes : quatre variantes tirées de la seule palette de marque.
 * Aucune couleur étrangère — la variété vient de la valeur, pas de la teinte.
 * Contrastes mesurés : 12,8 / 15,5 / 7,0 / 4,6 pour 1.
 */
const PALETTE = [
  { bg: '#E2EFFF', fg: '#07008F' }, // azur clair / outremer
  { bg: '#E2EFFF', fg: '#0C0E45' }, // azur clair / nuit
  { bg: '#C9DEFB', fg: '#0A0A6B' }, // azur soutenu / outremer sombre
  { bg: '#0C0E45', fg: '#6574F8' }, // nuit / barbeau
];

/** Hachage stable : le même médecin garde toujours la même couleur. */
function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/** URL de photo réelle, ou null si le praticien n'en a pas fourni. */
export function getDoctorPhoto(doctor: Pick<Doctor, 'id' | 'name' | 'image'>): string | null {
  const img = (doctor.image || '').trim();
  if (/^(https?:)?\/\//.test(img) || img.startsWith('/')) return img;
  return null;
}

/** Couleurs du monogramme pour ce praticien. */
export function doctorMonogramColors(doctor: Pick<Doctor, 'id' | 'name'>) {
  return PALETTE[hash(`${doctor.id}-${doctor.name}`) % PALETTE.length];
}

/** Initiales, en ignorant le titre « Dr ». */
export function doctorInitials(name: string): string {
  const clean = (name || '').replace(/^d[rre]?\.?\s+/i, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  const initials = (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
  return initials.toUpperCase() || 'DR';
}
