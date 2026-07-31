import pg from 'pg';
import bcrypt from 'bcrypt';

const { Pool } = pg;

// Connexion PostgreSQL (via DATABASE_URL fournie par Render)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_URL && !/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL)
      ? { rejectUnauthorized: false }
      : false,
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

  console.log('✅ Tables PostgreSQL prêtes');

  // Utilisateurs par défaut (admin / employés)
  const userCount = await pool.query('SELECT COUNT(*)::int AS count FROM users');
  if (userCount.rows[0].count === 0) {
    const insertUser = 'INSERT INTO users (username, password, role) VALUES ($1, $2, $3)';
    await pool.query(insertUser, ['admin', bcrypt.hashSync('chifak2026', 10), 'admin']);
    await pool.query(insertUser, ['employee1', bcrypt.hashSync('chifak123', 10), 'employee']);
    await pool.query(insertUser, ['employee2', bcrypt.hashSync('chifak456', 10), 'employee']);
    console.log('✅ Utilisateurs par défaut créés');
  }

  // Patient de démonstration
  const demoPatientEmail = 'demo.patient@chifak.dz';
  const existingDemo = await pool.query('SELECT id FROM patients WHERE email = $1', [demoPatientEmail]);
  if (existingDemo.rows.length === 0) {
    await pool.query(
      'INSERT INTO patients (email, name, password, is_verified) VALUES ($1, $2, $3, 1)',
      [demoPatientEmail, 'Patient Demo', bcrypt.hashSync('patient123', 10)]
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
}

export { pool };
export default db;
