# 🔐 Configuration OAuth et Email - chifak

## 📧 Configuration Gmail (Envoi d'emails)

### Étape 1 : Activer l'authentification à 2 facteurs
1. Allez sur https://myaccount.google.com/security
2. Activez "Validation en deux étapes"

### Étape 2 : Créer un mot de passe d'application
1. Allez sur https://myaccount.google.com/apppasswords
2. Sélectionnez "Autre (nom personnalisé)"
3. Tapez "chifak"
4. Cliquez sur "Générer"
5. Copiez le mot de passe de 16 caractères

### Étape 3 : Configurer le fichier .env
```env
EMAIL_USER=votre_email@gmail.com
EMAIL_PASSWORD=mot_de_passe_app_16_caracteres
```

---

## 🔴 Configuration Google OAuth (Connexion avec Google)

### Étape 1 : Créer un projet Google Cloud
1. Allez sur https://console.cloud.google.com
2. Créez un nouveau projet "chifak"
3. Sélectionnez le projet

### Étape 2 : Activer l'API Google+
1. Dans le menu, allez sur "API et services" > "Bibliothèque"
2. Recherchez "Google+ API"
3. Cliquez sur "Activer"

### Étape 3 : Créer des identifiants OAuth
1. Allez sur "API et services" > "Identifiants"
2. Cliquez sur "+ CRÉER DES IDENTIFIANTS" > "ID client OAuth"
3. Sélectionnez "Application Web"
4. Nom : "chifak Web Client"
5. Origines JavaScript autorisées :
   ```
   http://localhost:5173
   http://localhost:3001
   ```
6. URI de redirection autorisés :
   ```
   http://localhost:3001/api/auth/google/callback
   ```
7. Cliquez sur "Créer"

### Étape 4 : Récupérer les identifiants
Copiez :
- **ID client** (commence par xxx.apps.googleusercontent.com)
- **Secret du client**

### Étape 5 : Configurer le fichier .env
```env
GOOGLE_CLIENT_ID=votre_id_client.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=votre_secret_client
```

### Étape 6 : Configurer l'écran de consentement OAuth
1. Dans "API et services" > "Écran de consentement OAuth"
2. Sélectionnez "Externe"
3. Remplissez :
   - Nom de l'application : chifak
   - E-mail d'assistance utilisateur : votre_email@gmail.com
   - Logo (optionnel)
   - Domaines autorisés : localhost
4. Ajoutez les scopes :
   - .../auth/userinfo.email
   - .../auth/userinfo.profile
5. Sauvegardez

---

## 🔵 Configuration Facebook OAuth (Connexion avec Facebook)

### Étape 1 : Créer une application Facebook
1. Allez sur https://developers.facebook.com
2. Cliquez sur "Mes Apps" > "Créer une App"
3. Sélectionnez "Consommateur"
4. Nom de l'app : "chifak"
5. Créez l'app

### Étape 2 : Configurer Facebook Login
1. Dans le tableau de bord, ajoutez "Facebook Login"
2. Sélectionnez "Web"
3. URL du site : `http://localhost:5173`

### Étape 3 : Configurer les paramètres
1. Allez dans "Facebook Login" > "Paramètres"
2. URI de redirection OAuth valides :
   ```
   http://localhost:3001/api/auth/facebook/callback
   ```
3. Sauvegardez

### Étape 4 : Récupérer les identifiants
1. Allez dans "Paramètres" > "Général"
2. Copiez :
   - **ID de l'app**
   - **Clé secrète de l'app** (cliquez sur "Afficher")

### Étape 5 : Configurer le fichier .env
```env
FACEBOOK_APP_ID=votre_app_id
FACEBOOK_APP_SECRET=votre_app_secret
```

### Étape 6 : Mode développement
En mode développement, ajoutez les testeurs :
1. Dans "Rôles" > "Testeurs"
2. Ajoutez votre compte Facebook

---

## ✅ Vérification de la configuration

### Fichier `.env` complet :
```env
PORT=3001
JWT_SECRET=chifak_secret_key_2026_super_secure
NODE_ENV=development
SESSION_SECRET=chifak_session_secret_2026

# Google OAuth
GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnop

# Facebook OAuth
FACEBOOK_APP_ID=123456789012345
FACEBOOK_APP_SECRET=abcdef0123456789abcdef0123456789

# Email Configuration
EMAIL_USER=votre_email@gmail.com
EMAIL_PASSWORD=abcd efgh ijkl mnop

# URLs
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3001
```

---

## 🧪 Tester les fonctionnalités

### Test Email :
```bash
# Inscrivez-vous avec un email
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "password": "password123",
    "language": "fr"
  }'
```
Vérifiez votre boîte mail pour le code.

### Test Google OAuth :
1. Ouvrez http://localhost:5173
2. Cliquez sur "Se connecter avec Google"
3. Autorisez l'application

### Test Facebook OAuth :
1. Ouvrez http://localhost:5173
2. Cliquez sur "Se connecter avec Facebook"
3. Autorisez l'application

---

## ⚠️ Dépannage

### Email ne s'envoie pas
- Vérifiez que la validation en 2 étapes est activée
- Vérifiez que vous utilisez un mot de passe d'application
- Vérifiez les logs du serveur

### Google OAuth ne fonctionne pas
- Vérifiez les URI de redirection
- Vérifiez que l'API Google+ est activée
- Ajoutez des utilisateurs de test si nécessaire

### Facebook OAuth ne fonctionne pas
- Vérifiez que l'app est en mode développement
- Ajoutez des testeurs
- Vérifiez les URI de redirection

---

## 🔒 Sécurité

**Important :**
- Ne partagez JAMAIS votre fichier `.env`
- Ne commitez JAMAIS les secrets dans Git
- Utilisez des secrets différents en production
- Activez HTTPS en production

---

## 📝 Mode Production

Pour la production, vous devrez :
1. Obtenir un nom de domaine
2. Mettre à jour les URLs dans :
   - Console Google Cloud
   - Développeurs Facebook
   - Fichier `.env`
3. Activer HTTPS
4. Passer Facebook en mode "Live"
