/**
 * Ce dont la base s'est révélée capable au démarrage.
 *
 * Les extensions et fonctions optionnelles ne doivent jamais empêcher le
 * service de tourner : chacune est tentée, et son échec se solde par un
 * avertissement, pas par un arrêt. Mais les routes doivent savoir sur quoi
 * compter — sinon elles bâtissent une requête qui cite une fonction absente,
 * et la recherche renvoie 500 au lieu d'être seulement moins tolérante.
 *
 * Ce drapeau vit dans son propre module, et non dans database.js, pour une
 * raison pratique : les tests remplacent database.js par une doublure. Un
 * export nommé de plus dans ce fichier casse chaque doublure existante, sans
 * rapport avec ce qu'elle vérifie. Ici, il n'y a rien à simuler.
 *
 * Renseigné par initDatabase(), lu par les routes.
 */
export const capacites = {
  /**
   * La fonction SQL `sans_accents` existe-t-elle ?
   * Si oui, la recherche par ville et par spécialité compare des chaînes
   * normalisées : « Béjaïa » trouve un cabinet enregistré « Bejaia ».
   * Sinon, on repart en comparaison littérale.
   */
  sansAccents: false,
};
