/**
 * Point d'entrée du serveur chifak.
 *
 * Rôle volontairement minimal : initialiser la base, démarrer l'écoute,
 * planifier les tâches récurrentes. Tout le reste vit ailleurs :
 *
 *   app.js        assemblage Express (l'ordre des protections)
 *   config/       CORS, Redis, limiteurs de débit, session
 *   middleware/   authentification par jeton, un contrôle par population
 *   routes/       les domaines métier, un fichier par domaine
 *   lib/          logique partagée (photos, données publiques, personnel)
 *   database.js   schéma, migrations, semis
 *   security.js   validation d'entrées et exigences sur les secrets
 */
import './env.js';
import cron from 'node-cron';
import { initDatabase, pool } from './database.js';
import { sendDailyAgendas } from './dailyAgenda.js';
import { envoyerRappels } from './rappels.js';
import app from './app.js';
import { annoncerPreparation } from './config/diagnostic.js';

const PORT = process.env.PORT || 3001;

/* ── Filets de sécurité au niveau du processus ──

   Une promesse rejetée sans gestionnaire est presque toujours une requête
   isolée qui a mal tourné : Express a déjà répondu ou répondra 500, et le
   reste du serveur va parfaitement bien. On journalise, on continue.

   Une exception NON CAPTURÉE est d'une autre nature. Node l'a laissée
   remonter jusqu'ici parce que plus personne, sur toute la pile d'appels, ne
   savait quoi en faire : à ce point, l'état du processus est indéfini —
   connexions à demi ouvertes, transaction laissée en suspens, variable de
   module à moitié écrite. On journalisait puis on continuait, ce qui laissait
   tourner un serveur capable de répondre FAUX. Sur des rendez-vous médicaux,
   une mauvaise réponse est pire qu'une absence de réponse : l'hébergeur
   relance en quelques secondes, un dossier erroné reste.

   On ferme donc proprement : on cesse d'accepter de nouvelles requêtes, on
   laisse celles en cours se terminer, et on sort. Le délai de garde couvre le
   cas où la fermeture elle-même se bloque. */
process.on('unhandledRejection', (reason) => {
  console.error('Rejet de promesse non géré:', reason);
});

let serveur = null;
let arretEnCours = false;

process.on('uncaughtException', (err) => {
  console.error('Exception non capturée:', err);
  if (arretEnCours) return;
  arretEnCours = true;

  console.error('🛑 Arrêt du processus : son état n\'est plus fiable.');
  const minuteur = setTimeout(() => process.exit(1), 5000);
  minuteur.unref();

  if (serveur) serveur.close(() => process.exit(1));
  else process.exit(1);
});

initDatabase()
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log(`\n🚀 Serveur chifak démarré sur http://localhost:${PORT}`);
      console.log(`📊 Base de données: PostgreSQL`);
      console.log(`\n✅ Prêt à recevoir des requêtes!`);
      // Ce qui manque, et ce que chaque absence coûte. Voir config/diagnostic.js.
      annoncerPreparation();
    });
    // Laisse plus de temps aux connexions lentes (mobiles) avant de couper.
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;
    // Connu du gestionnaire d'exceptions, pour fermer proprement (voir en haut).
    serveur = server;

    // Agenda du jour envoyé à chaque médecin, tous les matins à 5h00 (heure d'Alger).
    const AGENDA_TZ = process.env.AGENDA_TIMEZONE || 'Africa/Algiers';
    if (cron.validate('0 5 * * *')) {
      cron.schedule('0 5 * * *', async () => {
        console.log('⏰ Envoi des agendas quotidiens (5h00)...');
        try {
          await sendDailyAgendas();
        } catch (err) {
          console.error('Erreur envoi agendas planifiés:', err);
        }
      }, { timezone: AGENDA_TZ });
      console.log(`🗓️  Agendas quotidiens planifiés à 05:00 (${AGENDA_TZ})`);
    }

    /* ── Rappels de rendez-vous, la veille au soir ──
       18h : assez tôt pour qu'on lise le message avant de se coucher, assez
       tard pour que la journée soit finie et qu'on puisse réorganiser demain.
       Un rappel envoyé le matin même arriverait souvent après le départ. */
    cron.schedule('0 18 * * *', async () => {
      console.log('🔔 Envoi des rappels de rendez-vous (18h00)…');
      try {
        await envoyerRappels();
      } catch (err) {
        console.error('Erreur envoi des rappels:', err);
      }
    }, { timezone: AGENDA_TZ });
    console.log(`🔔 Rappels patients planifiés à 18:00 (${AGENDA_TZ})`);

    /* ── Purge des codes de vérification ──
       Rien ne les effaçait. La table grossissait à chaque inscription et à
       chaque renvoi, sans limite. Surtout, les codes non utilisés y restaient
       lisibles indéfiniment : une sauvegarde égarée, ou un accès en lecture à
       la base, livrait de quoi valider des comptes créés des mois plus tôt.

       On garde une journée de marge après l'expiration, le temps de diagnostiquer
       un « mon code ne marche pas » signalé le lendemain. */
    cron.schedule('30 3 * * *', async () => {
      try {
        const r = await pool.query(
          "DELETE FROM verification_codes WHERE expires_at < NOW() - INTERVAL '1 day'"
        );
        if (r.rowCount) console.log(`🧹 ${r.rowCount} code(s) de vérification périmé(s) supprimé(s)`);
      } catch (err) {
        console.error('Erreur purge des codes de vérification:', err.message);
      }
    }, { timezone: AGENDA_TZ });
  })
  .catch((err) => {
    console.error("❌ Échec de l'initialisation de la base de données:", err);
    process.exit(1);
  });
