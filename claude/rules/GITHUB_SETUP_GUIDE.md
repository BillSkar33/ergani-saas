# 📦 Οδηγός Ρύθμισης GitHub — Βήμα προς Βήμα

> Πλήρης οδηγός για τη δημιουργία, ρύθμιση, και αυτοματοποίηση
> του repository στο GitHub, ειδικά σχεδιασμένος για αρχάριους.

---

## Πίνακας Περιεχομένων

1. [Δημιουργία GitHub Account (αν δεν έχετε)](#1-δημιουργία-github-account)
2. [Εγκατάσταση Git τοπικά](#2-εγκατάσταση-git-τοπικά)
3. [Ρύθμιση SSH Key (μία φορά)](#3-ρύθμιση-ssh-key)
4. [Δημιουργία Repository στο GitHub](#4-δημιουργία-repository-στο-github)
5. [Πρώτο Push του κώδικα](#5-πρώτο-push-του-κώδικα)
6. [GitHub Secrets (Ασφάλεια)](#6-github-secrets)
7. [Branch Protection Rules](#7-branch-protection-rules)
8. [CI/CD Pipeline (Πώς λειτουργεί)](#8-cicd-pipeline)
9. [Διαχείριση Issues & Pull Requests](#9-διαχείριση-issues--pull-requests)
10. [GitHub Actions Monitoring](#10-github-actions-monitoring)
11. [Deployment από GitHub (μελλοντικά)](#11-deployment-από-github)

---

## 1. Δημιουργία GitHub Account

Αν δεν έχετε GitHub λογαριασμό:

1. Πηγαίνετε στο **https://github.com/signup**
2. Συμπληρώστε: email, password, username
3. Επιλέξτε **Free** plan (αρκεί — τα private repos είναι δωρεάν)
4. Επιβεβαιώστε το email σας

> 💡 **Συμβουλή**: Χρησιμοποιήστε email της εταιρείας, όχι προσωπικό.

---

## 2. Εγκατάσταση Git τοπικά

### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install -y git
```

### Ρύθμιση ταυτότητας (ΑΠΑΡΑΙΤΗΤΟ — μία φορά)

```bash
# Βάλτε τα δικά σας στοιχεία
git config --global user.name "Όνομα Επώνυμο"
git config --global user.email "email@company.gr"

# Επιβεβαίωση
git config --list
```

> ⚠️ Αν δεν ρυθμίσετε αυτά, δεν μπορείτε να κάνετε commit!

---

## 3. Ρύθμιση SSH Key

Το SSH key σας επιτρέπει να κάνετε push/pull **χωρίς password** κάθε φορά.

### Βήμα 1: Δημιουργία κλειδιού

```bash
# Δημιουργήστε Ed25519 SSH key
ssh-keygen -t ed25519 -C "email@company.gr"

# Πατήστε Enter σε όλα (default τοποθεσία, χωρίς passphrase)
# Δημιουργήθηκε: ~/.ssh/id_ed25519 (private) + ~/.ssh/id_ed25519.pub (public)
```

### Βήμα 2: Αντιγραφή public key

```bash
cat ~/.ssh/id_ed25519.pub
# Αντιγράψτε ΟΛΗ τη γραμμή που εμφανίζεται
# (ξεκινάει με "ssh-ed25519 AAAA...")
```

### Βήμα 3: Προσθήκη στο GitHub

1. Πηγαίνετε στο **https://github.com/settings/keys**
2. Πατήστε **"New SSH key"**
3. **Title**: π.χ. "Server Ergani"
4. **Key**: Κάντε paste ολόκληρο το public key
5. Πατήστε **"Add SSH key"**

### Βήμα 4: Δοκιμή σύνδεσης

```bash
ssh -T git@github.com
# Αναμενόμενο: "Hi USERNAME! You've successfully authenticated..."
```

> ✅ Αν βλέπετε αυτό, είστε OK!

---

## 4. Δημιουργία Repository στο GitHub

### Μέσω Browser

1. Πηγαίνετε στο **https://github.com/new**
2. Συμπληρώστε:
   - **Repository name**: `ergani-saas`
   - **Description**: "Ψηφιακή Κάρτα Εργασίας — SaaS Chatbot Platform"
   - **Visibility**: 🔒 **Private** (ΚΡΙΣΙΜΟ — περιέχει κώδικα εταιρείας!)
   - ❌ ΜΗΝ τσεκάρετε "Initialize with README" (θα κάνουμε push τον δικό μας)
3. Πατήστε **"Create repository"**

> ⚠️ **ΠΑΝΤΑ Private!** Ο κώδικας περιέχει business logic και security patterns.

### Μέσω GitHub CLI (αν προτιμάτε terminal)

```bash
# Εγκατάσταση GitHub CLI
sudo apt install gh

# Login
gh auth login

# Δημιουργία repo
gh repo create ergani-saas --private --description "Ψηφιακή Κάρτα Εργασίας"
```

---

## 5. Πρώτο Push του κώδικα

```bash
# 1. Μπείτε στο φάκελο του project
cd ~/Desktop/ergani     # ή όπου βρίσκεται ο κώδικας

# 2. Αρχικοποίηση Git (αν δεν έγινε ήδη)
git init

# 3. Προσθήκη ΟΛΩΝ των αρχείων
git add .

# 4. Πρώτο commit
git commit -m "🚀 initial: Ψηφιακή Κάρτα Εργασίας — πλήρης υλοποίηση"

# 5. Σύνδεση με GitHub (αντικαταστήστε YOUR_USERNAME)
git remote add origin git@github.com:YOUR_USERNAME/ergani-saas.git

# 6. Push!
git branch -M main
git push -u origin main
```

### Επιβεβαίωση

Πηγαίνετε στο `https://github.com/YOUR_USERNAME/ergani-saas` — πρέπει να βλέπετε τα αρχεία!

### Τι ΔΕΝ ανεβαίνει στο GitHub

Το `.gitignore` αποκλείει αυτόματα:
- `node_modules/` — dependencies (εγκαθίστανται με `npm install`)
- `.env` — passwords, tokens (αρχείο `secrets`)
- `logs/` — αρχεία καταγραφής
- `coverage/` — test reports

> ✅ Αυτά δεν πρέπει ΠΟΤΕ να ανέβουν στο GitHub!

---

## 6. GitHub Secrets (Ασφάλεια)

Τα secrets χρησιμοποιούνται από το CI/CD pipeline χωρίς να φαίνονται στον κώδικα.

### Πού τα ρυθμίζετε

1. Πηγαίνετε στο repository σας στο GitHub
2. **Settings** (tab κάτω δεξιά) → **Secrets and variables** → **Actions**
3. Πατήστε **"New repository secret"**

### Ποια secrets χρειάζεστε

| Secret Name             | Τιμή                     | Πότε                       |
| ----------------------- | ------------------------ | -------------------------- |
| `DB_PASSWORD`           | Κωδικός PostgreSQL       | Πάντα                      |
| `ENCRYPTION_KEY`        | 64 hex chars             | Πάντα                      |
| `TELEGRAM_BOT_TOKEN`    | Token από @BotFather     | Αν χρησιμοποιείτε Telegram |
| `TELEGRAM_SECRET_TOKEN` | Τυχαίο string            | Αν χρησιμοποιείτε Telegram |
| `VIBER_AUTH_TOKEN`      | Token από Viber Partners | Αν χρησιμοποιείτε Viber    |
| `WHATSAPP_ACCESS_TOKEN` | Token από Meta           | Αν χρησιμοποιείτε WhatsApp |
| `WHATSAPP_APP_SECRET`   | App Secret               | Αν χρησιμοποιείτε WhatsApp |
| `ERGANI_API_URL`        | URL ΕΡΓΑΝΗ API           | Για production             |

### Πώς προστίθεται ένα secret

```
1. Settings → Secrets → Actions → New repository secret
2. Name: TELEGRAM_BOT_TOKEN
3. Value: 7123456789:AAH7k... (paste ολόκληρο)
4. Add secret
```

> 🔒 Τα secrets ΔΕΝ φαίνονται σε κανέναν — ούτε εσάς — μετά την αποθήκευση.
> Μπορείτε μόνο να τα αντικαταστήσετε.

---

## 7. Branch Protection Rules

Αποτρέπουν τυχαίες αλλαγές στο `main` branch (το "ζωντανό"):

### Ρύθμιση

1. **Settings** → **Branches** → **Add branch protection rule**
2. **Branch name pattern**: `main`
3. Ενεργοποιήστε:
   - ☑️ **Require a pull request before merging**
     - ☑️ Require 1 approval (αν έχετε ομάδα)
   - ☑️ **Require status checks to pass before merging**
     - Αναζητήστε: `Unit Tests & Lint` (το CI pipeline σας)
   - ☑️ **Do not allow bypassing**
4. Πατήστε **"Create"**

### Τι σημαίνει αυτό πρακτικά

```
❌ Δεν μπορείτε πια να κάνετε git push origin main απευθείας
✅ Πρέπει να:
   1. git checkout -b feature/my-change    # Νέο branch
   2. git add . && git commit              # Αλλαγές
   3. git push origin feature/my-change    # Push branch
   4. Στο GitHub → "Create Pull Request"   # Review
   5. Τα tests τρέχουν αυτόματα            # CI
   6. Merge αφού περάσουν                   # ✅
```

> 💡 Αν είστε μόνος developer, μπορείτε να αφαιρέσετε το "Require approval"
> αλλά κρατήστε το "Require status checks" — είναι σημαντικό!

---

## 8. CI/CD Pipeline (Πώς λειτουργεί)

### Τι κάνει

Κάθε φορά που κάνετε push ή δημιουργείτε Pull Request, το GitHub **αυτόματα**:

1. 🔄 Εκκινεί ένα Ubuntu virtual machine
2. 📦 Εγκαθιστά Node.js 20
3. 📥 Κάνει `npm ci` (εγκατάσταση dependencies)
4. 🧪 Τρέχει `npm test` (45 unit tests)
5. 📊 Αποθηκεύει coverage report ως artifact
6. ✅ ή ❌ Αναφέρει αποτέλεσμα

### Αρχείο pipeline: `.github/workflows/ci.yml`

```yaml
# Ήδη υπάρχει στο project — δεν χρειάζεται αλλαγή!
name: CI Pipeline — Ψηφιακή Κάρτα Εργασίας
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
```

### Πώς βλέπετε τα αποτελέσματα

1. Πηγαίνετε στο repository → **Actions** (tab)
2. Βλέπετε τις τελευταίες εκτελέσεις
3. Κάθε εκτέλεση δείχνει:
   - ✅ Πράσινο tick = Tests passed
   - ❌ Κόκκινο X = Tests failed (κλικ → δείτε ποιο test)

---

## 9. Διαχείριση Issues & Pull Requests

### Issues (Αναφορά προβλημάτων)

Χρησιμοποιήστε **Issues** για:
- 🐛 Αναφορά bugs
- ✨ Requests νέων features
- 📋 TODO λίστες

```
1. GitHub → Issues → New issue
2. Τίτλος: "Geofence δεν λειτουργεί σε νυχτερινή βάρδια"
3. Περιγραφή: Βήματα αναπαραγωγής, αναμενόμενο vs πραγματικό αποτέλεσμα
4. Labels: bug / enhancement / question
```

### Pull Requests (Αλλαγές κώδικα)

```bash
# 1. Δημιουργία νέου branch
git checkout -b fix/geofence-night-shift

# 2. Κάντε τις αλλαγές σας
nano services/message-processor/handlers/check-in.handler.js

# 3. Commit
git add .
git commit -m "fix: διόρθωση geofence σε νυχτερινή βάρδια"

# 4. Push
git push origin fix/geofence-night-shift

# 5. Στο GitHub → "Compare & pull request"
# 6. Περιγράψτε τις αλλαγές
# 7. Τα CI tests τρέχουν αυτόματα
# 8. Merge αφού περάσουν ✅
```

### Ονοματολογία Branches (σύμβαση)

| Prefix      | Σκοπός         | Παράδειγμα                       |
| ----------- | -------------- | -------------------------------- |
| `feature/`  | Νέα λειτουργία | `feature/employer-portal`        |
| `fix/`      | Διόρθωση bug   | `fix/night-shift-reference-date` |
| `docs/`     | Τεκμηρίωση     | `docs/update-admin-guide`        |
| `refactor/` | Αναδιάρθρωση   | `refactor/kafka-consumer`        |

---

## 10. GitHub Actions Monitoring

### Email Notifications

Αυτόματα λαμβάνετε email αν ένα CI run αποτύχει.
Ρύθμιση: **Settings** → **Notifications** → ☑️ "Actions"

### Badges (Εμφάνιση κατάστασης)

Προσθέστε αυτό στο `README.md` σας στη ρίζα:

```markdown
![CI](https://github.com/YOUR_USERNAME/ergani-saas/actions/workflows/ci.yml/badge.svg)
```

Αποτέλεσμα: Εμφανίζει ✅ ή ❌ αυτόματα.

---

## 11. Deployment από GitHub (μελλοντικά)

Αυτόματο deploy στο VPS μετά από push στο `main`:

### Προαπαιτούμενα

1. VPS με SSH access
2. SSH key ρυθμισμένο ως GitHub Secret

### Βήμα 1: Προσθέστε SSH secrets

```
SSH_HOST = ip.vps.σας
SSH_USER = deploy
SSH_PRIVATE_KEY = (ολόκληρο το private key)
```

### Βήμα 2: Προσθέστε deployment step στο `ci.yml`

```yaml
  deploy:
    name: Deploy to Production
    needs: test  # Τρέχει ΜΟΝΟ αφού περάσουν τα tests
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy μέσω SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/ergani
            git pull origin main
            npm ci
            pm2 restart all
```

> ⚠️ Ενεργοποιήστε αυτό μόνο όταν είστε **100% σίγουροι** ότι ο κώδικας λειτουργεί!

---

## Γρήγορη Αναφορά Git Εντολών

```bash
# Κατάσταση αρχείων
git status

# Ιστορικό αλλαγών
git log --oneline -10

# Νέο branch
git checkout -b feature/my-feature

# Επιστροφή στο main
git checkout main

# Pull τελευταίων αλλαγών
git pull origin main

# Commit + Push
git add .
git commit -m "fix: περιγραφή αλλαγής"
git push origin feature/my-feature

# Διαγραφή branch (μετά merge)
git branch -d feature/my-feature
```

---

*Τελευταία ενημέρωση: Φεβρουάριος 2026*
