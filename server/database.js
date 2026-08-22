import './env.js';
import pg from 'pg';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { capacites } from './config/capacites.js';

const { Pool } = pg;

// Connexion PostgreSQL (via DATABASE_URL fournie par Render)
// Réglages pensés pour tenir la charge sans épuiser la base :
// - max : plafonne le nombre de connexions simultanées (les offres gratuites en ont peu)
// - idleTimeout : recycle les connexions inactives
// - connectionTimeout : échoue vite plutôt que d'empiler des requêtes bloquées
/**
 * Réglage TLS de la connexion à PostgreSQL.
 *
 * En local, pas de TLS : la base est sur la même machine.
 *
 * À distance, le trafic porte l'intégralité des dossiers — il doit être
 * chiffré, et le serveur en face doit être AUTHENTIFIÉ. Sans authentification,
 * le chiffrement protège d'une écoute passive mais pas de quelqu'un placé sur
 * le chemin, qui se présente à la place de la base et lit tout.
 *
 * `rejectUnauthorized: false` était donc appliqué en dur : la vérification du
 * certificat était désactivée pour tout le monde, sans possibilité de faire
 * autrement. Elle devient maintenant le REPLI, pas la règle :
 *
 *   · DATABASE_CA renseignée → le certificat est vérifié contre elle. C'est
 *     le mode à viser. La valeur est le certificat racine de l'hébergeur, au
 *     format PEM ; les retours à la ligne peuvent être écrits « \n », ce que
 *     supportent mal certains panneaux de configuration.
 *   · absente → ancien comportement, et un avertissement au démarrage pour
 *     que ce ne soit jamais un oubli silencieux.
 */
function reglageSsl() {
  const url = process.env.DATABASE_URL;
  if (!url || /localhost|127\.0\.0\.1/.test(url)) return false;

  const ca = process.env.DATABASE_CA;
  if (ca) {
    return { ca: ca.replace(/\\n/g, '\n'), rejectUnauthorized: true };
  }

  console.warn(
    '⚠️  DATABASE_CA absente : le certificat de PostgreSQL n\'est PAS vérifié.\n' +
    '    La connexion est chiffrée, mais rien ne prouve que le serveur en face\n' +
    '    est bien la base. Renseignez le certificat racine de l\'hébergeur pour\n' +
    '    fermer cet angle.',
  );
  return { rejectUnauthorized: false };
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX) || 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
  ssl: reglageSsl(),
});

// Un client du pool peut échouer (coupure réseau, redémarrage DB). On log sans tuer le process.
pool.on('error', (err) => {
  console.error('Erreur inattendue sur un client PostgreSQL inactif:', err.message);
});

/**
 * Convertit les marqueurs SQLite (?) en marqueurs PostgreSQL ($1, $2, …).
 *
 * ── Pourquoi ce n'est pas un simple remplacement ──
 *
 * La version d'origine faisait `sql.replace(/\?/g, …)` : elle remplaçait TOUT
 * point d'interrogation de la chaîne. Aucune requête n'en contenait hors
 * marqueur, donc rien ne cassait — mais deux constructions parfaitement
 * normales suffisaient à corrompre silencieusement une requête :
 *
 *   · un « ? » dans une chaîne littérale, par exemple
 *     `WHERE libelle = 'Déjà vu ?'` ;
 *   · les opérateurs jsonb de PostgreSQL — `?` (la clé existe-t-elle),
 *     `?|` (l'une de ces clés), `?&` (toutes ces clés).
 *
 * Dans les deux cas la requête partait avec un marqueur de trop, et le
 * pilote se plaignait d'un nombre de paramètres incohérent — à supposer
 * qu'elle échoue franchement, ce qui n'est pas garanti.
 *
 * On parcourt donc la chaîne en sachant où l'on est : à l'intérieur d'un
 * littéral, d'un identifiant entre guillemets, d'un commentaire, ou dans le
 * corps de la requête. Seuls les « ? » du corps deviennent des marqueurs, et
 * les opérateurs jsonb sont laissés intacts.
 *
 * Pour tester l'existence d'une clé jsonb, préférer malgré tout la forme
 * fonctionnelle `jsonb_exists(colonne, ?)` : elle dit la même chose sans
 * jamais dépendre de cette analyse.
 */
