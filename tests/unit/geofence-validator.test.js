/**
 * ============================================================
 * UNIT TESTS: Geofence Validator
 * 
 * Τεστάρει τη λογική geofencing:
 * ακρίβεια GPS, εξωτερικοί εργαζόμενοι, spoofing detection.
 * ============================================================
 */

const { validateGeofence, GeofenceStatus } = require('../../services/message-processor/geofencing/validator');

// Mock logger
jest.mock('../../shared/logger', () => ({
    debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(),
}));

// Σταθερές — γραφείο στο κέντρο Αθήνας
const OFFICE = { lat: 37.9755, lng: 23.7348 };

describe('Geofence Validator', () => {
    test('εντός ακτίνας → APPROVED', () => {
        const result = validateGeofence({
            employeeLat: 37.9756, employeeLng: 23.7349,
            branchLat: OFFICE.lat, branchLng: OFFICE.lng,
            radiusMeters: 40, horizontalAccuracy: 10,
        });
        expect(result.status).toBe(GeofenceStatus.APPROVED);
        expect(result.distance).toBeLessThan(40);
    });

    test('εκτός ακτίνας → REJECTED', () => {
        const result = validateGeofence({
            employeeLat: 37.9800, employeeLng: 23.7400,
            branchLat: OFFICE.lat, branchLng: OFFICE.lng,
            radiusMeters: 40,
        });
        expect(result.status).toBe(GeofenceStatus.REJECTED);
        expect(result.message).toContain('κατάστημα');
    });

    test('εξωτερικός εργαζόμενος → BYPASSED', () => {
        const result = validateGeofence({
            employeeLat: 40.0, employeeLng: 25.0, // Πολύ μακριά
            branchLat: OFFICE.lat, branchLng: OFFICE.lng,
            radiusMeters: 40, isExternalWorker: true,
        });
        expect(result.status).toBe(GeofenceStatus.BYPASSED);
    });

    test('χαμηλή ακρίβεια GPS → LOW_ACCURACY', () => {
        const result = validateGeofence({
            employeeLat: 37.9756, employeeLng: 23.7349,
            branchLat: OFFICE.lat, branchLng: OFFICE.lng,
            radiusMeters: 40, horizontalAccuracy: 1500, maxAccuracyMeters: 100,
        });
        expect(result.status).toBe(GeofenceStatus.LOW_ACCURACY);
        expect(result.message).toContain('GPS');
    });

    test('accuracy = 0 → flag zero_accuracy', () => {
        const result = validateGeofence({
            employeeLat: 37.9756, employeeLng: 23.7349,
            branchLat: OFFICE.lat, branchLng: OFFICE.lng,
            radiusMeters: 40, horizontalAccuracy: 0,
        });
        expect(result.flags).toContain('zero_accuracy');
    });

    test('συντεταγμένες (0,0) → flag zero_coordinates', () => {
        const result = validateGeofence({
            employeeLat: 0, employeeLng: 0,
            branchLat: OFFICE.lat, branchLng: OFFICE.lng,
            radiusMeters: 40,
        });
        expect(result.flags).toContain('zero_coordinates');
        expect(result.status).toBe(GeofenceStatus.REJECTED);
    });
});
