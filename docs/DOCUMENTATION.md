# Ψηφιακή Κάρτα Εργασίας — SaaS Chatbot Platform

## Τεχνική Τεκμηρίωση

---

### 1. Επισκόπηση Συστήματος

Η πλατφόρμα **Ψηφιακή Κάρτα Εργασίας** είναι ένα SaaS σύστημα που επιτρέπει στους εργαζομένους να δηλώνουν έναρξη/λήξη βάρδιας μέσω messenger chatbots (Telegram, Viber, WhatsApp) με αυτόματη υποβολή στo **ΕΡΓΑΝΗ ΙΙ API**.

#### Κύριες Λειτουργίες
- **Check-in/Check-out** μέσω GPS location sharing
- **Geofencing** — Haversine algorithm με accuracy checks
- **Αυτόματη υποβολή κάρτας** (WRKCardSE) στο ΕΡΓΑΝΗ ΙΙ
- **Fraud detection** — GPS spoofing, impossible travel
- **Multi-platform** — Telegram, Viber, WhatsApp
- **GDPR Compliance** — GPS anonymization μετά 48 ώρες

---

### 2. Αρχιτεκτονική Συστήματος

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Messengers  │────>│  Webhook Gateway │────>│  Apache Kafka   │
│  (Viber/TG/  │     │  (Fastify HTTP)  │     │  (Message Queue)│
│   WhatsApp)  │     └──────────────────┘     └────────┬────────┘
└──────────────┘                                       │
                                                       ▼
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   ΕΡΓΑΝΗ ΙΙ  │<────│  ΕΡΓΑΝΗ Client   │<────│ Message         │
│   REST API   │     │  (Auth+Submit)   │     │ Processor       │
└──────────────┘     └──────────────────┘     │ (Kafka Consumer)│
                                              └─────────────────┘
                                                       │
                     ┌──────────────────┐              │
                     │  Notification    │<─────────────┘
                     │  Service         │
                     │  (TG/Viber/WA)   │
                     └──────────────────┘
```

#### Event Flow
1. Εργαζόμενος στέλνει τοποθεσία μέσω messenger
2. Webhook Gateway λαμβάνει, επαληθεύει υπογραφή, ελέγχει idempotency
3. Μήνυμα σπρώχνεται στο Kafka topic `incoming-messages`
4. Message Processor λαμβάνει, ελέγχει geofence, υποβάλλει στo ΕΡΓΑΝΗ
5. Notification Service στέλνει επιβεβαίωση στον εργαζόμενο

---

### 3. Δομή Project

```
ergani/
├── package.json                    # Dependencies & scripts
├── .env.example                    # Environment variables template
├── .gitignore                      # Εξαιρέσεις Git
├── docker-compose.yml              # PostgreSQL, Redis, Kafka
│
├── infrastructure/
│   └── migrations/
│       └── 001_initial.sql         # Database schema (9 πίνακες)
│
├── shared/                         # Κοινές βιβλιοθήκες
│   ├── config/index.js             # Κεντρικές ρυθμίσεις (env vars)
│   ├── encryption/index.js         # AES-256-GCM κρυπτογράφηση
│   ├── logger/index.js             # Structured JSON logging (pino)
│   ├── db/index.js                 # PostgreSQL connection pool
│   ├── redis/index.js              # Redis client (cache, sessions)
│   └── kafka/index.js              # Kafka producer & consumer
│
├── services/
│   ├── webhook-gateway/            # HTTP Webhook Server
│   │   ├── index.js                # Fastify server entry
│   │   ├── middleware/
│   │   │   ├── signature-verify.js # Crypto signature verification
│   │   │   └── idempotency.js      # Duplicate message prevention
│   │   └── routes/
│   │       ├── telegram.js         # Telegram webhook handler
│   │       ├── viber.js            # Viber webhook handler
│   │       └── whatsapp.js         # WhatsApp webhook handler
│   │
│   ├── message-processor/          # Kafka Consumer Workers
│   │   ├── index.js                # Consumer entry + message router
│   │   ├── handlers/
│   │   │   ├── check-in.handler.js   # Έναρξη βάρδιας
│   │   │   ├── check-out.handler.js  # Λήξη βάρδιας
│   │   │   ├── registration.handler.js # Εγγραφή εργαζομένου
│   │   │   ├── status.handler.js     # Κατάσταση / ιστορικό
│   │   │   └── unknown.handler.js    # Αγνώριστο μήνυμα
│   │   ├── geofencing/
│   │   │   ├── haversine.js        # Αλγόριθμος Haversine
│   │   │   └── validator.js        # Geofence validator
│   │   └── fraud/
│   │       └── detector.js         # Fraud detection engine
│   │
│   ├── ergani-client/              # ΕΡΓΑΝΗ ΙΙ API Client
│   │   ├── auth.js                 # JWT authentication + cache
│   │   ├── payload-builder.js      # WRKCardSE JSON builder
│   │   ├── work-card.js            # Submit + retry + DLQ
│   │   └── error-mapper.js         # Error → Greek messages
│   │
│   ├── notification-service/       # Αποστολή μηνυμάτων chatbot
│   │   ├── template-engine.js      # Message templates (Ελληνικά)
│   │   ├── telegram-sender.js      # Telegram Bot API sender
│   │   ├── viber-sender.js         # Viber Bot API sender
│   │   └── whatsapp-sender.js      # WhatsApp Cloud API sender
│   │
│   └── scheduler/                  # CRON Jobs
│       ├── index.js                # Scheduler entry (5 jobs)
│       ├── checkout-reminder.js    # Υπενθύμιση check-out (>8h)
│       ├── pending-retry.js        # Retry failed ΕΡΓΑΝΗ submissions
│       ├── gps-cleanup.js          # GDPR GPS anonymization (48h)
│       ├── jwt-refresh.js          # Proactive JWT refresh
│       └── daily-summary.js        # Ημερήσια σύνοψη εργοδότη
│
├── tests/
│   └── unit/
│       ├── haversine.test.js       # 9 tests
│       ├── payload-builder.test.js # 9 tests
│       ├── signature-verify.test.js # 7 tests
│       ├── error-mapper.test.js    # 7 tests
│       ├── encryption.test.js      # 6 tests
│       └── geofence-validator.test.js # 6 tests
│
├── .github/workflows/
│   └── ci.yml                      # GitHub Actions CI Pipeline
│
└── docs/
    └── DOCUMENTATION.md            # Αυτό το αρχείο
