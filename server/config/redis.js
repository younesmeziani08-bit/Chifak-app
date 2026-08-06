/**
 * Client Redis partagé (limiteur de débit + sessions OAuth).
 * FACULTATIF : sans REDIS_URL, tout fonctionne en mémoire d'instance.
 */
import '../env.js';

/* ── Compteurs partagés du limiteur de débit ──
   express-rate-limit compte en mémoire du processus. Avec une seule instance
   c'est exact ; dès la deuxième, chaque instance compte de son côté et le
   plafond réel est multiplié par le nombre d'instances — une attaque par
   force brute sur la connexion en profite directement.

   Redis donne un compteur commun. Il reste FACULTATIF : sans REDIS_URL, ou si
   le serveur Redis ne répond pas, on retombe sur le comptage mémoire. Le
   démarrage n'échoue jamais pour cette raison, et le développement local ne
   demande aucune installation. */
export let fabriqueMagasin = null;
/** Client Redis partagé entre limiteur et sessions ; null si indisponible. */
export let clientRedisPartage = null;

if (process.env.REDIS_URL) {
  try {
    const [{ createClient }, moduleStore] = await Promise.all([
      import('redis'),
      import('rate-limit-redis'),
    ]);
    const RedisStore = moduleStore.default || moduleStore.RedisStore;

    const clientRedis = createClient({
      url: process.env.REDIS_URL,
      // Au-delà de dix tentatives, on cesse de réessayer : le service continue
      // en mémoire plutôt que d'accumuler des reconnexions en arrière-plan.
      socket: { reconnectStrategy: (essais) => (essais > 10 ? false : Math.min(essais * 200, 3000)) },
    });
    // Un incident Redis ne doit pas faire tomber le processus.
    clientRedis.on('error', (e) => console.warn('Redis:', e.message));
    await clientRedis.connect();

    /* Un préfixe distinct par limiteur. Sans cela, les trois limiteurs
       partageraient les mêmes clés : une recherche de médecin consommerait le
       quota de tentatives de connexion. */
    fabriqueMagasin = (prefixe) => new RedisStore({
      sendCommand: (...args) => clientRedis.sendCommand(args),
      prefix: `chifak:${prefixe}:`,
    });

    process.on('SIGTERM', () => { clientRedis.quit().catch(() => {}); });
    clientRedisPartage = clientRedis;
    console.log('✅ Limiteur de débit partagé (Redis)');
  } catch (e) {
    console.warn('⚠️  Redis indisponible, limiteur en mémoire :', e.message);
  }
} else {
  console.log('ℹ️  REDIS_URL absent : limiteur de débit en mémoire (instance unique)');
}

/** Magasin partagé si Redis répond, sinon rien — express-rate-limit prend alors sa mémoire. */
export const magasin = (prefixe) => (fabriqueMagasin ? { store: fabriqueMagasin(prefixe) } : {});

