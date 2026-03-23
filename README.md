# Digital Work Card — SaaS Chatbot Platform

A complete SaaS solution that allows employees in Greece to easily declare their shift start and end times via popular messenger chatbots (Telegram, Viber, WhatsApp). The system automatically validates and submits the data to the Greek **ERGHANI II** (ΕΡΓΑΝΗ) API.

## ✨ Features

- **Check-in/Check-out via Messengers:** Employees send their GPS location to a bot on Telegram, Viber, or WhatsApp.
- **Geofencing Validation:** Ensures employees are within the branch premises using the Haversine algorithm with accuracy checks.
- **Automatic ERGHANI II Submission:** Automatically formats and submits the digital work card (WRKCardSE) to the national Ergani II API.
- **Fraud Detection:** Advanced security against GPS spoofing and "impossible travel" scenarios.
- **GDPR Compliance:** Automatic anonymization of GPS coordinates after 48 hours.
- **Admin Dashboard:** A robust Single Page Application (SPA) for employers to manage branches, employees, schedules, leaves, and view real-time statistics.
- **Super Admin Panel:** A centralized dashboard for the SaaS owner to manage employer accounts, trial periods, and subscription plans (Trial, Basic, Pro, Enterprise).
- **Proactive Notifications:** Automated shift reminders, leave approval/rejection updates, and weekly scheduling summaries directly via chatbots.
- **Robust Security:** Implements JWT-based authentication, rate limiting, account lockout policies, payload signatures, and DB encryption for Ergani credentials.

## 🏗 System Architecture

The system is built for scale and reliability, utilizing a microservices-inspired architecture:

```text
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Messengers  │────>│  Webhook Gateway │────>│  Apache Kafka   │
│  (Viber/TG   │     │  (Fastify HTTP)  │     │  (Message Queue)│
│   WhatsApp)  │     │  🔒 CORS+Helmet  │     └────────┬────────┘
└──────────────┘     └──────────────────┘              │
                            │                          ▼
                     ┌──────┴──────┐          ┌─────────────────┐
                     │ Admin API   │          │ Message         │
                     │ /api/admin  │          │ Processor       │
                     │ Super Admin │          │ (Kafka Consumer)│
                     │ /api/super  │          └─────────────────┘
                     └─────────────┘                   │
                                              ┌────────┴────────┐
                                              │  ERGHANI Client │
                                              │  + Notifications│
                                              └─────────────────┘
```

## 🛠 Tech Stack

- **Backend:** Node.js 20+, Fastify
- **Database:** PostgreSQL 16
- **Caching & Rate Limiting:** Redis 7
- **Message Broker:** Apache Kafka
- **Security:** bcryptjs, @fastify/helmet, @fastify/cors, AES-256-GCM encryption
- **Testing:** Jest
- **Deployment:** Docker & Docker Compose

## 🚀 Quick Start

### Prerequisites
- Node.js (v20 or higher)
- Docker & Docker Compose

### Automated Setup (Recommended)
You can quickly install and set up the entire project using the provided setup script:
```bash
./scripts/first-setup.sh
```

### Manual Setup
```bash
# 1. Install dependencies
npm install

# 2. Setup environment variables
cp .env.example .env

# 3. Start database and message broker services (PostgreSQL, Redis, Kafka)
docker compose up -d

# 4. Run database migrations and seed demo data
npm run migrate
npm run migrate:trial
npm run seed

# 5. Start the application
./scripts/start.sh
```

## 🧪 Testing

The platform includes a comprehensive test suite (including Haversine distance tests, payload builders, signature verification, and more).

```bash
# Run the test suite (45 tests)
./scripts/test.sh

# Run tests and generate coverage report
./scripts/test.sh --coverage
```

## 📖 Documentation

Detailed documentation (in Greek) can be found in the `docs/` directory:

- [System Documentation](docs/DOCUMENTATION.md) - System overview and architecture details
- [Admin Setup Guide](docs/ADMIN_SETUP_GUIDE.md) - Full deployment and infrastructure guide
- [Dashboard Guide](docs/DASHBOARD_GUIDE.md) - Guide for navigating the Admin and Super Admin SPA
- [Scripts Cheatsheet](docs/SCRIPTS_GUIDE.md) - Guide on using the 11 automation scripts
- [Security Planner & Report](docs/SECURITY_PLANNER.md) - Security audit and implemented practices
