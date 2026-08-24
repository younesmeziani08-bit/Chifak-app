/**
 * Les deux adresses publiques du service, résolues en un seul endroit.
 *
 * ── Ce que cette réunion corrige ──
 *
 * L'adresse du site était recalculée dans sept fichiers, toujours de la même
 * façon : `process.env.FRONTEND_URL || 'http://localhost:5173'`. En
 * production, la variable n'était pas renseignée. Le repli s'appliquait donc
 * pour de vrai, et sans le moindre bruit :
 *
 *   · le retour de connexion Google renvoyait le patient sur localhost.
 *     Le diagnostic annonçait pourtant « Connexion Google : prête » — elle
 *     l'était, c'est le retour qui n'atterrissait nulle part ;
 *   · le lien d'annulation de chaque e-mail de confirmation pointait sur
 *     localhost, de même que les liens de liste d'attente.
 *
 * Un repli vers localhost en production n'est pas un repli, c'est une panne
 * qu'on ne voit pas. Le dernier recours est désormais le domaine réel : une
 * variable oubliée dégrade au lieu de casser.
 *
 * Les constantes ci-dessous ne sont pas de la configuration — ce sont les
 * domaines du service, déjà écrits dans .env.production. Renseigner
 * FRONTEND_URL et PUBLIC_API_URL reste la bonne pratique ; ceci n'est que le
 * filet.
 */
import '../env.js';

const FRONT_PRODUCTION = 'https://chifak.dz';
const API_PRODUCTION = 'https://chifak-api.onrender.com';

const enProduction = () => process.env.NODE_ENV === 'production';
const sansSlashFinal = (valeur) => String(valeur || '').trim().replace(/\/$/, '');

/** Adresse du site patient. Sert à bâtir tous les liens envoyés par courrier. */
export function adresseFront() {
  return sansSlashFinal(process.env.FRONTEND_URL)
    || (enProduction() ? FRONT_PRODUCTION : 'http://localhost:5173');
}

/**
 * Adresse publique de l'API.
 *
 * ── Pourquoi l'en-tête Host ne fait pas foi en production ──
 *
 * L'adresse des photos de praticiens était bâtie sur `req.get('host')`. Cet
 * en-tête est écrit par le client, pas par le serveur : il suffisait de
 * l'appeler avec « Host: ailleurs.example » pour que l'annuaire réponde des
 * adresses d'images pointant là-bas. Comme ces réponses sont mises en cache un
 * an — c'est tout l'intérêt de l'empreinte en paramètre — une seule requête
 * empoisonnée avait de la durée.
 *
 * En développement, il reste la seule façon raisonnable de savoir sur quel
 * port on tourne.
 */
export function adresseApi(req) {
  const configuree = sansSlashFinal(process.env.PUBLIC_API_URL);
  if (configuree) return configuree;
  if (enProduction()) return API_PRODUCTION;
  return `${req.protocol}://${req.get('host')}`;
}
