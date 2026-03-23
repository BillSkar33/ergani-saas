# Use Cases & User Stories — Ψηφιακή Κάρτα Εργασίας

> Αναλυτική αναφορά όλων των υλοποιημένων λειτουργιών, πώς δουλεύουν,
> και σε ποια αρχεία εκτείνεται η κάθε μία.

---

## Πίνακας Περιεχομένων

1. [Actors (Ρόλοι)](#1-actors)
2. [UC-01: Εγγραφή Εργαζομένου μέσω Chatbot](#uc-01)
3. [UC-02: Check-in (Έναρξη Βάρδιας)](#uc-02)
4. [UC-03: Check-out (Λήξη Βάρδιας)](#uc-03)
5. [UC-04: Geofence Validation (GPS Έλεγχος)](#uc-04)
6. [UC-05: Fraud Detection (Ανίχνευση Απάτης)](#uc-05)
7. [UC-06: Υποβολή στο ΕΡΓΑΝΗ ΙΙ](#uc-06)
8. [UC-07: Διαχείριση Εργαζομένων (Admin)](#uc-07)
9. [UC-08: Διαχείριση Παραρτημάτων](#uc-08)
10. [UC-09: Ωράρια & Βάρδιες](#uc-09)
11. [UC-10: Άδειες & Απουσίες](#uc-10)
12. [UC-11: Εβδομαδιαίο Ημερολόγιο](#uc-11)
13. [UC-12: Ειδοποιήσεις Εργοδότη](#uc-12)
14. [UC-13: Multi-Platform Chatbot](#uc-13)
15. [UC-14: Admin Dashboard (SPA)](#uc-14)
16. [UC-15: Authentication & Security](#uc-15)
17. [UC-16: Trial System & Subscriptions](#uc-16)
18. [UC-17: Super Admin Panel](#uc-17)
19. [UC-18: GDPR Compliance](#uc-18)
20. [UC-19: Αυτοματοποίηση & Scripts](#uc-19)
21. [UC-20: CI/CD & Security Pipeline](#uc-20)
22. [UC-21: Proactive Ειδοποιήσεις Εργαζομένου](#uc-21)

---

## 1. Actors

| Actor                        | Περιγραφή                                                        | Interface                               |
| ---------------------------- | ---------------------------------------------------------------- | --------------------------------------- |
| **Εργαζόμενος**              | Χρήστης chatbot — check-in/out μέσω Telegram/Viber/WhatsApp      | Chatbot (messenger)                     |
| **Εργοδότης (Admin)**        | Ιδιοκτήτης επιχείρησης — διαχείριση εργαζομένων, ωραρίων, αδειών | Admin Dashboard (`/admin/`)             |
| **Super Admin (SaaS Owner)** | Ο δημιουργός της πλατφόρμας — διαχείριση trials, πελατών         | Super Admin Panel (`/admin/super.html`) |
| **ΕΡΓΑΝΗ ΙΙ**                | Εξωτερικό API — δέχεται κάρτες εργασίας WRKCardSE                | Αυτόματη σύνδεση                        |
| **Σύστημα (CRON)**           | Αυτοματοποιημένες εργασίες (υπενθυμίσεις, cleanup, retry)        | Scheduler                               |

---

## UC-01: Εγγραφή Εργαζομένου μέσω Chatbot {#uc-01}

### User Story
> *Ως εργαζόμενος, θέλω να εγγραφώ στο σύστημα μέσω του messenger μου, ώστε να μπορώ να δηλώνω βάρδιες.*

### Ροή

```
1. Ο εργοδότης δημιουργεί εργαζόμενο στο Dashboard → παίρνει 6ψήφιο κωδικό (πχ 843921)
2. Ο εργοδότης δίνει τον κωδικό στον εργαζόμενο
3. Ο εργαζόμενος ανοίγει τον chatbot (πχ Telegram)
4. Πατάει /start → λαμβάνει "Εισήγαγε τον 6ψήφιο κωδικό"
5. Πληκτρολογεί 843921
6. Σύστημα: ✓ Κωδικός valid, ✓ Δεν έληξε → Σύνδεση messenger ID ↔ εργαζόμενος
7. Εργαζόμενος λαμβάνει: "✅ Καλωσόρισες, ΓΕΩΡΓΙΟΣ!"
```

### Εναλλακτικές Ροές
- **Λάθος κωδικός** → "❌ Ο κωδικός δεν αντιστοιχεί"
- **Ληγμένος κωδικός** (30 ημέρες) → "⏰ Ο κωδικός έχει λήξει"
- **Ήδη εγγεγραμμένος** → "ℹ️ Είστε ήδη εγγεγραμμένος"

### Αρχεία

| Αρχείο                                                        | Ρόλος                                                                       |
| ------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `services/message-processor/handlers/registration.handler.js` | Κύριος handler εγγραφής                                                     |
| `services/notification-service/template-engine.js`            | Μηνύματα: `welcome`, `registration_success`, `invalid_code`, `expired_code` |
| `services/admin-api/routes/employees.js`                      | `POST /employees` → δημιουργία + linking_code                               |
| `infrastructure/migrations/001_initial.sql`                   | Πίνακες: `employees` (linking_code), `messenger_links`                      |

---

## UC-02: Check-in (Έναρξη Βάρδιας) {#uc-02}

### User Story
> *Ως εργαζόμενος, θέλω να στέλνω την τοποθεσία μου μέσω messenger για να δηλώσω έναρξη βάρδιας, με αυτόματη υποβολή στο ΕΡΓΑΝΗ.*

### Ροή (8 Βήματα)

```
1.  Εργαζόμενος στέλνει τοποθεσία (GPS) μέσω Telegram/Viber/WhatsApp
2.  Webhook Gateway λαμβάνει → Kafka queue
3.  Message Processor:
    1.  Εύρεση εργαζομένου (messenger_links → employees)
    2.  Έλεγχος duplicate check-in (σήμερα)
    2.5 🔒 Έλεγχος ωραρίου/αδειών (Schedule Validator)
    3.  Εύρεση πλησιέστερου παραρτήματος (Haversine)
    4.  Geofence validation (απόσταση + ακρίβεια GPS)
    5.  Αποθήκευση χρονοσήμανσης (time_stamps)
    6.  Fraud detection (ασύγχρονα)
    7.  Δημιουργία WRKCardSE payload
    8.  Υποβολή στο ΕΡΓΑΝΗ ΙΙ API
4.  Ειδοποίηση: "✅ Η βάρδια ξεκίνησε στις 08:02"
```

### Blocks / Rejections
- **Duplicate check-in** → "⚠️ Έχετε ήδη ενεργή βάρδια"
- **Εκτός ωραρίου** → "🚫 Η βάρδια σου ξεκινά στις 08:00"
- **Σε άδεια** → "🚫 Είσαι σε άδεια Κανονική"
- **Δεν δουλεύει σήμερα** → "🚫 Δεν έχεις βάρδια σήμερα (Σάββατο)"
- **Εκτός geofence** → "📍 Δεν βρίσκεστε κοντά (150m, max: 40m)"
- **Χαμηλή GPS ακρίβεια** → "📡 Αδυναμία εντοπισμού (200m)"
- **Trail expired** → Trial guard blocks mutating operation

### Αρχεία

| Αρχείο                                                    | Ρόλος                                              |
| --------------------------------------------------------- | -------------------------------------------------- |
| `services/message-processor/handlers/check-in.handler.js` | **Κύριος handler** (8 βήματα)                      |
| `services/message-processor/geofencing/haversine.js`      | Υπολογισμός απόστασης (Haversine formula)          |
| `services/message-processor/geofencing/validator.js`      | Geofence → approved/rejected/bypassed/low_accuracy |
| `shared/scheduling/validator.js`                          | 🆕 Schedule + leave check (step 2.5)                |
| `services/ergani-client/payload-builder.js`               | WRKCardSE payload δημιουργία                       |
| `services/ergani-client/work-card.js`                     | HTTP POST στο ΕΡΓΑΝΗ ΙΙ                            |
| `services/message-processor/fraud/detector.js`            | GPS spoofing, impossible travel                    |
| `services/notification-service/template-engine.js`        | Chatbot messages                                   |
| `infrastructure/migrations/001_initial.sql`               | Πίνακας `time_stamps`                              |

---

## UC-03: Check-out (Λήξη Βάρδιας) {#uc-03}

### User Story
> *Ως εργαζόμενος, θέλω να στέλνω ξανά τοποθεσία για λήξη βάρδιας.*

### Ροή
```
1. Εργαζόμενος στέλνει τοποθεσία (ενώ ήδη υπάρχει check-in)
2. Σύστημα ανιχνεύει ανοιχτή βάρδια → auto-detect "check_out"
3. Geofence check (αν ενεργοποιημένο)
4. WRKCardSE (fType=1 → Λήξη βάρδιας)
5. Υποβολή ΕΡΓΑΝΗ
6. "✅ Η βάρδια ολοκληρώθηκε στις 16:05. Διάρκεια: 8ω 3λ"
```

### Αρχεία

| Αρχείο                                                     | Ρόλος                            |
| ---------------------------------------------------------- | -------------------------------- |
| `services/message-processor/handlers/check-out.handler.js` | Κύριος handler                   |
| `services/ergani-client/payload-builder.js`                | fType=1 (λήξη)                   |
| `services/notification-service/template-engine.js`         | `checkout_success`, `no_checkin` |

---

## UC-04: Geofence Validation {#uc-04}

### User Story
> *Ως εργοδότης, θέλω οι εργαζόμενοι να μπορούν να κάνουν check-in μόνο κοντά στο κατάστημα.*

### Πώς Λειτουργεί
```
Βήμα 1: Haversine formula → απόσταση εργαζομένου - παράρτημα (μέτρα)
Βήμα 2: Σύγκριση με geofence_radius_meters (ρυθμιζόμενο, default 40m)
Βήμα 3: Έλεγχος horizontal_accuracy (max 100m default)
Βήμα 4: Αποτέλεσμα:
   ✅ APPROVED — εντός ακτίνας
   ❌ REJECTED — εκτός ακτίνας
   ⚠️ LOW_ACCURACY — κακό GPS signal
   🔓 BYPASSED — εξωτερικός εργαζόμενος (is_external_worker=true)
```

### Ρυθμίσεις ανά Παράρτημα
| Πεδίο                       | Default | Περιγραφή                  |
| --------------------------- | ------- | -------------------------- |
| `geofence_radius_meters`    | 40      | Ακτίνα αποδοχής (10-200m)  |
| `max_accuracy_meters`       | 100     | Max GPS ακρίβεια           |
| `checkout_geofence_enabled` | true    | Geofence και στο check-out |
| `early_checkin_grace_min`   | 15      | Αποδοχή νωρίτερης άφιξης   |

### Αρχεία
| Αρχείο                                               | Ρόλος                              |
| ---------------------------------------------------- | ---------------------------------- |
| `services/message-processor/geofencing/haversine.js` | Haversine formula                  |
| `services/message-processor/geofencing/validator.js` | Κύρια λογική geofence              |
| `infrastructure/migrations/001_initial.sql`          | `branches` (GPS, radius, accuracy) |
| `tests/unit/haversine.test.js`                       | 9 unit tests                       |
| `tests/unit/geofence-validator.test.js`              | 7 unit tests                       |

---

## UC-05: Fraud Detection {#uc-05}

### User Story
> *Ως εργοδότης, θέλω να ανιχνεύω GPS spoofing και ύποπτα μοτίβα.*

### Τύποι Fraud

| Τύπος                 | Πώς Ανιχνεύεται                                             | Σοβαρότητα |
| --------------------- | ----------------------------------------------------------- | ---------- |
| **GPS Spoofing**      | Ακρίβεια 0.0m (αδύνατο σε πραγματικό GPS)                   | HIGH       |
| **Impossible Travel** | Check-in Αθήνα 08:00, check-in Θεσ/νίκη 08:30 (500km/30min) | CRITICAL   |
| **Exact Coordinates** | Ίδιες ακριβείς συντεταγμένες πολλές φορές (copy-paste)      | MEDIUM     |
| **Mock Location**     | Ανίχνευση μέσω accuracy patterns                            | MEDIUM     |

### Ροή
```
1. Fraud detector τρέχει ασύγχρονα μετά κάθε check-in
2. Σύγκριση με προηγούμενα timestamps (τελευταίες 24ώρες)
3. Αν εντοπιστεί → εγγραφή στον πίνακα fraud_alerts
4. Trust score εργαζομένου μειώνεται
5. Εργοδότης βλέπει alert στο Dashboard (🚨 Fraud Alerts)
6. Εργοδότης πατάει "✅ Εξετάστηκε" → reviewed
```

### Αρχεία
| Αρχείο                                         | Ρόλος                                            |
| ---------------------------------------------- | ------------------------------------------------ |
| `services/message-processor/fraud/detector.js` | Ανίχνευση (analyze function)                     |
| `dashboard/js/pages.js`                        | `renderFraud()` — σελίδα alerts                  |
| `infrastructure/migrations/001_initial.sql`    | Πίνακες: `fraud_alerts`, `employees.trust_score` |

---

## UC-06: Υποβολή στο ΕΡΓΑΝΗ ΙΙ {#uc-06}

### User Story
> *Ως σύστημα, πρέπει να υποβάλλω αυτόματα WRKCardSE στο ΕΡΓΑΝΗ ΙΙ API.*

### WRKCardSE Payload
```json
{
  "f_afm_ergodoti": "123456789",
  "f_aa": "0",
  "f_afm": "987654321",
  "f_eponymo": "ΠΑΠΑΔΟΠΟΥΛΟΣ",
  "f_onoma": "ΓΕΩΡΓΙΟΣ",
  "f_type": 0,
  "f_date": "2026-02-28T08:02:00",
  "f_reference_date": "2026-02-28"
}
```

### Ροή
```
1. ΕΡΓΑΝΗ Client: Login → JWT token (cached σε Redis/DB)
2. Build payload (payload-builder.js)
3. POST /WRKCardSE στο API
4. Response → audit_log
5. Αν αποτυχία → retry_count++, scheduler retry
```

### Αρχεία
| Αρχείο                                      | Ρόλος                          |
| ------------------------------------------- | ------------------------------ |
| `services/ergani-client/auth.js`            | Login + JWT token cache        |
| `services/ergani-client/payload-builder.js` | WRKCardSE construction         |
| `services/ergani-client/work-card.js`       | HTTP submit + retry            |
| `services/ergani-client/error-mapper.js`    | ΕΡΓΑΝΗ error codes → ελληνικά  |
| `services/scheduler/index.js`               | CRON retry pending submissions |
| `tests/unit/payload-builder.test.js`        | 9 tests                        |
| `tests/unit/error-mapper.test.js`           | 7 tests                        |

---

## UC-07: Διαχείριση Εργαζομένων {#uc-07}

### User Story
> *Ως εργοδότης, θέλω να προσθέσω/επεξεργαστώ εργαζομένους, μαζικά ή μεμονωμένα.*

### Λειτουργίες

| Endpoint                                     | Ενέργεια                                  |
| -------------------------------------------- | ----------------------------------------- |
| `GET /api/admin/employees`                   | Λίστα (search, filter by branch/active)   |
| `POST /api/admin/employees`                  | Νέος (+ auto linking code, + limit check) |
| `PUT /api/admin/employees/:id`               | Ενημέρωση                                 |
| `DELETE /api/admin/employees/:id`            | Soft delete (is_active=false)             |
| `POST /api/admin/employees/:id/linking-code` | Νέος 6ψήφιος κωδικός                      |
| `POST /api/admin/employees/import-csv`       | Μαζική εισαγωγή (JSON array)              |

### 🔒 Employee Limit Check
```
Πριν το INSERT → checkEmployeeLimit(employerId)
→ μετράει ενεργούς εργαζομένους vs max_employees (πλάνο)
→ Trial: max 5, Basic: 10, Pro: 50, Enterprise: 500
→ Αν ξεπεράστηκε → 403 "Ξεπεράσατε το όριο (5/5)"
```

### Αρχεία
| Αρχείο                                   | Ρόλος                                                       |
| ---------------------------------------- | ----------------------------------------------------------- |
| `services/admin-api/routes/employees.js` | CRUD + import + limit check                                 |
| `shared/security/trial-guard.js`         | `checkEmployeeLimit()`                                      |
| `dashboard/js/pages.js`                  | `renderEmployees()`, `showAddEmployee()`, `showCsvImport()` |
| `dashboard/index.html`                   | Σελίδα 👥 Εργαζόμενοι                                        |

---

## UC-08: Διαχείριση Παραρτημάτων {#uc-08}

### User Story
> *Ως εργοδότης, θέλω να ορίσω καταστήματα/παραρτήματα με GPS συντεταγμένες.*

### Ρυθμίσεις ανά Παράρτημα
- Όνομα, Αριθμός ΕΡΓΑΝΗ
- GPS (latitude, longitude)
- Geofence ακτίνα (10-200m)
- Max ακρίβεια GPS
- Grace minutes (early check-in, late check-out)
- Max shift duration (auto-alert υπέρβασης)
- ΕΡΓΑΝΗ credentials (κρυπτογραφημένα AES-256-GCM)

### Αρχεία
| Αρχείο                                      | Ρόλος                                   |
| ------------------------------------------- | --------------------------------------- |
| `services/admin-api/routes/resources.js`    | `branchRoutes` — CRUD                   |
| `shared/encryption/index.js`                | AES-256-GCM encrypt/decrypt credentials |
| `dashboard/js/pages.js`                     | `renderBranches()`, `showAddBranch()`   |
| `infrastructure/migrations/001_initial.sql` | Πίνακας `branches`                      |
| `tests/unit/encryption.test.js`             | 6 tests                                 |

---

## UC-09: Ωράρια & Βάρδιες {#uc-09}

### User Story
> *Ως εργοδότης, θέλω να ορίσω ωράρια εργασίας ώστε οι εργαζόμενοι να μην κάνουν check-in ότι ώρα θέλουν.*

### Πώς Λειτουργεί

**Βήμα 1 — Δημιουργία πρότυπου ωραρίου:**
```json
{
  "name": "Πρωινό",
  "startTime": "08:00",
  "endTime": "16:00",
  "daysOfWeek": [1,2,3,4,5],
  "isNightShift": false,
  "graceMinutesBefore": 15,
  "graceMinutesAfter": 10
}
```

**Βήμα 2 — Ανάθεση σε εργαζόμενο:**
```json
{
  "employeeId": "uuid-koста",
  "scheduleId": "uuid-πρωινό",
  "effectiveFrom": "2026-03-01",
  "effectiveUntil": null  // μόνιμο
}
```

**Βήμα 3 — Κατά το check-in (αυτόματα):**
```
Κώστας check-in Σάββατο 10:00 (ωράριο: Δευ-Παρ 08:00-16:00)
→ days_of_week = [1,2,3,4,5], σήμερα = 6 (Σάββατο)
→ 🚫 "Δεν έχεις βάρδια σήμερα (Σάββατο)"

Κώστας check-in Δευτέρα 06:30
→ earliest_check_in = 08:00 - 15 = 07:45
→ 06:30 < 07:45
→ 🚫 "Η βάρδια σου ξεκινά στις 08:00. Μπορείς να χτυπήσεις από 07:45"

Κώστας check-in Δευτέρα 08:20
→ shift_start = 08:00, grace_after = 10
→ 08:20 > 08:10 → αργοπορία 20 λεπτά (αλλά επιτρέπεται!)
→ ✅ Check-in + log "Αργοπορία 20 λεπτά"

Μαρία χωρίς ωράριο
→ ✅ Check-in ελεύθερα (backward compatible)
```

### API Endpoints

| Method   | Endpoint                           | Ενέργεια              |
| -------- | ---------------------------------- | --------------------- |
| `GET`    | `/api/admin/schedules`             | Λίστα πρότυπων        |
| `POST`   | `/api/admin/schedules`             | Νέο ωράριο            |
| `PUT`    | `/api/admin/schedules/:id`         | Ενημέρωση             |
| `DELETE` | `/api/admin/schedules/:id`         | Απενεργοποίηση        |
| `POST`   | `/api/admin/schedules/assign`      | Ανάθεση σε εργαζόμενο |
| `GET`    | `/api/admin/schedules/assignments` | Λίστα αναθέσεων       |
| `DELETE` | `/api/admin/schedules/assign/:id`  | Αφαίρεση ανάθεσης     |

### Dashboard
- **📅 Ωράρια** → δύο sections: Πρότυπα + Αναθέσεις
- Modal "Νέο Ωράριο" (name, start_time, end_time, days, grace)
- Modal "Ανάθεση" (επιλογή εργαζομένου + ωραρίου + ημερομηνίες)

### Αρχεία
| Αρχείο                                                    | Ρόλος                                                                      |
| --------------------------------------------------------- | -------------------------------------------------------------------------- |
| `infrastructure/migrations/003_schedules.sql`             | Πίνακες: `work_schedules`, `employee_schedules`                            |
| `shared/scheduling/validator.js`                          | `canEmployeeCheckIn()` — κύρια λογική                                      |
| `services/admin-api/routes/schedules.js`                  | `scheduleRoutes` — CRUD + assign                                           |
| `services/message-processor/handlers/check-in.handler.js` | Step 2.5: schedule check                                                   |
| `services/notification-service/template-engine.js`        | `schedule_blocked`, `schedule_late`, `shift_reminder`, `schedule_assigned` |
| `services/scheduler/employee-notifications.js`            | 🔔 Shift reminder CRON + ειδοποίηση ανάθεσης                                |
| `dashboard/js/pages.js`                                   | `renderSchedules()`, `showAddSchedule()`, `showAssignSchedule()`           |
| `dashboard/index.html`                                    | Nav: 📅 Ωράρια                                                              |

---

## UC-10: Άδειες & Απουσίες {#uc-10}

### User Story
> *Ως εργοδότης, θέλω να καταχωρώ και να εγκρίνω/απορρίπτω αιτήσεις αδειών.*

### Τύποι Αδειών
| Τύπος       | Ελληνικά      |
| ----------- | ------------- |
| `annual`    | Κανονική      |
| `sick`      | Ασθενείας     |
| `unpaid`    | Άνευ αποδοχών |
| `maternity` | Μητρότητας    |
| `other`     | Άλλη          |

### Ροή
```
1. Εργοδότης δημιουργεί άδεια: Κώστας → Κανονική → 10/3 ως 14/3
2. Status: "pending" (εκκρεμεί)
3. Εργοδότης πατάει ✅ → status = "approved"
4. Κώστας κάνει check-in 12/3 → Schedule Validator ελέγχει leaves
5. Βρίσκει approved leave → 🚫 "Είσαι σε άδεια Κανονική (10/3 - 14/3)"
```

### Overlap Detection
```
Κώστας ήδη έχει άδεια 10/3-14/3 (approved)
→ Νέα αίτηση 12/3-16/3 → 409 "Υπάρχει ήδη άδεια στις ίδιες ημερομηνίες"
```

### API Endpoints
| Method   | Endpoint                | Ενέργεια                           |
| -------- | ----------------------- | ---------------------------------- |
| `GET`    | `/api/admin/leaves`     | Λίστα (filter: status, employeeId) |
| `POST`   | `/api/admin/leaves`     | Νέα αίτηση                         |
| `PUT`    | `/api/admin/leaves/:id` | Approve/Reject                     |
| `DELETE` | `/api/admin/leaves/:id` | Ακύρωση                            |

### Αρχεία
| Αρχείο                                         | Ρόλος                                                                 |
| ---------------------------------------------- | --------------------------------------------------------------------- |
| `infrastructure/migrations/003_schedules.sql`  | Πίνακας `leaves`                                                      |
| `shared/scheduling/validator.js`               | Leave check (step 1 στο canEmployeeCheckIn)                           |
| `services/admin-api/routes/schedules.js`       | `leaveRoutes` — CRUD + approve + 🔔 notify employee                    |
| `services/scheduler/employee-notifications.js` | `notifyLeaveDecision()` — ειδοποίηση approved/rejected                |
| `dashboard/js/pages.js`                        | `renderLeaves()`, `showAddLeave()`, `approveLeave()`, `rejectLeave()` |
| `dashboard/index.html`                         | Nav: 🏖️ Άδειες                                                         |

---

## UC-11: Εβδομαδιαίο Ημερολόγιο {#uc-11}

### User Story
> *Ως εργοδότης, θέλω να βλέπω ποιος δουλεύει ποια μέρα.*

### API
```
GET /api/admin/calendar?weekStart=2026-03-02
→ Returns: εργαζόμενοι × ωράρια × άδειες για αυτήν τη βδομάδα
```

### Αρχεία
| Αρχείο                                   | Ρόλος                 |
| ---------------------------------------- | --------------------- |
| `shared/scheduling/validator.js`         | `getWeeklyCalendar()` |
| `services/admin-api/routes/schedules.js` | `calendarRoutes`      |

---

## UC-12: Ειδοποιήσεις Εργοδότη {#uc-12}

### User Story
> *Ως εργοδότης, θέλω να λαμβάνω ειδοποιήσεις για καθυστερήσεις, ξεχασμένα check-out, fraud alerts.*

### Διαθέσιμες Ειδοποιήσεις
| Ρύθμιση                        | Default     |
| ------------------------------ | ----------- |
| Κάθε check-in                  | ❌ (θόρυβος) |
| Καθυστέρηση (>15 λεπτά)        | ✅           |
| Ξεχασμένο checkout (>30 λεπτά) | ✅           |
| GPS rejection                  | ✅           |
| Κίνδυνος υπερωρίας             | ✅           |
| Fraud alerts                   | ✅           |
| Σφάλματα ΕΡΓΑΝΗ                | ✅           |
| Εβδομαδιαία σύνοψη             | ✅ (Δευτέρα) |
| Ώρες σίγασης                   | 22:00-07:00 |

### Αρχεία
| Αρχείο                                      | Ρόλος                                         |
| ------------------------------------------- | --------------------------------------------- |
| `infrastructure/migrations/001_initial.sql` | Πίνακας `employer_notification_settings`      |
| `services/admin-api/routes/resources.js`    | `settingsRoutes` — GET/PUT                    |
| `services/scheduler/index.js`               | CRON jobs (checkout reminder, weekly summary) |
| `dashboard/js/pages.js`                     | `renderSettings()` — toggles                  |

---

## UC-13: Multi-Platform Chatbot {#uc-13}

### User Story
> *Ως εργαζόμενος, θέλω να χρησιμοποιώ τον messenger που προτιμώ.*

### Υποστηριζόμενες Πλατφόρμες

| Πλατφόρμα    | Webhook                       | Signature Verification | Sender               |
| ------------ | ----------------------------- | ---------------------- | -------------------- |
| **Telegram** | `POST /webhooks/telegram`     | Secret Token header    | `telegram-sender.js` |
| **Viber**    | `POST /webhooks/viber`        | HMAC-SHA256            | `viber-sender.js`    |
| **WhatsApp** | `POST/GET /webhooks/whatsapp` | SHA256 verify          | `whatsapp-sender.js` |

### Ροή
```
Telegram/Viber/WhatsApp webhook
→ Webhook Gateway (signature verify)
→ Kafka topic: messages
→ Message Processor (platform-agnostic logic)
→ Notification Service (platform-specific send)
```

### Αρχεία
| Αρχείο                                                    | Ρόλος                    |
| --------------------------------------------------------- | ------------------------ |
| `services/webhook-gateway/routes/telegram.js`             | Telegram webhook parsing |
| `services/webhook-gateway/routes/viber.js`                | Viber webhook parsing    |
| `services/webhook-gateway/routes/whatsapp.js`             | WhatsApp webhook parsing |
| `services/webhook-gateway/middleware/signature-verify.js` | 🔒 Signature verification |
| `services/webhook-gateway/middleware/idempotency.js`      | Anti-duplicate           |
| `services/notification-service/telegram-sender.js`        | Telegram Bot API send    |
| `services/notification-service/viber-sender.js`           | Viber REST API send      |
| `services/notification-service/whatsapp-sender.js`        | WhatsApp Cloud API send  |
| `services/notification-service/template-engine.js`        | 26 μηνύματα στα Ελληνικά |
| `shared/kafka/index.js`                                   | Producer/consumer        |
| `tests/unit/signature-verify.test.js`                     | 7 tests                  |

---

## UC-14: Admin Dashboard (SPA) {#uc-14}

### User Story
> *Ως εργοδότης, θέλω γραφικό περιβάλλον στο browser για να διαχειρίζομαι τα πάντα.*

### Σελίδες (8)

| Σελίδα         | Λειτουργία                                           |
| -------------- | ---------------------------------------------------- |
| 📊 Dashboard    | Stats: check-ins, open shifts, fraud, pending ΕΡΓΑΝΗ |
| 👥 Εργαζόμενοι  | CRUD, search, CSV import, linking codes              |
| 🏢 Παραρτήματα  | CRUD, GPS, geofence settings                         |
| 📅 Ωράρια       | Πρότυπα + αναθέσεις εργαζομένων                      |
| 🏖️ Άδειες       | Αιτήσεις, approve/reject                             |
| 📋 Βάρδιες      | Ιστορικό, φίλτρα ημερομηνιών, CSV export             |
| 🚨 Fraud Alerts | Λίστα alerts, review                                 |
| ⚙️ Ρυθμίσεις    | Notification toggles                                 |

### Αρχεία
| Αρχείο                    | Ρόλος                                      |
| ------------------------- | ------------------------------------------ |
| `dashboard/index.html`    | HTML structure + navigation (8 links)      |
| `dashboard/css/style.css` | Premium dark theme                         |
| `dashboard/js/api.js`     | API client (JWT auth, get/post/put/delete) |
| `dashboard/js/pages.js`   | 8 page renderers + 15 helpers              |
| `dashboard/js/app.js`     | SPA router + modal + events                |

---

## UC-15: Authentication & Security {#uc-15}

### User Story
> *Ως εργοδότης, θέλω ασφαλή πρόσβαση στο Dashboard.*

### Μηχανισμοί Ασφάλειας (12)

| #   | Μηχανισμός         | Υλοποίηση                                       |
| --- | ------------------ | ----------------------------------------------- |
| 1   | JWT Auth           | HMAC-SHA256, 8h expiry, timing-safe verify      |
| 2   | Password Hashing   | bcrypt factor 12                                |
| 3   | Password Policy    | 8+ chars, κεφαλαίο, αριθμός, ειδικός χαρακτήρας |
| 4   | Account Lockout    | 5 fails → 15min Redis lockout                   |
| 5   | JWT Blacklist      | Logout + password change → Redis invalidation   |
| 6   | Rate Limiting      | auth: 5/min, api: 60/min, export: 5/min         |
| 7   | Input Sanitization | XSS entity encoding, SQL pattern stripping      |
| 8   | CORS               | Environment-aware origins                       |
| 9   | Helmet             | CSP, HSTS, X-Frame-Options, XSS, noSniff        |
| 10  | Audit Trail        | Auto-log POST/PUT/DELETE, PII redaction         |
| 11  | Docker Hardening   | 127.0.0.1 binds, Redis password, memory limits  |
| 12  | CI Security        | npm audit, .env leak check, secrets scan        |

### Αρχεία
| Αρχείο                                  | Ρόλος                                        |
| --------------------------------------- | -------------------------------------------- |
| `services/admin-api/middleware/auth.js` | JWT verify + lockout + blacklist check       |
| `services/admin-api/routes/auth.js`     | Login, register, logout, change-password     |
| `shared/security/rate-limiter.js`       | Redis per-endpoint rate limiting             |
| `shared/security/account-lockout.js`    | 5-fail lockout                               |
| `shared/security/jwt-blacklist.js`      | Redis token invalidation                     |
| `shared/security/sanitize.js`           | XSS + SQL sanitization + password validation |
| `shared/security/audit-logger.js`       | Enhanced audit with PII redaction            |
| `services/webhook-gateway/index.js`     | CORS + Helmet registration                   |
| `docker-compose.yml`                    | Hardened configuration                       |
| `.github/workflows/ci.yml`              | Security scan job                            |

---

## UC-16: Trial System & Subscriptions {#uc-16}

### User Story
> *Ως SaaS owner, θέλω να δίνω δοκιμαστική περίοδο 14 ημερών στις νέες επιχειρήσεις.*

### Πλάνα

| Πλάνο      | Εργαζόμενοι | Παραρτήματα | Τιμή            |
| ---------- | ----------- | ----------- | --------------- |
| Trial      | 5           | 1           | Δωρεάν (14 ημ.) |
| Basic      | 10          | 2           | €9.90/μήνα      |
| Pro        | 50          | 5           | €29.90/μήνα     |
| Enterprise | 500         | 50          | €79.90/μήνα     |

### Trial Guard Middleware
```
Κάθε request → checkTrialStatus(employerId):
1. Trial εργοδότης: trial_expires_at < NOW()?  → auto-expire + block
2. Expired/Suspended: GET → ✅, POST/PUT/DELETE → ❌ 403

Έλεγχος limits:
- employees >= max_employees → 403 "Ξεπεράσατε το όριο (5/5)"
- branches >= max_branches → 403
```

### Αρχεία
| Αρχείο                                           | Ρόλος                                                   |
| ------------------------------------------------ | ------------------------------------------------------- |
| `infrastructure/migrations/002_trial_system.sql` | subscription_plans, employer trial fields, super_admins |
| `shared/security/trial-guard.js`                 | `trialGuard()` middleware + `checkEmployeeLimit()`      |
| `services/admin-api/index.js`                    | `preHandler: trialGuard`                                |

---

## UC-17: Super Admin Panel {#uc-17}

### User Story
> *Ως SaaS owner, θέλω dashboard για να βλέπω/διαχειρίζομαι ΟΛΟΥΣ τους πελάτες.*

### Dashboard Stats (8 cards)
- Σύνολο εργοδοτών, trial, active, expired, suspended
- Σύνολο εργαζομένων
- Fraud alerts, εσοδα ανά πλάνο

### Ενέργειες
- ➕14 ημ. παράταση trial
- ✅ Ενεργοποίηση (trial → active)
- 🚫 Αναστολή
- 🔧 Manage: αλλαγή πλάνου, limits, notes

### API Endpoints
| Method    | Endpoint                         | Ενέργεια                           |
| --------- | -------------------------------- | ---------------------------------- |
| `POST`    | `/api/super/auth/login`          | Login (24h token)                  |
| `POST`    | `/api/super/auth/setup`          | Πρώτος super admin (μία φορά)      |
| `GET`     | `/api/super/stats`               | Global KPIs                        |
| `GET`     | `/api/super/employers`           | Λίστα (search, filter, pagination) |
| `PUT`     | `/api/super/employers/:id/trial` | Trial management                   |
| `GET/PUT` | `/api/super/plans`               | Subscription plans CRUD            |

### Αρχεία
| Αρχείο                                           | Ρόλος                                   |
| ------------------------------------------------ | --------------------------------------- |
| `services/super-admin-api/index.js`              | Όλο το API (auth + routes)              |
| `dashboard/super.html`                           | SPA: login, dashboard, employers, plans |
| `infrastructure/migrations/002_trial_system.sql` | Πίνακας super_admins                    |
| `services/webhook-gateway/index.js`              | Mounted στο `/api/super`                |

---

## UC-18: GDPR Compliance {#uc-18}

### User Story
> *Ως σύστημα, πρέπει να τηρώ τον GDPR για τα GPS δεδομένα εργαζομένων.*

### Μέτρα
- **GPS Anonymization**: Μετά 48 ώρες → latitude/longitude = NULL
- **PII Redaction**: Audit logs δεν αποθηκεύουν ΑΦΜ/ονόματα
- **Soft Delete**: Εργαζόμενοι απενεργοποιούνται (δεν διαγράφονται)
- **Audit Retention**: 5 χρόνια (νομική υποχρέωση)

### Αρχεία
| Αρχείο                                      | Ρόλος                             |
| ------------------------------------------- | --------------------------------- |
| `services/scheduler/gps-cleanup.js`         | CRON: anonymize GPS > 48h         |
| `shared/security/audit-logger.js`           | PII redaction στα logs            |
| `infrastructure/migrations/001_initial.sql` | `time_stamps.latitude` (nullable) |
| `tests/unit/gdpr-compliance.test.js`        | GDPR tests                        |

---

## UC-19: Αυτοματοποίηση (Scripts) {#uc-19}

### User Story
> *Ως developer, θέλω scripts για γρήγορες εργασίες.*

### 11 Scripts

| Script           | Ενέργεια                        |
| ---------------- | ------------------------------- |
| `first-setup.sh` | Ολοκληρωμένη αρχική εγκατάσταση |
| `start.sh`       | Docker + Node services          |
| `stop.sh`        | Σταμάτημα                       |
| `restart.sh`     | Restart all                     |
| `status.sh`      | Κατάσταση containers/services   |
| `db-setup.sh`    | Migrations + seed               |
| `backup.sh`      | PostgreSQL dump + timestamp     |
| `git-push.sh`    | Auto commit + push              |
| `test.sh`        | Jest tests (optional coverage)  |
| `logs.sh`        | Docker logs                     |
| `help.sh`        | Βοήθεια                         |

### Αρχεία: `scripts/*.sh`

---

## UC-20: CI/CD & Security Pipeline {#uc-20}

### User Story
> *Ως developer, θέλω αυτόματο pipeline που ελέγχει tests και ασφάλεια σε κάθε push.*

### Pipeline (2 jobs)

**Job 1: Build & Test**
```
PostgreSQL service → npm install → npm test (45 tests) → npm audit
```

**Job 2: Security Scan**
```
npm audit --audit-level=critical
git diff --check .env (leak detection)
grep -r "password\s*=" (hardcoded secrets)
```

### Αρχεία
| Αρχείο                     | Ρόλος                   |
| -------------------------- | ----------------------- |
| `.github/workflows/ci.yml` | GitHub Actions pipeline |

---

## UC-21: Proactive Ειδοποιήσεις Εργαζομένου {#uc-21}

### User Story
> *Ως εργαζόμενος, θέλω να λαμβάνω αυτόματες ειδοποιήσεις για τις βάρδιες μου, τα ωράρια, και τις άδειες μου.*

### 4 Proactive Ειδοποιήσεις

| #   | Ειδοποίηση               | Πότε                              | Μήνυμα                                                      |
| --- | ------------------------ | --------------------------------- | ----------------------------------------------------------- |
| 1   | **🔔 Υπενθύμιση βάρδιας** | 30' πριν τη βάρδια                | "Η βάρδια σου «Πρωινό» ξεκινά σε 30 λεπτά. ⏰ 08:00 - 16:00" |
| 2   | **📅 Ανάθεση ωραρίου**    | Μόλις ο εργοδότης αναθέσει ωράριο | "Σου ανατέθηκε: «Πρωινό» ⏰ 08:00 - 16:00, από 01/03"        |
| 3   | **✅ Άδεια εγκρίθηκε**    | Μόλις ο εργοδότης πατήσει ✅       | "Η άδεια σου εγκρίθηκε! Κανονική 10/3 → 14/3"               |
| 4   | **❌ Άδεια απορρίφθηκε**  | Μόλις ο εργοδότης πατήσει ❌       | "Η αίτηση άδειας απορρίφθηκε. Κανονική 10/3 → 14/3"         |
| 5   | **📊 Εβδομαδιαία σύνοψη** | Κάθε Κυριακή 20:00                | "Αυτή τη βδομάδα: 5 βάρδιες"                                |

### Πώς Λειτουργούν

**CRON-based (αυτόματα):**
```
Shift Reminder (κάθε 5 λεπτά):
1. Βρες εργαζομένους με βάρδια σε 25-35 λεπτά
2. Εξαίρεση: ήδη check-in ή σε άδεια
3. Στείλε μέσω messenger → "🔔 Η βάρδια σου ξεκινά σε 30 λεπτά"

Weekly Summary (Κυριακή 20:00):
1. Βρες εργαζομένους με messenger link
2. Υπολόγισε: βάρδιες, ανοιχτές βάρδιες
3. Στείλε → "📊 5 βάρδιες αυτή τη βδομάδα"
```

**Event-based (αντιδραστικά):**
```
Εργοδότης αναθέτει ωράριο στον Κώστα:
→ POST /schedules/assign → fire-and-forget notifyScheduleAssignment()
→ Κώστας λαμβάνει: "📅 Σου ανατέθηκε: «Πρωινό»"

Εργοδότης εγκρίνει άδεια:
→ PUT /leaves/:id { status: 'approved' } → fire-and-forget notifyLeaveDecision()
→ Κώστας λαμβάνει: "✅ Η άδεια σου εγκρίθηκε!"
```

### Αρχεία
| Αρχείο                                             | Ρόλος                                                                                                                 |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `services/scheduler/employee-notifications.js`     | **Κύριο module** — 4 functions                                                                                        |
| `services/scheduler/index.js`                      | 7 CRON jobs (2 νέα: shift reminder, weekly summary)                                                                   |
| `services/notification-service/template-engine.js` | 5 νέα templates: `shift_reminder`, `schedule_assigned`, `leave_approved`, `leave_rejected`, `weekly_employee_summary` |
| `services/admin-api/routes/schedules.js`           | Event triggers σε assign + approve/reject                                                                             |

---

## Στατιστικά Συνολικά

| Μετρική               | Τιμή                           |
| --------------------- | ------------------------------ |
| **Use Cases**         | 21                             |
| **DB Tables**         | 14                             |
| **API Endpoints**     | ~40                            |
| **Dashboard Pages**   | 8 (Employer) + 3 (Super Admin) |
| **Chatbot Messages**  | 26 templates                   |
| **CRON Jobs**         | 7                              |
| **Unit Tests**        | 45 (6 suites)                  |
| **Security Measures** | 12                             |
| **Scripts**           | 11                             |
| **Platforms**         | 3 (Telegram, Viber, WhatsApp)  |
| **Αρχεία κώδικα**     | ~85                            |

---

*Τελευταία ενημέρωση: 28 Φεβρουαρίου 2026*
