/**
 * État de préparation du service, énoncé au démarrage.
 *
 * ── Pourquoi ce fichier existe ──
 *
 * La question « est-ce que l'application est prête ? » n'avait pas de réponse
 * lisible. Le serveur démarrait pareil qu'il sache envoyer des e-mails ou non,
 * que la connexion Google soit configurée ou non, que le freinage des
 * tentatives soit partagé entre instances ou local à l'une d'elles. Les
 * fonctionnalités manquantes se découvraient une par une, en production, par
 * un patient qui n'a jamais reçu son code de vérification.
 *
 * Ce module dresse la liste au démarrage : ce qui fonctionne, ce qui est
 * absent, et surtout CE QUE CHAQUE ABSENCE COÛTE. « AI_API_KEY absent » ne dit
 * rien à personne ; « l'assistant santé répondra qu'il est indisponible » se
 * comprend.
 *
 * Trois niveaux :
 *   bloquant   le service ne peut pas rendre son office correctement
 *   dégradé    il fonctionne, mais une fonctionnalité est éteinte ou affaiblie
 *   complet    rien à signaler
 *
 * Le rapport est aussi servi par /health, pour se relire sans fouiller les
 * journaux de l'hébergeur — sans jamais divulguer la moindre valeur, seulement
 * des états.
 */

const defini = (nom) => {
  const v = process.env[nom];
  return Boolean(v && v.trim() && !/^(your_|xxx|changeme|todo)/i.test(v.trim()));
};

/**
 * Les points de contrôle, dans l'ordre où ils comptent.
 *
 * `critique` ne signifie pas « le serveur refuse de démarrer » — il démarre
 * toujours, sinon un oubli de configuration couperait le service entier. Il
 * signifie « à régler avant d'ouvrir à de vrais patients ».
 */
function pointsDeControle() {
  const enProduction = process.env.NODE_ENV === 'production';
  const messagerie = defini('EMAIL_HOST') || (defini('EMAIL_USER') && defini('EMAIL_PASSWORD'));

  return [
    {
      nom: 'Base de données',
      ok: defini('DATABASE_URL'),
      critique: true,
      absence: 'aucune donnée ne peut être lue ni écrite — le service ne rend rien.',
    },
    {
      nom: 'Secrets de signature',
      ok: defini('JWT_SECRET') && defini('SESSION_SECRET'),
      critique: true,
      absence: 'les jetons de session ne peuvent pas être signés de façon sûre.',
    },
    {
      nom: 'Envoi des e-mails',
      ok: messagerie,
      critique: true,
      absence: 'aucune inscription possible — le code de vérification ne part pas. '
        + 'Ni confirmation de rendez-vous, ni rappel de la veille, ni agenda praticien.',
    },
    {
      nom: 'Certificat de la base (DATABASE_CA)',
      ok: !enProduction || defini('DATABASE_CA'),
      critique: false,
      absence: 'le trafic vers la base est chiffré mais le serveur en face n\'est pas '
        + 'authentifié. Sur des dossiers médicaux, c\'est un angle à refermer.',
    },
    {
      nom: 'Clé de chiffrement TOTP (TOTP_KEY)',
      ok: defini('TOTP_KEY'),
      critique: false,
      absence: 'la double authentification repart sur JWT_SECRET. Tout fonctionne, '
        + 'mais faire tourner JWT_SECRET rendra les seconds facteurs illisibles.',
    },
    {
      nom: 'Compteurs partagés (REDIS_URL)',
      ok: defini('REDIS_URL'),
      critique: false,
      absence: 'freinage des connexions et sessions OAuth locaux à cette instance. '
        + 'Sans conséquence avec une seule instance ; à corriger dès la deuxième.',
    },
    {
      nom: 'Connexion Google',
      ok: defini('GOOGLE_CLIENT_ID') && defini('GOOGLE_CLIENT_SECRET'),
      critique: false,
      absence: 'le bouton « continuer avec Google » renvoie vers un message d\'indisponibilité.',
    },
    {
      nom: 'Connexion Facebook',
      ok: defini('FACEBOOK_APP_ID') && defini('FACEBOOK_APP_SECRET'),
      critique: false,
      absence: 'le bouton « continuer avec Facebook » renvoie vers un message d\'indisponibilité.',
    },
    {
      nom: 'Rappels par SMS (SMS_URL)',
      ok: defini('SMS_URL'),
      critique: false,
      absence: 'les rappels de la veille ne partent que par e-mail. En Algérie, le SMS '
        + 'porte bien plus loin — c\'est ce rappel qui décide si le patient se déplace.',
    },
    {
      nom: 'Assistant santé (AI_API_KEY)',
      ok: defini('AI_API_KEY'),
      critique: false,
      absence: 'l\'assistant répond qu\'il n\'est pas configuré. Le reste du site est intact.',
    },
    {
      nom: 'Origines autorisées (ALLOWED_ORIGINS)',
      ok: !enProduction || defini('ALLOWED_ORIGINS') || defini('FRONTEND_URL'),
      critique: enProduction,
      absence: 'en production, aucune origine web n\'est acceptée : le site ne peut plus '
        + 'appeler son API. Seule l\'application mobile continuerait de fonctionner.',
    },
    {
      nom: 'Adresse publique de l\'API (PUBLIC_API_URL)',
      ok: !enProduction || defini('PUBLIC_API_URL'),
      critique: false,
      absence: 'les adresses des photos de praticiens sont bâties sur l\'en-tête Host de '
        + 'la requête, que le client contrôle. Renseignez-la en production.',
    },
    {
      nom: 'Adresse du site (FRONTEND_URL)',
      ok: defini('FRONTEND_URL'),
      critique: false,
      absence: 'les retours de connexion sociale pointent vers http://localhost:5173.',
    },
  ];
}

