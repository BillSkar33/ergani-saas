# 🔒 Security Planner — Ψηφιακή Κάρτα Εργασίας

> Πλάνο ασφάλειας, penetration testing checklist,
> και προτεινόμενες ενέργειες για production-ready ασφάλεια.

---

## Πίνακας Περιεχομένων

1. [Τρέχουσα Κατάσταση Ασφάλειας](#1-τρέχουσα-κατάσταση-ασφάλειας)
2. [Threat Model](#2-threat-model)
3. [Penetration Testing Checklist](#3-penetration-testing-checklist)
4. [Κρίσιμες Ενέργειες (Υψηλή Προτεραιότητα)](#4-κρίσιμες-ενέργειες)
5. [Μεσαίας Προτεραιότητας](#5-μεσαίας-προτεραιότητας)
6. [Χαμηλής Προτεραιότητας (Hardening)](#6-χαμηλής-προτεραιότητας)
7. [OWASP Top 10 Mapping](#7-owasp-top-10-mapping)
8. [Monitoring & Incident Response](#8-monitoring--incident-response)
9. [Compliance (GDPR + Εργατική Νομοθεσία)](#9-compliance)
10. [Security Testing Tools](#10-security-testing-tools)
11. [Action Plan Timeline](#11-action-plan-timeline)

---

## 1. Τρέχουσα Κατάσταση Ασφάλειας

### ✅ Τι υπάρχει ΉΔΗ

| Μέτρο                                 | Κατάσταση | Αρχείο                           |
| ------------------------------------- | --------- | -------------------------------- |
| Webhook signature verification        | ✅         | `middleware/signature-verify.js` |
| AES-256-GCM κρυπτογράφηση credentials | ✅         | `shared/encryption/`             |
| Idempotency (anti-replay)             | ✅         | `middleware/idempotency.js`      |
| Rate limiting (Fastify plugin)        | ✅         | `webhook-gateway/index.js`       |
| GDPR GPS data cleanup (48h)           | ✅         | `scheduler/gps-cleanup.js`       |
| Fraud detection (GPS spoofing)        | ✅         | `fraud/detector.js`              |
| Structured logging (no PII)           | ✅         | `shared/logger/`                 |
| JWT auth for admin API                | ✅         | `admin-api/middleware/auth.js`   |
| bcrypt passwords (factor 12)          | ✅         | `admin-api/routes/auth.js`       |
| `.env` excluded from Git              | ✅         | `.gitignore`                     |
| HMAC-SHA256 JWT tokens                | ✅         | `admin-api/middleware/auth.js`   |

### ⚠️ Τι χρειάζεται ΑΚΟΜΑrendering

| Κενό                           | Κίνδυνος  | Προτεραιότητα |
| ------------------------------ | --------- | ------------- |
| HTTPS / TLS                    | 🔴 Κρίσιμο | Υψηλή         |
| CORS configuration             | 🟡 Μεσαίο  | Υψηλή         |
| SQL injection audit            | 🟡 Μεσαίο  | Υψηλή         |
| XSS protection (dashboard)     | 🟡 Μεσαίο  | Υψηλή         |
| CSRF tokens                    | 🟡 Μεσαίο  | Μεσαία        |
| Security headers (Helmet)      | 🟡 Μεσαίο  | Μεσαία        |
| Account lockout policy         | 🟢 Χαμηλό  | Μεσαία        |
| API key rotation               | 🟢 Χαμηλό  | Χαμηλή        |
| Dependency vulnerability scan  | 🟡 Μεσαίο  | Υψηλή         |
| WAF (Web Application Firewall) | 🟢 Χαμηλό  | Χαμηλή        |

---

## 2. Threat Model

### Πιθανοί Επιτιθέμενοι

```
┌─────────────────────────────────────────┐
│              THREAT ACTORS              │
├─────────────────────────────────────────┤
│ 1. Εργαζόμενος — GPS spoofing          │
│    Σκοπός: Fake check-in/out           │
│    Πιθανότητα: ΥΨΗΛΗ                   │
│                                         │
│ 2. Εξωτερικός hacker                    │
│    Σκοπός: Data breach, API abuse      │
│    Πιθανότητα: ΜΕΣΑΙΑ                  │
│                                         │
│ 3. Competitor / Scraper                 │
│    Σκοπός: Business intelligence       │
│    Πιθανότητα: ΧΑΜΗΛΗ                  │
│                                         │
│ 4. Κακόβουλος εργοδότης                │
│    Σκοπός: Αλλοίωση στοιχείων          │
│    Πιθανότητα: ΧΑΜΗΛΗ                  │
└─────────────────────────────────────────┘
```

### Attack Surface

| Σημείο         | Πρωτόκολλο | Κίνδυνος                   |
| -------------- | ---------- | -------------------------- |
| `/webhooks/*`  | HTTP POST  | Webhook forgery, DDoS      |
| `/api/admin/*` | HTTP REST  | Auth bypass, SQL injection |
| `/admin/`      | HTTP GET   | XSS, CSRF                  |
| PostgreSQL     | TCP 5432   | SQL injection, exposure    |
| Redis          | TCP 6379   | Unauthorized access        |
| Kafka          | TCP 9092   | Message poisoning          |

---

## 3. Penetration Testing Checklist

### A. Authentication & Authorization

- [ ] **Brute-force login** — ΔΕΝ αφήνει unlimiteμένα attempts
  ```bash
  # Test: 100 rapid failed logins
  for i in $(seq 1 100); do
    curl -s -o /dev/null -w "%{http_code}" \
      -X POST http://localhost:3000/api/admin/auth/login \
      -H "Content-Type: application/json" \
      -d '{"email":"test@x.com","password":"wrong"}'
  done
  # Αναμενόμενο: 429 (Too Many Requests) μετά ~10 attempts
  ```

- [ ] **JWT tampering** — Αλλαγή payload δεν γίνεται αποδεκτή
  ```bash
  # Test: Τροποποίηση token payload
  TOKEN="eyJ...VALID_TOKEN"
  # Αλλαγή employerId στο payload → πρέπει να αρνηθεί (401)
  ```

- [ ] **Expired tokens** — Ληγμένα tokens δεν γίνονται δεκτά
- [ ] **Horizontal privilege** — Εργοδότης Α ΔΕΝ βλέπει δεδομένα Εργοδότη Β
  ```bash
  # Test: Login ως employer A, request employees employer B
  curl -H "Authorization: Bearer $TOKEN_A" \
    http://localhost:3000/api/admin/employees?employerId=$ID_B
  # Πρέπει: Μόνο δεδομένα employer A
  ```

### B. Injection Attacks

- [ ] **SQL Injection** — Σε ΟΛΕΣ τις φόρμα search/filter
  ```bash
  # Test κλασικά payloads
  curl "http://localhost:3000/api/admin/employees?search=' OR 1=1 --"
  curl "http://localhost:3000/api/admin/employees?search='; DROP TABLE employees; --"
  # Πρέπει: Χρήση parameterized queries (ήδη γίνεται μέσω $1, $2)
  ```

- [ ] **NoSQL / JSON injection** — Στα JSON body endpoints
- [ ] **Command injection** — Σε `node -e` ή `exec` calls

### C. XSS (Cross-Site Scripting)

- [ ] **Stored XSS** — Input sanitization σε ονόματα εργαζομένων
  ```bash
  # Test: Εγγραφή εργαζομένου με XSS payload
  curl -X POST http://localhost:3000/api/admin/employees \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"afm":"999999999","eponymo":"<script>alert(1)</script>","onoma":"TEST"}'
  # Dashboard πρέπει να ΜΗΝ εκτελεί το script
  ```

- [ ] **Reflected XSS** — Στα search parameters
- [ ] **DOM XSS** — Στο dashboard frontend (innerHTML usage)

### D. Webhook Security

- [ ] **Signature bypass** — Αποστολή webhook χωρίς valid signature
  ```bash
  curl -X POST http://localhost:3000/webhooks/telegram \
    -H "Content-Type: application/json" \
    -H "X-Telegram-Bot-Api-Secret-Token: WRONG_TOKEN" \
    -d '{"update_id":1,"message":{"text":"test"}}'
  # Πρέπει: 401 Unauthorized
  ```

- [ ] **Replay attack** — Αποστολή duplicate message
- [ ] **Oversized payload** — Body > 1MB
- [ ] **Malformed JSON** — Invalid JSON body

### E. Data Security

- [ ] **ΕΡΓΑΝΗ credentials** — Κρυπτογραφημένα στη βάση (ΟΧΙ plaintext)
- [ ] **GPS data GDPR** — Ανωνυμοποίηση μετά 48h
- [ ] **Backup encryption** — SQL dumps περιέχουν ευαίσθητα δεδομένα
- [ ] **Log redaction** — Κανένα PII στα logs (ΑΦΜ, ονόματα)

### F. Infrastructure

- [ ] **Port exposure** — Μόνο 443 (HTTPS) στο public
  ```bash
  nmap -sT target_ip
  # Πρέπει: Μόνο 443 open. ΟΧΙ 5432, 6379, 9092
  ```

- [ ] **Docker socket** — Μη προσβάσιμο από το web
- [ ] **Redis auth** — Password ρυθμισμένο
- [ ] **PostgreSQL auth** — Μόνο localhost ή Docker network

---

## 4. Κρίσιμες Ενέργειες

### 4.1 HTTPS/TLS (Αμεσα)

```nginx
# nginx config — Let's Encrypt free SSL
server {
    listen 443 ssl http2;
    ssl_certificate /etc/letsencrypt/live/api.domain.gr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.domain.gr/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
    
    # HSTS
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

### 4.2 CORS Lockdown

```javascript
// Προσθήκη στο webhook-gateway/index.js
app.register(require('@fastify/cors'), {
  origin: ['https://yourdomain.gr'],  // ΜΟΝΟ το domain σας
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
});
```

### 4.3 Security Headers (Helmet)

```javascript
// Ήδη εγκατεστημένο, απλά ενεργοποίηση
app.register(require('@fastify/helmet'), {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      fontSrc: ["'self'", "fonts.gstatic.com"],
    },
  },
});
```

### 4.4 Input Sanitization

```javascript
// Έλεγχος & καθαρισμός input πριν αποθήκευση
function sanitizeHtml(str) {
  return str.replace(/[<>"'&]/g, (char) => ({
    '<': '&lt;', '>': '&gt;', '"': '&quot;',
    "'": '&#39;', '&': '&amp;'
  }[char]));
}
```

### 4.5 Dependency Audit

```bash
# Εκτέλεση άμεσα
npm audit
npm audit fix

# Αυτοματοποίηση — προσθήκη στο CI:
# npm audit --audit-level=high
```

---

## 5. Μεσαίας Προτεραιότητας

### 5.1 Account Lockout

```
Μετά 5 αποτυχημένα login → lockout 15 λεπτά
Αποθήκευση failed attempts σε Redis
```

### 5.2 Password Policy

```
Ελάχιστο 8 χαρακτήρες ✅ (ήδη υπάρχει)
Πρόσθεση: 1 κεφαλαίο, 1 αριθμός, 1 ειδικός χαρακτήρας
Αποτροπή κοινών passwords (πχ "12345678")
```

### 5.3 API Rate Limiting (ανά endpoint)

```
Auth endpoints:  5 req/min  (αποτροπή brute-force)
CRUD endpoints:  60 req/min (κανονική χρήση)
Export/CSV:      5 req/min  (βαρύ query)
```

### 5.4 Audit Trail Enhancement

```
Αποθήκευση σε κάθε admin action:
- Ποιος (employer_id)
- Τι (action: "create_employee", "update_branch", "export_csv")
- Πότε (timestamp)
- Από πού (IP address)
```

### 5.5 JWT Token Blacklist

```
Κατά το logout → blacklist token στο Redis
Κατά την αλλαγή password → invalidate ΟΛΑ τα tokens
Check redis blacklist σε κάθε authenticated request
```

---

## 6. Χαμηλής Προτεραιότητας

### 6.1 2FA (Two-Factor Authentication)

```
Προαιρετικό TOTP (Google Authenticator)
Ειδικά για production εργοδότες
```

### 6.2 API Key Rotation

```
Αυτόματη λήξη & renewal:
- ΕΡΓΑΝΗ JWT: ✅ (ήδη refresh)
- Telegram Token: manual (ενημέρωση @BotFather)
- ENCRYPTION_KEY: σχέδιο migration
```

### 6.3 WAF (Web Application Firewall)

```
Cloudflare Free tier ή nginx ModSecurity
Αποτρέπει SQL injection, XSS σε network level
```

### 6.4 Container Isolation

```
docker-compose.yml:
- Ξεχωριστό network ανά service
- Μη root user στα containers
- Read-only filesystem όπου δεν χρειάζεται write
```

---

## 7. OWASP Top 10 Mapping

| #   | Κατηγορία OWASP           | Κατάσταση | Μέτρα                                       |
| --- | ------------------------- | --------- | ------------------------------------------- |
| A01 | Broken Access Control     | ⚠️         | Employer isolation ✅, CORS ❌                |
| A02 | Cryptographic Failures    | ✅         | AES-256-GCM, bcrypt-12                      |
| A03 | Injection                 | ⚠️         | Parameterized queries ✅, XSS sanitization ❌ |
| A04 | Insecure Design           | ✅         | Threat model, geofence validation           |
| A05 | Security Misconfiguration | ⚠️         | Helmet ❌, CORS ❌                            |
| A06 | Vulnerable Components     | ❓         | `npm audit` πρέπει να τρέξει                |
| A07 | Auth Failures             | ⚠️         | JWT ✅, lockout ❌, 2FA ❌                     |
| A08 | Data Integrity            | ✅         | Signature verification, audit log           |
| A09 | Logging & Monitoring      | ✅         | Structured logging, fraud detection         |
| A10 | SSRF                      | ✅         | Δεν δέχεται user-provided URLs              |

---

## 8. Monitoring & Incident Response

### Τι πρέπει να παρακολουθείτε

| Μετρική              | Εργαλείο              | Alert Όριο    |
| -------------------- | --------------------- | ------------- |
| Failed logins        | Logs + Redis counter  | > 10/λεπτό    |
| 5xx errors           | UptimeRobot / Grafana | > 5/ώρα       |
| Response time        | Fastify metrics       | > 2 sec       |
| Disk usage (backups) | cron + df             | > 80%         |
| npm vulnerabilities  | `npm audit` CI step   | High/Critical |
| Fraud alerts         | DB query              | > 5/ημέρα     |
| Expired JWT tokens   | Redis TTL             | —             |
| ΕΡΓΑΝΗ failures      | audit_log query       | > 3/ώρα       |

### Incident Response Plan

```
1. ΕΝΤΟΠΙΣΜΟΣ — Alert/Monitoring ειδοποίηση
2. ΑΞΙΟΛΟΓΗΣΗ — Severity: Low/Medium/High/Critical
3. ΠΕΡΙΟΡΙΣΜΟΣ — Disable λογαριασμό, block IP, suspend service
4. ΔΙΕΡΕΥΝΗΣΗ — Logs, audit trail, forensics
5. ΑΠΟΚΑΤΑΣΤΑΣΗ — Fix, patch, restore backup
6. ΤΕΚΜΗΡΙΩΣΗ — Post-mortem report
```

---

## 9. Compliance

### GDPR

| Απαίτηση                      | Κατάσταση | Υλοποίηση                                 |
| ----------------------------- | --------- | ----------------------------------------- |
| Δικαίωμα πρόσβασης            | ⚠️         | Χρειάζεται endpoint δεδομένων εργαζομένου |
| Δικαίωμα διαγραφής            | ⚠️         | Soft delete ✅, full purge ❌               |
| Ελαχιστοποίηση δεδομένων      | ✅         | GPS 48h retention                         |
| Consent                       | ⚠️         | Χρειάζεται acceptance κατά linking        |
| Data breach notification      | ⚠️         | 72h όριο — χρειάζεται process             |
| DPO (Data Protection Officer) | ⚠️         | Απαιτείται αν > 250 εργαζόμενοι           |

### Εργατική Νομοθεσία (Ν.4808/2021)

| Απαίτηση               | Κατάσταση                |
| ---------------------- | ------------------------ |
| Ψηφιακή κάρτα εργασίας | ✅ WRKCardSE payload      |
| Real-time υποβολή      | ✅ Kafka + retry          |
| Ακρίβεια χρόνου        | ✅ Timezone Europe/Athens |
| Αποθήκευση 5 χρόνια    | ✅ audit_log retention    |

---

## 10. Security Testing Tools

### Δωρεάν

| Εργαλείο    | Τύπος              | Χρήση                          |
| ----------- | ------------------ | ------------------------------ |
| `npm audit` | Dependency scan    | `npm audit --audit-level=high` |
| OWASP ZAP   | Web app scanner    | Αυτόματο scan dashboard        |
| nikto       | Web server scanner | `nikto -h http://target`       |
| nmap        | Port scanner       | `nmap -sV target_ip`           |
| sqlmap      | SQL injection      | `sqlmap -u "URL?search=test"`  |
| curl        | Manual testing     | Πλήρης API test                |

### Εμπορικά (προαιρετικά)

| Εργαλείο       | Τύπος                       | Κόστος         |
| -------------- | --------------------------- | -------------- |
| Snyk           | Dependency + container scan | Free tier      |
| Burp Suite Pro | Full pentest                | ~€400/χρόνο    |
| HackerOne      | Bug bounty                  | Ανάλογα budget |

---

## 11. Action Plan Timeline

### Εβδομάδα 1 — Κρίσιμα (Πριν Production)

- [ ] HTTPS/TLS setup (Let's Encrypt)
- [ ] CORS configuration
- [ ] Security headers (Helmet)
- [ ] `npm audit fix`
- [ ] Firewall: μόνο port 443, 22
- [ ] Redis password

### Εβδομάδα 2 — Υψηλά

- [ ] Input sanitization (XSS protection)
- [ ] Account lockout μετά 5 αποτυχίες
- [ ] API rate limiting ανά endpoint
- [ ] OWASP ZAP scan + fix findings
- [ ] CI pipeline: npm audit step

### Εβδομάδα 3 — Μεσαία

- [ ] Audit trail enhancement
- [ ] JWT blacklist (logout/password change)
- [ ] Password strength policy
- [ ] Penetration test (manual, OWASP checklist)
- [ ] Backup encryption

### Εβδομάδα 4 — Hardening

- [ ] Docker container security (non-root, read-only)
- [ ] Monitoring setup (UptimeRobot, alerts)
- [ ] Incident response process documentation
- [ ] GDPR consent flow
- [ ] 2FA (optional, για premium)

### Μηνιαία (Ongoing)

- [ ] `npm audit` σε κάθε CI run
- [ ] Αναθεώρηση fraud alerts
- [ ] Backup verification (restore test)
- [ ] Security log review
- [ ] Dependency updates

---

*Τελευταία ενημέρωση: Φεβρουάριος 2026*