export function toPg(sql) {
  let sortie = '';
  let i = 0;
  let n = 0;

  while (i < sql.length) {
    const c = sql[i];
    const suivant = sql[i + 1];

    // Chaîne littérale : '…', où '' représente une apostrophe.
    if (c === "'") {
      const debut = i++;
      while (i < sql.length) {
        if (sql[i] === "'" && sql[i + 1] === "'") { i += 2; continue; }
        if (sql[i] === "'") { i++; break; }
        i++;
      }
      sortie += sql.slice(debut, i);
      continue;
    }

    // Identifiant entre guillemets : "…"
    if (c === '"') {
      const debut = i++;
      while (i < sql.length && sql[i] !== '"') i++;
      i++;
      sortie += sql.slice(debut, i);
      continue;
    }

    // Commentaire de fin de ligne : -- …
    if (c === '-' && suivant === '-') {
      const debut = i;
      while (i < sql.length && sql[i] !== '\n') i++;
      sortie += sql.slice(debut, i);
      continue;
    }

    // Commentaire de bloc : /* … */
    if (c === '/' && suivant === '*') {
      const debut = i;
      i += 2;
      while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i++;
      i += 2;
      sortie += sql.slice(debut, Math.min(i, sql.length));
      continue;
    }

    // Opérateurs jsonb ?| et ?& : ce ne sont pas des marqueurs.
    if (c === '?' && (suivant === '|' || suivant === '&')) {
      sortie += c + suivant;
      i += 2;
      continue;
    }

    if (c === '?') {
      sortie += `$${++n}`;
      i++;
      continue;
    }

    sortie += c;
    i++;
  }

  return sortie;
}

/**
 * Couche de compatibilité : garde l'API db.prepare(sql).get/all/run(...)
 * de better-sqlite3, mais en asynchrone au-dessus de PostgreSQL.
 */
const db = {
  prepare(sql) {
    const text = toPg(sql);
    const isInsert = /^\s*insert\s/i.test(sql);
    const hasReturning = /returning/i.test(sql);
    return {
      async get(...params) {
        const res = await pool.query(text, params);
        return res.rows[0];
      },
      async all(...params) {
        const res = await pool.query(text, params);
        return res.rows;
      },
      async run(...params) {
        const q = isInsert && !hasReturning ? `${text} RETURNING id` : text;
        const res = await pool.query(q, params);
        return {
          lastInsertRowid: res.rows && res.rows[0] ? res.rows[0].id : undefined,
          changes: res.rowCount,
        };
      },
    };
  },
  async query(text, params) {
    return pool.query(toPg(text), params);
  },
};

