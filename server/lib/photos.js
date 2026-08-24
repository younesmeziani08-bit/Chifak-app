/** Photos des praticiens : adresses stables, jamais de base64 dans les listes. */
import crypto from 'node:crypto';
import { adresseApi } from '../config/adresses.js';


/**
 * Adresse publique d'une photo de praticien.
 *
 * Les portraits téléversés sont stockés en base sous forme de « data URL ».
 * Les inclure dans la liste de l'annuaire revenait à envoyer jusqu'à 200 Ko
 * par médecin, à chaque recherche, sans que le navigateur puisse rien garder
 * en cache : cinq cents fiches faisaient une réponse de cent mégaoctets.
 *
 * On renvoie désormais une adresse. L'empreinte en paramètre sert de version :
 * le navigateur peut conserver la photo un an, et une photo remplacée change
 * d'empreinte donc d'adresse — elle est rechargée d'elle-même.
 */
export function urlPhoto(req, doctor) {
  if (doctor.photo_hash) {
    const base = adresseApi(req);
    return `${base}/api/doctors/${doctor.id}/photo?v=${doctor.photo_hash.slice(0, 12)}`;
  }
  // Photo externe (adresse web) ou emoji hérité : la valeur est courte, on la
  // transmet telle quelle.
  return doctor.image || null;
}

/** Empreinte d'une photo téléversée ; null pour une adresse web ou un emoji. */
export function empreintePhoto(image) {
  if (typeof image !== 'string' || !image.startsWith('data:image/')) return null;
  return crypto.createHash('md5').update(image).digest('hex');
}

