# chifak — Application mobile native (iOS + Android) avec Capacitor

Ce guide transforme l'app web chifak en **vraie application native** iOS et Android,
en réutilisant ton code existant (pas de réécriture). J'ai déjà préparé dans le projet :

- `capacitor.config.ts` (appId `com.chifak.app`, appName « chifak », webDir `dist`)
- les scripts npm (`cap:sync`, `cap:ios`, `cap:android`, `cap:assets`)
- l'icône et le splash dans `resources/` (générés depuis ton logo)
- `.env.production` pour l'URL du backend

Tu n'as plus qu'à lancer les commandes ci-dessous **sur ton Mac**.

---

## 0. Prérequis (à installer une seule fois)

- **Node.js** (déjà installé)
- **Xcode** (App Store, gratuit) — pour iOS
- **CocoaPods** — pour iOS : `sudo gem install cocoapods`
- **Android Studio** (gratuit) — pour Android
- **Compte Apple Developer** (99 $/an) — uniquement pour installer sur un vrai
  iPhone / publier sur l'App Store. Le simulateur iOS ne le demande pas.
- **Un backend hébergé en ligne** (voir étape 1) — indispensable.

---

## 1. Héberger le backend (indispensable)

L'app native ne peut pas utiliser `localhost` : elle doit appeler ton backend
via une **URL publique en HTTPS**. Options simples et gratuites/peu chères :
Render, Railway, Fly.io.

En résumé (ex. Render) : crée un « Web Service », pointe-le sur le dossier
`server/`, commande de démarrage `npm start`. Tu obtiens une URL du type
`https://chifak-api.onrender.com`.

Puis ouvre `.env.production` et remplace la valeur par ton URL :

```
VITE_API_URL=https://chifak-api.onrender.com
```

> Sans cette étape, l'app s'ouvrira mais n'affichera aucun médecin.
> (Je peux t'aider à héberger le backend quand tu veux.)

---

## 2. Installer Capacitor

```bash
cd ~/Downloads/chifak-app
npm install @capacitor/core @capacitor/ios @capacitor/android
npm install -D @capacitor/cli @capacitor/assets
```

---

## 3. Construire l'app web

```bash
npm run build
```

(Produit le dossier `dist/` que Capacitor va empaqueter.)

---

## 4. Ajouter les plateformes iOS et Android

```bash
npx cap add ios
npx cap add android
```

Cela crée les dossiers natifs `ios/` et `android/`.

---

## 5. Générer icônes + écran de démarrage (depuis ton logo)

```bash
npm run cap:assets
```

(Utilise `resources/icon.png` et `resources/splash.png` déjà présents.)

---

## 6. Synchroniser

À refaire **à chaque fois que tu modifies le code** :

```bash
npm run cap:sync
```

(= `npm run build` puis `npx cap sync`.)

---

## 7. Lancer sur iPhone (Xcode)

```bash
npm run cap:ios
```

Dans Xcode : choisis un simulateur (ou branche ton iPhone), sélectionne ton
« Team » (compte Apple) dans *Signing & Capabilities*, puis clique sur ▶︎.

---

## 8. Lancer sur Android (Android Studio)

```bash
npm run cap:android
```

Dans Android Studio : choisis un émulateur ou branche ton téléphone, puis ▶︎.

Pour un **APK installable** directement :
*Build → Build Bundle(s) / APK(s) → Build APK(s)*. Le fichier `.apk` généré
peut être envoyé et installé sur n'importe quel Android.

---

## Récapitulatif express (après la 1re installation)

```bash
cd ~/Downloads/chifak-app
npm run cap:sync      # rebuild + sync
npm run cap:ios       # ou : npm run cap:android
```

## Checklist prérequis

- [ ] Backend hébergé en HTTPS + `VITE_API_URL` renseignée dans `.env.production`
- [ ] Xcode installé + CocoaPods (iOS)
- [ ] Android Studio installé (Android)
- [ ] Compte Apple Developer (uniquement pour un vrai iPhone / l'App Store)

---

### Notes

- Bilingue FR/AR + RTL et le responsive sont conservés tels quels.
- La connexion Google/Facebook (OAuth) demandera une config supplémentaire des
  URLs de redirection côté natif ; la connexion par **email** fonctionne directement.
- App Store : Apple exige le compte développeur payant. Play Store : compte
  Google Play, frais uniques de 25 $.