export async function initDatabase() {
  // Ordre important : les tables référencées doivent exister avant les FK.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'employee')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS patients (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      password TEXT,
      google_id TEXT UNIQUE,
      facebook_id TEXT UNIQUE,
      is_verified INTEGER DEFAULT 0,
      balance INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS verification_codes (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      is_used INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS doctors (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      specialty TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      doctor_code TEXT UNIQUE,
      image TEXT DEFAULT '👨‍⚕️',
      rating REAL DEFAULT 5.0,
      review_count INTEGER DEFAULT 0,
      available_slots TEXT NOT NULL,
      next_available TEXT NOT NULL,
      slot_duration INTEGER DEFAULT 30,
      working_days TEXT DEFAULT '[1,2,3,4,5]',
      latitude REAL,
      longitude REAL,
      maps_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS appointments (
      id SERIAL PRIMARY KEY,
      doctor_id INTEGER NOT NULL,
      patient_name TEXT NOT NULL,
      patient_email TEXT NOT NULL,
      patient_phone TEXT NOT NULL,
      appointment_date TEXT NOT NULL,
      appointment_time TEXT NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS consultations (
      id SERIAL PRIMARY KEY,
      doctor_id INTEGER NOT NULL,
      patient_name TEXT NOT NULL,
      patient_phone TEXT,
      patient_email TEXT,
      state_description TEXT,
      progress_notes TEXT,
      next_appointment_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
      FOREIGN KEY (next_appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      doctor_id INTEGER NOT NULL,
      patient_email TEXT NOT NULL,
      patient_name TEXT,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (doctor_id, patient_email),
      FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
    )
  `);

  /* ── Demandes d'inscription des praticiens ──
     Un médecin ne crée PAS son compte directement : il dépose une demande,
     qu'un administrateur examine. Sans cette étape, n'importe qui pourrait
     s'inscrire comme cardiologue et recevoir de vrais patients — la
     vérification humaine est ici la seule barrière qui vaille.

     Le mot de passe choisi par le praticien est haché dès le dépôt : une
     demande en attente ne doit pas contenir de secret en clair, même si elle
     n'aboutit jamais. */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS doctor_applications (
      id SERIAL PRIMARY KEY,
      kind TEXT NOT NULL DEFAULT 'registration' CHECK (kind IN ('registration', 'demo')),
      full_name TEXT NOT NULL,
      specialty TEXT NOT NULL,
      city TEXT NOT NULL,
      address TEXT,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      license_number TEXT,
      message TEXT,
      /* Résultat du contrôle facial fait DANS LE NAVIGATEUR du praticien.
         Deux colonnes, et rien d'autre : ni image, ni vecteur, ni gabarit —
         aucune donnée biométrique n'atteint ce serveur, par construction.
         Ce booléen est DÉCLARATIF : le contrôle s'exécute chez l'utilisateur,
         qui peut donc l'annoncer réussi sans l'avoir passé. Il oriente
         l'examen humain, il ne le remplace jamais. */
      identity_checked BOOLEAN,
      identity_score REAL,
      password TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      review_note TEXT,
      reviewed_by INTEGER,
      reviewed_at TIMESTAMP,
      doctor_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL
    )
  `);

  /* Une seule demande en attente par adresse : sans cela, un même praticien
     impatient — ou un script — remplirait la file de doublons. Index partiel :
     il n'empêche pas de redéposer une demande après un refus. */
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_email_pending
    ON doctor_applications (email) WHERE status = 'pending'
  `);

  // Colonnes supplémentaires (espace médecin) — sans casser l'existant
  await pool.query("ALTER TABLE doctors ADD COLUMN IF NOT EXISTS description TEXT");
  await pool.query("ALTER TABLE doctors ADD COLUMN IF NOT EXISTS bio TEXT");
  await pool.query("ALTER TABLE doctors ADD COLUMN IF NOT EXISTS off_days TEXT DEFAULT '[]'");
  await pool.query("ALTER TABLE doctors ADD COLUMN IF NOT EXISTS password TEXT");
  await pool.query("ALTER TABLE doctors ADD COLUMN IF NOT EXISTS must_change_password INTEGER DEFAULT 0");
  // Créneaux bloqués individuellement par le médecin : ["2026-09-14 10:30", ...]
  await pool.query("ALTER TABLE doctors ADD COLUMN IF NOT EXISTS blocked_slots TEXT DEFAULT '[]'");
  await pool.query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS doctor_notes TEXT");

  // Le médecin déclare s'il accepte les téléconsultations. Défaut : non —
  // on n'active pas une modalité de soin à la place du praticien.
  await pool.query("ALTER TABLE doctors ADD COLUMN IF NOT EXISTS accepts_video INTEGER DEFAULT 0");

  /* Empreinte de la photo téléversée.
     Les portraits sont stockés en « data:image/jpeg;base64,… » dans la colonne
     image, soit jusqu'à 200 Ko par praticien. Les renvoyer dans la liste de
     l'annuaire faisait peser une recherche jusqu'à cent mégaoctets. On garde
     ici une empreinte courte : la liste ne cite plus que l'adresse de la photo,
     et PostgreSQL n'a plus besoin d'aller lire la colonne volumineuse. */
  await pool.query('ALTER TABLE doctors ADD COLUMN IF NOT EXISTS photo_hash TEXT');
  await pool.query(`
    UPDATE doctors SET photo_hash = md5(image)
    WHERE image LIKE 'data:image/%' AND photo_hash IS NULL
  `);

  // ── Comptes du personnel ──
  // Matricule lisible par un humain (EMP-2026-0007) : c'est lui que l'admin
  // cite dans un échange, pas l'identifiant technique de la ligne.
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_code TEXT');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT');
  // Fiche administrative de l'employé. Séparer prénom et nom permet de
  // construire l'identifiant de connexion et de trier correctement.
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date TEXT');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_place TEXT');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS position TEXT');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS hired_at TEXT');
  // Contact à prévenir en cas d'accident : information utile pour un poste
  // de terrain, où l'employé se déplace chez les praticiens.
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact TEXT');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS notes TEXT');
  // Jeton public du QR code. Distinct du matricule : le matricule est affiché
  // partout, alors que ce jeton donne le droit de déposer un avis. S'il fuite,
  // on le renouvelle sans changer l'identité de l'employé.
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS feedback_token TEXT');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS active INTEGER DEFAULT 1');

  /* ── Double authentification du personnel ──
     Un mot de passe seul ouvrait l'accès à la liste de tous les praticiens,
     à leurs coordonnées et aux comptes employés. C'est la porte la plus
     précieuse du service, et elle n'avait qu'une serrure.

     Le secret est stocké CHIFFRÉ : qui le lit fabrique des codes valides
     indéfiniment, donc une sauvegarde de base égarée suffirait sinon à
     contourner la mesure. Voir lib/totp.js.

     `totp_last_counter` retient la dernière période acceptée. Sans elle, un
     code lu par-dessus l'épaule reste utilisable une minute et demie. */
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled INTEGER DEFAULT 0');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_last_counter BIGINT');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enrolled_at TIMESTAMP');
  /* Codes de secours, hachés, sous forme de tableau JSON. Un téléphone se
     perd ; sans eux, le compte devient définitivement inaccessible et il faut
     intervenir dans la base, au pire moment. */
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_backup_codes TEXT DEFAULT '[]'");
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_staff_code ON users (staff_code) WHERE staff_code IS NOT NULL');
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_feedback_token ON users (feedback_token) WHERE feedback_token IS NOT NULL');

  // ── Journal des actions du personnel ──
  // On conserve le nom du médecin en clair : une fiche supprimée n'existe plus,
  // mais l'admin doit pouvoir lire « X a supprimé Dr Y le 4 août ».
  await pool.query(`
    CREATE TABLE IF NOT EXISTS staff_actions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      staff_code TEXT,
      action TEXT NOT NULL CHECK (action IN ('doctor_created', 'doctor_deleted')),
      doctor_id INTEGER,
      doctor_name TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ── Avis des médecins sur l'accompagnement reçu ──
  // Lisible par l'administration seule : un employé ne doit pas pouvoir
  // consulter — ni corriger — ce qui est dit de lui.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS employee_feedback (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      staff_code TEXT,
      doctor_name TEXT,
      doctor_code TEXT,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment TEXT,
      suggestion TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Heures ouvertes à la téléconsultation, sous-ensemble des créneaux du
  // praticien : ["14:00", "14:30", ...]. Vide = aucune plage vidéo, même si
  // accepts_video vaut 1 — le médecin doit désigner explicitement ses heures.
  await pool.query("ALTER TABLE doctors ADD COLUMN IF NOT EXISTS video_slots TEXT DEFAULT '[]'");

  // Mode choisi par le patient : 'cabinet' (défaut) ou 'video'.
  await pool.query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS consultation_type TEXT DEFAULT 'cabinet'");

  /* ── Rendez-vous pris par un parent pour son enfant mineur ──
     Le compte reste celui du parent : c'est lui qui reçoit les confirmations
     et qui retrouve le rendez-vous dans son espace. Mais le praticien doit
     voir qui il va réellement recevoir — un pédiatre qui attend « Karim
     Benali, 42 ans » et voit arriver un enfant de six ans a un problème.

     Trois champs seulement, et volontairement : nom, prénom, âge. Rien de
     plus n'est nécessaire pour tenir une consultation, et chaque donnée en
     plus sur un mineur est une donnée à protéger sans raison. */
  await pool.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS child_first_name TEXT');
  await pool.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS child_last_name TEXT');
  await pool.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS child_age INTEGER');

  /* ── Adresses e-mail : une seule forme fait foi ──
     L'unicité de PostgreSQL sur du texte distingue la casse. Les inscriptions
     par formulaire normalisaient en minuscules, mais pas les connexions par
     Google ou Facebook : « Karim@Gmail.com » créait donc un second compte à
     côté de « karim@gmail.com ». Deux dossiers pour une seule personne, ses
     rendez-vous répartis entre les deux, et un praticien qui ne voit jamais
     l'historique complet.

     On normalise l'existant, puis on impose l'unicité sans distinction de
     casse pour que le problème ne puisse pas revenir. Les collisions
     éventuelles sont signalées plutôt que fusionnées d'office : décider
     lequel de deux dossiers médicaux survit n'est pas une décision de code. */
  const collisions = await pool.query(`
    SELECT LOWER(email) AS adresse, COUNT(*)::int AS n
    FROM patients GROUP BY LOWER(email) HAVING COUNT(*) > 1
  `);
  if (collisions.rows.length > 0) {
    console.error('🚨 Comptes patients en double (même adresse, casse différente) :');
    for (const c of collisions.rows) console.error(`🚨   ${c.adresse} — ${c.n} comptes`);
    console.error('🚨 Fusionnez-les à la main avant que l\'unicité insensible à la casse');
    console.error('🚨 puisse être posée. Les rendez-vous sont rattachés par e-mail.');
  } else {
    await pool.query('UPDATE patients SET email = LOWER(email) WHERE email <> LOWER(email)');
    try {
      await pool.query(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_email_unique ON patients (LOWER(email))'
      );
    } catch (e) {
      console.warn('Index d\'unicité des e-mails patients ignoré:', e.message);
    }
  }

  /* Même règle pour les praticiens. La colonne n'avait AUCUNE contrainte
     d'unicité : deux fiches pouvaient porter la même adresse, et la validation
     d'une demande d'inscription s'appuie précisément sur ce champ pour
     reconnaître un médecin déjà inscrit. */
  const doublonsMedecins = await pool.query(`
    SELECT LOWER(email) AS adresse, COUNT(*)::int AS n
    FROM doctors WHERE email IS NOT NULL AND email <> ''
    GROUP BY LOWER(email) HAVING COUNT(*) > 1
  `);
  if (doublonsMedecins.rows.length > 0) {
    console.error('🚨 Fiches praticiens en double (même adresse) :');
    for (const c of doublonsMedecins.rows) console.error(`🚨   ${c.adresse} — ${c.n} fiches`);
  } else {
    await pool.query("UPDATE doctors SET email = LOWER(email) WHERE email IS NOT NULL AND email <> LOWER(email)");
    try {
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_doctors_email_unique
        ON doctors (LOWER(email)) WHERE email IS NOT NULL AND email <> ''
      `);
    } catch (e) {
      console.warn('Index d\'unicité des e-mails praticiens ignoré:', e.message);
    }
  }

  /* ── Un créneau, un seul rendez-vous ──
     La réservation vérifiait la disponibilité, puis insérait. Entre ces deux
     instants, une seconde requête pouvait passer le même contrôle : deux
     patients recevaient une confirmation pour la même heure, et le praticien
     découvrait le doublon dans son agenda. Aucune relecture du code ne
     corrige cela — seule la base peut trancher, parce qu'elle seule voit les
     deux requêtes.

     L'index est partiel : un rendez-vous annulé libère aussitôt son créneau,
     et son ancienne trace ne bloque pas la nouvelle réservation. */
  try {
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_creneau_unique
      ON appointments (doctor_id, appointment_date, appointment_time)
      WHERE status <> 'cancelled'
    `);
  } catch (e) {
    /* Des doublons antérieurs empêchent la création de l'index. On le signale
       sans bloquer le démarrage : le service doit rester debout, mais
       l'exploitant doit savoir qu'il reste des doublons à arbitrer. */
    console.error('🚨 Index anti-doublon des créneaux NON créé :', e.message);
    console.error('🚨 Des rendez-vous en double existent déjà. Repérez-les avec :');
    console.error("🚨   SELECT doctor_id, appointment_date, appointment_time, COUNT(*)");
    console.error("🚨   FROM appointments WHERE status <> 'cancelled'");
    console.error('🚨   GROUP BY 1,2,3 HAVING COUNT(*) > 1;');
  }

  /* ── Rappel de rendez-vous ──
     Le praticien recevait son agenda chaque matin ; le patient, lui, n'avait
     plus aucune nouvelle après la confirmation initiale. Un rendez-vous pris
     trois semaines à l'avance s'oublie — et l'absence au rendez-vous est
     précisément le problème que cette plateforme est censée résoudre.

     `reminder_sent_at` porte la trace de l'envoi. Sans elle, un redémarrage
     du serveur ou une double exécution de la tâche renverrait le même rappel,
     et un patient qui reçoit trois fois le même courrier cesse de les lire.

     `language` mémorise la langue choisie AU MOMENT de la réservation. Elle
     était transmise par le navigateur puis jetée après l'envoi de la
     confirmation : le rappel serait donc parti en français à quelqu'un qui
     avait fait toute sa réservation en arabe. */
  await pool.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP');
  await pool.query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'fr'");
  /* Index partiel : la tâche du soir ne cherche que les rendez-vous d'un jour
     donné dont le rappel n'est pas encore parti. Il reste minuscule, puisqu'il
     ignore tout l'historique déjà traité. */
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_appointments_rappel
    ON appointments (appointment_date) WHERE reminder_sent_at IS NULL
  `);

  // Nom de la salle de visioconférence, tiré au sort à la réservation.
  // Il ne dérive PAS de l'identifiant du rendez-vous : une salle nommée
  // « chifak-rdv-42 » serait devinable, et n'importe qui pourrait entrer
  // dans la consultation d'un autre patient en incrémentant un nombre.
  await pool.query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS video_room TEXT");

  /* ── À quoi sert ce code à usage unique ──
     La table servait uniquement à vérifier une adresse à l'inscription. Elle
     porte maintenant aussi les demandes de nouveau mot de passe. Sans cette
     colonne, un code envoyé pour vérifier une adresse ouvrirait la
     réinitialisation d'un mot de passe, et réciproquement : deux usages sans
     rapport, confondus par le même secret à six chiffres. */
  await pool.query("ALTER TABLE verification_codes ADD COLUMN IF NOT EXISTS purpose TEXT DEFAULT 'signup'");

  /* ── Annulation par le titulaire d'une réservation sans compte ──
     Une seule route pouvait annuler, et elle exigeait un jeton patient. Un
     visiteur qui réservait sans compte — un parcours que l'application
     propose délibérément — n'avait donc AUCUN moyen de se décommander : le
     créneau restait bloqué et le praticien attendait quelqu'un qui ne
     viendrait pas.

     Ce jeton part dans l'e-mail de confirmation, sous forme de lien. Vingt-
     quatre octets tirés au sort : il ne se devine pas, et il ne donne accès
     qu'à CE rendez-vous — ni à un compte, ni à un dossier. */
  await pool.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancel_token TEXT');
  await pool.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancelled_by TEXT');
  await pool.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancel_reason TEXT');

  /* ── Fin de vie d'un rendez-vous ──
     Les seuls états étaient « confirmé » et « annulé » : rien ne disait si la
     consultation avait eu lieu. Le praticien ne pouvait pas noter qui s'était
     présenté, les compteurs ne reflétaient rien de réel, et les avis se
     déclenchaient sur « la date est passée » plutôt que sur « la consultation
     a eu lieu ». */
  await pool.query('ALTER TABLE appointments ADD COLUMN IF NOT EXISTS attendance_marked_at TIMESTAMP');

  /* ── Effacement d'un compte patient ──
     Le compte est anonymisé, pas supprimé : les rendez-vous passés
     appartiennent aussi au dossier du praticien, qui a ses propres
     obligations de conservation. On retire ce qui identifie la personne et on
     garde la trace de l'acte de soin. */
  await pool.query('ALTER TABLE patients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP');

  /* Consentement au traitement des données de santé, recueilli à
     l'inscription et horodaté : sans cette date, on ne peut pas démontrer
     qu'il a été donné. */
  await pool.query('ALTER TABLE patients ADD COLUMN IF NOT EXISTS consent_at TIMESTAMP');

  /* ── Invalidation des jetons après un changement de mot de passe ──
     Un jeton vit vingt-quatre heures et rien ne pouvait l'annuler. Quelqu'un
     qui reprenait la main sur son compte laissait donc l'intrus dedans pour le
     reste de la journée — ce qui vidait la manœuvre de tout son sens.
     Le middleware compare l'instant d'émission du jeton à cette date. */
  await pool.query('ALTER TABLE patients ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP');

  // Index : indispensables pour éviter les balayages complets de table sous charge
  const indexes = [
    "CREATE INDEX IF NOT EXISTS idx_doctors_specialty ON doctors (specialty)",
    "CREATE INDEX IF NOT EXISTS idx_doctors_city ON doctors (city)",
    "CREATE INDEX IF NOT EXISTS idx_doctors_doctor_code ON doctors (doctor_code)",
    "CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date ON appointments (doctor_id, appointment_date)",
    // /api/booked-slots interroge la date SEULE. L'index ci-dessus commence par
    // doctor_id, donc il ne peut pas servir : sans celui-ci, la table entière
    // est parcourue à chaque changement de jour dans les résultats.
    "CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments (appointment_date)",
    // Index partiel : n'indexe que les praticiens en téléconsultation. Il reste
    // minuscule même avec des dizaines de milliers de fiches, puisqu'il ignore
    // toutes celles qui ne proposent pas la vidéo.
    "CREATE INDEX IF NOT EXISTS idx_doctors_video ON doctors (id) WHERE accepts_video = 1",
    // Les statistiques filtrent toujours par employé PUIS par date : l'index
    // composite dans cet ordre permet à PostgreSQL de compter sans lire la table.
    "CREATE INDEX IF NOT EXISTS idx_staff_actions_user_date ON staff_actions (user_id, created_at)",
    "CREATE INDEX IF NOT EXISTS idx_employee_feedback_user ON employee_feedback (user_id, created_at)",
    "CREATE INDEX IF NOT EXISTS idx_appointments_patient_email ON appointments (patient_email)",
    // La fiche affiche les avis les plus récents d'abord : en indexant la date
    // dans l'ordre de lecture, PostgreSQL prend les cent premiers sans trier.
    "CREATE INDEX IF NOT EXISTS idx_reviews_doctor_date ON reviews (doctor_id, created_at DESC)",
    // « Ai-je déjà noté ce médecin ? » interroge l'e-mail du patient.
    "CREATE INDEX IF NOT EXISTS idx_reviews_patient ON reviews (patient_email)",
    "CREATE INDEX IF NOT EXISTS idx_patients_email ON patients (email)",
    "CREATE INDEX IF NOT EXISTS idx_consultations_doctor ON consultations (doctor_id)",
    "CREATE INDEX IF NOT EXISTS idx_verification_email ON verification_codes (email)",
    // Le code est cherché par adresse ET par usage : sans l'usage dans l'index,
    // chaque réinitialisation balaye toutes les inscriptions de la même adresse.
    "CREATE INDEX IF NOT EXISTS idx_verification_email_purpose ON verification_codes (email, purpose)",
    // Annulation par lien : le jeton est le seul critère de recherche.
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_cancel_token ON appointments (cancel_token) WHERE cancel_token IS NOT NULL",
    // username porte déjà une contrainte UNIQUE, donc son index existe.
    // L'écran d'administration lit les demandes en attente, les plus récentes
    // d'abord : l'index porte les deux, il n'y a donc ni balayage ni tri.
    "CREATE INDEX IF NOT EXISTS idx_applications_status_date ON doctor_applications (status, created_at DESC)",
    // Le QR code d'un employé est résolu par ce jeton, sur une route publique.
    "CREATE INDEX IF NOT EXISTS idx_users_feedback_token ON users (feedback_token)",
  ];
  for (const sql of indexes) {
    try { await pool.query(sql); } catch (e) { console.warn('Index ignoré:', e.message); }
  }

  /* Recherche par spécialité et par ville.
     Ces deux champs sont interrogés avec ILIKE '%…%'. Un index B-tree classique
     n'y sert à rien : le joker en tête interdit toute recherche ordonnée, et
     PostgreSQL parcourt la table entière à chaque frappe. L'extension pg_trgm
     indexe les groupes de trois lettres et rend ces recherches immédiates,
     même sur des dizaines de milliers de fiches.
     Si l'extension n'est pas disponible sur l'hébergement, on continue sans :
     la recherche reste correcte, seulement plus lente. */
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_doctors_specialty_trgm ON doctors USING gin (specialty gin_trgm_ops)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_doctors_city_trgm ON doctors USING gin (city gin_trgm_ops)');
    console.log('✅ Recherche par trigrammes active');
  } catch (e) {
    console.warn('pg_trgm indisponible, recherche non indexée:', e.message);
  }

  /* ── Recherche insensible aux accents ──

     « Béchar » et « Bechar » désignent la même ville, et personne ne sait
     laquelle des deux graphies a été saisie dans la fiche d'un praticien.
     La recherche comparait pourtant les chaînes telles quelles : un patient
     qui choisissait « Béjaïa » dans la liste ne trouvait pas un cabinet
     enregistré à « Bejaia », et réciproquement. Sur un annuaire médical,
     c'est un praticien qui n'existe pas pour la moitié de ses patients.

     `sansAccents` est écrite en SQL immuable, donc indexable. L'index qui
     suit porte sur la valeur normalisée : la recherche reste immédiate. Les
     deux côtés de la comparaison passent par cette même fonction — voir
     routes/doctors.js.

     Pourquoi `translate` plutôt que l'extension `unaccent` : celle-ci n'est
     pas installable sur tous les hébergements, et surtout ses fonctions ne
     sont pas marquées immuables, ce qui interdit de les indexer. La table de
     correspondance ci-dessous couvre le français et le berbère latin, seules
     langues dans lesquelles ces fiches sont saisies. */
  try {
    await pool.query(`
      CREATE OR REPLACE FUNCTION sans_accents(t text) RETURNS text AS $$
        SELECT lower(translate(
          COALESCE(t, ''),
          'àâäáãåÀÂÄÁÃÅéèêëÉÈÊËíìîïÍÌÎÏóòôöõÓÒÔÖÕúùûüÚÙÛÜçÇñÑýÿÝ',
          'aaaaaaAAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUcCnNyyY'
        ))
      $$ LANGUAGE sql IMMUTABLE STRICT
    `);
    await pool.query(
      'CREATE INDEX IF NOT EXISTS idx_doctors_city_sansaccents ON doctors USING gin (sans_accents(city) gin_trgm_ops)',
    );
    await pool.query(
      'CREATE INDEX IF NOT EXISTS idx_doctors_specialty_sansaccents ON doctors USING gin (sans_accents(specialty) gin_trgm_ops)',
    );
    capacites.sansAccents = true;
    console.log('✅ Recherche insensible aux accents active');
  } catch (e) {
    /* La fonction n'emploie que `translate` et `lower`, disponibles partout ;
       cet échec serait donc un droit manquant, pas une extension absente. On
       le signale et la recherche repart en comparaison littérale — moins
       tolérante, mais jamais en erreur. Le drapeau est lu par
       routes/doctors.js : aucune requête ne cite une fonction inexistante. */
    console.warn('Recherche sans accents indisponible, repli littéral :', e.message);
  }

  console.log('✅ Tables PostgreSQL prêtes');

  /* ── Semis initial ──
     Règle absolue : AUCUN identifiant connu d'avance en production.
     L'ancien code créait admin/chifak2026, employee1/chifak123,
     employee2/chifak456 et un patient demo/patient123 — des mots de passe
     lisibles par quiconque ouvre le dépôt GitHub. En production, on crée un
     seul compte admin, avec un mot de passe tiré au hasard et affiché UNE
     fois dans les logs du premier démarrage : à changer immédiatement.
     Les données de démonstration (médecins fictifs, avis inventés, faux
     compteurs « 4,9 ★ · 245 avis ») n'existent qu'en développement — les
     afficher à de vrais patients serait un mensonge. */
  const enProduction = process.env.NODE_ENV === 'production';

  const userCount = await pool.query('SELECT COUNT(*)::int AS count FROM users');
  if (userCount.rows[0].count === 0) {
    const insertUser = 'INSERT INTO users (username, password, role) VALUES ($1, $2, $3)';
    if (enProduction) {
      const motDePasseInitial = crypto.randomBytes(12).toString('base64url');
      await pool.query(insertUser, ['admin', await bcrypt.hash(motDePasseInitial, 12), 'admin']);
      console.log('┌──────────────────────────────────────────────────────────┐');
      console.log('│  Compte admin créé. Mot de passe initial (une seule      │');
      console.log('│  apparition — changez-le dès la première connexion) :    │');
      console.log(`│  admin / ${motDePasseInitial}                        │`);
      console.log('└──────────────────────────────────────────────────────────┘');
    } else {
      await pool.query(insertUser, ['admin', await bcrypt.hash('chifak2026', 10), 'admin']);
      await pool.query(insertUser, ['employee1', await bcrypt.hash('chifak123', 10), 'employee']);
      await pool.query(insertUser, ['employee2', await bcrypt.hash('chifak456', 10), 'employee']);
      console.log('✅ Utilisateurs de développement créés');
    }
  }

  /* Détection d'un héritage dangereux : si le compte admin de PRODUCTION
     porte encore l'un des anciens mots de passe publiés, on le crie à chaque
     démarrage. On ne peut pas le changer d'office — l'admin perdrait l'accès
     sans explication — mais on ne laisse pas le danger silencieux. */
  if (enProduction) {
    const adminRow = await pool.query("SELECT password FROM users WHERE username = 'admin'");
    if (adminRow.rows[0]) {
      for (const ancien of ['chifak2026', 'admin', 'password']) {
        if (await bcrypt.compare(ancien, adminRow.rows[0].password)) {
          console.error('🚨 SÉCURITÉ : le compte admin utilise encore un mot de passe publié');
          console.error('🚨 dans le dépôt du projet. Changez-le IMMÉDIATEMENT depuis');
          console.error('🚨 l\'interface d\'administration.');
          break;
        }
      }
    }
  }

  if (!enProduction) {
    // Patient de démonstration
    const demoPatientEmail = 'demo.patient@chifak.dz';
    const existingDemo = await pool.query('SELECT id FROM patients WHERE email = $1', [demoPatientEmail]);
    if (existingDemo.rows.length === 0) {
      await pool.query(
        'INSERT INTO patients (email, name, password, is_verified) VALUES ($1, $2, $3, 1)',
        [demoPatientEmail, 'Patient Demo', await bcrypt.hash('patient123', 10)]
      );
      console.log('✅ Patient de démonstration créé');
    }

    // Médecins de démonstration — notes et compteurs à zéro : les seuls
    // chiffres affichés sont ceux que les avis semés produisent réellement.
    const doctorCount = await pool.query('SELECT COUNT(*)::int AS count FROM doctors');
    if (doctorCount.rows[0].count === 0) {
      const slots = JSON.stringify(['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00']);
      const insertDoctor = `
        INSERT INTO doctors (name, specialty, address, city, phone, email, doctor_code, image, rating, review_count, available_slots, next_available, slot_duration, working_days)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 0, $9, $10, $11, $12)
      `;
      await pool.query(insertDoctor, [
        'Dr. Ahmed Benali', 'Médecin généraliste', '15 Rue Didouche Mourad', "Sidi M'Hamed, Alger",
        '0555123456', 'ahmed.benali@chifak.dz', 'MED-001', '👨‍⚕️', slots, 'Disponible maintenant', 30, '[1,2,3,4,5]',
      ]);
      await pool.query(insertDoctor, [
        'Dr. Fatima Zahra', 'Dentiste', "8 Avenue de l'Indépendance", 'Bir Mourad Raïs, Alger',
        '0555234567', 'fatima.zahra@chifak.dz', 'MED-002', '👩‍⚕️', slots, 'Disponible maintenant', 30, '[1,2,3,4,5]',
      ]);
      console.log('✅ Médecins de démonstration créés');
    }

    // Avis de démonstration
    const reviewCount = await pool.query('SELECT COUNT(*)::int AS count FROM reviews');
    if (reviewCount.rows[0].count === 0) {
      const d1 = (await pool.query("SELECT id FROM doctors WHERE doctor_code = 'MED-001'")).rows[0];
      const d2 = (await pool.query("SELECT id FROM doctors WHERE doctor_code = 'MED-002'")).rows[0];
      const seedReviews = [];
      if (d1) {
        seedReviews.push([d1.id, 'amina.b@example.dz', 'Amina B.', 5, 'Médecin très à l\'écoute et professionnel. Je recommande.']);
        seedReviews.push([d1.id, 'yacine.m@example.dz', 'Yacine M.', 4, 'Bonne consultation, explications claires. Un peu d\'attente.']);
        seedReviews.push([d1.id, 'nadia.h@example.dz', 'Nadia H.', 5, 'Excellent accueil, rien à redire.']);
      }
      if (d2) {
        seedReviews.push([d2.id, 'sara.k@example.dz', 'Sara K.', 5, 'Dentiste douce et compétente, cabinet impeccable.']);
        seedReviews.push([d2.id, 'karim.d@example.dz', 'Karim D.', 4, 'Travail soigné, je reviendrai.']);
      }
      for (const r of seedReviews) {
        await pool.query(
          'INSERT INTO reviews (doctor_id, patient_email, patient_name, rating, comment) VALUES ($1, $2, $3, $4, $5)',
          r
        );
      }
      for (const d of [d1, d2]) {
        if (!d) continue;
        const s = (await pool.query('SELECT COUNT(*)::int AS count, COALESCE(AVG(rating), 0) AS avg FROM reviews WHERE doctor_id = $1', [d.id])).rows[0];
        await pool.query('UPDATE doctors SET rating = $1, review_count = $2 WHERE id = $3', [Math.round(Number(s.avg) * 10) / 10, s.count, d.id]);
      }
      console.log('✅ Avis de démonstration créés');
    }

    // Rendez-vous passé de démonstration (teste la notification + les avis)
    const demoAppt = await pool.query("SELECT COUNT(*)::int AS count FROM appointments WHERE patient_email = 'demo.patient@chifak.dz'");
    if (demoAppt.rows[0].count === 0) {
      const dd = (await pool.query("SELECT id FROM doctors WHERE doctor_code = 'MED-001'")).rows[0];
      if (dd) {
        const past = new Date();
        past.setDate(past.getDate() - 3);
        const iso = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-${String(past.getDate()).padStart(2, '0')}`;
        await pool.query(
          "INSERT INTO appointments (doctor_id, patient_name, patient_email, patient_phone, appointment_date, appointment_time, status) VALUES ($1, $2, $3, $4, $5, $6, 'confirmed')",
          [dd.id, 'Patient Demo', 'demo.patient@chifak.dz', '0555000000', iso, '09:00']
        );
        console.log('✅ Rendez-vous de démonstration (passé) créé');
      }
    }
  }
}

export { pool };
export default db;
