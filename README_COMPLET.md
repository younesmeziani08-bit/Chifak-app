# 🏥 chifak - Application Médicale Complète

## 🌟 Vue d'ensemble

**chifak** est une plateforme complète de réservation de rendez-vous médicaux avec :
- ✅ Base de données locale (SQLite)
- ✅ Authentification multiple (Email, Google, Facebook)
- ✅ Envoi d'emails automatique
- ✅ Interface multilingue (FR/AR)
- ✅ Espace admin pour gérer les médecins
- ✅ Système de localisation précis (Wilaya → Daïra → Commune)

---

## 🚀 Démarrage Ultra-Rapide

### Installation complète (1 commande) :

```bash
# Installer tout
cd server && npm install && cd .. && npm install

# Démarrer (2 terminaux)
# Terminal 1 :
cd server && npm start

# Terminal 2 :
npm run dev
```

### Ou utilisez les scripts :

**Windows :**
```bash
start.bat
```

**Linux/Mac :**
```bash
chmod +x start.sh && ./start.sh
```

---

## 📧 Configuration Minimale (Email)

Pour utiliser l'application avec inscription par email :

1. **Créer un mot de passe d'application Gmail** :
   - https://myaccount.google.com/apppasswords
   
2. **Modifier `server/.env`** :
   ```env
   EMAIL_USER=votre_email@gmail.com
   EMAIL_PASSWORD=xxxx xxxx xxxx xxxx
   ```

3. **Redémarrer le serveur**

✅ L'application fonctionne maintenant !

---

## 🔐 Fonctionnalités d'Authentification

### 1. **Inscription par Email**
- Formulaire d'inscription
- Code de vérification par email (6 chiffres)
- Expiration 10 minutes
- Compte vérifié automatiquement

### 2. **Connexion Google OAuth**
- Bouton "Se connecter avec Google"
- Connexion en 1 clic
- Pas de mot de passe nécessaire

### 3. **Connexion Facebook OAuth**
- Bouton "Se connecter avec Facebook"
- Authentification rapide
- Profil importé automatiquement

### 4. **Espace Admin (Employés)**
- Identifiants :
  - `admin` / `chifak2026`
  - `employee1` / `chifak123`
  - `employee2` / `chifak456`

---

## 📦 Structure du Projet

```
chifak/
│
├── server/                          # 🔙 Backend
│   ├── server.js                    # API Express
│   ├── database.js                  # Configuration SQLite
│   ├── passport-config.js           # OAuth Google/Facebook
│   ├── emailService.js              # Envoi d'emails
│   ├── chifak.db                    # Base de données (auto-créée)
│   ├── .env                         # Configuration
│   ├── package.json
│   └── CONFIGURATION_OAUTH.md       # Guide OAuth détaillé
│
├── src/                             # ⚛️ Frontend React
│   ├── components/
│   │   ├── admin/                   # Dashboard admin
│   │   ├── auth/                    # Modals auth (OAuth, Email)
│   │   ├── HomePage.tsx
│   │   ├── SearchResults.tsx
│   │   ├── BookingPage.tsx
│   │   └── ConfirmationPage.tsx
│   ├── contexts/                    # State management
│   │   ├── DoctorsContext.tsx
│   │   ├── AdminAuthContext.tsx
│   │   └── LanguageContext.tsx
│   ├── services/
│   │   └── api.ts                   # Appels API
│   └── data/
│       └── algeria.ts               # Wilayas d'Algérie
│
├── 📚 Documentation/
│   ├── README.md                    # Vue d'ensemble
│   ├── INSTALLATION.md              # Installation détaillée
│   ├── GUIDE_RAPIDE.md              # Démarrage rapide
│   ├── DEMARRAGE_RAPIDE_OAUTH.md    # Guide OAuth express
│   ├── GUIDE_OAUTH_EMAIL.md         # Guide utilisateur
│   ├── NOUVELLES_FONCTIONNALITES.md # Changelog
│   └── README_COMPLET.md            # Ce fichier
│
└── 🚀 Scripts de démarrage
    ├── start.bat                    # Windows
    └── start.sh                     # Linux/Mac
```

---

## 🗄️ Base de Données

### Tables :

1. **users** - Employés/Admin (3 par défaut)
2. **patients** - Patients (OAuth + Email)
3. **doctors** - Médecins (ajoutés par admin)
4. **appointments** - Rendez-vous
5. **verification_codes** - Codes de vérification email

**Fichier :** `server/chifak.db` (SQLite local)

---

## 🎯 Utilisations

### Pour les Patients :

1. **S'inscrire/Se connecter** :
   - Email + code de vérification
   - Google OAuth
   - Facebook OAuth

2. **Chercher un médecin** :
   - Choisir spécialité
   - Sélectionner Wilaya → Daïra → Commune
   - Voir les résultats

3. **Réserver** :
   - Sélectionner médecin
   - Choisir date/heure
   - Remplir infos
   - ✅ Recevoir confirmation par email

### Pour les Employés :

1. **Se connecter** (🔒 Admin)
2. **Ajouter des médecins** :
   - Nom, spécialité
   - Adresse
   - Localisation complète
3. **Gérer la liste**
4. **Voir les statistiques**

---

## 📧 Emails Automatiques

### 1. Email de vérification
```
Objet : chifak - Code de vérification
Corps : Code à 6 chiffres
Expire : 10 minutes
```

