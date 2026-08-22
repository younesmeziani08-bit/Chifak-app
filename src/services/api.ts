/**
 * Façade des services d'API.
 *
 * Les appels réseau sont rangés par domaine, en miroir exact des routes du
 * backend (server/routes/*) : pour comprendre un échange de bout en bout,
 * ouvrir le fichier du même nom des deux côtés.
 *
 * Ce fichier ne fait que ré-exporter : les imports existants
 * (`from './api'`) restent tous valides.
 */
export * from './http';
export * from './assistant';
export * from './auth';
export * from './doctors';
export * from './appointments';
export * from './reviews';
export * from './doctorSpace';
export * from './patient';
export * from './consultations';
export * from './stats';
/* Seule la partie publique des demandes reste ici — le dépôt. La file
   d'examen, l'acceptation et le refus vivent dans admin/services. */
export * from './applications';
export * from './feedback';
export * from './motDePasse';
export * from './annulations';
