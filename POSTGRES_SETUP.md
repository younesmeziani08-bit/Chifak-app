# Migration vers PostgreSQL — étapes Render

Le code backend a été migré de SQLite vers PostgreSQL :
- `server/database.js` réécrit (connexion `pg`, mêmes requêtes via une couche de
  compatibilité, schéma PostgreSQL + données de démo).
- `server/server.js` et `server/passport-config.js` convertis en asynchrone.
- `pg` ajouté, `better-sqlite3` retiré de `server/package.json`.

Tes données seront désormais **permanentes** (elles ne disparaîtront plus aux
redéploiements).

> ⚠️ Ordre important : crée la base et renseigne `DATABASE_URL` **avant** de
> pousser le nouveau code, sinon le déploiement échouera (le serveur a besoin de
> la base au démarrage).

---

## 1. Créer la base PostgreSQL sur Render

1. Dashboard Render → **New +** → **Postgres**.
2. Réglages :
   - **Name** : `chifak-db`
   - **Region** : **Frankfurt (EU Central)** — la MÊME que ton service `chifak-api`.
   - **Plan** : **Free**.
3. **Create Database** → attends que le statut soit **Available**.

## 2. Récupérer l'URL de connexion

Sur la page de la base → section **Connections** → copie l'**Internal Database URL**
(commence par `postgres://…`). *(Interne = même région, plus rapide.)*

## 3. Brancher le service dessus

1. Va sur ton service **chifak-api** → **Environment**.
2. Ajoute une variable :
   - **Key** : `DATABASE_URL`
   - **Value** : *(l'Internal Database URL copiée)*
3. **Save Changes**.

## 4. Pousser le nouveau code

```bash
cd ~/Downloads/chifak-app
git add .
git commit -m "Migration base de données vers PostgreSQL"
git push
```

Render redéploie : il installe `pg`, crée les tables et insère les données de
démo automatiquement. Surveille les logs → tu dois voir
`✅ Tables PostgreSQL prêtes` puis `✅ Prêt à recevoir des requêtes!`.

## 5. Vérifier

Ouvre dans le navigateur :
```
https://chifak-api.onrender.com/api/doctors
```
Tu dois voir les 2 médecins de démo (servis depuis PostgreSQL cette fois).

## 6. Recréer ton compte (une seule fois)

La nouvelle base est vide côté comptes. Dans l'app : **reconnecte-toi avec
Google**. Ton compte est recréé — et cette fois il **restera** même après les
prochains redéploiements. ✅

---

### En cas de souci
- **Deploy failed / crash au démarrage** → `DATABASE_URL` manquante ou mal
  copiée, ou base pas encore « Available ». Vérifie l'étape 3.
- **Erreur SSL** → l'URL doit être celle de Render (le code active SSL
  automatiquement pour les URL Render).
- **`relation "..." does not exist`** → les tables n'ont pas été créées ; regarde
  les logs de démarrage pour l'erreur exacte de `initDatabase`.
