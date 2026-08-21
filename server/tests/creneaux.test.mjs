/**
 * Créneaux réservés — la route qui les expose.
 *
 * Elle ne rendait qu'une seule journée, et sans la date. Trois écrans en
 * dépendaient : la liste de résultats annonçait « Prochaine disponibilité :
 * mardi 25 » sans savoir si ce mardi était complet, la page de réservation
 * n'excluait rien du tout, et l'espace praticien proposait des heures déjà
 * prises. Le patient allait au bout du formulaire pour lire « ce créneau
 * vient d'être réservé ».
 *
 * Ce qui est vérifié ici : la fenêtre, ses bornes, et le fait que la date
 * accompagne chaque ligne — sans elle, le navigateur ne saurait pas à quel
 * jour rattacher un horaire.
 */
import { test, describe, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET ||= 'secret-de-test-suffisamment-long-pour-les-essais-abcdef';
process.env.SESSION_SECRET ||= 'session-de-test-suffisamment-longue-pour-les-essais-abcd';

const requetes = [];
const lignes = [];

/* bcrypt est un module natif, compilé pour la machine qui l'a installé. Ce
   test n'a rien à voir avec le hachage : le remplacer le rend portable — il
   tourne sur macOS comme dans une intégration continue Linux — et évite de
   charger un binaire pour rien. */
mock.module('bcrypt', {
  defaultExport: {
    hashSync: () => '$test$',
    hash: async () => '$test$',
    compare: async () => false,
  },
  namedExports: {
    hashSync: () => '$test$',
    hash: async () => '$test$',
    compare: async () => false,
  },
});

mock.module('../database.js', {
  defaultExport: {
    prepare(sql) {
      return {
        all: async (...p) => { requetes.push({ sql: sql.replace(/\s+/g, ' ').trim(), p }); return lignes; },
        get: async () => undefined,
        run: async () => ({ changes: 0 }),
      };
    },
  },
});

const { default: app } = await import('../app.js');

/** Interroge l'application sans ouvrir de port. */
function appeler(chemin) {
  return new Promise((resolve) => {
    const serveur = app.listen(0, async () => {
      const { port } = serveur.address();
      const r = await fetch(`http://127.0.0.1:${port}${chemin}`);
      const corps = await r.json().catch(() => null);
      serveur.close(() => resolve({ statut: r.status, corps }));
    });
  });
}

beforeEach(() => { requetes.length = 0; lignes.length = 0; });

describe('Une seule journée', () => {
  test('la date est acceptée', async () => {
    const { statut } = await appeler('/api/booked-slots?date=2026-08-22');
    assert.equal(statut, 200);
  });

  test('la requête borne le jour demandé aux deux extrémités', async () => {
    await appeler('/api/booked-slots?date=2026-08-22');
    const { sql, p } = requetes.at(-1);
    assert.match(sql, /appointment_date BETWEEN \? AND \?/);
    assert.deepEqual(p, ['2026-08-22', '2026-08-22']);
  });

  test('la date accompagne chaque ligne', async () => {
    await appeler('/api/booked-slots?date=2026-08-22');
    assert.match(requetes.at(-1).sql, /appointment_date/,
      'sans la date, impossible de rattacher un horaire à un jour dans une fenêtre');
  });

  test('les rendez-vous annulés sont exclus', async () => {
    await appeler('/api/booked-slots?date=2026-08-22');
    assert.match(requetes.at(-1).sql, /status != 'cancelled'/);
  });
});

describe('Fenêtre de plusieurs jours', () => {
  test('les deux bornes sont transmises', async () => {
    const { statut } = await appeler('/api/booked-slots?date=2026-08-22&to=2026-09-10');
    assert.equal(statut, 200);
    assert.deepEqual(requetes.at(-1).p, ['2026-08-22', '2026-09-10']);
  });

  test('trente-et-un jours passent', async () => {
    const { statut } = await appeler('/api/booked-slots?date=2026-08-01&to=2026-09-01');
    assert.equal(statut, 200);
  });

  test('au-delà, c\'est refusé — la réponse grossirait pour personne', async () => {
    const { statut, corps } = await appeler('/api/booked-slots?date=2026-08-01&to=2026-12-01');
    assert.equal(statut, 400);
    assert.match(corps.error, /31 jours/);
  });

  test('une fin antérieure au début est refusée', async () => {
    const { statut } = await appeler('/api/booked-slots?date=2026-08-22&to=2026-08-01');
    assert.equal(statut, 400);
  });
});

describe('Entrées invalides', () => {
  for (const mauvais of ['', '?date=', '?date=hier', '?date=2026-13-01', '?date=2026-02-31']) {
    test(`« ${mauvais || 'aucun paramètre'} » est refusé`, async () => {
      const { statut } = await appeler(`/api/booked-slots${mauvais}`);
      assert.equal(statut, 400);
    });
  }

  test('un « to » mal formé est refusé', async () => {
    const { statut } = await appeler('/api/booked-slots?date=2026-08-22&to=jamais');
    assert.equal(statut, 400);
  });
});
