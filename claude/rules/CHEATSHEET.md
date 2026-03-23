# ⚡ Γρήγορη Αναφορά — Cheatsheet

> Όλες οι βασικές εντολές σε μία σελίδα.

---

## Εντολές Εκκίνησης

```bash
docker compose up -d                           # Εκκίνηση Docker (PG, Redis, Kafka)
docker compose down                            # Σταμάτημα Docker
docker compose down -v                         # Σταμάτημα + ΔΙΑΓΡΑΦΗ δεδομένων

npm run migrate                                # Δημιουργία πινάκων βάσης
npm run seed                                   # Φόρτωση demo δεδομένων
npm test                                       # Εκτέλεση 45 unit tests

node services/webhook-gateway/index.js         # HTTP Server (port 3000)
node services/message-processor/index.js       # Kafka Consumer
node services/scheduler/index.js               # CRON Jobs
```

---

## Demo Linking Codes

| Κωδικός | Εργαζόμενος | Τύπος | Παράρτημα |
|---------|-------------|-------|-----------|
| `123456` | ΧΡΗΣΤΗΣ ΔΟΚΙΜΑΣΤΙΚΟΣ | Κανονικός | Σύνταγμα |
| `654321` | ΕΡΓΑΖΟΜΕΝΟΣ ΕΞΩΤΕΡΙΚΟΣ | Εξωτερικός (bypass geofence) | Σύνταγμα |
| `789012` | ΕΡΓΑΤΗΣ ΜΟΝΑΣΤΗΡΑΚΙΩΤΗΣ | Κανονικός | Μοναστηράκι |

---

## Demo GPS Συντεταγμένες

| Τοποθεσία | Latitude | Longitude | Αποτέλεσμα |
|-----------|----------|-----------|------------|
| Σύνταγμα (κατ/μα) | 37.9755 | 23.7348 | — |
| Κοντά (10m) | 37.97555 | 23.73485 | ✅ APPROVED |
| Μακριά (500m) | 37.9800 | 23.7400 | ❌ REJECTED |
| Μοναστηράκι (κατ/μα) | 37.9765 | 23.7257 | — |

---

## Webhook Endpoints

| Method | URL | Πλατφόρμα |
|--------|-----|-----------|
| GET | `/health` | Health check |
| POST | `/webhooks/telegram` | Telegram |
| POST | `/webhooks/viber` | Viber |
| GET/POST | `/webhooks/whatsapp` | WhatsApp |

---

## Εντολές Chatbot (Εργαζόμενος)

| Εντολή | Λειτουργία |
|--------|------------|
| `/start` ή `ΕΓΓΡΑΦΗ` | Εγγραφή |
| 6ψήφιος κωδικός (π.χ. `123456`) | Σύνδεση λογαριασμού |
| 📍 Τοποθεσία | Check-in ή Check-out |
| `ΚΑΤΑΣΤΑΣΗ` | Τρέχουσα βάρδια |
| `ΙΣΤΟΡΙΚΟ` | Τελευταίες βάρδιες |
| `ΒΟΗΘΕΙΑ` | Οδηγίες |

---

## .env Βασικά Πεδία

```env
ENCRYPTION_KEY=<64 hex chars>              # node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ERGANI_API_URL=https://trialeservices.yeka.gr/WebServicesAPI/api   # Sandbox
TELEGRAM_BOT_TOKEN=<from @BotFather>
TELEGRAM_SECRET_TOKEN=<random string>
```

---

## SQL Γρήγορα

```sql
-- Σύνδεση
docker exec -it ergani-postgres psql -U ergani_user -d ergani_db

-- Τελευταία check-ins
SELECT e.onoma, e.eponymo, ts.event_timestamp, ts.geofence_status, ts.ergani_status
FROM time_stamps ts JOIN employees e ON ts.employee_id = e.id
ORDER BY ts.created_at DESC LIMIT 10;

-- Ενεργοί εργαζόμενοι
SELECT onoma, eponymo, afm, linking_code FROM employees WHERE is_active = true;

-- Fraud alerts
SELECT * FROM fraud_alerts ORDER BY created_at DESC LIMIT 5;
```
