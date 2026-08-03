/**
 * Visuels de l'application.
 *
 * Photos issues d'Unsplash, servies par leur CDN avec redimensionnement à la
 * volée (paramètres `w`, `q`, `auto=format`, `fit=crop`). Licence Unsplash :
 * usage commercial autorisé, attribution non obligatoire — nous créditons
 * malgré tout les auteurs, c'est la moindre des choses.
 *
 * Pour remplacer une photo par une vraie photo de cabinet algérien : déposer le
 * fichier dans `public/photos/` et changer `base` en `/photos/mon-fichier.jpg`
 * (la fonction `photoUrl` détecte les chemins locaux et n'ajoute pas de
 * paramètres CDN).
 */

export interface Photo {
  /** Base de l'URL, sans paramètres de redimensionnement. */
  base: string;
  /** Texte alternatif, décrit la scène pour les lecteurs d'écran. */
  alt: string;
  altAr: string;
  credit: { author: string; profile: string; source: string };
}

const UNSPLASH = 'https://images.unsplash.com';

export const PHOTOS = {
  /** Consultation en cabinet — onglet « Prendre rendez-vous ». */
  consultation: {
    base: `${UNSPLASH}/photo-1758691461957-474a7686e388`,
    alt: 'Un médecin et une patiente échangent lors d’une consultation au cabinet',
    altAr: 'طبيب ومريضة يتحدثان خلال استشارة في العيادة',
    credit: {
      author: 'Vitaly Gariev',
      profile: 'https://unsplash.com/@silverkblack',
      source: 'https://unsplash.com/photos/doctor-consults-with-patient-in-modern-office-7-l5EL7YHI4',
    },
  },

  /** Consultation à distance — onglet « Téléconsultation ». */
  teleconsultation: {
    base: `${UNSPLASH}/photo-1758691463620-188ca7c1a04f`,
    alt: 'Un médecin donne un avis médical en visioconférence depuis son bureau',
    altAr: 'طبيب يقدّم استشارة عبر الفيديو من مكتبه',
    credit: {
      author: 'Vitaly Gariev',
      profile: 'https://unsplash.com/@silverkblack',
      source: 'https://unsplash.com/photos/doctor-consulting-patient-via-video-call-on-laptop-EVX9pt2dD1o',
    },
  },

  /** Praticienne au travail — onglet « Je suis praticien ». */
  praticien: {
    base: `${UNSPLASH}/photo-1758691462878-6edc3d3da1be`,
    alt: 'Une praticienne remplit un dossier patient dans son cabinet',
    altAr: 'طبيبة تملأ ملف مريض في عيادتها',
    credit: {
      author: 'Vitaly Gariev',
      profile: 'https://unsplash.com/@silverkblack',
      source: 'https://unsplash.com/photos/doctor-consults-with-patient-in-medical-office-iyeUwItlIPk',
    },
  },
} satisfies Record<string, Photo>;

export type PhotoKey = keyof typeof PHOTOS;

/**
 * URL d'une photo à la largeur demandée.
 * Les fichiers locaux (`/photos/…`) sont renvoyés tels quels.
 */
export function photoUrl(photo: Photo, width: number, quality = 68): string {
  if (!photo.base.startsWith('http')) return photo.base;
  return `${photo.base}?auto=format&fit=crop&crop=entropy&w=${width}&q=${quality}`;
}

/** Jeu d'URL responsive pour l'attribut `srcSet`. */
export function photoSrcSet(photo: Photo, widths = [640, 1024, 1600, 2048]): string {
  if (!photo.base.startsWith('http')) return '';
  return widths.map((w) => `${photoUrl(photo, w)} ${w}w`).join(', ');
}
