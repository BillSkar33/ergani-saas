# MEMORY — Ergani SaaS Auto Memory Index

> **Purpose**: This file serves as the living memory of the project. Update it continuously as new decisions, patterns, bugs, and context emerge. Claude reads this on every session to restore context quickly.

---

## 🏗️ Project Identity
- **Name**: ergani-saas
- **Description**: Ψηφιακή Κάρτα Εργασίας — SaaS Chatbot Platform με GPS Geofencing & ΕΡΓΑΝΗ ΙΙ Integration
- **Language**: Greek (UI & error messages), English (code & comments)
- **Stack**: Node.js 20+, Fastify v5, PostgreSQL, Redis, Kafka, Docker

---

## 📁 Repository Structure (Current)
```
ergani/
├── claude/                     # AI context, rules, skills, commands
│   ├── CLAUDE.md               # Master AI context file
│   ├── settings.json           # Project settings for Claude
│   ├── skills/                 # Domain skill guides
│   │   ├── ui/                 # Dashboard frontend patterns
│   │   ├── backend/            # Fastify microservices patterns
│   │   ├── tests/              # Jest testing patterns
│   │   ├── security/           # Auth, GDPR, encryption
│   │   ├── database/           # PostgreSQL patterns
│   │   ├── api-design/         # REST API conventions
│   │   ├── deployment/         # Docker & infrastructure
│   │   └── notifications/      # Chatbot & push notifications
│   ├── commands/               # Shell scripts (start, stop, backup...)
│   ├── rules/                  # Documentation & guidelines
│   └── agents/                 # Agent definitions (TBD)
└── project-main/               # Main application packages
    ├── services/               # Microservices
    ├── shared/                 # Shared modules
    ├── infrastructure/         # Migrations, seeds, nginx
    ├── dashboard/              # Frontend (HTML/CSS/JS)
    ├── tests/                  # Jest tests
    ├── docker-compose.yml
    ├── package.json
    ├── prd/                    # Product requirements & docs
    │   ├── README.md
    │   ├── ΕΡΓΑΝΗ ΙΙ - Οδηγός Χρήσης Διαλειτουργικοτήτων.md
    │   └── Οδηγός Υλοποίησης Ψηφιακής Κάρτας Εργασίας.md
    └── memory/
        └── MEMORY.md           # This file
```

---

## 🔑 Key Architecture Decisions

### Multi-tenant SaaS
- Every DB query **must** include `WHERE company_id = $1`
- `company_id` always comes from JWT claim — never from request body
- Tenant isolation is the #1 security concern

### Chatbot Entry Point
- Messenger/Viber webhooks → `webhook-gateway` → Kafka → `message-processor`
- Intent detection in `message-processor/handlers/`
- Responses via `notification-service/template-engine.js`

### ΕΡΓΑΝΗ ΙΙ Integration
- All work card submissions go through `services/ergani-client/`
- Submission result stored in `check_ins.ergani_submission_status`
- Failed submissions must be retried (dead-letter logic in ergani-client)

### Fraud Detection
- GPS spoofing detection in `services/message-processor/fraud/detector.js`
- Checks: outside geofence, repeated identical coords, timestamp anomalies
- Fraud flags stored with evidence for audit

---

## 🚦 Service Ports (Docker)
| Service         | Port     |
| --------------- | -------- |
| PostgreSQL      | 5432     |
| Redis           | 6379     |
| Kafka           | 9092     |
| webhook-gateway | 3000     |
| admin-api       | 3001     |
| super-admin-api | 3002     |
| scheduler       | 3003     |
| Nginx (public)  | 80 / 443 |

---

## 📌 Important Patterns Learned

### DB Query Pattern
```javascript
// Always parameterized, always company-scoped
const { rows } = await db.query(
  'SELECT * FROM employees WHERE company_id = $1',
  [req.user.companyId]
);
```

### Error Response Pattern
```javascript
reply.status(400).send({
  success: false,
  error: 'ERROR_CODE',
  message: 'Μήνυμα στα Ελληνικά για τον χρήστη'
});
```

---

## 🐛 Known Issues & Gotchas

<!-- Add bugs and quirks as they are discovered -->
- [ ] Ergani API sandbox credentials differ from production — see `.env.example`
- [ ] Kafka consumer group IDs must be unique per service

---

## 📅 Session Log

<!-- Claude: append new entries here after each session -->
| Date       | Summary                                                                                                                       |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 2026-03-22 | Initial project restructure: created claude/ folder with skills, commands, rules; created project-main/ with prd/ and memory/ |

---

## 🔗 Key Files Quick Reference
| Purpose                | File                                                            |
| ---------------------- | --------------------------------------------------------------- |
| Main AI context        | `claude/CLAUDE.md`                                              |
| Project settings       | `claude/settings.json`                                          |
| Start services         | `claude/commands/start.sh`                                      |
| DB migrations          | `project-main/infrastructure/migrations/`                       |
| Check-in flow          | `project-main/services/message-processor/handlers/`             |
| Ergani client          | `project-main/services/ergani-client/`                          |
| Fraud detector         | `project-main/services/message-processor/fraud/detector.js`     |
| Notification templates | `project-main/services/notification-service/template-engine.js` |
| Employer dashboard     | `project-main/dashboard/index.html`                             |
| Super-admin dashboard  | `project-main/dashboard/super.html`                             |
