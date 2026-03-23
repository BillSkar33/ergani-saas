# CLAUDE.md — Ergani SaaS Master Context

> This file is the primary context document for AI assistants working on this project.
> Read this first. Then read `project-main/memory/MEMORY.md` for session-specific context.

---

## 🎯 Project Overview

**Ergani SaaS** is a multi-tenant B2B SaaS platform that automates the **Ψηφιακή Κάρτα Εργασίας** (Digital Work Card) process mandated by Greek labor law via the **ΕΡΓΑΝΗ ΙΙ** government API.

**Core value prop**: Employers register their company, employees check in/out via Facebook Messenger or Viber chatbot, the system validates GPS geofencing, detects fraud, and automatically submits work card records to ΕΡΓΑΝΗ ΙΙ in real-time.

### Key Concepts
| Concept | Description |
|---------|-------------|
| **ΕΡΓΑΝΗ ΙΙ** | Greek Ministry of Labour digital system for work cards |
| **Ψηφιακή Κάρτα Εργασίας** | Digital work card — mandatory check-in/out record |
| **Geofencing** | GPS zone validation — employees must be on-site to check in |
| **Multi-tenant** | One platform, many companies (employers), each isolated |
| **Chatbot** | Messenger/Viber bot for employee interactions |

---

## 📁 Repository Structure

```
ergani/
├── claude/                     # AI context & development assets
│   ├── CLAUDE.md               # ← You are here
│   ├── settings.json           # Project configuration for Claude
│   ├── skills/                 # Domain-specific development guides
│   │   ├── ui/SKILL.md         # Dashboard frontend (HTML/CSS/JS)
│   │   ├── backend/SKILL.md    # Fastify microservices patterns
│   │   ├── tests/SKILL.md      # Jest testing strategy
│   │   ├── security/SKILL.md   # Auth, GDPR, encryption
│   │   ├── database/SKILL.md   # PostgreSQL patterns & migrations
│   │   ├── api-design/SKILL.md # REST API conventions
│   │   ├── deployment/SKILL.md # Docker & infrastructure
│   │   └── notifications/SKILL.md # Chatbot & scheduling
│   ├── commands/               # Shell scripts for common operations
│   │   ├── start.sh            # Start all Docker services
│   │   ├── stop.sh             # Stop all services
│   │   ├── restart.sh          # Restart services
│   │   ├── status.sh           # Health check all services
│   │   ├── logs.sh             # Tail service logs
│   │   ├── backup.sh           # Database backup
│   │   ├── db-setup.sh         # Initialize database
│   │   ├── first-setup.sh      # First-time project setup
│   │   └── test.sh             # Run test suite
│   ├── rules/                  # Documentation & guidelines
│   │   ├── DOCUMENTATION.md    # Full technical documentation
│   │   ├── SECURITY_PLANNER.md # Security roadmap
│   │   ├── SECURITY_REPORT.md  # Security audit results
│   │   ├── USE_CASES_AND_USER_STORIES.md
│   │   ├── ADMIN_SETUP_GUIDE.md
│   │   ├── DASHBOARD_GUIDE.md
│   │   ├── SANDBOX_GUIDE.md    # Dev/test sandbox guide
│   │   ├── SCRIPTS_GUIDE.md    # Commands reference
│   │   ├── GITHUB_SETUP_GUIDE.md
│   │   └── CHEATSHEET.md       # Quick reference
│   └── agents/                 # Agent definitions (reserved for future use)
│
└── project-main/               # Application source code
    ├── services/               # Microservices
    │   ├── webhook-gateway/    # Receives Messenger/Viber webhooks
    │   ├── message-processor/  # Core chatbot logic, fraud detection
    │   ├── admin-api/          # REST API for employer dashboard
    │   ├── super-admin-api/    # REST API for super-admin
    │   ├── ergani-client/      # ΕΡΓΑΝΗ ΙΙ API integration
    │   ├── scheduler/          # Cron jobs & proactive notifications
    │   └── notification-service/ # Push notification dispatcher
    ├── shared/                 # Shared modules (db, redis, kafka, security...)
    ├── infrastructure/         # Migrations, seeds, nginx config
    ├── dashboard/              # Frontend (HTML/CSS/JS)
    ├── tests/                  # Jest test suites
    ├── docker-compose.yml      # Container orchestration
    ├── package.json            # Node.js dependencies
    ├── prd/                    # Product requirements documents
    │   ├── README.md           # Project README
    │   ├── ΕΡΓΑΝΗ ΙΙ - Οδηγός Χρήσης Διαλειτουργικοτήτων.md
    │   └── Οδηγός Υλοποίησης Ψηφιακής Κάρτας Εργασίας.md
    └── memory/
        └── MEMORY.md           # Living session memory index
```

---

## 🏗️ Architecture

