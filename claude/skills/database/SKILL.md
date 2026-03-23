# Database Skill — PostgreSQL Patterns

## Overview
Guidelines for database design, migrations, queries, and maintenance for the Ergani SaaS PostgreSQL database.

## Connection
```javascript
// Always use shared/db pool — never create new Pool instances
const db = require('../../shared/db');
const { rows } = await db.query(SQL, params);
```

## Schema Overview
```
companies           — Multi-tenant root entity
employees           — Linked to company, stores AFM/AMKA (encrypted)
shifts              — Planned work shifts per employee
check_ins           — Actual check-in/out records with GPS + Ergani submission status
geofences           — GPS zones per company location
schedules           — Weekly schedule templates
leave_requests      — Leave/absence records
audit_logs          — Immutable audit trail
```

## Migrations
```
project-main/infrastructure/migrations/
├── 001_initial.sql           # Core tables: companies, employees, check_ins
├── 002_trial_system.sql      # Trial/billing system
├── 003_schedules.sql         # Schedules, shifts
└── 004_advanced_features.sql # Geofences, audit logs, GDPR tools
```

### Running Migrations
```bash
npm run migrate                # 001
npm run migrate:trial          # 002
npm run migrate:schedules      # 003
npm run migrate:advanced       # 004
```

### Writing Migrations
```sql
-- Always idempotent with IF NOT EXISTS
CREATE TABLE IF NOT EXISTS new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Always add indexes for FK columns
CREATE INDEX IF NOT EXISTS idx_new_table_company_id ON new_table(company_id);
```

## Query Patterns

### Multi-tenant Safety
```javascript
// ALWAYS filter by company_id — never query cross-tenant
const { rows } = await db.query(
  'SELECT * FROM employees WHERE company_id = $1 AND id = $2',
  [req.user.companyId, employeeId]  // companyId from JWT, never from body
);
```

### Transactions
```javascript
const client = await db.pool.connect();
try {
  await client.query('BEGIN');
  await client.query('INSERT INTO check_ins ...', [...]);
  await client.query('UPDATE shifts SET status = $1 WHERE ...', [...]);
  await client.query('COMMIT');
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();
}
```

### Pagination
```javascript
const { rows } = await db.query(
  'SELECT * FROM check_ins WHERE company_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
  [companyId, limit, offset]
);
```

## Seeds
```
project-main/infrastructure/seeds/
└── demo_data.sql   # Demo company, employees, schedules for testing
```
```bash
npm run seed   # Load demo data
```

## Naming Conventions
- Tables: `snake_case` plural nouns
- Columns: `snake_case`
- Indexes: `idx_{table}_{column(s)}`
- FKs: `{table}_id` referencing `{table}.id`
- All timestamps: `TIMESTAMPTZ` (timezone-aware)

## Do's & Don'ts
- ✅ Always use parameterized queries `$1, $2...`
- ✅ Always filter by `company_id` in multi-tenant queries
- ✅ Use transactions for multi-step writes
- ✅ Add indexes on FK columns and frequently filtered columns
- ❌ Never store AFM/AMKA in plaintext — use `shared/encryption`
- ❌ Never `DELETE` audit logs — only soft-delete or anonymize
- ❌ Avoid `SELECT *` — always specify columns needed
