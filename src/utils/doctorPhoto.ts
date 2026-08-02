import { Doctor } from '../App';

// Jeu de portraits professionnels (photos réelles, libres pour démo).
const MALE = [8, 11, 14, 32, 33, 45, 52, 60, 75, 83];
const FEMALE = [9, 16, 25, 26, 44, 47, 56, 63, 68, 79];

// Prénoms féminins fréquents en Algérie (heuristique pour choisir le portrait).
const FEMALE_HINTS = [
  'fatima', 'zahra', 'amina', 'khadija', 'aicha', 'aïcha', 'yasmine', 'yasmina',
  'nadia', 'samira', 'leila', 'leyla', 'lina', 'sara', 'sarah', 'meriem', 'mariem',
  'nour', 'imane', 'imene', 'houda', 'sofia', 'sophia', 'rania', 'salima', 'karima',
  'nabila', 'wafa', 'hind', 'asma', 'sabrina', 'lamia', 'radia', 'souad', 'malak',
];

function isFemale(name: string): boolean {
  const first = name.replace(/^d[rre]?\.?\s+/i, '').trim().toLowerCase().split(/\s+/)[0] || '';
  return FEMALE_HINTS.some((h) => first.startsWith(h));
}

/** Renvoie l'URL d'une photo de médecin (photoUrl explicite sinon portrait déterministe). */
export function getDoctorPhoto(doctor: Pick<Doctor, 'id' | 'name' | 'image'>): string {
  const img = doctor.image || '';
  if (/^(https?:)?\/\//.test(img) || img.startsWith('/')) return img; // déjà une vraie image

  const female = isFemale(doctor.name);
  const pool = female ? FEMALE : MALE;
  const idx = Math.abs(doctor.id || 0) % pool.length;
  const bucket = female ? 'women' : 'men';
  return `https://randomuser.me/api/portraits/${bucket}/${pool[idx]}.jpg`;
}

/** Initiales pour le fallback si la photo ne charge pas. */
export function doctorInitials(name: string): string {
  const clean = name.replace(/^d[rre]?\.?\s+/i, '').trim();
  const parts = clean.split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'DR';
}
