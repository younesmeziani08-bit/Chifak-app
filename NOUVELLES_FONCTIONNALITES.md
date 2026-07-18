# 🎉 Nouvelles Fonctionnalités - chifak

## ✨ Authentification complète

### 1. 📧 Inscription avec Email + Vérification

**Fonctionnalité :**
- Inscription avec email et mot de passe
- Envoi automatique d'un code de vérification par email
- Code à 6 chiffres valide 10 minutes
- Possibilité de renvoyer le code
- Compte activé après vérification

**Endpoints API :**
- `POST /api/auth/register` - Inscription
- `POST /api/auth/verify-code` - Vérifier le code
- `POST /api/auth/resend-code` - Renvoyer le code
- `POST /api/auth/login-patient` - Connexion patient

### 2. 🔴 Connexion avec Google (OAuth)

**Fonctionnalité :**
- Connexion en un clic avec compte Google
- Récupération automatique du nom et email
- Pas besoin de mot de passe
- Compte vérifié automatiquement

**Endpoints API :**
- `GET /api/auth/google` - Initier OAuth Google
- `GET /api/auth/google/callback` - Callback OAuth

### 3. 🔵 Connexion avec Facebook (OAuth)

**Fonctionnalité :**
- Connexion avec compte Facebook
- Récupération du profil Facebook
- Authentification sécurisée
- Compte vérifié automatiquement

**Endpoints API :**
- `GET /api/auth/facebook` - Initier OAuth Facebook
- `GET /api/auth/facebook/callback` - Callback OAuth

### 4. 📬 Système d'envoi d'emails

**Types d'emails :**

#### Email de vérification :
- Design professionnel HTML
- Code à 6 chiffres mis en évidence
- Disponible en français et arabe
- Logo et branding chifak

#### Email de confirmation de rendez-vous :
- Envoyé automatiquement après réservation
- Détails complets du rendez-vous
- Informations du médecin
- Rappels importants
- Design responsive

---

## 🗄️ Modifications de la base de données

### Nouvelle table : `patients`

```sql
CREATE TABLE patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  password TEXT,
  google_id TEXT UNIQUE,
  facebook_id TEXT UNIQUE,
  is_verified INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### Nouvelle table : `verification_codes`

```sql
CREATE TABLE verification_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  is_used INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

---

## 📦 Nouvelles dépendances

### Backend (server/package.json) :

```json
{
  "passport": "^0.7.0",
  "passport-google-oauth20": "^2.0.0",
  "passport-facebook": "^3.0.0",
  "express-session": "^1.17.3",
  "nodemailer": "^6.9.7"
}
```

---

## 🔧 Configuration requise

### Variables d'environnement (.env) :

```env
# Email (Gmail)
EMAIL_USER=votre_email@gmail.com
EMAIL_PASSWORD=mot_de_passe_app_16_caracteres

# Google OAuth
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx

# Facebook OAuth
FACEBOOK_APP_ID=xxx
FACEBOOK_APP_SECRET=xxx

# URLs
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3001
SESSION_SECRET=chifak_session_secret_2026
```

---

## 📁 Nouveaux fichiers créés

### Backend :

1. **server/emailService.js** - Service d'envoi d'emails
2. **server/passport-config.js** - Configuration OAuth
3. **server/CONFIGURATION_OAUTH.md** - Guide de configuration

### Frontend :

1. **src/components/auth/SignupModal.tsx** - Modal d'inscription
2. **src/components/auth/OAuthCallback.tsx** - Gestion callback OAuth

### Documentation :

1. **GUIDE_OAUTH_EMAIL.md** - Guide utilisateur
2. **NOUVELLES_FONCTIONNALITES.md** - Ce fichier

---

## 🚀 Installation

### 1. Installer les dépendances

```bash
cd server
npm install
```

### 2. Configurer les services

Suivez le guide **server/CONFIGURATION_OAUTH.md** pour :
- ✅ Configurer Gmail
- ✅ Configurer Google OAuth
- ✅ Configurer Facebook OAuth

