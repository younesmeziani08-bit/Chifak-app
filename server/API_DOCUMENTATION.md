# 📚 Documentation API - chifak

Base URL: `http://localhost:3001/api`

## 🔐 Authentification

Les endpoints marqués 🔒 nécessitent un token JWT dans le header :
```
Authorization: Bearer <token>
```

---

## 🔑 Auth

### POST `/auth/login`
Connexion employé/admin

**Body:**
```json
{
  "username": "admin",
  "password": "chifak2026"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  }
}
```

### GET `/auth/verify` 🔒
Vérifier la validité du token

**Response:**
```json
{
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  }
}
```

---

## 👨‍⚕️ Médecins

### GET `/doctors`
Récupérer tous les médecins (avec filtres optionnels)

**Query params:**
- `specialty` (optionnel) : Filtrer par spécialité
- `location` (optionnel) : Filtrer par ville

**Exemple:**
```
GET /api/doctors?specialty=Dentiste&location=Alger
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "Dr. Ahmed Benali",
    "specialty": "Médecin généraliste",
    "address": "15 Rue Didouche Mourad",
    "city": "Sidi M'Hamed, Alger",
    "phone": "0555123456",
    "email": "ahmed.benali@chifak.dz",
    "image": "👨‍⚕️",
    "rating": 4.9,
    "reviewCount": 245,
    "availableSlots": ["08:00", "09:00", "10:00", ...],
    "nextAvailable": "Disponible maintenant",
    "created_at": "2026-01-15 10:30:00",
    "updated_at": "2026-01-15 10:30:00"
  }
]
```

### GET `/doctors/:id`
Récupérer un médecin spécifique

**Response:**
```json
{
  "id": 1,
  "name": "Dr. Ahmed Benali",
  ...
}
```

### POST `/doctors` 🔒
Ajouter un nouveau médecin

**Body:**
```json
{
  "name": "Dr. Karim Mansouri",
  "specialty": "Cardiologue",
  "address": "25 Boulevard Mohamed V",
  "city": "Oran, Oran",
  "phone": "0556789012",
  "email": "karim.mansouri@chifak.dz",
  "image": "👨‍⚕️",
  "availableSlots": ["08:00", "09:00", "10:00", "14:00", "15:00"],
  "nextAvailable": "Disponible demain"
}
```

**Champs requis:** name, specialty, address, city  
**Champs optionnels:** phone, email, image, availableSlots, nextAvailable

**Response:**
```json
{
  "id": 3,
  "name": "Dr. Karim Mansouri",
  ...
}
```

### PUT `/doctors/:id` 🔒
Modifier un médecin existant

**Body:** (tous les champs sont optionnels)
```json
{
  "phone": "0556789013",
  "email": "nouveau.email@chifak.dz"
}
```

**Response:**
```json
{
  "id": 3,
  "name": "Dr. Karim Mansouri",
  "phone": "0556789013",
  ...
}
```

### DELETE `/doctors/:id` 🔒
Supprimer un médecin

**Response:**
```json
{
  "message": "Médecin supprimé avec succès"
}
```

---

## 📅 Rendez-vous

### POST `/appointments`
Créer un rendez-vous

**Body:**
```json
{
  "doctorId": 1,
  "patientName": "Mohammed Salah",
  "patientEmail": "mohammed.salah@email.com",
  "patientPhone": "0661234567",
  "appointmentDate": "2026-01-20",
  "appointmentTime": "14:00",
  "reason": "Consultation générale"
}
```

**Champs requis:** doctorId, patientName, patientEmail, patientPhone, appointmentDate, appointmentTime  
**Champs optionnels:** reason

**Response:**
```json
{
  "id": 1,
  "doctor_id": 1,
  "patient_name": "Mohammed Salah",
  "patient_email": "mohammed.salah@email.com",
  "patient_phone": "0661234567",
  "appointment_date": "2026-01-20",
  "appointment_time": "14:00",
  "reason": "Consultation générale",
  "status": "confirmed",
  "created_at": "2026-01-15 11:00:00"
}
```

### GET `/appointments` 🔒
Récupérer tous les rendez-vous

**Response:**
```json
[
  {
    "id": 1,
    "doctor_id": 1,
    "doctor_name": "Dr. Ahmed Benali",
    "specialty": "Médecin généraliste",
    "address": "15 Rue Didouche Mourad",
    "city": "Sidi M'Hamed, Alger",
    "patient_name": "Mohammed Salah",
    "patient_email": "mohammed.salah@email.com",
    "patient_phone": "0661234567",
    "appointment_date": "2026-01-20",
    "appointment_time": "14:00",
    "reason": "Consultation générale",
    "status": "confirmed",
    "created_at": "2026-01-15 11:00:00"
  }
]
```

---

## 📊 Statistiques

### GET `/stats` 🔒
Récupérer les statistiques globales

**Response:**
```json
{
  "totalDoctors": 15,
  "totalAppointments": 234,
  "totalSpecialties": 8
}
```

---

## ⚠️ Codes d'erreur

| Code | Description |
|------|-------------|
| 200 | Succès |
| 201 | Créé avec succès |
| 400 | Requête invalide (champs manquants) |
| 401 | Non authentifié (token manquant) |
| 403 | Token invalide ou expiré |
| 404 | Ressource non trouvée |
| 500 | Erreur serveur |

---

## 📝 Exemples avec cURL

### Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"chifak2026"}'
```

### Récupérer les médecins
```bash
curl http://localhost:3001/api/doctors
```

### Ajouter un médecin
```bash
curl -X POST http://localhost:3001/api/doctors \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <votre_token>" \
  -d '{
    "name": "Dr. Test",
    "specialty": "Dentiste",
    "address": "123 Rue Test",
    "city": "Alger, Alger"
  }'
```

### Supprimer un médecin
```bash
curl -X DELETE http://localhost:3001/api/doctors/1 \
  -H "Authorization: Bearer <votre_token>"
```

---

## 🔄 Format des données

### Available Slots
Format: Array de strings au format "HH:MM"
```json
["08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"]
```

### Dates
Format: "YYYY-MM-DD"
Exemple: "2026-01-20"

### Heures
Format: "HH:MM"
Exemple: "14:00"

---

## 🛡️ Sécurité

- Les mots de passe sont hashés avec bcrypt (10 rounds)
- Les tokens JWT expirent après 24h
- CORS activé pour le développement local
- Les clés étrangères sont activées dans SQLite
