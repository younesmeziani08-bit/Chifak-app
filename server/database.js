import pg from 'pg';
import bcrypt from 'bcrypt';

const { Pool } = pg;

// Connexion PostgreSQL (via DATABASE_URL fournie par Render)
// Réglages pensés pour tenir la charge sans épuiser la base :
// - max : plafonne le nombre de connexions simultanées (les offres gratuites en ont peu)
// - idleTimeout : recycle les connexions inactives
// - connectionTimeout : échoue vite plutôt que d'empiler des requêtes bloquées
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX) || 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
  ssl:
    process.env.DATABASE_URL && !/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL)
      ? { rejectUnauthorized: false }
      : false,
});

// Un client du pool peut échouer (coupure réseau, redémarrage DB). On log sans tuer le process.
pool.on('error', (err) => {
  console.error('Erreur inattendue sur un client PostgreSQL inactif:', err.message);
});

// Convertit les placeholders SQLite (?) en placeholders PostgreSQL ($1, $2, ...)
function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
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

  // Heures ouvertes à la téléconsultation, sous-ensemble des créneaux du
  // praticien : ["14:00", "14:30", ...]. Vide = aucune plage vidéo, même si
  // accepts_video vaut 1 — le médecin doit désigner explicitement ses heures.
  await pool.query("ALTER TABLE doctors ADD COLUMN IF NOT EXISTS video_slots TEXT DEFAULT '[]'");

  // Mode choisi par le patient : 'cabinet' (défaut) ou 'video'.
  await pool.query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS consultation_type TEXT DEFAULT 'cabinet'");

  // Nom de la salle de visioconférence, tiré au sort à la réservation.
  // Il ne dérive PAS de l'identifiant du rendez-vous : une salle nommée
  // « chifak-rdv-42 » serait devinable, et n'importe qui pourrait entrer
  // dans la consultation d'un autre patient en incrémentant un nombre.
  await pool.query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS video_room TEXT");

  // Index : indispensables pour éviter les balayages complets de table sous charge
  const indexes = [
    "CREATE INDEX IF NOT EXISTS idx_doctors_specialty ON doctors (specialty)",
    "CREATE INDEX IF NOT EXISTS idx_doctors_city ON doctors (city)",
    "CREATE INDEX IF NOT EXISTS idx_doctors_doctor_code ON doctors (doctor_code)",
    "CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date ON appointments (doctor_id, appointment_date)",
    "CREATE INDEX IF NOT EXISTS idx_appointments_patient_email ON appointments (patient_email)",
    "CREATE INDEX IF NOT EXISTS idx_reviews_doctor ON reviews (doctor_id)",
    "CREATE INDEX IF NOT EXISTS idx_patients_email ON patients (email)",
    "CREATE INDEX IF NOT EXISTS idx_consultations_doctor ON consultations (doctor_id)",
    "CREATE INDEX IF NOT EXISTS idx_verification_email ON verification_codes (email)",
  ];
  for (const sql of indexes) {
    try { await pool.query(sql); } catch (e) { console.warn('Index ignoré:', e.message); }
  }

  console.log('✅ Tables PostgreSQL prêtes');

  // Utilisateurs par défaut (admin / employés)
  const userCount = await pool.query('SELECT COUNT(*)::int AS count FROM users');
  if (userCount.rows[0].count === 0) {
    const insertUser = 'INSERT INTO users (username, password, role) VALUES ($1, $2, $3)';
    await pool.query(insertUser, ['admin', await bcrypt.hash('chifak2026', 10), 'admin']);
    await pool.query(insertUser, ['employee1', await bcrypt.hash('chifak123', 10), 'employee']);
    await pool.query(insertUser, ['employee2', await bcrypt.hash('chifak456', 10), 'employee']);
    console.log('✅ Utilisateurs par défaut créés');
  }

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

  // Médecins par défaut
  const doctorCount = await pool.query('SELECT COUNT(*)::int AS count FROM doctors');
  if (doctorCount.rows[0].count === 0) {
    const slots = JSON.stringify(['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00']);
    const insertDoctor = `
      INSERT INTO doctors (name, specialty, address, city, phone, email, doctor_code, image, rating, review_count, available_slots, next_available, slot_duration, working_days)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `;
    await pool.query(insertDoctor, [
      'Dr. Ahmed Benali', 'Médecin généraliste', '15 Rue Didouche Mourad', "Sidi M'Hamed, Alger",
      '0555123456', 'ahmed.benali@chifak.dz', 'MED-001', '👨‍⚕️', 4.9, 245, slots, 'Disponible maintenant', 30, '[1,2,3,4,5]',
    ]);
    await pool.query(insertDoctor, [
      'Dr. Fatima Zahra', 'Dentiste', "8 Avenue de l'Indépendance", 'Bir Mourad Raïs, Alger',
      '0555234567', 'fatima.zahra@chifak.dz', 'MED-002', '👩‍⚕️', 4.8, 189, slots, 'Disponible maintenant', 30, '[1,2,3,4,5]',
    ]);
    console.log('✅ Médecins par défaut créés');
  }

  // Quelques avis de démonstration
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
    // Recalcul des notes des médecins concernés
    for (const d of [d1, d2]) {
      if (!d) continue;
      const s = (await pool.query('SELECT COUNT(*)::int AS count, COALESCE(AVG(rating), 0) AS avg FROM reviews WHERE doctor_id = $1', [d.id])).rows[0];
      await pool.query('UPDATE doctors SET rating = $1, review_count = $2 WHERE id = $3', [Math.round(Number(s.avg) * 10) / 10, s.count, d.id]);
    }
    console.log('✅ Avis de démonstration créés');
  }

  // Rendez-vous passé de démonstration (pour tester la notification + les avis)
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

export { pool };
export default db;