### 3. Mettre à jour .env

Remplissez toutes les variables dans `server/.env`

### 4. Redémarrer le serveur

```bash
cd server
npm start
```

---

## 🎯 Utilisation

### Pour les patients :

1. **S'inscrire :**
   - Email + Mot de passe (avec vérification)
   - OU Google (connexion directe)
   - OU Facebook (connexion directe)

2. **Se connecter :**
   - Email + Mot de passe
   - OU Bouton Google
   - OU Bouton Facebook

3. **Réserver un rendez-vous :**
   - Rechercher un médecin
   - Sélectionner date/heure
   - Remplir les informations
   - ✅ Recevoir confirmation par email

### Pour les développeurs :

```javascript
// Exemple : Inscription
const response = await fetch('http://localhost:3001/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'patient@example.com',
    name: 'Mohammed Salah',
    password: 'password123',
    language: 'fr'
  })
});

// Exemple : Vérification
const verifyResponse = await fetch('http://localhost:3001/api/auth/verify-code', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'patient@example.com',
    code: '123456'
  })
});
```

---

## 🔒 Sécurité

### Mesures implémentées :

1. **Mots de passe** :
   - Hashés avec bcrypt (10 rounds)
   - Jamais stockés en clair

2. **Codes de vérification** :
   - Uniques et aléatoires (6 chiffres)
   - Expiration après 10 minutes
   - Marqués comme utilisés après validation

3. **Tokens JWT** :
   - Signés avec secret
   - Expiration 24h
   - Stockés côté client (localStorage)

4. **OAuth** :
   - Protocoles standards Google/Facebook
   - Tokens gérés par Passport.js
   - Sessions sécurisées

5. **Emails** :
   - Design professionnel anti-spam
   - Pas de liens suspects
   - Vérification de l'expéditeur

---

## 📊 Statistiques

**Nouvelles capacités :**
- ✅ 3 méthodes d'authentification
- ✅ Vérification email automatique
- ✅ Emails transactionnels
- ✅ Support OAuth Google/Facebook
- ✅ Gestion des sessions
- ✅ Base de données patients

---

## 🐛 Dépannage

### Email ne s'envoie pas ?

1. Vérifiez `EMAIL_USER` et `EMAIL_PASSWORD`
2. Assurez-vous d'utiliser un mot de passe d'application Gmail
3. Vérifiez que la validation en 2 étapes est activée

### Google OAuth ne fonctionne pas ?

1. Vérifiez `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET`
2. Vérifiez les URI de redirection dans Google Cloud Console
3. Assurez-vous que l'API Google+ est activée

### Facebook OAuth ne fonctionne pas ?

1. Vérifiez `FACEBOOK_APP_ID` et `FACEBOOK_APP_SECRET`
2. Vérifiez les URI de redirection dans Facebook Developers
3. Ajoutez des testeurs en mode développement

### Le code de vérification a expiré ?

Cliquez sur "Renvoyer le code" pour en recevoir un nouveau.

---

## 📚 Documentation complète

- **[GUIDE_OAUTH_EMAIL.md](GUIDE_OAUTH_EMAIL.md)** - Guide utilisateur
- **[server/CONFIGURATION_OAUTH.md](server/CONFIGURATION_OAUTH.md)** - Configuration technique
- **[server/API_DOCUMENTATION.md](server/API_DOCUMENTATION.md)** - Documentation API

---

## ✅ Checklist de mise en production

Avant de déployer en production :

- [ ] Configurer un vrai serveur SMTP (ou service comme SendGrid)
- [ ] Obtenir un nom de domaine
- [ ] Mettre à jour les URLs OAuth (Google/Facebook)
- [ ] Activer HTTPS
- [ ] Passer Facebook en mode "Live"
- [ ] Vérifier Google OAuth en mode production
- [ ] Tester tous les flux d'authentification
- [ ] Configurer les sauvegardes de la BDD

---

**Votre application chifak est maintenant complète avec authentification sociale et emails ! 🎉**
