# Backend Skill — Fastify Microservices Architecture

## Overview
Guidelines for building and maintaining the Node.js/Fastify backend services of Ergani SaaS.

## Stack
- **Runtime**: Node.js >= 20.0.0
- **Framework**: Fastify v5
- **Database**: PostgreSQL via `pg` (raw queries, no ORM)
- **Cache**: Redis via `ioredis`
- **Messaging**: Apache Kafka via `kafkajs`
- **Logging**: Pino + pino-pretty
- **Scheduling**: node-cron
- **Auth**: JWT + bcryptjs

## Services Map
```
project-main/services/
├── webhook-gateway/       # Entry point: receives Messenger/Viber webhooks
├── message-processor/     # Core logic: parse intents, handle check-in flow
│   ├── fraud/             # Fraud detection (GPS spoofing, duplicate submissions)
│   ├── handlers/          # Intent handlers (check-in, leave, schedules...)
│   └── chatbot/           # Message template builders
├── admin-api/             # REST API for employer dashboard
│   └── routes/            # employees, shifts, schedules, geofences, auth...
├── super-admin-api/       # REST API for super-admin (company/billing mgmt)
├── ergani-client/         # ΕΡΓΑΝΗ ΙΙ API integration client
├── scheduler/             # Cron jobs (shift reminders, weekly summaries)
└── notification-service/  # Push notifications via chatbot platforms
    └── template-engine.js # Message template renderer
```

## Coding Patterns

### Fastify Plugin Registration
```javascript
// Always use async plugins
async function routes(fastify, opts) {
  fastify.get('/health', async (req, reply) => {
    return { status: 'ok', service: 'admin-api' };
  });
}
module.exports = routes;
```

### Database Queries
```javascript
// Use parameterized queries — NEVER string interpolation
const { rows } = await db.query(
  'SELECT * FROM employees WHERE company_id = $1 AND active = true',
  [companyId]
);
```

### Error Handling
```javascript
// Always return structured errors
reply.status(400).send({
  success: false,
  error: 'VALIDATION_ERROR',
  message: 'Το πεδίο είναι υποχρεωτικό'
});
```

### Kafka Producer
```javascript
await kafka.producer.send({
  topic: 'checkin-events',
  messages: [{ value: JSON.stringify(payload) }]
});
```

### Redis Caching
```javascript
const cached = await redis.get(`company:${companyId}`);
if (cached) return JSON.parse(cached);
// ... fetch from DB
await redis.setex(`company:${companyId}`, 300, JSON.stringify(data));
```

## Environment Variables
All secrets via `.env` — see `.env.example` for required vars.
Never hardcode credentials. Use `process.env.VAR_NAME`.

## Shared Modules
```
project-main/shared/
├── config/       # Config loader
├── db/           # PostgreSQL pool
├── redis/        # Redis client
├── kafka/        # Kafka producer/consumer
├── logger/       # Pino logger instance
├── encryption/   # AES-256 encryption helpers
├── security/     # Auth middleware, JWT verify
└── scheduling/   # Cron helpers
```

## Do's & Don'ts
- ✅ Always validate input with Fastify schema or manual checks
- ✅ Use transactions for multi-table writes
- ✅ Log with structured Pino — never `console.log` in production
- ✅ Handle Kafka consumer errors with dead-letter logic
- ❌ Never expose internal errors to client (only log them)
- ❌ Never skip rate limiting on public endpoints
