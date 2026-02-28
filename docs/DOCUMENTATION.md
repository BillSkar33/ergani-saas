# Ψηφιακή Κάρτα Εργασίας — SaaS Chatbot Platform

## Τεχνική Τεκμηρίωση (v2.0)

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
- **Admin Dashboard** — Γραφικό περιβάλλον εργοδότη (SPA)
- **Super Admin Panel** — Διαχείριση SaaS (trials, πλάνα)
- **Trial System** — Δοκιμαστικές περίοδοι + subscription πλάνα

---

### 2. Αρχιτεκτονική Συστήματος

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Messengers  │────>│  Webhook Gateway │────>│  Apache Kafka   │
│  (Viber/TG/  │     │  (Fastify HTTP)  │     │  (Message Queue)│
│   WhatsApp)  │     │  🔒 CORS+Helmet  │     └────────┬────────┘
└──────────────┘     └──────────────────┘              │
                            │                           ▼
                     ┌──────┴──────┐           ┌─────────────────┐
                     │ Admin API   │           │ Message         │
                     │ /api/admin  │           │ Processor       │
                     │ Super Admin │           │ (Kafka Consumer)│
                     │ /api/super  │           └─────────────────┘
                     └─────────────┘                    │
                                               ┌───────┴─────────┐
                                               │  ΕΡΓΑΝΗ Client  │
                                               │  + Notification │
                                               └─────────────────┘
```

---

### 3. Δομή Project

```
ergani/
├── package.json
├── .env.example
├── .gitignore
├── docker-compose.yml              🔒 Hardened (127.0.0.1 binds, Redis password)
│
├── scripts/                        📜 Automation (11 scripts)
│   ├── first-setup.sh
│   ├── start.sh / stop.sh / restart.sh / status.sh
│   ├── db-setup.sh / backup.sh
│   ├── git-push.sh / test.sh / logs.sh / help.sh
│
├── infrastructure/
│   ├── migrations/
│   │   ├── 001_initial.sql         DB schema (9 πίνακες)
│   │   └── 002_trial_system.sql    Trial system (plans, super_admins)
│   ├── seeds/demo_data.sql
│   └── nginx/ergani.conf           🔒 Production nginx config
│
├── shared/
│   ├── config/index.js
│   ├── encryption/index.js         AES-256-GCM
│   ├── logger/index.js             Pino structured JSON
│   ├── db/index.js                 PostgreSQL pool
│   ├── redis/index.js              Redis client
│   ├── kafka/index.js              Kafka producer/consumer
│   └── security/                   🔒 Security modules
│       ├── sanitize.js             XSS/SQL/Password validation
│       ├── rate-limiter.js         Redis per-endpoint limiter
│       ├── account-lockout.js      5-fail → 15min lockout
│       ├── jwt-blacklist.js        Logout + password invalidation
│       ├── audit-logger.js         Enhanced audit trail
│       ├── trial-guard.js          Trial/subscription limits
│       └── index.js                Barrel export
│
├── services/
│   ├── webhook-gateway/            HTTP Server (🔒 CORS+Helmet)
│   ├── admin-api/                  REST API εργοδοτών
│   │   ├── middleware/auth.js      🔒 JWT + lockout + blacklist
│   │   └── routes/ (auth, dashboard, employees, resources)
│   ├── super-admin-api/            SaaS owner management
│   │   └── index.js                Stats, Employers, Trials, Plans
│   ├── message-processor/          Kafka Consumer Workers
│   ├── ergani-client/              ΕΡΓΑΝΗ ΙΙ API Client
│   ├── notification-service/       Chatbot message sender
│   └── scheduler/                  CRON Jobs (5 jobs)
│
├── dashboard/
│   ├── index.html                  Employer Admin Dashboard (SPA)
│   ├── super.html                  Super Admin Panel (SPA)
│   ├── css/style.css               Premium dark theme
│   └── js/ (api.js, pages.js, app.js)
│
├── tests/unit/                     45 unit tests (Jest)
├── .github/workflows/ci.yml       CI + 🔒 Security scan
│
└── docs/                           📖 Τεκμηρίωση
    ├── DOCUMENTATION.md            Αυτό το αρχείο
    ├── ADMIN_SETUP_GUIDE.md
    ├── SANDBOX_GUIDE.md
    ├── GITHUB_SETUP_GUIDE.md
    ├── DASHBOARD_GUIDE.md
    ├── SCRIPTS_GUIDE.md
    ├── SECURITY_PLANNER.md
    ├── SECURITY_REPORT.md
    └── CHEATSHEET.md