### System Flow
```
Employee (phone)
     │
     ▼ Messenger / Viber message
webhook-gateway (port 3000)
     │
     ▼ Kafka topic: incoming-messages
message-processor
     ├── Intent detection
     ├── GPS geofence validation
     ├── Fraud detection (fraud/detector.js)
     ├── Handler dispatch (handlers/)
     │    └── Check-in handler → ergani-client → ΕΡΓΑΝΗ ΙΙ API
     └── Response via notification-service
          └── template-engine.js → Messenger/Viber reply

Employer (browser)
     │
     ▼ HTTPS
Nginx → admin-api (port 3001)
     │
     ▼
PostgreSQL + Redis
```

### Services
| Service | Port | Role |
|---------|------|------|
| `webhook-gateway` | 3000 | Entry point for chatbot webhooks |
| `message-processor` | — | Core logic (Kafka consumer) |
| `admin-api` | 3001 | Employer dashboard REST API |
| `super-admin-api` | 3002 | Platform admin REST API |
| `ergani-client` | — | ΕΡΓΑΝΗ ΙΙ API client library |
| `scheduler` | 3003 | Cron jobs & proactive notifications |
| `notification-service` | — | Push notification dispatcher |

### Shared Infrastructure
| Component | Use |
|-----------|-----|
| PostgreSQL | Primary data store |
| Redis | Sessions, caching, rate limiting |
| Kafka | Async message queue between services |
| Nginx | Reverse proxy, SSL termination |

---

## 🧠 How to Use Context Files

### Before starting ANY task:
1. 📖 Read **this file** (CLAUDE.md) — project overview & structure
2. 📖 Read **`project-main/memory/MEMORY.md`** — recent decisions & session log
3. 📖 Read the relevant **`claude/skills/*/SKILL.md`** — domain-specific patterns

### Skill files to read by task type:
| Task type | Read SKILL.md |
|-----------|--------------|
| Dashboard / UI work | `claude/skills/ui/SKILL.md` |
| Backend service work | `claude/skills/backend/SKILL.md` |
| Writing tests | `claude/skills/tests/SKILL.md` |
| Security / auth / GDPR | `claude/skills/security/SKILL.md` |
| Database / migrations | `claude/skills/database/SKILL.md` |
| API endpoint design | `claude/skills/api-design/SKILL.md` |
| Docker / deployment | `claude/skills/deployment/SKILL.md` |
| Notifications / chatbot | `claude/skills/notifications/SKILL.md` |

### Rules (docs) to consult:
| Need | Read |
|------|------|
| Full system docs | `claude/rules/DOCUMENTATION.md` |
| Security guidelines | `claude/rules/SECURITY_PLANNER.md` |
| Dashboard usage | `claude/rules/DASHBOARD_GUIDE.md` |
| Scripts reference | `claude/rules/SCRIPTS_GUIDE.md` |
| Dev/test setup | `claude/rules/SANDBOX_GUIDE.md` |
| Use cases | `claude/rules/USE_CASES_AND_USER_STORIES.md` |

### After completing a task:
- Update **`project-main/memory/MEMORY.md`** — append to Session Log, update Known Issues if relevant

---

## ⚡ Quick Start Commands

```bash
# First-time setup
./claude/commands/first-setup.sh

# Start all services
./claude/commands/start.sh

# Check health
./claude/commands/status.sh

# Run migrations
cd project-main && npm run migrate

# Run tests
cd project-main && npm test

# View logs
./claude/commands/logs.sh
```

---

## 🔐 Critical Rules (Always Apply)

1. **Multi-tenant safety** — ALWAYS filter DB queries by `company_id` from JWT, never from request body
2. **Parameterized queries** — NEVER use string interpolation in SQL
3. **Encrypted PII** — AFM, AMKA, and personal data always encrypted via `shared/encryption`
4. **Greek error messages** — User-facing messages must be in Greek
5. **No secrets in code** — All credentials via `.env` only
6. **Structured logging** — Use Pino logger, never `console.log` in production
7. **Fastify schemas** — Always define input validation schemas on routes

---

## 📚 Domain Knowledge

### ΕΡΓΑΝΗ ΙΙ API
- Greek government API for submitting digital work card events
- Requires business credentials (`ERGANI_USERNAME`, `ERGANI_PASSWORD`)
- Sandbox environment available — see `claude/rules/SANDBOX_GUIDE.md`
- All submissions must include: AFM employer, AFM employee, timestamp, type (IN/OUT)

### Work Card Types
| Type | Description |
|------|-------------|
| `CHECK_IN` | Employee arrives at work |
| `CHECK_OUT` | Employee departs from work |

### Business Roles
| Role | Who | Access |
|------|-----|--------|
| `super_admin` | Platform owner | All companies, billing, system |
| `employer` | Company owner/HR | Own company data |
| `employee` | Worker | Check-in/out, own records |
