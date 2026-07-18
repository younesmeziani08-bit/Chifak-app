# 🚀 Guide de démarrage rapide - chifak

## ⚡ Démarrage automatique

### Windows
Double-cliquez sur **`start.bat`**

### Linux / Mac
```bash
chmod +x start.sh
./start.sh
```

---

## 📝 Démarrage manuel

### Terminal 1 - Backend
```bash
cd server
npm install    # (première fois seulement)
npm start
```

### Terminal 2 - Frontend
```bash
npm install    # (première fois seulement)
npm run dev
```

---

## 🌐 Accès

- **Application** : http://localhost:5173
- **API Backend** : http://localhost:3001

---

## 🔐 Identifiants employé

| Utilisateur | Mot de passe | Rôle |
|------------|--------------|------|
| `admin` | `chifak2026` | Administrateur |
| `employee1` | `chifak123` | Employé |
| `employee2` | `chifak456` | Employé |

---

## 📱 Utilisation

### Espace Patient
1. Ouvrez http://localhost:5173
2. Sélectionnez une spécialité
3. Choisissez Wilaya → Daïra → Commune
4. Cliquez sur "Rechercher"
5. Sélectionnez un médecin et réservez

### Espace Employé
1. Cliquez sur **🔒 Admin** (en haut à droite)
2. Connectez-vous avec les identifiants ci-dessus
3. Ajoutez/gérez les médecins

---

## 🗄️ Base de données

- **Fichier** : `server/chifak.db`
- **Type** : SQLite (local)
- **Emplacement** : Sur votre ordinateur

### Sauvegarder
Copiez `server/chifak.db` dans un endroit sûr

### Restaurer
Remplacez `server/chifak.db` par votre sauvegarde

---

## ❓ Problèmes courants

### Port déjà utilisé
Changez le port dans `server/.env` :
```
PORT=3002
```
Et dans `src/services/api.ts` :
```typescript
const API_URL = 'http://localhost:3002/api';
```

### Erreur de connexion
1. Vérifiez que le backend est démarré
2. Vérifiez l'URL dans la console du navigateur
3. Redémarrez les deux serveurs

---

## 📊 Fonctionnalités

✅ Recherche de médecins par spécialité et localisation  
✅ Réservation de rendez-vous en ligne  
✅ Interface multilingue (FR/AR)  
✅ Espace admin pour gérer les médecins  
✅ Base de données locale  
✅ Authentification sécurisée  

---

## 📞 Support

Pour plus de détails, consultez **INSTALLATION.md**