```

---

### 4. Βάση Δεδομένων (PostgreSQL 16)

| Πίνακας                          | Περιγραφή                                             |
| -------------------------------- | ----------------------------------------------------- |
| `employers`                      | Εργοδότες + trial_status, max_employees, max_branches |
| `branches`                       | Παραρτήματα (GPS, geofence, ΕΡΓΑΝΗ credentials)       |
| `employees`                      | Εργαζόμενοι (ΑΦΜ, linking_code)                       |
| `messenger_links`                | Σύνδεση messenger ↔ εργαζόμενος                       |
| `time_stamps`                    | Χρονοσημάνσεις (check-in/out, GPS, status)            |
| `processed_messages`             | Idempotency (duplicate prevention)                    |
| `audit_log`                      | Audit trail (5 χρόνια, PII redacted)                  |
| `fraud_alerts`                   | GPS spoofing, impossible travel                       |
| `employer_notification_settings` | Notification preferences                              |
| `subscription_plans`             | Trial/Basic/Pro/Enterprise (limits)                   |
| `super_admins`                   | SaaS owner accounts                                   |

---

### 5. Ασφάλεια 🔒

| Μηχανισμός             | Λεπτομέρειες                                        |
| ---------------------- | --------------------------------------------------- |
| **CORS**               | Environment-aware (`CORS_ALLOWED_ORIGINS`)          |
| **Helmet**             | CSP, HSTS, X-Frame-Options, XSS, noSniff            |
| **Webhook Signatures** | HMAC-SHA256 (Viber), Secret Token (TG), SHA256 (WA) |
| **Encryption at Rest** | AES-256-GCM για ΕΡΓΑΝΗ credentials                  |
| **JWT Auth**           | HMAC-SHA256, timing-safe verify, 8h expiry          |
| **JWT Blacklist**      | Redis — logout + password change invalidation       |
| **Account Lockout**    | 5 αποτυχίες → 15 λεπτά lockout                      |
| **Password Policy**    | 8+ chars, uppercase, number, special char           |
| **Rate Limiting**      | Redis — auth: 5/min, api: 60/min, export: 5/min     |
| **Input Sanitization** | XSS entity encoding, SQL pattern stripping          |
| **Audit Trail**        | Auto-log POST/PUT/DELETE, PII redaction             |
| **Trial Guard**        | Auto-expire, blocks mutating ops, limit enforcement |
| **GDPR GPS**           | Anonymization μετά 48 ώρες                          |
| **Fraud Detection**    | Impossible travel, zero accuracy, exact coords      |
| **Docker Hardening**   | 127.0.0.1 binds, Redis password, memory limits      |
| **CI Security**        | npm audit, .env leak check, secrets search          |
| **Error Handler**      | No stack traces in production                       |
| **Nginx Template**     | HTTPS/TLS, per-endpoint rate limiting               |

---

### 6. Trial/Subscription System

#### Πλάνα

| Πλάνο               | Εργαζόμενοι | Παραρτήματα | Τιμή            |
| ------------------- | ----------- | ----------- | --------------- |
| Trial (δοκιμαστικό) | 5           | 1           | Δωρεάν (14 ημ.) |
| Basic               | 10          | 2           | €9.90/μήνα      |
| Pro                 | 50          | 5           | €29.90/μήνα     |
| Enterprise          | 500         | 50          | €79.90/μήνα     |

#### Status

| Status      | Σημασία                          |
| ----------- | -------------------------------- |
| `trial`     | Δοκιμαστική περίοδος (countdown) |
| `active`    | Πληρωμένο — χωρίς λήξη           |
| `expired`   | Trial λήξη — read-only           |
| `suspended` | Αναστολή — read-only             |

#### Super Admin Panel: `/admin/super.html`
- Dashboard: 8 stats cards
- Employers: λίστα + filters + trial actions
- Plans: overview + edit

---

### 7. API Endpoints

#### Webhook Gateway

| Method   | Endpoint             | Περιγραφή        |
| -------- | -------------------- | ---------------- |
| GET      | `/health`            | Health check     |
| POST     | `/webhooks/telegram` | Telegram webhook |
| POST     | `/webhooks/viber`    | Viber webhook    |
| GET/POST | `/webhooks/whatsapp` | WhatsApp webhook |

#### Admin API (εργοδότης)

| Method           | Endpoint                          | Auth |
| ---------------- | --------------------------------- | ---- |
| POST             | `/api/admin/auth/login`           | —    |
| POST             | `/api/admin/auth/register`        | —    |
| POST             | `/api/admin/auth/logout`          | JWT  |
| PUT              | `/api/admin/auth/change-password` | JWT  |
| GET              | `/api/admin/dashboard/stats`      | JWT  |
| GET/POST/PUT/DEL | `/api/admin/employees`            | JWT  |
| GET/POST/PUT     | `/api/admin/branches`             | JWT  |
| GET              | `/api/admin/timestamps`           | JWT  |
| GET              | `/api/admin/fraud-alerts`         | JWT  |
| GET/PUT          | `/api/admin/settings`             | JWT  |

#### Super Admin API (SaaS owner)

| Method  | Endpoint                         | Auth         |
| ------- | -------------------------------- | ------------ |
| POST    | `/api/super/auth/login`          | —            |
| POST    | `/api/super/auth/setup`          | — (μία φορά) |
| GET     | `/api/super/stats`               | Super JWT    |
| GET     | `/api/super/employers`           | Super JWT    |
| PUT     | `/api/super/employers/:id/trial` | Super JWT    |
| GET/PUT | `/api/super/plans`               | Super JWT    |

---

### 8. Εγκατάσταση

```bash
# Ολοκληρωμένη (πρώτη φορά)
./scripts/first-setup.sh

