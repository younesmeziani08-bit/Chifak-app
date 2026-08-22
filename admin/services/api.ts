/**
 * Façade des services de l'application d'administration.
 *
 * Elle réexporte ce dont les écrans ont besoin, et RIEN d'autre. C'est la
 * différence avec l'ancienne façade partagée : celle-ci réexportait tout —
 * personnel, demandes, double authentification — dans les deux paquets à la
 * fois. L'application patiente emportait ainsi la liste complète des appels
 * d'administration, lisibles par quiconque ouvrait la console.
 *
 * Les services vraiment communs (adresse de l'API, en-têtes, annuaire des
 * praticiens, connexion du personnel) restent dans src/services : ils servent
 * réellement des deux côtés, et les dupliquer garantirait qu'ils divergent.
 */

// ── Communs aux deux applications ──
export * from '../../src/services/http';
export * from '../../src/services/auth';
export * from '../../src/services/doctors';
export * from '../../src/services/appointments';
export * from '../../src/services/reviews';
export * from '../../src/services/stats';
export type {
  Application, ApplicationKind, ApplicationInput,
} from '../../src/services/applications';

// ── Propres à l'administration ──
export * from './staff';
export * from './twoFactor';
export * from './applications';
export * from './annulations';
