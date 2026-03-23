/**
 * ============================================================
 * UNIT TESTS: ΕΡΓΑΝΗ Error Mapper
 * 
 * Τεστάρει τη μετατροπή ΕΡΓΑΝΗ σφαλμάτων
 * σε φιλικά ελληνικά μηνύματα.
 * ============================================================
 */

const { mapErganiError } = require('../../services/ergani-client/error-mapper');

// Mock logger
jest.mock('../../shared/logger', () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

describe('ΕΡΓΑΝΗ Error Mapper', () => {
    test('HTTP 400 πρέπει να επιστρέφει φιλικό μήνυμα', () => {
        const result = mapErganiError(400, { message: 'Invalid request' });
        expect(result.employeeMessage).toBeTruthy();
        expect(result.isRetryable).toBe(false);
        expect(result.notifyEmployer).toBe(true);
    });

    test('HTTP 400 "Service Code is not authenticated" πρέπει να ταιριάζει pattern', () => {
        const result = mapErganiError(400, { message: 'Service Code is not authenticated' });
        expect(result.employeeMessage).toContain('Σφάλμα σύνδεσης');
        expect(result.severity).toBe('critical');
    });

    test('HTTP 401 πρέπει να είναι retryable', () => {
        const result = mapErganiError(401, {});
        expect(result.employeeMessage).toBeNull(); // Αυτόματο retry
        expect(result.isRetryable).toBe(true);
    });

    test('HTTP 500 πρέπει να ενημερώνει για αναμονή', () => {
        const result = mapErganiError(500, {});
        expect(result.employeeMessage).toContain('δεν ανταποκρίνεται');
        expect(result.isRetryable).toBe(true);
    });

    test('HTTP 503 πρέπει να αναφέρει συντήρηση', () => {
        const result = mapErganiError(503, {});
        expect(result.employeeMessage).toContain('συντήρηση');
        expect(result.isRetryable).toBe(true);
    });

    test('Timeout (null status) πρέπει να είναι retryable', () => {
        const result = mapErganiError(null, null);
        expect(result.employeeMessage).toContain('σύνδεσης');
        expect(result.isRetryable).toBe(true);
    });

    test('Άγνωστο error (418) πρέπει να επιστρέφει generic', () => {
        const result = mapErganiError(418, { teapot: true });
        expect(result.employeeMessage).toBeTruthy();
        expect(result.notifyEmployer).toBe(true);
    });
});
