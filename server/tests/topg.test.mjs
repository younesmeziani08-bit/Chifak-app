/**
 * Conversion des marqueurs SQLite (?) vers PostgreSQL ($1, $2, …).
 *
 * Ces cas sont là pour une raison précise. La version d'origine remplaçait
 * tout point d'interrogation de la chaîne, sans regarder où il se trouvait.
 * Aucune requête du serveur n'en contenait hors marqueur — le bug était donc
 * invisible, et le serait resté jusqu'au jour où quelqu'un écrit un opérateur
 * jsonb ou un « ? » dans un libellé. La requête serait alors partie avec un
 * marqueur de trop, pour une raison illisible dans le message d'erreur.
 *
 * Chaque cas ci-dessous correspond à une construction SQL parfaitement
 * normale que l'ancienne version cassait.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { toPg } from '../database.js';

describe('Marqueurs ordinaires', () => {
  test('un seul', () => {
    assert.equal(toPg('SELECT * FROM t WHERE a = ?'), 'SELECT * FROM t WHERE a = $1');
  });

  test('plusieurs, numérotés dans l\'ordre', () => {
    assert.equal(
      toPg('SELECT * FROM t WHERE a = ? AND b = ? AND c = ?'),
      'SELECT * FROM t WHERE a = $1 AND b = $2 AND c = $3',
    );
  });

  test('aucun marqueur : la requête ressort intacte', () => {
    const sql = 'SELECT COUNT(*)::int AS n FROM users';
    assert.equal(toPg(sql), sql);
  });
});

describe('Chaînes littérales — leur contenu ne se touche pas', () => {
  test('un « ? » dans un libellé reste un « ? »', () => {
    assert.equal(
      toPg("SELECT * FROM t WHERE libelle = 'Deja vu ?'"),
      "SELECT * FROM t WHERE libelle = 'Deja vu ?'",
    );
  });

  test('la numérotation ignore les « ? » littéraux', () => {
    assert.equal(
      toPg("SELECT * FROM t WHERE l = 'a ?' AND b = ?"),
      "SELECT * FROM t WHERE l = 'a ?' AND b = $1",
    );
  });

  test("apostrophe doublée à l'intérieur du littéral", () => {
    assert.equal(
      toPg("SELECT * FROM t WHERE l = 'l''ami ?' AND b = ?"),
      "SELECT * FROM t WHERE l = 'l''ami ?' AND b = $1",
    );
  });

  test('la clause ESCAPE de la recherche par ville survit', () => {
    // Requête réelle : routes/doctors.js, filtre ILIKE avec échappement.
    assert.equal(
      toPg("SELECT id FROM doctors WHERE city ILIKE ? ESCAPE '\\'"),
      "SELECT id FROM doctors WHERE city ILIKE $1 ESCAPE '\\'",
    );
  });

  test('identifiant entre guillemets', () => {
    assert.equal(
      toPg('SELECT "col?onne" FROM t WHERE a = ?'),
      'SELECT "col?onne" FROM t WHERE a = $1',
    );
  });
});

describe('Opérateurs jsonb — ce ne sont pas des marqueurs', () => {
  test('?| (l\'une de ces clés)', () => {
    assert.equal(
      toPg("SELECT * FROM t WHERE d ?| array['x'] AND i = ?"),
      "SELECT * FROM t WHERE d ?| array['x'] AND i = $1",
    );
  });

  test('?& (toutes ces clés)', () => {
    assert.equal(
      toPg("SELECT * FROM t WHERE d ?& array['x'] AND i = ?"),
      "SELECT * FROM t WHERE d ?& array['x'] AND i = $1",
    );
  });
});

describe('Commentaires', () => {
  test('fin de ligne', () => {
    assert.equal(
      toPg('SELECT ? -- un ? en commentaire\n, ?'),
      'SELECT $1 -- un ? en commentaire\n, $2',
    );
  });

  test('bloc', () => {
    assert.equal(toPg('SELECT ? /* ? bloc ? */, ?'), 'SELECT $1 /* ? bloc ? */, $2');
  });
});

describe('Requêtes réelles du serveur', () => {
  test('consommation atomique d\'un code de vérification', () => {
    // routes/auth.js — le motif le plus dense en marqueurs du projet.
    const converti = toPg(`
      UPDATE verification_codes SET is_used = 1
      WHERE id = (
        SELECT id FROM verification_codes
        WHERE email = ? AND code = ? AND is_used = 0 AND expires_at > NOW()
        ORDER BY created_at DESC LIMIT 1 FOR UPDATE SKIP LOCKED
      ) RETURNING id`);
    assert.match(converti, /email = \$1 AND code = \$2/);
    assert.equal(converti.includes('?'), false);
  });

  test('consommation atomique d\'un code de secours', () => {
    // routes/twoFactor.js — emploie jsonb_exists, la forme fonctionnelle.
    const converti = toPg(`
      UPDATE users SET totp_backup_codes = COALESCE((
        SELECT jsonb_agg(t.c)::text
        FROM jsonb_array_elements_text(totp_backup_codes::jsonb) AS t(c)
        WHERE t.c <> ?
      ), '[]')
      WHERE id = ? AND jsonb_exists(totp_backup_codes::jsonb, ?)
      RETURNING totp_backup_codes`);
    assert.match(converti, /t\.c <> \$1/);
    assert.match(converti, /id = \$2 AND jsonb_exists\(totp_backup_codes::jsonb, \$3\)/);
  });
});
