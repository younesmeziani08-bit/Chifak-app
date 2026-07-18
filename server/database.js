import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';

// Créer/Ouvrir la base de données SQLite
const db = new Database('chifak.db');

// Activer les clés étrangères
db.pragma('foreign_keys = ON');

// Créer les tables
export function initDatabase() {
  // Table des utilisateurs (employés/admin)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'employee')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Table des patients (pour authentification sociale et email)
  db.exec(`
    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      password TEXT,
      google_id TEXT UNIQUE,
      facebook_id TEXT UNIQUE,
      is_verified INTEGER DEFAULT 0,
      balance INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Table des codes de vérification
  db.exec(`
    CREATE TABLE IF NOT EXISTS verification_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      is_used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Table des médecins
  db.exec(`
    CREATE TABLE IF NOT EXISTS doctors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Table des consultations / Suivi patient
  db.exec(`
    CREATE TABLE IF NOT EXISTS consultations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_id INTEGER NOT NULL,
      patient_name TEXT NOT NULL,
      patient_phone TEXT,
      patient_email TEXT,
      state_description TEXT,
      progress_notes TEXT,
      next_appointment_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
      FOREIGN KEY (next_appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
    )
  `);

  // Table des rendez-vous
  db.exec(`
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_id INTEGER NOT NULL,
      patient_name TEXT NOT NULL,
      patient_email TEXT NOT NULL,
      patient_phone TEXT NOT NULL,
      appointment_date TEXT NOT NULL,
      appointment_time TEXT NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'confirmed' CHECK(status IN ('confirmed', 'cancelled', 'completed')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
    )
  `);

  // Migration légère pour les bases existantes
  const doctorColumns = db.prepare("PRAGMA table_info(doctors)").all();
  
  const hasDoctorCode = doctorColumns.some((col) => col.name === 'doctor_code');
  if (!hasDoctorCode) {
    db.exec('ALTER TABLE doctors ADD COLUMN doctor_code TEXT');
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_doctors_doctor_code ON doctors(doctor_code)');
    console.log('✅ Migration doctors: colonne doctor_code ajoutée avec index unique');
  }

  const hasSlotDuration = doctorColumns.some((col) => col.name === 'slot_duration');
  if (!hasSlotDuration) {
    db.exec('ALTER TABLE doctors ADD COLUMN slot_duration INTEGER DEFAULT 30');
    db.exec('UPDATE doctors SET slot_duration = 30 WHERE slot_duration IS NULL');
    console.log('✅ Migration doctors: colonne slot_duration ajoutée');
  }

  const hasWorkingDays = doctorColumns.some((col) => col.name === 'working_days');
  if (!hasWorkingDays) {
    db.exec("ALTER TABLE doctors ADD COLUMN working_days TEXT DEFAULT '[1,2,3,4,5]'");
    db.exec("UPDATE doctors SET working_days = '[1,2,3,4,5]' WHERE working_days IS NULL");
    console.log('✅ Migration doctors: colonne working_days ajoutée');
  }

  const patientColumns = db.prepare("PRAGMA table_info(patients)").all();
  const hasBalance = patientColumns.some((col) => col.name === 'balance');
  if (!hasBalance) {
    db.exec('ALTER TABLE patients ADD COLUMN balance INTEGER DEFAULT 0');
    db.exec('UPDATE patients SET balance = 0 WHERE balance IS NULL');
    console.log('✅ Migration patients: colonne balance ajoutée');
  }

  console.log('✅ Tables créées avec succès');

  // Vérifier si des utilisateurs existent
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  
  if (userCount.count === 0) {
    // Créer les utilisateurs par défaut
    const hashedPassword1 = bcrypt.hashSync('chifak2026', 10);
    const hashedPassword2 = bcrypt.hashSync('chifak123', 10);
    const hashedPassword3 = bcrypt.hashSync('chifak456', 10);

    const insertUser = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)');
    
    insertUser.run('admin', hashedPassword1, 'admin');
    insertUser.run('employee1', hashedPassword2, 'employee');
    insertUser.run('employee2', hashedPassword3, 'employee');

    console.log('✅ Utilisateurs par défaut créés');
  }

  // Créer un patient de démonstration s'il n'existe pas
  const demoPatientEmail = 'demo.patient@chifak.dz';
  const existingDemoPatient = db.prepare('SELECT id FROM patients WHERE email = ?').get(demoPatientEmail);
  if (!existingDemoPatient) {
    const demoPatientPassword = bcrypt.hashSync('patient123', 10);
    db.prepare(`
      INSERT INTO patients (email, name, password, is_verified)
      VALUES (?, ?, ?, 1)
    `).run(demoPatientEmail, 'Patient Demo', demoPatientPassword);
    console.log('✅ Patient de démonstration créé');
  }

  // Vérifier si des médecins existent
  const doctorCount = db.prepare('SELECT COUNT(*) as count FROM doctors').get();
  
  if (doctorCount.count === 0) {
    // Créer des médecins par défaut
    const insertDoctor = db.prepare(`
      INSERT INTO doctors (name, specialty, address, city, phone, email, doctor_code, image, rating, review_count, available_slots, next_available, slot_duration, working_days)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const slots = JSON.stringify(['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00']);

    insertDoctor.run(
      'Dr. Ahmed Benali',
      'Médecin généraliste',
      '15 Rue Didouche Mourad',
      'Sidi M\'Hamed, Alger',
      '0555123456',
      'ahmed.benali@chifak.dz',
      'MED-001',
      '👨‍⚕️',
      4.9,
      245,
      slots,
      'Disponible maintenant',
      30,
      '[1,2,3,4,5]'
    );

    insertDoctor.run(
      'Dr. Fatima Zahra',
      'Dentiste',
      '8 Avenue de l\'Indépendance',
      'Bir Mourad Raïs, Alger',
      '0555234567',
      'fatima.zahra@chifak.dz',
      'MED-002',
      '👩‍⚕️',
      4.8,
      189,
      slots,
      'Disponible maintenant',
      30,
      '[1,2,3,4,5]'
    );

    console.log('✅ Médecins par défaut créés');
  }
}

export default db;
