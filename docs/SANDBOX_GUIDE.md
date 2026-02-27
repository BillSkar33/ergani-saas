# 🧪 Οδηγός Πειραματικής Λειτουργίας (Sandbox / Demo)

> Πώς να τρέξετε την πλατφόρμα τοπικά **χωρίς πραγματικά δεδομένα**,
> χωρίς πραγματικούς εργαζομένους, και χρησιμοποιώντας τo **sandbox ΕΡΓΑΝΗ**.

---

## Πίνακας Περιεχομένων

1. [Γενική Επισκόπηση](#1-γενική-επισκόπηση)
2. [Γρήγορη Εκκίνηση σε 5 Λεπτά](#2-γρήγορη-εκκίνηση-σε-5-λεπτά)
3. [Sandbox ΕΡΓΑΝΗ ΙΙ](#3-sandbox-εργανη-ιι)
4. [Δοκιμαστικά Δεδομένα (Seed Data)](#4-δοκιμαστικά-δεδομένα-seed-data)
5. [Δοκιμή με Telegram Bot (Πιο εύκολο)](#5-δοκιμή-με-telegram-bot-πιο-εύκολο)
6. [Δοκιμή χωρίς Messenger (HTTP Manual)](#6-δοκιμή-χωρίς-messenger-http-manual)
7. [Δοκιμή Geofencing (Χωρίς μετακίνηση!)](#7-δοκιμή-geofencing-χωρίς-μετακίνηση)
8. [Unit Tests (Χωρίς servers)](#8-unit-tests-χωρίς-servers)
9. [Σενάρια Demo (End-to-End)](#9-σενάρια-demo-end-to-end)
10. [Συχνές Ερωτήσεις Testing](#10-συχνές-ερωτήσεις-testing)

---

## 1. Γενική Επισκόπηση

Η πλατφόρμα μπορεί να τρέξει σε **3 επίπεδα δοκιμής**:

| Επίπεδο           | Χρειάζεται Internet | ΕΡΓΑΝΗ    | Messenger  | Σκοπός                         |
| ----------------- | ------------------- | --------- | ---------- | ------------------------------ |
| **Unit Tests**    | ❌                   | ❌         | ❌          | Αυτόματη επαλήθευση αλγορίθμων |
| **Local Sandbox** | ✅ (μόνο ngrok)      | ✅ Sandbox | ✅ Telegram | End-to-end testing τοπικά      |
| **Staging**       | ✅                   | ✅ Sandbox | ✅ Telegram | Pre-production testing σε VPS  |

---

## 2. Γρήγορη Εκκίνηση σε 5 Λεπτά

```bash
# 1. Εγκατάσταση
git clone <repo> && cd ergani-saas
npm install

# 2. Ρύθμιση environment
cp .env.example .env
# Επεξεργασία: βάλτε ENCRYPTION_KEY (βλ. παρακάτω)

# 3. Docker (PostgreSQL, Redis, Kafka)
docker compose up -d

# 4. Database migration
npm run migrate

# 5. Δοκιμαστικά δεδομένα
npm run seed

# 6. Unit tests
npm test

# Αν βλέπετε "45 passed" → όλα OK!
```

---

## 3. Sandbox ΕΡΓΑΝΗ ΙΙ

### Τι είναι;

Το Υπουργείο Εργασίας παρέχει **sandbox (δοκιμαστικό) περιβάλλον** για τo ΕΡΓΑΝΗ API:

- **URL**: `https://trialeservices.yeka.gr/WebServicesAPI/api`
- **Σκοπός**: Δοκιμή χωρίς πραγματικά δεδομένα
- **Κόστος**: Δωρεάν
- **Δεδομένα**: Δεν υποβάλλονται πραγματικές κάρτες εργασίας

### Βήμα 1: Εγγραφή στο Sandbox

1. Πηγαίνετε στο **https://trialeservices.yeka.gr**
2. Κάντε εγγραφή ως εργοδότης
3. Δημιουργήστε **Branch User** (χρήστης παραρτήματος):
   - Username: π.χ. `test_branch_user`
   - Password: π.χ. `TestPass123!`
4. Δημιουργήστε **δοκιμαστικό εργαζόμενο** στο sandbox
   - ΑΦΜ: Χρησιμοποιήστε δοκιμαστικό ΑΦΜ (π.χ. `000000000`)
   - Ονοματεπώνυμο: `ΔΟΚΙΜΑΣΤΙΚΟΣ ΧΡΗΣΤΗΣ`

### Βήμα 2: Ρύθμιση .env

```env
# ΣΗΜΑΝΤΙΚΟ: Πάντα sandbox κατά τη δοκιμή!
ERGANI_API_URL=https://trialeservices.yeka.gr/WebServicesAPI/api
ERGANI_ENV=sandbox

# Πλήρες timeout — sandbox μπορεί να αργεί
ERGANI_TIMEOUT_MS=30000

# Ελάχιστα retries — δεν χρειάζονται σε testing
ERGANI_MAX_RETRIES=1
```

### Βήμα 3: Δοκιμή Authentication

```bash
# Δοκιμή σύνδεσης στο ΕΡΓΑΝΗ sandbox
curl -X POST "https://trialeservices.yeka.gr/WebServicesAPI/api/authenticate" \
  -H "Content-Type: application/json" \
  -d '{
    "Username": "test_branch_user",
    "Password": "TestPass123!"
  }'

# Αναμενόμενη απάντηση: JWT access token
# {"accessToken":"eyJhbG...","expiresIn":3600}
```

### Τι δεδομένα δέχεται το Sandbox;

| Πεδίο              | Sandbox Τιμή                  | Σημείωση                 |
| ------------------ | ----------------------------- | ------------------------ |
| `f_afm_ergodoti`   | `000000000` ή δοκιμαστικό ΑΦΜ | Δεν ελέγχεται            |
| `f_afm` (employee) | `111111111`                   | Δεν ελέγχεται            |
| `f_eponymo`        | `ΔΟΚΙΜΑΣΤΙΚΟΣ`                | Δεν χρειάζεται ταίριασμα |
| `f_onoma`          | `ΧΡΗΣΤΗΣ`                     | Δεν χρειάζεται ταίριασμα |
| `f_type`           | `0` ή `1`                     | Ίδιο με production       |
| `f_date`           | Πραγματική ημερομηνία         | Πρέπει ISO 8601 + offset |

> ⚠️ Τα δοκιμαστικά ΑΦΜ **δεν υπάρχουν στο πραγματικό ΕΡΓΑΝΗ** — γι' αυτό
> χρησιμοποιούμε sandbox. Εκεί δεν ελέγχονται αυστηρά.

---

## 4. Δοκιμαστικά Δεδομένα (Seed Data)

Δημιουργήστε δοκιμαστικά δεδομένα αυτόματα:

```bash
# Εκτέλεση script δοκιμαστικών δεδομένων
# (θα δημιουργήσει εργοδότη, παράρτημα, εργαζομένους)
psql -h localhost -U ergani_user -d ergani_db -f infrastructure/seeds/demo_data.sql
```

> 📝 Ο σωστός φάκελος: `infrastructure/seeds/demo_data.sql`  
> Δημιουργείται αυτόματα (βλ. παρακάτω).

---

## 5. Δοκιμή με Telegram Bot (Πιο εύκολο)

### Γιατί Telegram;
- **Δωρεάν 100%** — καμία χρέωση
- **5 λεπτά setup** — δημιουργείτε bot σε δευτερόλεπτα
- **Location sharing** — built-in στο Telegram

### Βήματα:

#### 1. Δημιουργία Test Bot

```
Telegram → @BotFather → /newbot
Όνομα: TestΚάρτα
Username: test_karta_ergasias_bot
→ Κρατήστε το Token
```

#### 2. Ρύθμιση .env

```env
TELEGRAM_BOT_TOKEN=<το_token_που_πήρατε>
TELEGRAM_SECRET_TOKEN=test_secret_123
```

#### 3. ngrok (Δημόσιο URL)

```bash
# Terminal 1
ngrok http 3000
# Output: https://abc123.ngrok-free.app
```

#### 4. Webhook

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://abc123.ngrok-free.app/webhooks/telegram",
    "secret_token": "test_secret_123"
  }'
```

#### 5. Εκκίνηση Services

```bash
# Terminal 2
node services/webhook-gateway/index.js

# Terminal 3
node services/message-processor/index.js
```

#### 6. Δοκιμή!

1. Ανοίξτε Telegram → βρείτε `@test_karta_ergasias_bot`
2. Πατήστε **Start**
3. Πληκτρολογήστε: `123456` (ο linking code από demo data)
4. Στείλτε **Τοποθεσία** (Location)
5. Θα λάβετε check-in confirmation! ✅

> 💡 **Fake Location**: Σε Android, ενεργοποιήστε "Mock Locations" στις Developer Options
> για να στέλνετε ψεύτικη τοποθεσία κοντά στο demo κατάστημα.

---

## 6. Δοκιμή χωρίς Messenger (HTTP Manual)

Αν δεν θέλετε να φτιάξετε bot, μπορείτε να στέλνετε **απευθείας HTTP requests**
στο webhook gateway (σαν να ήταν Telegram):

### Health Check

```bash
curl http://localhost:3000/health
# {"status":"ok","service":"webhook-gateway",...}
```

### Ψεύτικο Telegram Location Message

```bash
curl -X POST http://localhost:3000/webhooks/telegram \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Bot-Api-Secret-Token: test_secret_123" \
  -d '{
    "update_id": 999001,
    "message": {
      "message_id": 1001,
      "from": {"id": 77777777, "first_name": "Test"},
      "chat": {"id": 77777777, "type": "private"},
      "date": 1709000000,
      "location": {
        "latitude": 37.97550,
        "longitude": 23.73480,
        "horizontal_accuracy": 10
      }
    }
  }'
```

### Ψεύτικο Telegram Text Message (/start)

```bash
curl -X POST http://localhost:3000/webhooks/telegram \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Bot-Api-Secret-Token: test_secret_123" \
  -d '{
    "update_id": 999002,
    "message": {
      "message_id": 1002,
      "from": {"id": 77777777, "first_name": "Test"},
      "chat": {"id": 77777777, "type": "private"},
      "date": 1709000001,
      "text": "/start"
    }
  }'
```

### Ψεύτικο Linking Code

```bash
curl -X POST http://localhost:3000/webhooks/telegram \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Bot-Api-Secret-Token: test_secret_123" \
  -d '{
    "update_id": 999003,
    "message": {
      "message_id": 1003,
      "from": {"id": 77777777, "first_name": "Test"},
      "chat": {"id": 77777777, "type": "private"},
      "date": 1709000002,
      "text": "123456"
    }
  }'
```

---

## 7. Δοκιμή Geofencing (Χωρίς μετακίνηση!)

### Εντός ακτίνας (40m)

Το demo κατάστημα είναι στο Σύνταγμα (37.9755, 23.7348).  
Στείλτε τοποθεσία **πολύ κοντά**:

```bash
# Σημείο 10m μακριά → πρέπει να γίνει APPROVED
curl -X POST http://localhost:3000/webhooks/telegram \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Bot-Api-Secret-Token: test_secret_123" \
  -d '{
    "update_id": 999010,
    "message": {
      "message_id": 1010,
      "from": {"id": 77777777, "first_name": "Test"},
      "chat": {"id": 77777777, "type": "private"},
      "date": 1709000010,
      "location": {
        "latitude": 37.97555,
        "longitude": 23.73485,
        "horizontal_accuracy": 5
      }
    }
  }'
```

### Εκτός ακτίνας

```bash
# Σημείο 500m μακριά → πρέπει να γίνει REJECTED
curl -X POST http://localhost:3000/webhooks/telegram \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Bot-Api-Secret-Token: test_secret_123" \
  -d '{
    "update_id": 999011,
    "message": {
      "message_id": 1011,
      "from": {"id": 77777777, "first_name": "Test"},
      "chat": {"id": 77777777, "type": "private"},
      "date": 1709000011,
      "location": {
        "latitude": 37.9800,
        "longitude": 23.7400,
        "horizontal_accuracy": 5
      }
    }
  }'
```

### Χαμηλή GPS Accuracy

```bash
# Accuracy 500m → πρέπει να γίνει LOW_ACCURACY
curl -X POST http://localhost:3000/webhooks/telegram \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Bot-Api-Secret-Token: test_secret_123" \
  -d '{
    "update_id": 999012,
    "message": {
      "message_id": 1012,
      "from": {"id": 77777777, "first_name": "Test"},
      "chat": {"id": 77777777, "type": "private"},
      "date": 1709000012,
      "location": {
        "latitude": 37.97550,
        "longitude": 23.73480,
        "horizontal_accuracy": 500
      }
    }
  }'
```

---

## 8. Unit Tests (Χωρίς servers)

Τα unit tests **δεν χρειάζονται Docker, Internet, ή οτιδήποτε** — τρέχουν ανεξάρτητα:

```bash
# Εκτέλεση ΟΛΩΝ
npm test

# Μόνο ένα test suite
npx jest tests/unit/haversine.test.js

# Με verbose output
npx jest --verbose

# Με code coverage
npx jest --coverage
```

### Τι τεστάρουν;

| Suite                | Τι δοκιμάζει                                   |
| -------------------- | ---------------------------------------------- |
| `haversine`          | Υπολογισμός απόστασης GPS (γνωστά σημεία)      |
| `payload-builder`    | Σωστή δομή WRKCardSE, ΑΦΜ validation, timezone |
| `signature-verify`   | HMAC verification (Viber, Telegram, WhatsApp)  |
| `error-mapper`       | Μετάφραση σφαλμάτων σε ελληνικά                |
| `encryption`         | AES-256-GCM encrypt/decrypt round-trip         |
| `geofence-validator` | Geofence approved/rejected/bypassed/flags      |

---

## 9. Σενάρια Demo (End-to-End)

### Σενάριο 1: Πλήρης βάρδια (Check-in → Check-out)

```
1. Εργαζόμενος ανοίγει Telegram bot
2. Πατά Start → λαμβάνει μήνυμα καλωσορίσματος
3. Πληκτρολογεί 123456 (linking code)
4. ✅ "Καλωσόρισες, ΔΟΚΙΜΑΣΤΙΚΟΣ ΧΡΗΣΤΗΣ!"
5. Στέλνει τοποθεσία (κοντά στο κατάστημα)
6. ✅ "Η βάρδια ξεκίνησε στις 09:00"
7. (μετά από λίγο) Στέλνει ξανά τοποθεσία
8. ✅ "Η βάρδια ολοκληρώθηκε στις 17:00 — Διάρκεια: 8ω 0λ"
```

### Σενάριο 2: Εκτός Geofence

```
1. Εργαζόμενος στέλνει τοποθεσία 500m μακριά
2. ❌ "Δεν βρίσκεστε κοντά στο κατάστημα. Απόσταση: 500m"
```

### Σενάριο 3: Κατάσταση βάρδιας

```
1. Εργαζόμενος πατά 📊 ΚΑΤΑΣΤΑΣΗ
2. ℹ️ "Ενεργή βάρδια — Έναρξη: 09:00 — Διάρκεια: 3ω 15λ"
```

### Σενάριο 4: Λάθος Κωδικός

```
1. Εργαζόμενος πληκτρολογεί 999999 (λάθος code)
2. ❌ "Ο κωδικός δεν αντιστοιχεί σε καμία επιχείρηση"
```

---

## 10. Συχνές Ερωτήσεις Testing

### Πρέπει να έχω πραγματικό ΑΦΜ;
**Όχι.** Στο sandbox μπορείτε να χρησιμοποιήσετε `000000000`, `111111111` κλπ.

### Θα φανεί κάτι στο πραγματικό ΕΡΓΑΝΗ;
**Όχι.** Το sandbox endpoint (`trialeservices.yeka.gr`) είναι εντελώς ξεχωριστό.

### Πώς στέλνω fake GPS στο Telegram;
- **Android**: Developer Options → "Select mock location app" → χρησιμοποιήστε "Fake GPS Location" app
- **iOS**: Χρησιμοποείστε Xcode → Simulate Location
- **Manual**: Χρησιμοποιήστε τα `curl` commands αντί Telegram

### Μπορώ να τρέξω χωρίς Docker;
Ναι, αν εγκαταστήσετε PostgreSQL, Redis, και Kafka τοπικά. Αλλά Docker είναι πολύ πιο εύκολο.

### Τα unit tests χρειάζονται Docker;
**Όχι.** Τρέχουν εντελώς ανεξάρτητα. `npm test` — τίποτα άλλο δεν χρειάζεται.

### Πώς κάνω reset σε όλα τα δεδομένα;
```bash
# ΠΡΟΣΟΧΗ: Διαγράφει ΤΑ ΠΑΝΤΑ
docker compose down -v   # Σταμάτα containers + ΔΙΑΓΡΑΦΗ volumes
docker compose up -d     # Ξεκίνα πάλι
npm run migrate          # Ξανά migration
# Ξανά seed αν θέλετε demo δεδομένα
```

---

*Τελευταία ενημέρωση: Φεβρουάριος 2026*