### 2. Confirmation de rendez-vous
```
Objet : chifak - Confirmation de rendez-vous
Corps : Détails complets (médecin, date, heure, adresse)
Design : HTML responsive
Langue : FR ou AR
```

---

## 🌍 Multilingue

- **Français** (FR)
- **العربية** (AR)
- RTL automatique pour l'arabe
- Toggle FR/AR dans le header

---

## 🔧 Configuration

### Fichier `server/.env` :

```env
# Serveur
PORT=3001
JWT_SECRET=chifak_secret_key_2026_super_secure
NODE_ENV=development
SESSION_SECRET=chifak_session_secret_2026

# Email (REQUIS)
EMAIL_USER=votre_email@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx

# Google OAuth (OPTIONNEL)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx

# Facebook OAuth (OPTIONNEL)
FACEBOOK_APP_ID=xxx
FACEBOOK_APP_SECRET=xxx

# URLs
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3001
```

---

## 📚 Documentation Complète

### Guides de Démarrage :
- **[GUIDE_RAPIDE.md](GUIDE_RAPIDE.md)** - Démarrage express
- **[INSTALLATION.md](INSTALLATION.md)** - Installation détaillée
- **[DEMARRAGE_RAPIDE_OAUTH.md](DEMARRAGE_RAPIDE_OAUTH.md)** - Configuration OAuth rapide

### Guides Techniques :
- **[server/API_DOCUMENTATION.md](server/API_DOCUMENTATION.md)** - API REST complète
- **[server/CONFIGURATION_OAUTH.md](server/CONFIGURATION_OAUTH.md)** - Configuration OAuth détaillée
- **[server/README.md](server/README.md)** - Backend documentation

### Guides Utilisateur :
- **[GUIDE_OAUTH_EMAIL.md](GUIDE_OAUTH_EMAIL.md)** - Guide patient
- **[NOUVELLES_FONCTIONNALITES.md](NOUVELLES_FONCTIONNALITES.md)** - Fonctionnalités ajoutées

---

## 🎓 Technologies

### Backend :
- Node.js + Express
- SQLite (better-sqlite3)
- Passport.js (OAuth)
- Nodemailer (Emails)
- JWT + bcrypt
- Express-session

### Frontend :
- React 18 + TypeScript
- Vite
- Tailwind CSS
- React Context API

---

## 🚦 Commandes Utiles

```bash
# Démarrer backend
cd server && npm start

# Démarrer frontend
npm run dev

# Build frontend
npm run build

# Installer dépendances backend
cd server && npm install

# Installer dépendances frontend
npm install
```

---

## ✅ Checklist de Vérification

### Fonctionnalités de base :
- [x] Base de données SQLite locale
- [x] API REST complète
- [x] Interface React multilingue
- [x] Recherche de médecins
- [x] Réservation de rendez-vous
- [x] Espace admin
- [x] Authentification admin

### Nouvelles fonctionnalités :
- [x] Inscription par email
- [x] Envoi de code de vérification
- [x] Google OAuth
- [x] Facebook OAuth
- [x] Emails de confirmation
- [x] Gestion des patients
- [x] Sessions sécurisées

---

## 🐛 Dépannage Rapide

| Problème | Solution |
|----------|----------|
| Backend ne démarre pas | Vérifier `node_modules` installé dans `server/` |
| Email ne s'envoie pas | Vérifier `EMAIL_USER` et `EMAIL_PASSWORD` dans `.env` |
| Google OAuth erreur | Laisser valeur par défaut ou configurer selon guide |
| Facebook OAuth erreur | Laisser valeur par défaut ou configurer selon guide |
| Port 3001 occupé | Changer `PORT` dans `.env` |
| Base de données erreur | Supprimer `chifak.db` et redémarrer |

---

## 🔒 Sécurité

- ✅ Mots de passe hashés (bcrypt)
- ✅ JWT sécurisés
- ✅ Codes de vérification temporaires
- ✅ OAuth standard (Google/Facebook)
- ✅ Sessions avec secret
- ✅ CORS configuré
- ✅ Validation des données

---

## 📊 Statistiques

### Fonctionnalités :
- 3 méthodes d'authentification
- 2 langues supportées
- 16 wilayas d'Algérie incluses
- 12 spécialités médicales
- Interface 100% responsive

### Code :
- Backend : 6 fichiers principaux
- Frontend : 15+ composants
- Documentation : 8 guides
- Base de données : 5 tables

---

## 🎯 Prochaines Étapes

Après l'installation :

1. ✅ Configurer Gmail (requis)
2. ⭕ Configurer Google OAuth (optionnel)
3. ⭕ Configurer Facebook OAuth (optionnel)
4. ✅ Tester inscription par email
5. ✅ Se connecter en admin
6. ✅ Ajouter des médecins
7. ✅ Tester la réservation

---

## 🆘 Support

1. Consultez la documentation appropriée
2. Vérifiez la section Dépannage
3. Regardez les logs du serveur
4. Vérifiez la console du navigateur

---

## 📄 Licence

Ce projet est à usage personnel et éducatif.

---

## 🤝 Contribution

Application développée pour faciliter l'accès aux soins médicaux en Algérie.

---

**🏥 chifak - Votre santé, notre priorité**

*Développé avec ❤️ pour les patients et professionnels de santé algériens*
