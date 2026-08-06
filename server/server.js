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
import { initDatabase } from './database.js';
import { sendDailyAgendas } from './dailyAgenda.js';
import app from './app.js';

const PORT = process.env.PORT || 3001;

// Filets de sécurité au niveau du process : on log sans tuer le serveur brutalement.
process.on('unhandledRejection', (reason) => {
  console.error('Rejet de promesse non géré:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Exception non capturée:', err);
});

initDatabase()
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log(`\n🚀 Serveur chifak démarré sur http://localhost:${PORT}`);
      console.log(`📊 Base de données: PostgreSQL`);
      console.log(`\n✅ Prêt à recevoir des requêtes!\n`);
    });
    // Laisse plus de temps aux connexions lentes (mobiles) avant de couper.
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;

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
  })
  .catch((err) => {
    console.error("❌ Échec de l'initialisation de la base de données:", err);
    process.exit(1);
  });