```

---

### 4. Βάση Δεδομένων (PostgreSQL 16)

#### Πίνακες

| Πίνακας | Περιγραφή | Σημαντικά πεδία |
|---------|-----------|-----------------|
| `employers` | Εργοδότες (εταιρείες) | afm_ergodoti, company_name, subscription |
| `branches` | Παραρτήματα (καταστήματα) | GPS, geofence_radius, ΕΡΓΑΝΗ credentials |
| `employees` | Εργαζόμενοι | ΑΦΜ, ονοματεπώνυμο, trust_score, linking_code |
| `messenger_links` | Σύνδεση messenger ↔ εργαζόμενος | platform, platform_user_id |
| `time_stamps` | Χρονοσημάνσεις (check-in/out) | GPS, geofence_status, ergani_status |
| `processed_messages` | Idempotency (αποτροπή duplicates) | message_id, platform |
| `audit_log` | Καταγραφή ενεργειών (5 χρόνια) | event_type, payload, response |
| `fraud_alerts` | Fraud detection alerts | alert_type, severity, details |
| `employer_notification_settings` | Ρυθμίσεις ειδοποιήσεων | notify_on_* flags |

---

### 5. Ασφάλεια

| Μηχανισμός | Περιγραφή |
|------------|-----------|
| **Webhook Signatures** | HMAC-SHA256 (Viber), Secret Token (Telegram), SHA256 (WhatsApp) |
| **Encryption at Rest** | AES-256-GCM για ΕΡΓΑΝΗ credentials |
| **JWT Management** | Redis cache, proactive refresh, auto-invalidation σε 401 |
| **GDPR GPS** | Anonymization μετά 48 ώρες (latitude/longitude → NULL) |
| **Idempotency** | DB-based (ON CONFLICT DO NOTHING) κατά webhook retries |
| **Fraud Detection** | Impossible travel, zero accuracy, exact coordinates |
| **Timing-Safe** | crypto.timingSafeEqual σε signature verification |

---

### 6. Εγκατάσταση & Εκτέλεση

```bash
# 1. Κλωνοποίηση
git clone <repository> && cd ergani

# 2. Εγκατάσταση dependencies
npm install

# 3. Ρύθμιση environment variables
cp .env.example .env
# Επεξεργασία .env με τις σωστές τιμές

# 4. Εκκίνηση υποδομής (Docker)
docker-compose up -d

# 5. Εκτέλεση migration
npm run migrate

# 6. Εκτέλεση tests
npm test

