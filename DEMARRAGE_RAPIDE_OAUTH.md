# 🚀 Démarrage Rapide - OAuth & Email

## ⚡ Installation Express (5 minutes)

### Étape 1 : Installer les dépendances backend
```bash
cd server
npm install
cd ..
```

### Étape 2 : Configurer Gmail (pour l'envoi d'emails)

1. **Activer la validation en 2 étapes Gmail :**
   - Allez sur https://myaccount.google.com/security
   - Activez "Validation en deux étapes"

2. **Créer un mot de passe d'application :**
   - Allez sur https://myaccount.google.com/apppasswords
   - Nom : "chifak"
   - Copiez le mot de passe (16 caractères sans espaces)

3. **Mettre à jour server/.env :**
   ```env
   EMAIL_USER=votre_email@gmail.com
   EMAIL_PASSWORD=xxxx xxxx xxxx xxxx
   ```

### Étape 3 : Démarrer l'application

```bash
# Terminal 1 - Backend
cd server
npm start

# Terminal 2 - Frontend
npm run dev
```

---

## ✅ Test Basique (Email uniquement)

Vous pouvez tester **immédiatement** l'inscription par email sans configurer OAuth !

1. Ouvrez http://localhost:5173
2. Cliquez sur "Connexion"
3. Cliquez sur "Créer un compte"
4. Remplissez le formulaire
5. Vérifiez votre email
6. Entrez le code reçu
7. ✅ Connecté !

**Note :** Les boutons Google et Facebook ne fonctionneront pas sans configuration OAuth (voir ci-dessous).

---

## 🔴 Configuration Google OAuth (Optionnel - 10 minutes)

### Configuration rapide :

1. **Google Cloud Console** : https://console.cloud.google.com
2. Créez un projet "chifak"
3. **API et services** > **Bibliothèque** > Activez "Google+ API"
4. **Identifiants** > **Créer des identifiants** > **ID client OAuth**
5. Type : "Application Web"
6. **Origines autorisées** :
   ```
   http://localhost:5173
   http://localhost:3001
   ```
7. **URI de redirection** :
   ```
   http://localhost:3001/api/auth/google/callback
   ```
8. Copiez **ID client** et **Secret**
9. **Mettez à jour server/.env** :
   ```env
   GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-xxx
   ```
10. **Redémarrez le serveur**

✅ Le bouton Google fonctionne maintenant !

---

## 🔵 Configuration Facebook OAuth (Optionnel - 10 minutes)

### Configuration rapide :

1. **Facebook Developers** : https://developers.facebook.com
2. **Mes Apps** > **Créer une App** > Type : "Consommateur"
3. Nom : "chifak"
4. Ajoutez **Facebook Login** > **Web**
5. URL du site : `http://localhost:5173`
6. **Facebook Login** > **Paramètres** > **URI de redirection OAuth** :
   ```
   http://localhost:3001/api/auth/facebook/callback
   ```
7. **Paramètres** > **Général** > Copiez **ID** et **Clé secrète**
8. **Mettez à jour server/.env** :
   ```env
   FACEBOOK_APP_ID=123456789012345
   FACEBOOK_APP_SECRET=xxx
   ```
9. **Rôles** > **Testeurs** > Ajoutez votre compte
10. **Redémarrez le serveur**

✅ Le bouton Facebook fonctionne maintenant !

---

## 📝 Fichier .env complet

```env
PORT=3001
JWT_SECRET=chifak_secret_key_2026_super_secure
NODE_ENV=development
SESSION_SECRET=chifak_session_secret_2026

# Google OAuth (Optionnel)
GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnop

# Facebook OAuth (Optionnel)
FACEBOOK_APP_ID=123456789012345
FACEBOOK_APP_SECRET=abcdef0123456789abcdef0123456789

# Email (Requis pour vérification)
EMAIL_USER=votre_email@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx

# URLs
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3001
```

---

## 🧪 Tester les fonctionnalités

### 1. Inscription par Email :
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "password": "password123",
    "language": "fr"
  }'
```

### 2. Google OAuth :
- Ouvrez http://localhost:5173
- Cliquez sur "Se connecter avec Google"

### 3. Facebook OAuth :
- Ouvrez http://localhost:5173
- Cliquez sur "Se connecter avec Facebook"

---

## 🎯 Que faire si...

### Les emails ne s'envoient pas ?
1. Vérifiez `EMAIL_USER` et `EMAIL_PASSWORD`
2. Assurez-vous d'avoir un mot de passe d'application Gmail
3. Regardez les logs du serveur

### Google OAuth ne fonctionne pas ?
1. Laissez `GOOGLE_CLIENT_ID=your_google_client_id` dans .env
2. Le bouton sera désactivé automatiquement
3. Ou configurez-le selon les instructions ci-dessus

### Facebook OAuth ne fonctionne pas ?
1. Laissez `FACEBOOK_APP_ID=your_facebook_app_id` dans .env
2. Le bouton sera désactivé automatiquement
3. Ou configurez-le selon les instructions ci-dessus

---

## 📚 Documentation détaillée

Pour plus de détails, consultez :

- **[NOUVELLES_FONCTIONNALITES.md](NOUVELLES_FONCTIONNALITES.md)** - Toutes les nouvelles fonctionnalités
- **[GUIDE_OAUTH_EMAIL.md](GUIDE_OAUTH_EMAIL.md)** - Guide utilisateur
- **[server/CONFIGURATION_OAUTH.md](server/CONFIGURATION_OAUTH.md)** - Configuration complète

---

## ✅ Checklist de démarrage

- [ ] Dépendances backend installées (`cd server && npm install`)
- [ ] Gmail configuré (validation 2 étapes + mot de passe app)
- [ ] `.env` rempli avec email
- [ ] Serveur backend démarré (`cd server && npm start`)
- [ ] Frontend démarré (`npm run dev`)
- [ ] Test d'inscription par email ✅
- [ ] (Optionnel) Google OAuth configuré
- [ ] (Optionnel) Facebook OAuth configuré

---

**Vous êtes prêt ! L'application fonctionne avec l'authentification par email. Configurez OAuth plus tard si vous le souhaitez. 🚀**
