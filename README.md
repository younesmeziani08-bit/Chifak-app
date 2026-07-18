# 🏥 chifak - Plateforme de réservation médicale

Application web complète de prise de rendez-vous médicaux avec base de données locale.

## ✨ Fonctionnalités

### 👥 Pour les patients
- 🔍 Recherche de médecins par spécialité
- 📍 Localisation précise (Wilaya → Daïra → Commune)
- 🗺️ **Cartes Google Maps intégrées** pour localiser les cabinets
- 📅 Réservation de rendez-vous en ligne
- 🌍 Interface multilingue (Français / العربية)
- 📱 Design responsive
- 📧 Authentification multiple (Email, Google, Facebook)
- ✉️ Confirmation par email automatique

### 👨‍💼 Pour les employés
- 🔐 Authentification sécurisée
- ➕ Ajout de médecins avec localisation GPS
- 🗺️ **Intégration Google Maps** (URL ou coordonnées)
- ✏️ Gestion complète des médecins
- 📊 Tableau de bord avec statistiques
- 🗄️ Données stockées localement
- 📧 Gestion des patients et rendez-vous

## 🚀 Démarrage rapide

### Option 1 : Script automatique

**Windows :**
```bash
start.bat
```

**Linux/Mac :**
```bash
chmod +x start.sh
./start.sh
```

### Option 2 : Démarrage manuel

**Terminal 1 - Backend :**
```bash
cd server
npm install
npm start
```

**Terminal 2 - Frontend :**
```bash
npm install
npm run dev
```

## 🌐 Accès

- **Application** : http://localhost:5173
- **API** : http://localhost:3001
- **Dashboard Admin** : Cliquez sur 🔒 Admin

## 🔐 Identifiants

| Utilisateur | Mot de passe | Rôle |
|------------|--------------|------|
| `admin` | `chifak2026` | Administrateur |
| `employee1` | `chifak123` | Employé |
| `employee2` | `chifak456` | Employé |

## 📁 Structure

```
chifak/
├── server/              # Backend Node.js + Express + SQLite
│   ├── server.js        # API REST
│   ├── database.js      # Configuration BDD
│   ├── chifak.db       # Base de données SQLite
│   └── package.json
│
├── src/                 # Frontend React + TypeScript + Tailwind
│   ├── components/      # Composants UI
│   ├── contexts/        # State management
│   ├── services/        # API calls
│   └── data/           # Données (wilayas d'Algérie)
│
├── INSTALLATION.md      # Guide d'installation détaillé
├── GUIDE_RAPIDE.md     # Guide de démarrage rapide
└── start.bat / .sh     # Scripts de démarrage
```

## 🗄️ Base de données

- **Type** : SQLite (fichier local)
- **Emplacement** : `server/chifak.db`
- **Sauvegarde** : Copier le fichier .db

### Tables

- **users** : Employés et administrateurs
- **doctors** : Médecins et leurs informations
- **appointments** : Rendez-vous pris

## 🛠️ Technologies

### Frontend
- ⚛️ React 18
- 📘 TypeScript
- 🎨 Tailwind CSS
- ⚡ Vite
- 🌐 i18n (FR/AR)

### Backend
- 🟢 Node.js
- 🚂 Express
- 🗄️ SQLite (better-sqlite3)
- 🔐 JWT + bcrypt
- 🌍 CORS

## 📚 Documentation

- **[INSTALLATION.md](INSTALLATION.md)** - Guide d'installation complet
- **[GUIDE_RAPIDE.md](GUIDE_RAPIDE.md)** - Démarrage rapide
- **[server/API_DOCUMENTATION.md](server/API_DOCUMENTATION.md)** - Documentation API
- **[server/README.md](server/README.md)** - Guide backend

## 🎯 Utilisation

### 1. Recherche de médecin (Patient)
1. Sélectionnez une spécialité (Dentiste, Médecin généraliste, etc.)
2. Choisissez votre localisation (Wilaya → Daïra → Commune)
3. Cliquez sur "Rechercher"
4. Consultez les résultats et réservez

### 2. Gestion des médecins (Employé)
1. Cliquez sur **🔒 Admin** (header ou footer)
2. Connectez-vous avec vos identifiants
3. Ajoutez ou gérez les médecins
4. Les médecins apparaissent instantanément pour les patients

## 📊 Wilayas d'Algérie incluses

16 wilayas principales avec leurs daïras et communes :
- Alger (16) - 8 daïras
- Oran (31) - 3 daïras
- Constantine (25) - 3 daïras
- Blida, Tizi Ouzou, Annaba, Tlemcen, etc.

## 🔧 Configuration

### Backend (server/.env)
```env
PORT=3001
JWT_SECRET=chifak_secret_key_2026_super_secure
NODE_ENV=development
```

### Frontend (src/services/api.ts)
```typescript
const API_URL = 'http://localhost:3001/api';
```

## ⚠️ Prérequis

- Node.js 16+
- npm ou yarn

## 🔄 Sauvegarde

**Important :** Toutes vos données sont dans `server/chifak.db`

Pour sauvegarder :
```bash
cp server/chifak.db server/chifak-backup-$(date +%Y%m%d).db
```

Pour restaurer :
```bash
cp server/chifak-backup-YYYYMMDD.db server/chifak.db
```

## 🐛 Dépannage

### Port déjà utilisé
Modifiez `PORT` dans `server/.env` et `API_URL` dans `src/services/api.ts`

### Erreur de connexion à l'API
1. Vérifiez que le backend est démarré
2. Ouvrez http://localhost:3001 (doit afficher un message)
3. Vérifiez la console du navigateur

### Base de données corrompue
Supprimez `chifak.db` et redémarrez le serveur (créera une nouvelle BDD)

## 📄 Licence

Ce projet est à usage personnel et éducatif.

## 🤝 Contribution

Application développée pour la gestion des rendez-vous médicaux en Algérie.

---

**Développé avec ❤️ pour faciliter l'accès aux soins médicaux**
