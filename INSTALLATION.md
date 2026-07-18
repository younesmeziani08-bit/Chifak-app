# 🏥 chifak - Guide d'installation complet

## 📋 Prérequis

- **Node.js** version 16 ou supérieure
- **npm** ou **yarn**

## 🚀 Installation

### 1️⃣ Installation du Backend (API)

Ouvrez un **premier terminal** et naviguez vers le dossier server :

```bash
cd server
npm install
```

Démarrez le serveur :

```bash
npm start
```

Le serveur démarrera sur **http://localhost:3001**

Vous devriez voir :
```
🚀 Serveur chifak démarré sur http://localhost:3001
📊 Base de données: chifak.db
✅ Prêt à recevoir des requêtes!
```

**⚠️ Laissez ce terminal ouvert** - le serveur doit rester actif.

---

### 2️⃣ Installation du Frontend (Interface)

Ouvrez un **deuxième terminal** et naviguez vers la racine du projet :

```bash
npm install
```

Démarrez l'application :

```bash
npm run dev
```

L'application démarrera sur **http://localhost:5173** (ou un autre port si celui-ci est occupé)

---

## ✅ Vérification

1. **Backend** : Visitez http://localhost:3001 - vous devriez voir `{"message":"API chifak fonctionne ! 🏥"}`

2. **Frontend** : Visitez http://localhost:5173 - vous devriez voir la page d'accueil de chifak

## 🔐 Connexion à l'espace employé

1. Sur la page d'accueil, cliquez sur le bouton **🔒 Admin** (en haut à droite)
2. Utilisez les identifiants :
   - **Admin** : `admin` / `chifak2026`
   - **Employé 1** : `employee1` / `chifak123`
   - **Employé 2** : `employee2` / `chifak456`

## 📁 Structure du projet

```
chifak/
├── server/              # Backend Node.js
│   ├── server.js        # Serveur Express
│   ├── database.js      # Configuration SQLite
│   ├── package.json     # Dépendances backend
│   ├── .env            # Configuration (PORT, JWT_SECRET)
│   └── chifak.db       # Base de données (créée automatiquement)
│
├── src/                 # Frontend React
│   ├── components/      # Composants React
│   ├── contexts/        # Contextes (Auth, Doctors)
│   ├── services/        # API calls
│   └── data/           # Données statiques (wilayas)
│
├── package.json         # Dépendances frontend
└── vite.config.ts      # Configuration Vite
```

## 🗄️ Base de données

La base de données **chifak.db** se trouve dans le dossier `server/`.

**Données par défaut incluses :**
- ✅ 3 utilisateurs (admin + 2 employés)
- ✅ 2 médecins de démonstration

Toutes les données sont stockées localement sur votre ordinateur.

## 🔧 Configuration

### Backend (`server/.env`)
```env
PORT=3001
JWT_SECRET=chifak_secret_key_2026_super_secure
NODE_ENV=development
```

### Frontend (`src/services/api.ts`)
```typescript
const API_URL = 'http://localhost:3001/api';
```

## 🛠️ Commandes utiles

### Backend
```bash
cd server
npm start          # Démarrer le serveur
npm run dev        # Mode développement avec auto-reload
```

### Frontend
```bash
npm run dev        # Mode développement
npm run build      # Build production
npm run preview    # Prévisualiser le build
```

## 📝 Fonctionnalités

### Pour les patients :
- 🔍 Recherche de médecins par spécialité et localisation
- 📅 Réservation de rendez-vous en ligne
- 🌍 Interface multilingue (Français / Arabe)
- 📍 Sélection détaillée : Wilaya → Daïra → Commune

### Pour les employés :
- 🔐 Connexion sécurisée
- ➕ Ajout de nouveaux médecins
- 📋 Gestion de la liste des médecins
- 🗑️ Suppression de médecins
- 📊 Tableau de bord avec statistiques

## ⚠️ Problèmes courants

### Le backend ne démarre pas
- Vérifiez que le port 3001 n'est pas déjà utilisé
- Assurez-vous que Node.js est installé : `node --version`

### Le frontend ne se connecte pas à l'API
- Vérifiez que le backend est bien démarré
- Vérifiez l'URL dans `src/services/api.ts`
- Ouvrez la console du navigateur pour voir les erreurs

### Erreur "Cannot find module"
- Supprimez `node_modules/` et `package-lock.json`
- Relancez `npm install`

## 🔄 Sauvegarde des données

Pour sauvegarder vos données, copiez le fichier `server/chifak.db` dans un endroit sûr.

Pour restaurer, remplacez le fichier `chifak.db` par votre sauvegarde.

## 🎯 Prochaines étapes

Une fois l'installation réussie :
1. Connectez-vous à l'espace employé
2. Ajoutez des médecins
3. Testez la recherche et la réservation
4. Explorez toutes les fonctionnalités !

---

**Besoin d'aide ?** Vérifiez que les deux terminaux (backend + frontend) sont bien ouverts et actifs.
