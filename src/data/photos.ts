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
 * Visuel de chaque spécialité, indexé par la clé de traduction.
 *
 * Toutes sous licence Unsplash libre — vérifiées une par une : les photos
 * marquées « Unsplash+ » relèvent d'un abonnement payant et ont été écartées.
 *
 * Le sujet est volontairement concret plutôt qu'illustratif : un œil pour
 * l'ophtalmologie, un nourrisson pour la pédiatrie. Un patient reconnaît la
 * spécialité avant même de lire le libellé.
 */
export const SPECIALTY_PHOTOS: Record<string, Photo> = {
  'specialty.generalDoctor': {
    base: `${UNSPLASH}/photo-1758691463384-771db2f192b3`,
    alt: 'Un médecin généraliste dans son cabinet',
    altAr: 'طبيب عام في عيادته',
    credit: { author: 'Vitaly Gariev', profile: 'https://unsplash.com/@silverkblack', source: 'https://unsplash.com/photos/JJEOuvnY1Tw' },
  },
  'specialty.dentist': {
    base: `${UNSPLASH}/photo-1704455306251-b4634215d98f`,
    alt: 'Un cabinet dentaire équipé',
    altAr: 'عيادة أسنان مجهّزة',
    credit: { author: 'Kari Bjorn Photography', profile: 'https://unsplash.com/@karibjorn', source: 'https://unsplash.com/photos/Fdku_oMrDvk' },
  },
  'specialty.ophthalmologist': {
    base: `${UNSPLASH}/photo-1483519173755-be893fab1f46`,
    alt: 'Gros plan sur un œil humain',
    altAr: 'لقطة قريبة لعين بشرية',
    credit: { author: 'v2osk', profile: 'https://unsplash.com/@v2osk', source: 'https://unsplash.com/photos/In4XVKhYaiI' },
  },
  'specialty.dermatologist': {
    base: `${UNSPLASH}/photo-1623676714504-edd78728155e`,
    alt: 'Application d’une protection solaire sur la peau',
    altAr: 'وضع واقٍ من الشمس على البشرة',
    credit: { author: 'Onela Ymeri', profile: 'https://unsplash.com/@onnela_', source: 'https://unsplash.com/photos/3Uj7ttuo5kk' },
  },
  'specialty.cardiologist': {
    base: `${UNSPLASH}/photo-1682706841297-5524ba1faa9c`,
    alt: 'Tracé cardiaque sur un moniteur',
    altAr: 'تخطيط القلب على شاشة مراقبة',
    credit: { author: 'Joshua Chehov', profile: 'https://unsplash.com/@joshua_chehov', source: 'https://unsplash.com/photos/beXUIzvxW-Q' },
  },
  'specialty.pediatrician': {
    base: `${UNSPLASH}/photo-1649880210584-3365f4c4c08b`,
    alt: 'Un nourrisson qui sourit',
    altAr: 'رضيع يبتسم',
    credit: { author: 'Wesley Tingey', profile: 'https://unsplash.com/@wesleyphotography', source: 'https://unsplash.com/photos/beF1iDFiZkA' },
  },
  'specialty.gynecologist': {
    base: `${UNSPLASH}/photo-1457342813143-a1ae27448a82`,
    alt: 'Une femme enceinte tenant son ventre',
    altAr: 'امرأة حامل تضع يدها على بطنها',
    credit: { author: 'freestocks', profile: 'https://unsplash.com/@freestocks', source: 'https://unsplash.com/photos/ux53SGpRAHU' },
  },
  'specialty.ent': {
    base: '/photos/orl.jpg',
    alt: 'Coupe anatomique du nez, de l’oreille et de la gorge',
    altAr: 'مقطع تشريحي للأنف والأذن والحنجرة',
    credit: { author: 'chifak', profile: '', source: '' },
  },
  'specialty.physiotherapist': {
    base: `${UNSPLASH}/photo-1540206053318-4d6a23b349dd`,
    alt: 'Un thérapeute accompagnant un étirement du dos',
    altAr: 'معالج يرافق تمديد الظهر',
    credit: { author: 'Annie Spratt', profile: 'https://unsplash.com/@anniespratt', source: 'https://unsplash.com/photos/BEhIfMOaPoc' },
  },
  'specialty.psychologist': {
    base: `${UNSPLASH}/photo-1758273241078-8eec353836be`,
    alt: 'Une psychologue en consultation avec une patiente',
    altAr: 'أخصائية نفسية في جلسة مع مريضة',
    credit: { author: 'Vitaly Gariev', profile: 'https://unsplash.com/@silverkblack', source: 'https://unsplash.com/photos/rG5elqddGzo' },
  },
  /* Visuel fourni par l'éditeur, servi depuis public/photos/ et non depuis le
     CDN Unsplash : photoUrl() détecte le chemin local et n'ajoute aucun
     paramètre de redimensionnement. */
  'specialty.osteopath': {
    base: '/photos/osteopathe.jpg',
    alt: 'Radiographie du buste avec les zones douloureuses de la colonne en rouge',
    altAr: 'صورة إشعاعية للجذع مع إبراز مناطق الألم في العمود الفقري باللون الأحمر',
    credit: { author: 'chifak', profile: '', source: '' },
  },
  'specialty.midwife': {
    base: `${UNSPLASH}/photo-1552819289-824d37ca69d2`,
    alt: 'Une main d’adulte tenant celle d’un nouveau-né',
    altAr: 'يد بالغ تمسك يد مولود جديد',
    credit: { author: 'Hu Chen', profile: 'https://unsplash.com/@huchenme', source: 'https://unsplash.com/photos/tCbTGNwrFNM' },
  },
};

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
