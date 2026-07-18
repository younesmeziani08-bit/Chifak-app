# 📁 Système de Stockage Temporaire des Comptes

Ce dossier sert de "base de données temporaire" pour les comptes créés sur l'application. Chaque compte est sauvegardé sous forme de fichier JSON dans le dossier `server/temp_db/accounts`.

## 📍 Emplacement
`server/temp_db/accounts/`

## 📝 Format des données
Chaque fichier est nommé selon l'email de l'utilisateur (ex: `test_gmail_com.json`) et contient :
- `id`: Identifiant unique
- `email`: Adresse email
- `name`: Nom complet
- `status`: État du compte (`pending_verification`, `verified`, `verified_google`, `verified_facebook`)
- `saved_at`: Date de la dernière sauvegarde
- `password`: Masqué pour la sécurité (`[ENCRYPTED]` ou `[OAUTH]`)

## 🛠️ Comment ça marche ?
1. Lorsqu'un utilisateur s'inscrit, un fichier est créé avec le statut `pending_verification`.
2. Une fois le code de vérification validé, le fichier est mis à jour avec le statut `verified`.
3. Pour les connexions via Google ou Facebook, un fichier est créé/mis à jour instantanément.

## 💡 Avantages
- Inspection facile des comptes sans outils SQL.
- Sauvegarde lisible par l'homme.
- Facile à copier/coller pour des tests.
