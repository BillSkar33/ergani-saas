# 🔧 Οδηγός Αυτοματισμών (Scripts)

> Αναλυτική τεκμηρίωση για κάθε script στον φάκελο `scripts/`.
> Όλα τα scripts εκτελούνται από τη ρίζα του project.

---

## Πίνακας Περιεχομένων

| Script           | Σκοπός               | Σελίδα                 |
| ---------------- | -------------------- | ---------------------- |
| `first-setup.sh` | Πρώτη εγκατάσταση    | [§1](#1-first-setupsh) |
| `start.sh`       | Εκκίνηση υπηρεσιών   | [§2](#2-startsh)       |
| `stop.sh`        | Τερματισμός          | [§3](#3-stopsh)        |
| `restart.sh`     | Επανεκκίνηση         | [§4](#4-restartsh)     |
| `status.sh`      | Κατάσταση συστήματος | [§5](#5-statussh)      |
| `git-push.sh`    | Git commit & push    | [§6](#6-git-pushsh)    |
| `db-setup.sh`    | Βάση δεδομένων       | [§7](#7-db-setupsh)    |
| `backup.sh`      | Αντίγραφα ασφαλείας  | [§8](#8-backupsh)      |
| `test.sh`        | Unit tests           | [§9](#9-testsh)        |
| `logs.sh`        | Docker logs          | [§10](#10-logssh)      |
| `help.sh`        | Βοήθεια              | [§11](#11-helpsh)      |

---

## 1. `first-setup.sh`

### Σκοπός
Ολοκληρωμένη πρώτη εγκατάσταση — τρέχει **μία φορά** σε καινούριο μηχάνημα.

### Τι κάνει (7 βήματα)

```
[1/7] Ελέγχει ότι υπάρχει Node.js v20+
[2/7] npm install — εγκαθιστά dependencies
[3/7] Δημιουργεί .env από .env.example + αυτόματο ENCRYPTION_KEY
[4/7] docker compose up -d — PostgreSQL, Redis, Kafka
[5/7] Migration — δημιουργεί πίνακες βάσης
[6/7] Seed — φορτώνει demo δεδομένα
[7/7] Τρέχει 45 unit tests
```

### Χρήση
```bash
./scripts/first-setup.sh
```

### Σημαντικό
- Αν υπάρχει ήδη `.env`, **δεν** το αντικαθιστά
- Αυτόματα δημιουργεί κρυπτογραφικό κλειδί (`ENCRYPTION_KEY`)
- Δεν χρειάζεται να τρέξει ξανά (εκτός αν αλλάξει μηχάνημα)

---

## 2. `start.sh`

### Σκοπός
Εκκίνηση Docker containers + 3 Node.js υπηρεσίες.

### Τι κάνει

```
[1/4] docker compose up -d (PostgreSQL, Redis, Kafka)
[2/4] node services/webhook-gateway/index.js (port 3000)
[3/4] node services/message-processor/index.js (Kafka consumer)
[4/4] node services/scheduler/index.js (CRON jobs)
```

### Χρήση
```bash
# Όλες οι υπηρεσίες
./scripts/start.sh

# Μόνο μία υπηρεσία
./scripts/start.sh gateway
./scripts/start.sh processor
./scripts/start.sh scheduler
```

### Μετά την εκκίνηση
- **Dashboard**: http://localhost:3000/admin/
- **Health Check**: http://localhost:3000/health
- **Τερματισμός**: `Ctrl+C`

---

## 3. `stop.sh`

### Σκοπός
Σταματάει ΌΛΑ (Node.js + Docker).

### Χρήση
```bash
# Σταμάτα τα πάντα
./scripts/stop.sh

# Σταμάτα μόνο Node.js — Docker μένει ενεργό
./scripts/stop.sh --keep-docker
```

### Πότε χρειάζεται `--keep-docker`
Αν θέλετε η βάση δεδομένων να παραμείνει ενεργή (π.χ. για manual SQL queries ενώ ο server είναι κλειστός).

---

## 4. `restart.sh`

### Σκοπός
Τερματισμός + εκκίνηση ξανά. Ιδανικό μετά από αλλαγές κώδικα.

### Τι κάνει
```
[1/3] pkill — σκοτώνει τα Node.js processes
[2/3] docker compose restart
[3/3] Ξεκινάει ξανά τα 3 services
```

### Χρήση
```bash
./scripts/restart.sh
```

---

## 5. `status.sh`

### Σκοπός
Εμφανίζει κατάσταση ΟΛΩΝ — Docker, Node.js, HTTP health check.

### Τι ελέγχει
```
🐳 Docker containers (status + ports)
📦 Node.js: Gateway PID, Processor PID, Scheduler PID
🏥 HTTP GET /health (port 3000)
💾 Disk usage (Docker volumes + backups)
```

### Χρήση
```bash
./scripts/status.sh
```

### Παράδειγμα output
```
🐳 Docker:
  ergani-postgres    Up 2 hours    5432
  ergani-redis       Up 2 hours    6379
  ergani-kafka       Up 2 hours    9092

📦 Node.js Services:
  ✅ Webhook Gateway (PID: 12345)
  ✅ Message Processor (PID: 12346)
  ❌ Scheduler — δεν τρέχει
```

---

## 6. `git-push.sh`

### Σκοπός
Γρήγορο `git add . → commit → push` σε μία εντολή.

### Χρήση
```bash
# Default message: "update: 2026-02-27 23:45"
./scripts/git-push.sh

# Custom message
./scripts/git-push.sh "fix: διόρθωση geofence σε νυχτερινή βάρδια"
```

### Τι κάνει
1. Εμφανίζει αλλαγές (`git status --short`)
2. Αν δεν υπάρχουν αλλαγές → σταματάει
3. `git add .` + `git commit -m "..."`
4. `git push origin <current-branch>`

### Ασφάλεια
- Δεν ανεβάζει ΠΟΤΕ `.env` (είναι στο `.gitignore`)
- Auto-detect branch (main, develop, feature/...)

---

## 7. `db-setup.sh`

### Σκοπός
Δημιουργία πινάκων βάσης + φόρτωση demo δεδομένων.

### Χρήση
```bash
# Κανονική εκτέλεση (migration + seed)
./scripts/db-setup.sh

# Μόνο migration (ΧΩΡΙΣ demo data)
./scripts/db-setup.sh --migrate

# ΠΛΗΡΗΣ RESET: Διαγραφή volumes + migration + seed
./scripts/db-setup.sh --reset
```

### Τι κάνει `--reset`
```
⚠️ Ρωτάει "Σίγουρα; (y/N)"
[1/4] docker compose down -v (ΔΙΑΓΡΑΦΗ volumes)
[2/4] docker compose up -d
[3/4] Migration (001_initial.sql)
[4/4] Seed (demo_data.sql)
```

### Εμφανίζει
Σύνοψη μετά το τέλος:
```
πίνακας       | εγγραφές
Εργοδότες     | 1
Παραρτήματα   | 2
Εργαζόμενοι   | 3
Χρονοσημάνσεις| 0
```

---

## 8. `backup.sh`

### Σκοπός
Αντίγραφα ασφαλείας PostgreSQL μέσω `pg_dump`.

### Χρήση
```bash
# Δημιουργία backup
./scripts/backup.sh
# → backups/backup_2026-02-27_234500.sql (2.1K)

# Λίστα backups
./scripts/backup.sh --list

# Επαναφορά
./scripts/backup.sh --restore backups/backup_2026-02-27_234500.sql
```

### Αυτόματη διαχείριση
- Αποθηκεύει στον φάκελο `backups/`
- **Κρατάει μόνο τα 10 τελευταία** (αυτόματη διαγραφή παλιών)
- `backups/` είναι στο `.gitignore` — δεν ανεβαίνει στο GitHub

### Restore
- Ζητάει επιβεβαίωση πριν αντικαταστήσει δεδομένα
- Χρησιμοποιεί `psql` import

---

## 9. `test.sh`

### Σκοπός
Εκτέλεση unit tests (Jest).

### Χρήση
```bash
# Εκτέλεση 45 tests
./scripts/test.sh

# + Coverage report (ποσοστό κάλυψης κώδικα)
./scripts/test.sh --coverage

# Watch mode (ξανατρέχει αυτόματα σε αλλαγές)
./scripts/test.sh --watch
```

### Δεν χρειάζεται
- Docker
- Internet
- .env
- Τίποτα εκτός από `npm install`

---

## 10. `logs.sh`

### Σκοπός
Προβολή Docker container logs.

### Χρήση
```bash
./scripts/logs.sh            # PostgreSQL (default)
./scripts/logs.sh kafka      # Kafka
./scripts/logs.sh redis      # Redis
./scripts/logs.sh all        # Όλα τα containers
```

### Εμφανίζει τις τελευταίες 50 γραμμές.

---

## 11. `help.sh`

### Σκοπός
Εμφανίζει ΟΛΕΣ τις διαθέσιμες εντολές σε μία οθόνη.

### Χρήση
```bash
./scripts/help.sh
```

---

## Τυπικές Ροές Εργασίας

### 🆕 Πρώτη φορά
```bash
./scripts/first-setup.sh
./scripts/start.sh
# → http://localhost:3000/admin/
```

### 📝 Αλλαγή κώδικα
```bash
# edit code...
./scripts/restart.sh
./scripts/test.sh
./scripts/git-push.sh "fix: περιγραφή"
```

### 🗄️ Reset βάσης
```bash
./scripts/backup.sh           # πρώτα backup!
./scripts/db-setup.sh --reset
```

### 🚨 Κάτι πάει στραβά
```bash
./scripts/status.sh           # τι τρέχει;
./scripts/logs.sh             # SQL errors;
./scripts/logs.sh kafka       # Kafka problems;
./scripts/restart.sh          # restart ΟΛΩΝ
```

---

*Τελευταία ενημέρωση: Φεβρουάριος 2026*
