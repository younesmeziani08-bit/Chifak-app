/** Session, utilisée uniquement pour la poignée de main OAuth. */
import session from 'express-session';
import { clientRedisPartage } from './redis.js';

// Session pour OAuth
// Cookie durci : httpOnly (inaccessible au JavaScript), sameSite (anti-CSRF),
// secure en production (transmis uniquement en HTTPS).
/* Magasin de session : Redis si disponible, mémoire sinon.
   La session ne sert qu'à la poignée de main OAuth (Google/Facebook), mais en
   mémoire elle est locale à l'instance : avec deux instances derrière un
   répartiteur, le retour d'OAuth peut atterrir sur l'autre et la connexion
   échoue une fois sur deux. Même philosophie que le limiteur : optionnel,
   repli silencieux, le démarrage n'échoue jamais pour ça. */
let magasinSession;
if (clientRedisPartage) {
  try {
    const { RedisStore: SessionRedisStore } = await import('connect-redis');
    magasinSession = new SessionRedisStore({ client: clientRedisPartage, prefix: 'chifak:sess:' });
    console.log('✅ Sessions OAuth partagées (Redis)');
  } catch (e) {
    console.warn('⚠️  connect-redis indisponible, sessions en mémoire :', e.message);
  }
}

export const middlewareSession = session({
  name: 'chifak.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  ...(magasinSession ? { store: magasinSession } : {}),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 heures
  }
});

