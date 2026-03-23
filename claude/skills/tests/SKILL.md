# Tests Skill — Jest Testing Strategy

## Overview
Guidelines for writing and maintaining tests for the Ergani SaaS platform.

## Stack
- **Framework**: Jest v29
- **Test types**: Unit, Integration, GDPR compliance

## Test Structure
```
project-main/tests/
├── unit/           # Pure function tests, no external deps
│   ├── fraud/      # Fraud detector logic
│   ├── scheduler/  # Cron expression tests
│   └── shared/     # Encryption, security helpers
└── integration/    # Full service tests with DB/Redis/Kafka
    ├── checkin/    # Check-in flow end-to-end
    ├── ergani/     # ΕΡΓΑΝΗ ΙΙ API submission
    └── gdpr/       # Data export/deletion compliance
```

## Running Tests
```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# GDPR compliance tests
npm run test:gdpr

# Single file
npx jest tests/unit/fraud/detector.test.js --verbose
```

## Unit Test Patterns
```javascript
const { detectFraud } = require('../../../services/message-processor/fraud/detector');

describe('FraudDetector', () => {
  it('should flag GPS coordinates outside geofence', () => {
    const result = detectFraud({
      lat: 999, lng: 999,
      geofence: { lat: 37.97, lng: 23.73, radius: 200 }
    });
    expect(result.flagged).toBe(true);
    expect(result.reason).toBe('OUTSIDE_GEOFENCE');
  });
});
```

## Integration Test Patterns
```javascript
// Always clean up test data
afterEach(async () => {
  await db.query('DELETE FROM check_ins WHERE employee_id = $1', [TEST_EMPLOYEE_ID]);
});

// Use test company/employee IDs from seed data
const TEST_COMPANY_ID = 'test-company-uuid';
```

## Coverage Goals
| Layer            | Target |
| ---------------- | ------ |
| Fraud detection  | 90%+   |
| Ergani client    | 80%+   |
| Auth middleware  | 85%+   |
| Message handlers | 75%+   |

## Do's & Don'ts
- ✅ Mock external APIs (ΕΡΓΑΝΗ ΙΙ, Messenger) in unit tests
- ✅ Use real DB/Redis in integration tests with dedicated test DB
- ✅ Test error paths, not just happy paths
- ❌ Never commit tests that hit production Ergani API
- ❌ Avoid `setTimeout` in tests — use jest fake timers
