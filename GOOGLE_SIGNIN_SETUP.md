# Connexion Google dans l'app native chifak

J'ai déjà préparé tout le code :
- **Backend** (`server/server.js`) : renvoie vers l'app via un lien profond
  `chifak://auth/callback?token=...` quand la connexion vient du mobile.
- **App** : bouton Google/Facebook qui ouvre Safari puis récupère le retour
  (fichiers `src/utils/nativeAuth.ts`, `src/utils/auth.ts`, `App.tsx`, modales).
- Plugins ajoutés dans `package.json` (`@capacitor/app`, `@capacitor/browser`).

Il te reste 3 phases à faire.

---

## Phase 1 — Créer les identifiants Google (Google Cloud Console)

1. Va sur **https://console.cloud.google.com** (connecté avec ton compte Google).
2. En haut, crée un **nouveau projet** (« New Project ») → nom : `chifak` → Create.
3. Menu ☰ → **APIs & Services** → **OAuth consent screen** :
   - User Type : **External** → Create.
   - App name : `chifak`, email de support : le tien, email développeur : le tien → Save and continue.
   - Scopes : Save and continue (rien à ajouter).
   - **Test users** : ajoute ton propre email Google → Save.
   *(En mode « Testing », seuls les emails ajoutés ici peuvent se connecter — parfait pour tester.)*
4. Menu → **APIs & Services** → **Credentials** :
   - **Create Credentials** → **OAuth client ID**.
   - Application type : **Web application**.
   - Name : `chifak-web`.
   - **Authorized redirect URIs** → **Add URI** → colle **exactement** :
     ```
     https://chifak-api.onrender.com/api/auth/google/callback
     ```
   - Create.
5. Une fenêtre affiche **Client ID** et **Client secret** → **copie les deux** (garde-les de côté).

---

## Phase 2 — Configurer Render (variables + redéploiement)

### 2a. Repousser le backend modifié sur GitHub

Le code du serveur a changé, il faut l'envoyer pour que Render se mette à jour :

```bash
cd ~/Downloads/chifak-app
git add .
git commit -m "OAuth: retour app via lien profond + config mobile"
git push
```

Render redéploie automatiquement (regarde le statut passer à « Live »).

### 2b. Ajouter les variables d'environnement sur Render

Sur ton service Render → menu **Environment** → **Add Environment Variable**, et ajoute :

| Key                  | Value                                             |
| -------------------- | ------------------------------------------------- |
| `GOOGLE_CLIENT_ID`   | *(le Client ID copié en phase 1)*                 |
| `GOOGLE_CLIENT_SECRET` | *(le Client secret copié en phase 1)*           |
| `BACKEND_URL`        | `https://chifak-api.onrender.com`                 |
| `JWT_SECRET`         | *(une longue chaîne au hasard, ex. 30+ caractères)* |
| `MOBILE_REDIRECT_URL`| `chifak://auth/callback`                          |

Clique **Save Changes** → Render redéploie. Attends « Live ».

> ⚠️ `JWT_SECRET` est indispensable : sans lui, aucune connexion (email ou Google)
> ne peut fonctionner. Mets n'importe quelle longue chaîne secrète.

---

## Phase 3 — Brancher l'app native

### 3a. Installer les plugins + reconstruire

```bash
cd ~/Downloads/chifak-app
npm install
npm run cap:sync
```

### 3b. Déclarer le lien profond dans Xcode

```bash
npm run cap:ios
```

Dans Xcode :
1. Sélectionne le projet **App** (en haut à gauche) → cible **App** → onglet **Info**.
2. Déplie **URL Types** (tout en bas) → clique **+**.
3. Dans **URL Schemes**, écris : `chifak`
   *(laisse Identifier vide ou mets `com.chifak.app`).*
4. C'est tout — ça permet à iOS de rouvrir l'app depuis `chifak://…`.

### 3c. Lancer et tester

1. Dans Xcode : ▶︎ (simulateur ou iPhone).
2. Dans l'app : ouvre la connexion → touche **Google**.
3. Safari s'ouvre → choisis ton compte Google (celui ajouté en test user).
4. Tu es **automatiquement ramené dans l'app**, connecté. ✅

---

## En cas de souci

- **« Erreur 400 : redirect_uri_mismatch »** → l'URL autorisée dans Google ne
  correspond pas exactement à `https://chifak-api.onrender.com/api/auth/google/callback`.
- **« Access blocked / app not verified »** → ajoute bien ton email dans
  *Test users* (Phase 1.3), et connecte-toi avec CE compte.
- **Safari s'ouvre mais ne revient pas dans l'app** → le scheme `chifak` n'est
  pas déclaré dans Xcode (Phase 3b), ou `MOBILE_REDIRECT_URL` est mal orthographié.
- **Rien ne se passe / erreur token** → vérifie que `JWT_SECRET` est bien défini
  sur Render.

## Publier plus tard (hors test)

Pour ouvrir la connexion Google à tout le monde (pas seulement les test users),
il faudra **publier** l'écran de consentement OAuth dans Google Cloud (bouton
« Publish app »), ce qui peut demander une vérification par Google.