# Ή χειροκίνητα
npm install
cp .env.example .env
docker compose up -d
npm run migrate
npm run migrate:trial
npm run seed
./scripts/start.sh
```

---

### 9. Tests

| Suite              | Tests  |
| ------------------ | ------ |
| Haversine Distance | 9      |
| Payload Builder    | 9      |
| Signature Verify   | 7      |
| Error Mapper       | 7      |
| Encryption         | 6      |
| Geofence Validator | 7      |
| **Σύνολο**         | **45** |

```bash
./scripts/test.sh            # 45 tests
./scripts/test.sh --coverage # + coverage report
```

---

### 10. Τεχνολογίες

| Τεχνολογία          | Χρήση                                        |
| ------------------- | -------------------------------------------- |
| **Node.js 20+**     | Runtime                                      |
| **Fastify**         | HTTP Server                                  |
| **PostgreSQL 16**   | Database                                     |
| **Redis 7**         | Cache, rate limiting, lockout, JWT blacklist |
| **Apache Kafka**    | Message queue                                |
| **bcryptjs**        | Password hashing                             |
| **@fastify/cors**   | CORS protection                              |
| **@fastify/helmet** | Security headers                             |
| **@fastify/static** | Static file serving                          |
| **pino**            | JSON structured logging                      |
| **luxon**           | Timezone-safe datetime                       |
| **Jest**            | Unit testing                                 |

---

### 11. Documentation

| Αρχείο                  | Περιεχόμενο                            |
| ----------------------- | -------------------------------------- |
| `ADMIN_SETUP_GUIDE.md`  | Πλήρης οδηγός εγκατάστασης             |
| `SANDBOX_GUIDE.md`      | Πειραματικό testing                    |
| `GITHUB_SETUP_GUIDE.md` | Git/CI/CD ρύθμιση                      |
| `DASHBOARD_GUIDE.md`    | Οδηγός Admin Dashboard + API reference |
| `SCRIPTS_GUIDE.md`      | Οδηγός 11 scripts                      |
| `SECURITY_PLANNER.md`   | Security audit plan + OWASP            |
| `SECURITY_REPORT.md`    | Αναφορά υλοποίησης ασφάλειας           |
| `CHEATSHEET.md`         | Γρήγορη αναφορά εντολών                |

---

*Τελευταία ενημέρωση: 28 Φεβρουαρίου 2026 — v2.0*
