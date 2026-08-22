/**
 * Protection anti-falsification du retour OAuth.
 *
 * Le paramètre `state` portait « app » ou « web » — une valeur devinable, donc
 * aucune protection. Un tiers pouvait forger une adresse de retour complète et
 * la faire ouvrir à quelqu'un, qui se retrouvait connecté au compte de
 * l'attaquant sans s'en apercevoir, puis y saisissait ses coordonnées et ses
 * motifs de consultation.
 *
 * Ces cas verrouillent les trois propriétés qui referment cette porte : le
 * `state` est imprévisible, il ne vaut que pour le navigateur qui l'a demandé,
 * et la destination du retour continue de voyager avec lui.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  NOM_TEMOIN_OAUTH, lireTemoin, fabriquerState, verifierState, optionsTemoinOAuth,
} from '../lib/oauthState.js';

describe('Fabrication du state', () => {
  test('l\'aléa est long et jamais deux fois le même', () => {
    const vus = new Set();
    for (let i = 0; i < 200; i++) {
      const { alea } = fabriquerState('web');
      assert.ok(alea.length >= 32, 'un aléa court se devine');
      vus.add(alea);
    }
    assert.equal(vus.size, 200, 'chaque poignée de main doit avoir le sien');
  });

  test('la destination voyage avec l\'aléa', () => {
    assert.match(fabriquerState('app').state, /\.app$/);
    assert.match(fabriquerState('web').state, /\.web$/);
  });

  test('une destination inconnue retombe sur « web »', () => {
    // Le paramètre vient de l'URL : n'importe qui écrit ce qu'il veut dedans.
    for (const bricole of ['APP', 'javascript:alert(1)', '', undefined, null, 42, {}]) {
      assert.match(fabriquerState(bricole).state, /\.web$/);
    }
  });
});

describe('Vérification du retour', () => {
  test('un aller-retour normal est accepté, et rend la destination', () => {
    const web = fabriquerState('web');
    assert.equal(verifierState(web.state, web.alea), 'web');

    const app = fabriquerState('app');
    assert.equal(verifierState(app.state, app.alea), 'app');
  });

  /* Le cœur de la protection : l'attaquant démarre SA propre poignée de main,
     obtient un `state` valide, et pousse la victime sur l'adresse de retour.
     Le navigateur de la victime ne porte pas le témoin de l'attaquant. */
  test('le state d\'une autre poignée de main est refusé', () => {
    const attaquant = fabriquerState('web');
    const victime = fabriquerState('web');
    assert.equal(verifierState(attaquant.state, victime.alea), null);
  });

  test('un retour sans témoin est refusé', () => {
    const { state } = fabriquerState('web');
    for (const rien of ['', null, undefined]) {
      assert.equal(verifierState(state, rien), null);
    }
  });

  test('un state forgé de toutes pièces est refusé', () => {
    const { alea } = fabriquerState('web');
    assert.equal(verifierState('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.web', alea), null);
    assert.equal(verifierState('.web', alea), null);
    assert.equal(verifierState('web', alea), null, 'l\'ancienne forme ne passe plus');
    assert.equal(verifierState('app', alea), null, 'l\'ancienne forme ne passe plus');
    assert.equal(verifierState('', alea), null);
  });

  test('un state tronqué est refusé — pas d\'acceptation par préfixe', () => {
    const { alea } = fabriquerState('web');
    assert.equal(verifierState(`${alea.slice(0, 10)}.web`, alea), null);
    assert.equal(verifierState(`${alea}xx.web`, alea), null);
  });

  test('des types inattendus ne lèvent pas', () => {
    const { alea } = fabriquerState('web');
    for (const bricole of [null, undefined, 42, {}, [], true]) {
      assert.equal(verifierState(bricole, alea), null);
      assert.equal(verifierState('x.web', bricole), null);
    }
  });
});

describe('Lecture du témoin', () => {
  test('trouve la valeur parmi plusieurs témoins', () => {
    const enTete = `autre=1; ${NOM_TEMOIN_OAUTH}=abc123; chifak.sid=xyz`;
    assert.equal(lireTemoin(enTete, NOM_TEMOIN_OAUTH), 'abc123');
  });

  test('tolère les espaces et l\'absence', () => {
    assert.equal(lireTemoin(`  ${NOM_TEMOIN_OAUTH} = valeur `, NOM_TEMOIN_OAUTH), 'valeur');
    assert.equal(lireTemoin('autre=1', NOM_TEMOIN_OAUTH), null);
    assert.equal(lireTemoin('', NOM_TEMOIN_OAUTH), null);
    assert.equal(lireTemoin(undefined, NOM_TEMOIN_OAUTH), null);
  });

  test('décode la valeur, et ne lève jamais sur une entrée bricolée', () => {
    assert.equal(lireTemoin(`${NOM_TEMOIN_OAUTH}=a%2Bb`, NOM_TEMOIN_OAUTH), 'a+b');
    // « % » seul fait échouer decodeURIComponent : l'en-tête vient du client.
    assert.equal(lireTemoin(`${NOM_TEMOIN_OAUTH}=%`, NOM_TEMOIN_OAUTH), null);
  });

  test('ne confond pas un témoin dont le nom se termine pareil', () => {
    assert.equal(lireTemoin(`faux.${NOM_TEMOIN_OAUTH}=piege`, NOM_TEMOIN_OAUTH), null);
  });
});

describe('Durcissement du témoin', () => {
  test('inaccessible au JavaScript, et limité dans le temps', () => {
    const o = optionsTemoinOAuth();
    assert.equal(o.httpOnly, true);
    assert.equal(o.sameSite, 'lax', 'le retour du fournisseur est une navigation de premier plan');
    assert.ok(o.maxAge <= 10 * 60 * 1000, 'une poignée de main ne dure pas des heures');
  });

  test('transmis en HTTPS seulement, en production', () => {
    const avant = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      assert.equal(optionsTemoinOAuth().secure, true);
      process.env.NODE_ENV = 'development';
      assert.equal(optionsTemoinOAuth().secure, false, 'sinon rien ne marche en local');
    } finally { process.env.NODE_ENV = avant; }
  });
});
