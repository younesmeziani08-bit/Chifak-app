/**
 * Source unique de vérité pour les créneaux horaires.
 * Utilisé par la liste des résultats, la page de réservation et l'espace patient
 * afin qu'un même médecin affiche partout exactement les mêmes horaires.
 */

/**
 * Développe les plages horaires du médecin selon la durée de ses consultations.
 * Ex. plage 08:00 avec durée 15 min -> 08:00, 08:15, 08:30, 08:45.
 */
export function expandSlots(slots: string[], duration?: number): string[] {
  const step = duration && duration > 0 ? duration : 30;
  const out = new Set<string>();
  for (const s of slots) {
    const [h, m] = s.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) {
      out.add(s);
      continue;
    }
    for (let min = m; min < 60; min += step) {
      out.add(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
    }
  }
  return [...out].sort();
}

interface SlotSource {
  availableSlots?: string[];
  slotDuration?: number;
  workingDays?: number[];
  offDays?: string[];
  /** Créneaux réservés par le médecin, au format « AAAA-MM-JJ HH:MM » */
  blockedSlots?: string[];
}

/** Nombre de jours ouverts à la réservation à l'avance (un an). */
export const BOOKING_HORIZON_DAYS = 365;

/** Date du jour au format AAAA-MM-JJ (heure locale, sans décalage UTC). */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Dernière date réservable (aujourd'hui + un an). */
export function maxBookingIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + BOOKING_HORIZON_DAYS);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function workingDaysOf(doctor: SlotSource): number[] {
  return doctor.workingDays && doctor.workingDays.length > 0
    ? doctor.workingDays
    : [1, 2, 3, 4, 5];
}

export function weekdayOf(iso: string): number {
  return new Date(`${iso}T00:00:00`).getDay();
}

/** Le médecin consulte-t-il ce jour-là ? (jour travaillé et pas d'indisponibilité posée) */
export function isWorkingDate(doctor: SlotSource, iso: string): boolean {
  if (!workingDaysOf(doctor).includes(weekdayOf(iso))) return false;
  if (doctor.offDays && doctor.offDays.includes(iso)) return false;
  return true;
}

/**
 * Créneaux proposés par le médecin pour une date donnée.
 * Vide s'il ne travaille pas ; les créneaux qu'il a bloqués sont retirés.
 */
export function slotsForDay(doctor: SlotSource, iso: string): string[] {
  if (!isWorkingDate(doctor, iso)) return [];
  const all = expandSlots(doctor.availableSlots || [], doctor.slotDuration);
  const blocked = new Set(doctor.blockedSlots || []);
  return all.filter((t) => !blocked.has(`${iso} ${t}`));
}