# 7. Εκκίνηση services
node services/webhook-gateway/index.js    # HTTP Server
node services/message-processor/index.js  # Kafka Consumer
node services/scheduler/index.js          # CRON Jobs
```

---

### 7. Testing

#### Unit Tests (Jest)

| Test Suite | Αρχείο | Tests |
|-----------|--------|-------|
| Haversine Distance | `haversine.test.js` | 9 |
| Payload Builder | `payload-builder.test.js` | 9 |
| Signature Verify | `signature-verify.test.js` | 7 |
| Error Mapper | `error-mapper.test.js` | 7 |
| Encryption | `encryption.test.js` | 6 |
| Geofence Validator | `geofence-validator.test.js` | 6 |
| **Σύνολο** | | **44** |

```bash
npm test                    # Εκτέλεση tests
npm test -- --coverage      # Με code coverage
```

---

### 8. Scheduled Jobs (CRON)

| Job | Χρονισμός | Περιγραφή |
|-----|-----------|-----------|
| Checkout Reminder | `*/5 * * * *` (κάθε 5 λεπτά) | Υπενθύμιση σε εργαζόμενους με ανοιχτή βάρδια > 8 ώρες |
| Pending Retry | `*/2 * * * *` (κάθε 2 λεπτά) | Retry αποτυχημένων υποβολών ΕΡΓΑΝΗ |
| GPS Cleanup (GDPR) | `0 * * * *` (κάθε ώρα) | Διαγραφή GPS δεδομένων μετά 48 ώρες |
| JWT Refresh | `*/10 * * * *` (κάθε 10 λεπτά) | Proactive ανανέωση JWT tokens |
| Daily Summary | `0 23 * * *` (23:00 Athens) | Ημερήσια σύνοψη βαρδιών ανά εργοδότη |

---

### 9. API Endpoints

| Method | Endpoint | Περιγραφή |
|--------|----------|-----------|
| GET | `/health` | Health check |
| GET | `/ready` | Readiness probe |
| POST | `/webhooks/telegram` | Telegram webhook |
| POST | `/webhooks/viber` | Viber webhook |
| GET/POST | `/webhooks/whatsapp` | WhatsApp webhook (GET=verify, POST=events) |

---

### 10. Μηνύματα Chatbot (Ελληνικά)

Όλα τα μηνύματα στον εργαζόμενο είναι στα **Ελληνικά**, ορισμένα με emoji:

- ✅ Επιτυχία check-in/out
- ⏳ Αναμονή επιβεβαίωσης ΕΡΓΑΝΗ
- 📍 Εκτός geofence (με απόσταση)
- 📡 Χαμηλή ακρίβεια GPS
- ⚠️ Σφάλμα / μη εγγεγραμμένος
- 📖 Οδηγίες χρήσης / βοήθεια
- 📊 Κατάσταση βάρδιας
- 📋 Ιστορικό βαρδιών

---

### 11. Τεχνολογίες

| Τεχνολογία | Χρήση |
|-----------|--------|
| **Node.js 20+** | Runtime |
| **Fastify** | HTTP Server (Webhook Gateway) |
| **PostgreSQL 16** | Database |
| **Redis 7** | JWT cache, rate limiting |
| **Apache Kafka** | Message queue (event-driven) |
| **pino** | JSON structured logging |
| **luxon** | Timezone-safe datetime (EET/EEST) |
| **KafkaJS** | Kafka client |
| **ioredis** | Redis client |
| **axios** | HTTP client (ΕΡΓΑΝΗ API, messenger APIs) |
| **Jest** | Unit testing framework |
| **node-cron** | Scheduled jobs |

---

### 12. Σημαντικές Σημειώσεις

> ⚠️ **Timezone**: Πάντα χρήση `Europe/Athens` (EET +02:00 / EEST +03:00). Ποτέ UTC!

> ⚠️ **Night Shifts**: Η `reference_date` πρέπει πάντα να αντιστοιχεί στην ημερομηνία ΕΝΑΡΞΗΣ βάρδιας, ακόμα κι αν το check-out γίνει μετά μεσάνυχτα.

> ⚠️ **Ελληνικά Ονόματα**: Τα `f_eponymo` και `f_onoma` πρέπει να ταιριάζουν ΑΚΡΙΒΩΣ με το μητρώο ΕΡΓΑΝΗ (ΚΕΦΑΛΑΙΑ).

> ⚠️ **WhatsApp Retries**: Το WhatsApp κάνει retries μέχρι 7 ημέρες αν δεν λάβει 200 OK. Η idempotency είναι κρίσιμη!

---

*Τελευταία ενημέρωση: Φεβρουάριος 2026*
