# Security Skill — Security Patterns & Compliance

## Overview
Security guidelines for the Ergani SaaS platform, covering authentication, data protection, GDPR, and ΕΡΓΑΝΗ ΙΙ compliance.

## Authentication & Authorization

### JWT Strategy
```javascript
// Access token: 15min TTL
// Refresh token: 7d TTL, stored in httpOnly cookie or Redis
const token = jwt.sign(
  { userId, companyId, role },
  process.env.JWT_SECRET,
  { expiresIn: '15m' }
);
```

### Role Hierarchy
| Role | Permissions |
|------|------------|
| `super_admin` | All companies, billing, system config |
| `employer` | Own company: employees, schedules, geofences |
| `employee` | Check-in/out, own records only |

### Middleware
```javascript
// Always use shared security middleware
const { verifyJWT, requireRole } = require('../../shared/security');

fastify.get('/employees', {
  preHandler: [verifyJWT, requireRole('employer')]
}, handler);
```

## Data Protection

### Encryption at Rest
- AES-256-GCM for sensitive fields (AFM, AMKA, personal data)
- Keys from `process.env.ENCRYPTION_KEY` (never hardcoded)
- Use `shared/encryption` module — never implement ad-hoc

### Password Hashing
```javascript
const bcrypt = require('bcryptjs');
const hash = await bcrypt.hash(password, 12); // cost factor 12
```

## GDPR Compliance
- **Right to access**: `/api/gdpr/export` — returns all employee data as JSON
- **Right to erasure**: `/api/gdpr/delete` — anonymizes PII, keeps audit trail
- **Data retention**: Shift records retained 5 years (legal requirement)
- **Logging**: Never log personal data (AFM, AMKA, name) in plaintext

## Rate Limiting
```javascript
// @fastify/rate-limit — applied globally
// Public endpoints: 30 req/min per IP
// Auth endpoints: 10 req/min per IP
// Webhook gateway: 1000 req/min (Messenger/Viber traffic)
```

## Input Validation
```javascript
// Always define Fastify JSON schema for routes
const schema = {
  body: {
    type: 'object',
    required: ['afm', 'timestamp'],
    properties: {
      afm: { type: 'string', pattern: '^[0-9]{9}$' },
      timestamp: { type: 'string', format: 'date-time' }
    }
  }
};
```

## Secrets Management
- All secrets in `.env` (git-ignored)
- `.env.example` documents required vars without values
- In production: use Docker secrets or environment injection
- Rotate `JWT_SECRET` and `ENCRYPTION_KEY` periodically

## Security Headers
- `@fastify/helmet` applied globally
- CORS restricted to known origins only
- CSP headers on dashboard serve

## Audit Trail
- All check-in submissions logged with timestamp, IP, GPS coords
- Admin actions logged (employee create/delete, schedule change)
- Fraud flags logged with evidence

## Do's & Don'ts
- ✅ Validate ALL inputs — never trust client data
- ✅ Use parameterized SQL queries always
- ✅ Apply least-privilege principle on all roles
- ❌ Never log AFM, AMKA, or passwords
- ❌ Never expose stack traces to API responses
- ❌ Never use MD5 or SHA1 for passwords