/** Rapport structuré, sans aucune valeur sensible. Sert /health. */
export function rapportPreparation() {
  const points = pointsDeControle();
  const manquants = points.filter((p) => !p.ok);
  const bloquants = manquants.filter((p) => p.critique);

  return {
    etat: bloquants.length ? 'bloquant' : manquants.length ? 'degrade' : 'complet',
    environnement: process.env.NODE_ENV || 'development',
    pret: points.filter((p) => p.ok).map((p) => p.nom),
    manquant: manquants.map((p) => ({
      nom: p.nom,
      bloquant: Boolean(p.critique),
      consequence: p.absence,
    })),
  };
}

/**
 * Écrit le rapport dans les journaux, au démarrage.
 *
 * Volontairement bavard sur ce qui manque et muet sur ce qui va : personne ne
 * lit une liste de trente lignes vertes, et l'essentiel doit rester visible
 * dans une console d'hébergeur qui défile.
 */
export function annoncerPreparation() {
  const r = rapportPreparation();

  if (r.etat === 'complet') {
    console.log(`\n✅ Configuration complète (${r.environnement}) — rien à signaler.\n`);
    return r;
  }

  const bloquants = r.manquant.filter((m) => m.bloquant);
  const autres = r.manquant.filter((m) => !m.bloquant);

  console.log(`\n${'─'.repeat(66)}`);
  console.log(`  État de préparation — ${r.environnement}`);
  console.log(`  ${r.pret.length} point(s) en ordre, ${r.manquant.length} à régler`);
  console.log('─'.repeat(66));

  for (const m of bloquants) {
    console.log(`\n  🚨 ${m.nom}`);
    console.log(`     ${m.consequence}`);
  }
  for (const m of autres) {
    console.log(`\n  ⚠️  ${m.nom}`);
    console.log(`     ${m.consequence}`);
  }

  console.log(`\n${'─'.repeat(66)}`);
  console.log(bloquants.length
    ? '  Le service démarre, mais il ne peut pas rendre son office. À régler\n'
      + '  avant d\'ouvrir à de vrais patients.'
    : '  Le service est opérationnel. Les points ci-dessus sont des\n'
      + '  fonctionnalités éteintes, pas des pannes.');
  console.log(`${'─'.repeat(66)}\n`);

  return r;
}
