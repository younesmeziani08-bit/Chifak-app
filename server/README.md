# 🏥 Backend chifak - Guide d'installation

## 📦 Installation

### Étape 1 : Installer les dépendances

Ouvrez un terminal dans le dossier `server/` et exécutez :

```bash
npm install
```

### Étape 2 : Démarrer le serveur

```bash
npm start
```

Ou en mode développement (avec auto-reload) :

```bash
npm run dev
```

Le serveur démarrera sur **http://localhost:3001**

## 🗄️ Base de données

La base de données SQLite (`chifak.db`) sera créée automatiquement au premier démarrage dans le dossier `server/`.

### Données par défaut

**Utilisateurs créés automatiquement :**
- Admin : `admin` / `chifak2026`
- Employé 1 : `employee1` / `chifak123`
- Employé 2 : `employee2` / `chifak456`

**Médecins créés automatiquement :**
- Dr. Ahmed Benali (Médecin généraliste)
- Dr. Fatima Zahra (Dentiste)

## 📍 Endpoints API

### Authentification
- `POST /api/auth/login` - Connexion employé
- `GET /api/auth/verify` - Vérifier le token

### Médecins
- `GET /api/doctors` - Liste des médecins (avec filtres optionnels)
- `GET /api/doctors/:id` - Détails d'un médecin
- `POST /api/doctors` - Ajouter un médecin (🔒 auth requise)
- `PUT /api/doctors/:id` - Modifier un médecin (🔒 auth requise)
- `DELETE /api/doctors/:id` - Supprimer un médecin (🔒 auth requise)

### Rendez-vous
- `POST /api/appointments` - Créer un rendez-vous
- `GET /api/appointments` - Liste des rendez-vous (🔒 auth requise)

### Statistiques
- `GET /api/stats` - Statistiques globales (🔒 auth requise)

## 🔧 Configuration

Fichier `.env` :
```
PORT=3001
JWT_SECRET=chifak_secret_key_2026_super_secure
NODE_ENV=development
```

## 📊 Structure de la base de données

### Table `users`
- id, username, password (hashé), role, created_at

### Table `doctors`
- id, name, specialty, address, city, phone, email, image, rating, review_count, available_slots (JSON), next_available, created_at, updated_at

### Table `appointments`
- id, doctor_id, patient_name, patient_email, patient_phone, appointment_date, appointment_time, reason, status, created_at

## 🚀 Utilisation avec le frontend

Le frontend React est configuré pour se connecter automatiquement à `http://localhost:3001/api`.

**Important :** Assurez-vous que le serveur backend est démarré **avant** de lancer le frontend.

## 🛠️ Commandes utiles

```bash
# Démarrer le serveur
npm start

# Mode développement (avec nodemon)
npm run dev

# Voir le fichier de base de données
sqlite3 chifak.db
```

## ⚠️ Notes

- Le fichier `chifak.db` contient toutes vos données
- Sauvegardez ce fichier régulièrement
- Les mots de passe sont hashés avec bcrypt
- Les tokens JWT expirent après 24h
