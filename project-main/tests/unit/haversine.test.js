/**
 * ============================================================
 * UNIT TESTS: Haversine Distance Algorithm
 * 
 * Τεστάρει τον υπολογισμό απόστασης Haversine
 * μεταξύ GPS σημείων. Κρίσιμο για σωστό geofencing.
 * ============================================================
 */

const { haversine, toRadians, EARTH_RADIUS_METERS } = require('../../services/message-processor/geofencing/haversine');

describe('Haversine Distance Algorithm', () => {
    // --- Test 1: Ίδιο σημείο → 0 μέτρα ---
    test('ίδιο σημείο πρέπει να επιστρέφει 0 μέτρα', () => {
        const distance = haversine(37.9838, 23.7275, 37.9838, 23.7275);
        expect(distance).toBe(0);
    });

    // --- Test 2: Κοντινά σημεία στην Αθήνα (~30m) ---
    test('σημεία ~30m μακριά πρέπει να επιστρέφουν ~30 μέτρα', () => {
        // Σύνταγμα → ~30m βόρεια
        const distance = haversine(37.9755, 23.7348, 37.9758, 23.7348);
        expect(distance).toBeGreaterThan(25);
        expect(distance).toBeLessThan(40);
    });

    // --- Test 3: Σημεία ~500m μακριά ---
    test('σημεία ~500m μακριά πρέπει να επιστρέφουν ~500 μέτρα', () => {
        // Σύνταγμα → Μοναστηράκι (~500m)
        const distance = haversine(37.9755, 23.7348, 37.9765, 23.7270);
        expect(distance).toBeGreaterThan(400);
        expect(distance).toBeLessThan(900);
    });

    // --- Test 4: Μεγάλη απόσταση (Αθήνα → Θεσσαλονίκη ~300km) ---
    test('Αθήνα → Θεσσαλονίκη πρέπει να είναι ~300km', () => {
        const distance = haversine(37.9838, 23.7275, 40.6401, 22.9444);
        const km = distance / 1000;
        expect(km).toBeGreaterThan(280);
        expect(km).toBeLessThan(320);
    });

    // --- Test 5: Αντίποδες (Αθήνα → Sydney ~16000km) ---
    test('Αθήνα → Sydney πρέπει να είναι ~15000-17000km', () => {
        const distance = haversine(37.9838, 23.7275, -33.8688, 151.2093);
        const km = distance / 1000;
        expect(km).toBeGreaterThan(14000);
        expect(km).toBeLessThan(17000);
    });

    // --- Test 6: Μηδενικές συντεταγμένες (0,0) → πρέπει να λειτουργεί ---
    test('μηδενικές συντεταγμένες (0,0) πρέπει να δίνουν σωστή απόσταση', () => {
        const distance = haversine(0, 0, 37.9838, 23.7275);
        expect(distance).toBeGreaterThan(0);
        // Μεσημβρινός → Αθήνα ~4500km
        const km = distance / 1000;
        expect(km).toBeGreaterThan(4000);
        expect(km).toBeLessThan(5000);
    });

    // --- Test 7: Ακριβώς στο όριο (40m geofence) ---
    test('σημείο ακριβώς στα 40m πρέπει να υπολογιστεί σωστά', () => {
        // Μετακίνηση ~40m (0.00036 μοίρες ≈ 40m)
        const officeLat = 37.9838;
        const officeLng = 23.7275;
        const nearbyLat = 37.9838 + 0.00036;
        const nearbyLng = 23.7275;

        const distance = haversine(officeLat, officeLng, nearbyLat, nearbyLng);
        expect(distance).toBeGreaterThan(35);
        expect(distance).toBeLessThan(45);
    });

    // --- Test 8: toRadians μετατροπή ---
    test('μετατροπή μοιρών σε ακτίνια', () => {
        expect(toRadians(0)).toBe(0);
        expect(toRadians(180)).toBeCloseTo(Math.PI, 10);
        expect(toRadians(90)).toBeCloseTo(Math.PI / 2, 10);
        expect(toRadians(360)).toBeCloseTo(2 * Math.PI, 10);
    });

    // --- Test 9: Σταθερά ακτίνας Γης ---
    test('ακτίνα Γης πρέπει να είναι ~6371000 μέτρα', () => {
        expect(EARTH_RADIUS_METERS).toBe(6371000);
    });
});
