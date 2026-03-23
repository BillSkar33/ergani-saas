# API Design Skill — REST API Patterns

## Overview
Guidelines for designing and implementing REST API endpoints in the Ergani SaaS Fastify services.

## Base URL Structure
```
/api/v1/...              # admin-api (employer-facing)
/super/api/v1/...        # super-admin-api (platform admin)
/webhook/...             # webhook-gateway (Messenger/Viber)
```

## Route Organization (admin-api)
```
project-main/services/admin-api/routes/
├── auth.js          # POST /login, POST /refresh, POST /logout
├── employees.js     # CRUD for employees
├── shifts.js        # Shift management
├── schedules.js     # Schedule templates
├── geofences.js     # GPS zones
├── checkins.js      # Check-in history & stats
└── reports.js       # Analytics & exports
```

## Response Format

### Success
```json
{
  "success": true,
  "data": { ... },
  "meta": { "total": 100, "page": 1, "limit": 20 }
}
```

### Error
```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable message in Greek",
  "details": { "field": "afm", "issue": "invalid format" }
}
```

## Standard Error Codes
| Code | HTTP | Meaning |
|------|------|---------|
| `UNAUTHORIZED` | 401 | Missing/invalid JWT |
| `FORBIDDEN` | 403 | Insufficient role |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid input |
| `CONFLICT` | 409 | Duplicate resource |
| `ERGANI_ERROR` | 502 | ΕΡΓΑΝΗ ΙΙ API failure |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

## Route Template
```javascript
'use strict';
const db = require('../../shared/db');
const { verifyJWT, requireRole } = require('../../shared/security');

module.exports = async function (fastify, opts) {
  // GET list with pagination
  fastify.get('/employees', {
    preHandler: [verifyJWT, requireRole('employer')],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20, maximum: 100 }
        }
      }
    }
  }, async (req, reply) => {
    const { page, limit } = req.query;
    const offset = (page - 1) * limit;
    const companyId = req.user.companyId;

    const { rows } = await db.query(
      'SELECT id, name, afm FROM employees WHERE company_id = $1 LIMIT $2 OFFSET $3',
      [companyId, limit, offset]
    );
    return { success: true, data: rows };
  });
};
```

## Fastify Schema Validation
- Always define `schema` for body, querystring, params
- Use `$ref` for shared schemas registered with `fastify.addSchema`
- Let Fastify handle 400 for schema violations automatically

## Versioning
- Current: v1 (implicit in URL structure)
- Breaking changes → new version prefix
- Maintain backward compatibility for at least 1 major version

## Do's & Don'ts
- ✅ Return consistent JSON structure always
- ✅ Use HTTP status codes correctly (201 for create, 204 for delete)
- ✅ Paginate all list endpoints
- ✅ Return Greek error messages for user-facing errors
- ❌ Never expose internal IDs from ΕΡΓΑΝΗ ΙΙ API carelessly
- ❌ Never accept `companyId` from request body — always from JWT
