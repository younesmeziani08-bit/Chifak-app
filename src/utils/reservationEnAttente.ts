import type { Doctor } from '../types/metier';

/**
 * Le créneau qu'un visiteur a choisi avant qu'on lui demande de se connecter.
 *
 * ── Ce qui se passait ──
 *
 * Un patient parcourait les résultats, voyait « 09:00 » chez le Dr Benali, et
 * cliquait dessus. L'application lui demandait alors de se connecter — et ne
 * retenait QUE le praticien :
 *
 *     setPendingDoctor(doctor);   // la date et l'heure étaient perdues ici
 *
 * Une fois connecté, il retombait sur la page de réservation avec un agenda
 * vierge, et devait rechercher son créneau une seconde fois. Celui qu'il avait
 * choisi trente secondes plus tôt.
 *
 * ── Pourquoi ce n'est pas un simple état React ──
 *
 * Un état React aurait suffi pour la connexion par e-mail. Mais la connexion
 * Google et Facebook quitte la page — `window.location.href = …` — et le
 * navigateur revient sur une application entièrement redémarrée. Tout état
 * React a disparu : le patient perdait alors non seulement son créneau, mais
 * le praticien avec, et se retrouvait sur la page d'accueil sans comprendre.
 *
 * Le stockage de session traverse cet aller-retour et s'efface à la fermeture
 * de l'onglet.
 *
 * ── Pourquoi une date de péremption ──
 *
 * Un onglet laissé ouvert toute la nuit ne doit pas relancer une réservation
 * au réveil. Passé trente minutes, le choix est oublié : mieux vaut refaire
 * trois clics que se retrouver devant un formulaire qu'on n'a pas demandé.
 */

const CLE = 'chifak_reservation_en_attente';
const DUREE_DE_VIE = 30 * 60 * 1000;

export interface ReservationEnAttente {
  doctor: Doctor;
  date?: string;
  time?: string;
  consultationType?: 'cabinet' | 'video';
}

interface Enregistrement extends ReservationEnAttente {
  /** Instant de la mise en attente, pour la péremption. */
  a: number;
}

/** Met de côté le praticien ET le créneau, le temps de la connexion. */
export function memoriser(choix: ReservationEnAttente): void {
  try {
    const enregistrement: Enregistrement = { ...choix, a: Date.now() };
    sessionStorage.setItem(CLE, JSON.stringify(enregistrement));
  } catch {
    /* Stockage indisponible — navigation privée, quota plein. La connexion
       fonctionne quand même, le patient rechoisira son créneau. Ce n'est pas
       une raison de l'empêcher de se connecter. */
  }
}

/**
 * Reprend le choix mis de côté, et l'efface aussitôt.
 *
 * L'effacement est immédiat et volontaire : un choix repris deux fois
 * rouvrirait la page de réservation à chaque retour sur l'accueil.
 */
export function reprendre(): ReservationEnAttente | null {
  try {
    const brut = sessionStorage.getItem(CLE);
    if (!brut) return null;
    sessionStorage.removeItem(CLE);

    const e = JSON.parse(brut) as Enregistrement;
    if (!e?.doctor?.id || typeof e.a !== 'number') return null;
    if (Date.now() - e.a > DUREE_DE_VIE) return null;

    return { doctor: e.doctor, date: e.date, time: e.time, consultationType: e.consultationType };
  } catch {
    return null;
  }
}

/** Oublie le choix — le visiteur a renoncé, ou la réservation est faite. */
export function oublier(): void {
  try {
    sessionStorage.removeItem(CLE);
  } catch {
    /* Rien à faire : au pire le choix expirera de lui-même. */
  }
}
