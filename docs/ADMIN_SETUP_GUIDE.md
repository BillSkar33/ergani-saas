# 🛠️ Οδηγός Εγκατάστασης & Διαχείρισης — Από το Μηδέν

> Αυτό το έγγραφο σας καθοδηγεί βήμα-βήμα στην πλήρη εγκατάσταση
> και ρύθμιση της πλατφόρμας Ψηφιακή Κάρτα Εργασίας.

---

## Πίνακας Περιεχομένων

1. [Προαπαιτούμενα](#1-προαπαιτούμενα)
2. [Εγκατάσταση Τοπικού Περιβάλλοντος](#2-εγκατάσταση-τοπικού-περιβάλλοντος)
3. [Ρύθμιση Βάσης Δεδομένων](#3-ρύθμιση-βάσης-δεδομένων)
4. [Ρύθμιση Telegram Bot](#4-ρύθμιση-telegram-bot)
5. [Ρύθμιση Viber Bot](#5-ρύθμιση-viber-bot)
6. [Ρύθμιση WhatsApp Business](#6-ρύθμιση-whatsapp-business)
7. [Ρύθμιση ΕΡΓΑΝΗ ΙΙ API](#7-ρύθμιση-εργανη-ιι-api)
8. [Ρύθμιση GitHub & CI/CD](#8-ρύθμιση-github--cicd)
9. [Καταχώρηση Εργοδότη](#9-καταχώρηση-εργοδότη)
10. [Καταχώρηση Παραρτήματος](#10-καταχώρηση-παραρτήματος)
11. [Καταχώρηση Εργαζομένου](#11-καταχώρηση-εργαζομένου)
12. [Εκκίνηση Υπηρεσιών](#12-εκκίνηση-υπηρεσιών)
13. [Κόστη & Χρεώσεις](#13-κόστη--χρεώσεις)
14. [Παραγωγική Λειτουργία (Production)](#14-παραγωγική-λειτουργία-production)
15. [Συχνά Προβλήματα (Troubleshooting)](#15-συχνά-προβλήματα-troubleshooting)

---

## 1. Προαπαιτούμενα

### Λογισμικό που χρειάζεστε

| Λογισμικό                                 | Ελάχιστη Έκδοση | Σκοπός                          |
| ----------------------------------------- | --------------- | ------------------------------- |
| **Node.js**                               | v20.0.0+        | Runtime εφαρμογής               |
| **npm**                                   | v10.0.0+        | Διαχείριση πακέτων              |
| **Docker**                                | v24.0+          | Τρέχει PostgreSQL, Redis, Kafka |
| **Docker Compose**                        | v2.20+          | Orchestration containers        |
| **Git**                                   | v2.40+          | Version control                 |
| **ngrok** (τοπικά) ή **VPS** (production) | Οποιαδήποτε     | Δημόσιο URL για webhooks        |

### Εγκατάσταση σε Ubuntu/Debian

```bash
# Node.js 20 (μέσω NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Docker
sudo apt-get install -y docker.io docker-compose-v2

# Git
sudo apt-get install -y git

# ngrok (για τοπικό testing)
curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok-v3-stable-linux-amd64.tgz | sudo tar xz -C /usr/local/bin
```

### Έλεγχος εγκατάστασης

```bash
node --version      # v20.x.x
npm --version       # 10.x.x
docker --version    # 24.x.x
git --version       # 2.x.x
```

---

## 2. Εγκατάσταση Τοπικού Περιβάλλοντος

### Βήμα 1: Κλωνοποίηση repository

```bash
git clone https://github.com/YOUR_ORG/ergani-saas.git
cd ergani-saas
```

### Βήμα 2: Εγκατάσταση dependencies

```bash
npm install
```

### Βήμα 3: Δημιουργία .env

```bash
cp .env.example .env
```

### Βήμα 4: Επεξεργασία .env

Ανοίξτε το `.env` με τον αγαπημένο σας editor:

```bash
nano .env
# ή
code .env
```

**Τα πεδία που ΠΡΕΠΕΙ να αλλάξετε αμέσως:**

```env
# Βάση Δεδομένων (αφήστε τα defaults για τοπικά)
DB_PASSWORD=ΒΑΛΤε_ΔΙΚΟ_ΣΑΣ_PASSWORD

# Κλειδί κρυπτογράφησης (32 bytes = 64 hex chars)
# ΚΡΙΣΙΜΟ: Χάσιμο αυτού = χάσιμο πρόσβασης σε ΕΡΓΑΝΗ credentials!
ENCRYPTION_KEY=ΒΑΛΤε_64_ΧΑΡΑΚΤΗΡΕΣ_ΣΕ_HEX

# ΕΡΓΑΝΗ API (ξεκινήστε με sandbox!)
ERGANI_API_URL=https://trialeservices.yeka.gr/WebServicesAPI/api
ERGANI_ENV=sandbox

# Webhook secrets (θα τα πάρετε στα βήματα 4-6)
TELEGRAM_BOT_TOKEN=θα_συμπληρωθεί
VIBER_AUTH_TOKEN=θα_συμπληρωθεί
WHATSAPP_ACCESS_TOKEN=θα_συμπληρωθεί
```

**Δημιουργία ENCRYPTION_KEY:**
```bash
# Τρέξτε αυτό στο terminal για ασφαλές κλειδί
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Βήμα 5: Εκκίνηση υποδομής Docker

```bash
docker compose up -d
```

Ελέγξτε ότι τρέχουν:
```bash
docker compose ps
# Πρέπει να δείτε: postgres, redis, kafka, zookeeper σε status "Up"
```

---

## 3. Ρύθμιση Βάσης Δεδομένων

### Εκτέλεση migration

```bash
npm run migrate
```

> Αυτό δημιουργεί όλους τους πίνακες (employers, branches, employees, time_stamps κλπ.)

### Επαλήθευση

```bash
# Σύνδεση στη βάση
docker exec -it ergani-postgres psql -U ergani_user -d ergani_db

# Εμφάνιση πινάκων
\dt

# Αναμενόμενο: employers, branches, employees, time_stamps,
# messenger_links, processed_messages, audit_log, fraud_alerts,
# employer_notification_settings

# Έξοδος
\q
```

---

## 4. Ρύθμιση Telegram Bot

### Βήμα 1: Δημιουργία Bot μέσω @BotFather

1. Ανοίξτε **Telegram** → αναζητήστε `@BotFather`
2. Στείλτε `/newbot`
3. Δώστε **όνομα** (π.χ. "Κάρτα Εργασίας")
4. Δώστε **username** (π.χ. `ergani_workcard_bot`) — πρέπει να τελειώνει σε `_bot`
5. Αντιγράψτε το **Bot Token** (π.χ. `7123456789:AAH7k...`)

### Βήμα 2: Ρύθμιση Secret Token

```
/setmenubutton   → ρυθμίστε menu button (προαιρετικά)
/setdescription  → "Ψηφιακή Κάρτα Εργασίας — Check-in/out μέσω GPS"
```

### Βήμα 3: Ενημέρωση .env

```env
TELEGRAM_BOT_TOKEN=7123456789:AAH7k...
TELEGRAM_SECRET_TOKEN=ΕΝΑ_ΤΥΧΑΙΟ_STRING_ΠΟΥ_ΦΤΙΑΧΝΕΤΕ_ΕΣΕΙΣ
```

Δημιουργήστε τυχαίο secret token:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Βήμα 4: Εγγραφή Webhook

Πρέπει να έχετε **δημόσιο HTTPS URL**. Τοπικά χρησιμοποιήστε ngrok:

```bash
# Terminal 1: Ξεκινήστε ngrok
ngrok http 3000

# Σημειώστε το HTTPS URL, π.χ. https://abc123.ngrok-free.app
```

Εγγραφή webhook στο Telegram:
```bash
curl -X POST "https://api.telegram.org/bot<ΤΟ_TOKEN_ΣΑΣ>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://abc123.ngrok-free.app/webhooks/telegram",
    "secret_token": "ΤΟ_SECRET_TOKEN_ΣΑΣ",
    "allowed_updates": ["message", "callback_query"]
  }'
```

Αναμενόμενη απάντηση: `{"ok":true,"result":true,"description":"Webhook was set"}`

### Κόστος Telegram
- ✅ **Δωρεάν** — δεν υπάρχει χρέωση για bot messages
- ✅ Χωρίς όρια αριθμού μηνυμάτων

---

## 5. Ρύθμιση Viber Bot

### Βήμα 1: Δημιουργία Viber Bot Account

1. Πηγαίνετε στο https://partners.viber.com/
2. Κάντε login με Viber account
3. Πατήστε **"Create Bot Account"**
4. Συμπληρώστε:
   - **Bot Name**: "Κάρτα Εργασίας"
   - **Category**: "Business"
   - **Description**: "Ψηφιακή κάρτα εργασίας — check-in/out"
   - **Logo**: Ανεβάστε εικονίδιο (720x720 px)
5. Αντιγράψτε το **Auth Token**

### Βήμα 2: Ενημέρωση .env

```env
VIBER_AUTH_TOKEN=4f...σας...token
```

### Βήμα 3: Εγγραφή Webhook

```bash
curl -X POST "https://chatapi.viber.com/pa/set_webhook" \
  -H "X-Viber-Auth-Token: <ΤΟ_AUTH_TOKEN_ΣΑΣ>" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://abc123.ngrok-free.app/webhooks/viber",
    "event_types": ["message", "subscribed", "unsubscribed", "conversation_started"],
    "send_name": true,
    "send_photo": false
  }'
```

### Κόστος Viber

> ⚠️ **Σημαντικό**: Από Μάιο 2024, τα Viber bots χρεώνονται!

| Τύπος                                                         | Χρέωση                     |
| ------------------------------------------------------------- | -------------------------- |
| **Session Messages** (εντός 24ωρου μετά αλληλεπίδραση χρήστη) | ~€0.01/μήνυμα              |
| **Initiated Messages** (εκτός 24ωρου)                         | ~€0.05-0.15/μήνυμα         |
| **Μηνιαία συνδρομή Viber Chatbot**                            | ~€100/μήνα (αναλόγως χώρα) |

> 💡 Για μικρές επιχειρήσεις ξεκινήστε μόνο με **Telegram** (δωρεάν).

---

## 6. Ρύθμιση WhatsApp Business

### Βήμα 1: Δημιουργία Meta Business Account

1. Πηγαίνετε στο https://business.facebook.com/
2. Δημιουργήστε Business Account (χρειάζεται ΑΦΜ επιχείρησης)
3. Πηγαίνετε στο https://developers.facebook.com/
4. Δημιουργήστε νέα εφαρμογή τύπου **"Business"**
5. Ενεργοποιήστε το **"WhatsApp Business"** product

### Βήμα 2: Ρύθμιση WhatsApp Business API

1. Στα **App Settings** → **WhatsApp** → **Getting Started**
2. Σημειώστε:
   - **Phone Number ID** (π.χ. `1234567890123456`)
   - **WhatsApp Business Account ID**
3. Δημιουργήστε **Permanent Access Token**:
   - **System User** → **Generate Token** → Permissions: `whatsapp_business_messaging`
4. Ρυθμίστε **webhook** URL και **Verify Token**

### Βήμα 3: Ενημέρωση .env

```env
WHATSAPP_ACCESS_TOKEN=EAAx...μεγάλο_token
WHATSAPP_APP_SECRET=abc123...
WHATSAPP_PHONE_NUMBER_ID=1234567890123456
WHATSAPP_VERIFY_TOKEN=ΕΝΑ_ΤΥΧΑΙΟ_STRING
```

### Βήμα 4: Ρύθμιση Webhook στη Meta

1. Στο Developer Dashboard → **Configuration** → **Webhook**
2. **Callback URL**: `https://abc123.ngrok-free.app/webhooks/whatsapp`
3. **Verify Token**: Ίδιο με `WHATSAPP_VERIFY_TOKEN` στο `.env`
4. **Subscribe Fields**: `messages`

### Κόστος WhatsApp

> ⚠️ **Πιο ακριβό από Telegram**, αλλά πιο διαδεδομένο στην Ελλάδα.

| Τύπος                                                          | Χρέωση (Ελλάδα)              |
| -------------------------------------------------------------- | ---------------------------- |
| **Service Conversations** (user-initiated, εντός 24ωρου)       | **Δωρεάν** (πρώτα 1000/μήνα) |
| **Utility Conversations** (business-initiated, π.χ. reminders) | ~€0.035/conversation         |
| **Marketing Conversations**                                    | ~€0.074/conversation         |
| **Authentication Conversations**                               | ~€0.032/conversation         |

> 💡 Τα check-in/check-out messages είναι εντός 24ωρου (user-initiated) → **δωρεάν** μέχρι 1000/μήνα.

---

## 7. Ρύθμιση ΕΡΓΑΝΗ ΙΙ API

### Sandbox (Δοκιμαστικό Περιβάλλον)

1. Πηγαίνετε στο https://trialeservices.yeka.gr
2. Δημιουργήστε λογαριασμό στο sandbox
3. Δημιουργήστε **Branch User** (χρήστης παραρτήματος)
4. Σημειώστε: **username** και **password**

### Ενημέρωση .env

```env
# Sandbox URL
ERGANI_API_URL=https://trialeservices.yeka.gr/WebServicesAPI/api
ERGANI_ENV=sandbox
```

### Production (Παραγωγικό Περιβάλλον)

```env
# Production URL
ERGANI_API_URL=https://eservices.yeka.gr/WebServicesAPI/api
ERGANI_ENV=production
```

> ⚠️ **ΜΕΤΑΒΑΊΝΕΤΕ σε production ΜΟΝΟ αφού ολοκληρωθεί το testing!**

> 📄 Δείτε τον ξεχωριστό οδηγό [SANDBOX_GUIDE.md](./SANDBOX_GUIDE.md) για πειραματικό testing.

---

## 8. Ρύθμιση GitHub & CI/CD

> 📄 **Αναλυτικός οδηγός**: Δείτε [GITHUB_SETUP_GUIDE.md](./GITHUB_SETUP_GUIDE.md)
> για πλήρεις οδηγίες (SSH keys, repo, secrets, branches, CI, deployment).

### Γρήγορη Εκκίνηση

```bash
# 1. Αρχικοποίηση
git init
git add .
git commit -m "🚀 initial: Ψηφιακή Κάρτα Εργασίας"

# 2. Δημιουργία Private repo στο https://github.com/new
# 3. Push
git remote add origin git@github.com:YOUR_USERNAME/ergani-saas.git
git branch -M main
git push -u origin main
```

### CI/CD (ήδη έτοιμο!)

Το `.github/workflows/ci.yml` τρέχει αυτόματα 45 tests σε κάθε push.

### Secrets (Settings → Secrets → Actions)

| Secret               | Σκοπός                    |
| -------------------- | ------------------------- |
| `DB_PASSWORD`        | Κωδικός PostgreSQL        |
| `ENCRYPTION_KEY`     | 64 hex chars — AES κλειδί |
| `TELEGRAM_BOT_TOKEN` | Bot token                 |
| `ERGANI_API_URL`     | Production URL            |

### Branch Protection (Settings → Branches)

- ☑️ Require pull request
- ☑️ Require status checks: "Unit Tests & Lint"

---

## 9. Καταχώρηση Εργοδότη

Χρησιμοποιήστε **SQL** (μελλοντικά: Employer Portal UI):

```sql
-- Σύνδεση στη βάση
docker exec -it ergani-postgres psql -U ergani_user -d ergani_db

-- Εισαγωγή νέου εργοδότη
INSERT INTO employers (
  afm_ergodoti,
  company_name,
  email,
  phone,
  subscription_plan,
  is_active
) VALUES (
  '123456789',                          -- ΑΦΜ εταιρείας (9 ψηφία)
  'ΚΕΝΤΡΙΚΗ ΚΑΦΕΤΕΡΙΑ ΑΕ',             -- Επωνυμία
  'info@kentrikikafeteria.gr',           -- Email
  '+302101234567',                       -- Τηλέφωνο
  'professional',                        -- Πλάνο: basic/professional/enterprise
  true                                   -- Ενεργός
);
```

---

## 10. Καταχώρηση Παραρτήματος

```sql
-- Πρώτα βρείτε το ID εργοδότη
SELECT id, company_name FROM employers;

-- Εισαγωγή παραρτήματος
INSERT INTO branches (
  employer_id,
  branch_number,
  branch_name,
  address,
  latitude,
  longitude,
  geofence_radius_meters,
  max_accuracy_meters,
  ergani_username_encrypted,
  ergani_password_encrypted,
  is_active
) VALUES (
  1,                                     -- employer_id (από παραπάνω)
  '0',                                   -- Αριθμός παραρτήματος στο ΕΡΓΑΝΗ (0 = κεντρικό)
  'Κεντρικό Κατάστημα',
  'Σταδίου 42, Αθήνα',

  -- GPS συντεταγμένες (βρείτε τες στo Google Maps)
  37.9755,                               -- Latitude
  23.7348,                               -- Longitude

  40,                                    -- Ακτίνα geofence σε μέτρα
  100,                                   -- Μέγιστη αποδεκτή GPS accuracy

  -- ΕΡΓΑΝΗ credentials (κρυπτογραφημένα)
  -- Χρησιμοποιήστε το script παρακάτω
  NULL,                                  -- θα ενημερωθεί
  NULL,                                  -- θα ενημερωθεί
  true
);
```

### Κρυπτογράφηση ΕΡΓΑΝΗ Credentials

```bash
# Εκτελέστε αυτό το script
node -e "
  require('dotenv').config();
  const { encrypt } = require('./shared/encryption');
  const username = 'YOUR_ERGANI_USERNAME';
  const password = 'YOUR_ERGANI_PASSWORD';
  console.log('Username (encrypted):', encrypt(username).toString('hex'));
  console.log('Password (encrypted):', encrypt(password).toString('hex'));
"
```

Ενημερώστε τη βάση:
```sql
UPDATE branches
SET ergani_username_encrypted = decode('HEX_OUTPUT_USERNAME', 'hex'),
    ergani_password_encrypted = decode('HEX_OUTPUT_PASSWORD', 'hex')
WHERE id = 1;
```

### Πώς βρίσκω τις GPS συντεταγμένες;

1. Ανοίξτε **Google Maps** → βρείτε το κατάστημα
2. **Δεξί κλικ** πάνω στο σημείο → αντιγράψτε τις συντεταγμένες
3. Format: `37.97550, 23.73480` → Latitude = 37.97550, Longitude = 23.73480

---

## 11. Καταχώρηση Εργαζομένου

### Βήμα 1: Εισαγωγή στη βάση

```sql
-- Εισαγωγή εργαζομένου
INSERT INTO employees (
  employer_id,
  branch_id,
  afm,
  eponymo,
  onoma,
  is_external_worker,
  is_active
) VALUES (
  1,                                    -- employer_id
  1,                                    -- branch_id (default)
  '987654321',                          -- ΑΦΜ εργαζομένου
  'ΠΑΠΑΔΟΠΟΥΛΟΣ',                       -- ΚΕΦΑΛΑΙΑ — πρέπει να ταιριάζει ΕΡΓΑΝΗ!
  'ΓΕΩΡΓΙΟΣ',                           -- ΚΕΦΑΛΑΙΑ
  false,                                -- true αν εξωτερικός (αγνοεί geofence)
  true
);
```

> ⚠️ **ΚΡΙΣΙΜΟ**: Τα `eponymo` και `onoma` ΠΡΕΠΕΙ να ταιριάζουν ΑΚΡΙΒΩΣ με αυτά
> που είναι καταχωρημένα στο σύστημα ΕΡΓΑΝΗ (ΚΕΦΑΛΑΙΑ, σωστοί τόνοι).

### Βήμα 2: Δημιουργία Κωδικού Σύνδεσης

Ο εργαζόμενος θα πληκτρολογήσει αυτόν τον 6ψήφιο κωδικό στο messenger bot:

```sql
UPDATE employees
SET linking_code = '549237',
    linking_code_expires_at = NOW() + INTERVAL '7 days'
WHERE afm = '987654321';
```

> Δώστε αυτόν τον κωδικό `549237` στον εργαζόμενο (SMS, email, ή αυτοπροσώπως).

### Βήμα 3: Τι κάνει ο εργαζόμενος

1. Ανοίγει **Telegram/Viber/WhatsApp**
2. Αναζητεί το bot (π.χ. `@ergani_workcard_bot`)
3. Πατάει **Start** (ή στέλνει `ΕΓΓΡΑΦΗ`)
4. Πληκτρολογεί τον κωδικό: `549237`
5. Λαμβάνει μήνυμα: *"✅ Καλωσόρισες, ΓΕΩΡΓΙΟΣ ΠΑΠΑΔΟΠΟΥΛΟΣ!"*
6. Στέλνει **τοποθεσία** → check-in!

---

## 12. Εκκίνηση Υπηρεσιών

### Τοπικά (Development)

```bash
# Terminal 1: Webhook Gateway (HTTP server)
node services/webhook-gateway/index.js

# Terminal 2: Message Processor (Kafka consumer)
node services/message-processor/index.js

# Terminal 3: Scheduler (CRON jobs)
node services/scheduler/index.js

# Terminal 4: ngrok (για webhooks — ΜΟΝΟ τοπικά)
ngrok http 3000
```

### Παραγωγή (Production — PM2)

```bash
# Εγκατάσταση PM2
npm install -g pm2

# Εκκίνηση όλων
pm2 start services/webhook-gateway/index.js --name "webhook-gateway"
pm2 start services/message-processor/index.js --name "message-processor"
pm2 start services/scheduler/index.js --name "scheduler"

# Εκκίνηση μαζί με το OS
pm2 startup
pm2 save

# Monitoring
pm2 monit
```

---

## 13. Κόστη & Χρεώσεις

### Υποδομή (Self-hosted VPS)

| Πόρος                              | Ελάχιστο               | Συνιστώμενο     | Κόστος/μήνα |
| ---------------------------------- | ---------------------- | --------------- | ----------- |
| **VPS** (DigitalOcean/Hetzner/OVH) | 2 vCPU, 4GB RAM        | 4 vCPU, 8GB RAM | €12-40      |
| **PostgreSQL** (managed ή Docker)  | 25GB                   | 50GB            | €0-15       |
| **Domain + SSL**                   | Let's Encrypt (δωρεάν) | —               | €0-12/χρόνο |

### Messenger Πλατφόρμες

| Πλατφόρμα    | Session Messages   | Initiated Messages | Μηνιαίο ελάχιστο |
| ------------ | ------------------ | ------------------ | ---------------- |
| **Telegram** | Δωρεάν ∞           | Δωρεάν ∞           | **€0**           |
| **Viber**    | ~€0.01/msg         | ~€0.05-0.15/msg    | ~€100+           |
| **WhatsApp** | Δωρεάν (1000/μήνα) | ~€0.035/conv       | **€0-35**        |

### ΕΡΓΑΝΗ API
- Το ΕΡΓΑΝΗ API είναι **δωρεάν** — παρέχεται από το Υπουργείο Εργασίας
- Δεν υπάρχει χρέωση ανά API call

### Συνολικό Κόστος (εκτίμηση)

| Σενάριο                                          | Μηνιαίο κόστος  |
| ------------------------------------------------ | --------------- |
| **Μικρή εταιρεία** (10 υπάλληλοι, μόνο Telegram) | ~€12/μήνα (VPS) |
| **Μεσαία** (50 υπάλληλοι, Telegram + WhatsApp)   | ~€25-50/μήνα    |
| **Μεγάλη** (200+ υπάλληλοι, 3 πλατφόρμες)        | ~€100-200/μήνα  |

---

## 14. Παραγωγική Λειτουργία (Production)

### Checklist πριν πάτε live

- [ ] ΕΡΓΑΝΗ production credentials δοκιμασμένα
- [ ] HTTPS (TLS 1.3) ρυθμισμένο σε reverse proxy (nginx)
- [ ] `.env` σε production mode (`NODE_ENV=production`)
- [ ] Webhook URLs ενημερωμένα (μη ngrok!)
- [ ] Ονόματα εργαζομένων ελεγμένα (ΑΚΡΙΒΩΣ σαν ΕΡΓΑΝΗ)
- [ ] GPS συντεταγμένες παραρτημάτων σωστές
- [ ] Geofence radius βεπαρδιασμένο (δοκιμάστε on-site)
- [ ] PM2 εγκατεστημένο και ρυθμισμένο
- [ ] Monitoring/alerting ενεργό (π.χ. UptimeRobot, Grafana)
- [ ] Backups PostgreSQL αυτοματοποιημένα
- [ ] Firewall ρυθμισμένο (μόνο ports 443, 22)

### Nginx Reverse Proxy

```nginx
server {
    listen 443 ssl;
    server_name api.yourdomain.gr;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.gr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.gr/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 15. Συχνά Προβλήματα (Troubleshooting)

| Πρόβλημα                     | Λύση                                                               |
| ---------------------------- | ------------------------------------------------------------------ |
| `ECONNREFUSED` PostgreSQL    | Ελέγξτε: `docker compose ps` — τρέχει το postgres container;       |
| `KafkaJSConnectionError`     | Ελέγξτε: τρέχει Kafka; `docker compose logs kafka`                 |
| Telegram webhook δεν δέχεται | Ελέγξτε: ngrok τρέχει; Secret token σωστό;                         |
| ΕΡΓΑΝΗ 401                   | Token expired — ελέγξτε credentials, δοκιμάστε manual authenticate |
| Geofence rejected πάντα      | GPS accuracy > threshold; ελέγξτε radius στη βάση                  |
| Ονόματα δεν ταιριάζουν       | ΕΡΓΑΝΗ απαιτεί ΑΚΡΙΒΩΣ ίδια ονόματα (ΚΕΦΑΛΑΙΑ, τόνοι)              |
| `ENCRYPTION_KEY` missing     | Ελέγξτε .env — πρέπει να είναι 64 hex chars                        |
| WhatsApp δεν στέλνει         | Ελέγξτε: Phone Number ID σωστό; Access Token valid;                |

---

*Τελευταία ενημέρωση: Φεβρουάριος 2026*
