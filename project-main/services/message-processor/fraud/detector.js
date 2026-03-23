/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — SaaS Platform
 * Fraud Detector — Ανίχνευση GPS Spoofing & Ύποπτων Μοτίβων
 * 
 * Αναλύει τα GPS δεδομένα κάθε check-in/check-out
 * για ανίχνευση:
 * - GPS Spoofing (mock apps)
 * - Impossible travel (φυσικά αδύνατες μετακινήσεις)
 * - Ύποπτα patterns (ίδιες ακριβώς συντεταγμένες)
 * - Zero accuracy (τεχνητό GPS)
 * 
 * Αποτελέσματα: Fraud alerts στον πίνακα fraud_alerts
 * + Trust score ενημέρωση στον εργαζόμενο
 * ============================================================
 */

'use strict';

const db = require('../../../shared/db');
const logger = require('../../../shared/logger');
const { haversine } = require('../geofencing/haversine');

/**
 * Κατώφλια ανίχνευσης
 */
const THRESHOLDS = {
    // Ταχύτητα 150 km/h → αδύνατη μετακίνηση εντός 10 λεπτών
    IMPOSSIBLE_TRAVEL_KMH: 150,
    // Αν οι τελευταίες 5 τοποθεσίες ταιριάζουν σε 5+ δεκαδικά → spoofing
    EXACT_COORDS_THRESHOLD: 5,
    // Minimum χρόνος μεταξύ check-ins (λεπτά) για impossible travel check
    MIN_TIME_DIFF_MINUTES: 2,
    // Trust score αλλαγές
    TRUST_NORMAL_CHECKIN: 1,      // +1 για κανονικό check-in
    TRUST_GPS_REJECTION: -10,     // -10 για GPS rejection
    TRUST_FRAUD_ALERT: -20,       // -20 για fraud alert
    TRUST_IMPOSSIBLE_TRAVEL: -30, // -30 για impossible travel
};

/**
 * Ανάλυση GPS δεδομένων για ύποπτη δραστηριότητα
 * 
 * Εκτελείται ασύγχρονα μετά κάθε check-in/check-out.
 * Δεν μπλοκάρει τη ροή — τα fraud alerts καταγράφονται
 * στη βάση για εξέταση από τον εργοδότη.
 * 
 * @param {Object} params
 * @param {string} params.employeeId - ID εργαζομένου
 * @param {number} params.latitude - GPS πλάτος
 * @param {number} params.longitude - GPS μήκος
 * @param {number} params.horizontalAccuracy - Ακρίβεια GPS
 * @param {string} params.actionType - 'check_in' ή 'check_out'
 */
async function analyze({ employeeId, latitude, longitude, horizontalAccuracy, actionType }) {
    const alerts = [];

    try {
        // --- Έλεγχος 1: Zero accuracy (mock GPS) ---
        if (horizontalAccuracy !== null && horizontalAccuracy === 0) {
            alerts.push({
                type: 'zero_accuracy',
                severity: 'high',
                details: {
                    accuracy: horizontalAccuracy,
                    message: 'Ακρίβεια GPS = 0 — πιθανή χρήση mock GPS εφαρμογής',
                },
            });
        }

        // --- Έλεγχος 2: Μηδενικές συντεταγμένες (0,0) ---
        if (latitude === 0 && longitude === 0) {
            alerts.push({
                type: 'zero_coordinates',
                severity: 'critical',
                details: {
                    latitude, longitude,
                    message: 'Συντεταγμένες (0,0) — μέση Ατλαντικού ωκεανού',
                },
            });
        }

        // --- Έλεγχος 3: Impossible travel ---
        await checkImpossibleTravel(employeeId, latitude, longitude, alerts);

        // --- Έλεγχος 4: Επαναλαμβανόμενες ίδιες συντεταγμένες ---
        await checkExactCoordinates(employeeId, latitude, longitude, alerts);

        // --- Αποθήκευση fraud alerts ---
        for (const alert of alerts) {
            await db.query(
                `INSERT INTO fraud_alerts (employee_id, alert_type, severity, details)
         VALUES ($1, $2, $3, $4)`,
                [employeeId, alert.type, alert.severity, JSON.stringify(alert.details)]
            );

            logger.warn({
                employeeId,
                alertType: alert.type,
                severity: alert.severity,
            }, 'FRAUD ALERT — ύποπτη GPS δραστηριότητα');
        }

        // --- Ενημέρωση Trust Score ---
        if (alerts.length > 0) {
            // Μείωση trust score βάσει σοβαρότητας
            const worstSeverity = alerts.reduce((worst, alert) => {
                const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
                return severityOrder[alert.severity] > severityOrder[worst] ? alert.severity : worst;
            }, 'low');

            const trustDelta = worstSeverity === 'critical' ? THRESHOLDS.TRUST_IMPOSSIBLE_TRAVEL :
                worstSeverity === 'high' ? THRESHOLDS.TRUST_FRAUD_ALERT :
                    THRESHOLDS.TRUST_GPS_REJECTION;

            await updateTrustScore(employeeId, trustDelta);
        } else {
            // Κανονικό check-in → μικρή αύξηση trust score
            await updateTrustScore(employeeId, THRESHOLDS.TRUST_NORMAL_CHECKIN);
        }

    } catch (err) {
        logger.error({ err, employeeId }, 'Σφάλμα fraud detection');
    }
}

/**
 * Έλεγχος αδύνατης μετακίνησης (Impossible Travel)
 * 
 * Αν ο εργαζόμενος έκανε check-in σε σημείο Α 10 λεπτά πριν
 * και τώρα κάνει check-in 50 km μακριά → αδύνατη ταχύτητα.
 * 
 * @param {string} employeeId - ID εργαζομένου
 * @param {number} lat - Τρέχον πλάτος
 * @param {number} lng - Τρέχον μήκος
 * @param {Array} alerts - Λίστα alerts (mutated)
 */
async function checkImpossibleTravel(employeeId, lat, lng, alerts) {
    // Εύρεση τελευταίου check-in εντός 30 λεπτών
    const result = await db.query(
        `SELECT latitude, longitude, event_timestamp
     FROM time_stamps
     WHERE employee_id = $1
       AND latitude IS NOT NULL
       AND longitude IS NOT NULL
       AND event_timestamp > NOW() - INTERVAL '30 minutes'
     ORDER BY event_timestamp DESC LIMIT 1`,
        [employeeId]
    );

    if (result.rowCount === 0) return;

    const prev = result.rows[0];
    const distance = haversine(lat, lng, parseFloat(prev.latitude), parseFloat(prev.longitude));
    const timeDiffMs = Date.now() - new Date(prev.event_timestamp).getTime();
    const timeDiffHours = timeDiffMs / (1000 * 60 * 60);

    // Υπολογισμός ταχύτητας σε km/h
    const speedKmh = (distance / 1000) / timeDiffHours;

    if (speedKmh > THRESHOLDS.IMPOSSIBLE_TRAVEL_KMH && timeDiffMs > THRESHOLDS.MIN_TIME_DIFF_MINUTES * 60000) {
        alerts.push({
            type: 'impossible_travel',
            severity: 'critical',
            details: {
                distance: Math.round(distance),
                timeDiffMinutes: Math.round(timeDiffMs / 60000),
                speedKmh: Math.round(speedKmh),
                previousLocation: { lat: parseFloat(prev.latitude), lng: parseFloat(prev.longitude) },
                currentLocation: { lat, lng },
                message: `Αδύνατη μετακίνηση: ${Math.round(distance)}m σε ${Math.round(timeDiffMs / 60000)} λεπτά (${Math.round(speedKmh)} km/h)`,
            },
        });
    }
}

/**
 * Έλεγχος επαναλαμβανόμενων ίδιων συντεταγμένων
 * 
 * Αν οι τελευταίες 5+ τοποθεσίες ταιριάζουν ακριβώς
 * σε 5 δεκαδικά → πιθανό script/mock GPS.
 * 
 * @param {string} employeeId - ID εργαζομένου
 * @param {number} lat - Τρέχον πλάτος
 * @param {number} lng - Τρέχον μήκος
 * @param {Array} alerts - Λίστα alerts
 */
async function checkExactCoordinates(employeeId, lat, lng, alerts) {
    // Στρογγυλοποίηση σε 5 δεκαδικά (ακρίβεια ~1.1 μέτρα)
    const roundedLat = Math.round(lat * 100000) / 100000;
    const roundedLng = Math.round(lng * 100000) / 100000;

    // Μέτρηση πόσα check-ins τελευταίων 7 ημερών ταιριάζουν ακριβώς
    const result = await db.query(
        `SELECT COUNT(*) as count
     FROM time_stamps
     WHERE employee_id = $1
       AND ROUND(CAST(latitude AS NUMERIC), 5) = $2
       AND ROUND(CAST(longitude AS NUMERIC), 5) = $3
       AND created_at > NOW() - INTERVAL '7 days'`,
        [employeeId, roundedLat, roundedLng]
    );

    const count = parseInt(result.rows[0].count, 10);

    if (count >= THRESHOLDS.EXACT_COORDS_THRESHOLD) {
        alerts.push({
            type: 'exact_coordinates',
            severity: 'medium',
            details: {
                matchCount: count,
                roundedCoords: { lat: roundedLat, lng: roundedLng },
                message: `${count} ακριβώς ίδιες συντεταγμένες τελευταίες 7 ημέρες — πιθανό script`,
            },
        });
    }
}

/**
 * Ενημέρωση Trust Score εργαζομένου
 * 
 * Το trust score (0-100) ρυθμίζεται αυτόματα και..
 * ΔΕΝ αποκαλύπτεται στον εργαζόμενο.
 * 
 * @param {string} employeeId - ID εργαζομένου
 * @param {number} delta - Αλλαγή score (+1 ή -10/-20/-30)
 */
async function updateTrustScore(employeeId, delta) {
    try {
        // Κεφαλαίωση στο εύρος 0-100
        await db.query(
            `UPDATE employees
       SET trust_score = GREATEST(0, LEAST(100, trust_score + $1))
       WHERE id = $2`,
            [delta, employeeId]
        );
    } catch (err) {
        logger.error({ err, employeeId, delta }, 'Σφάλμα ενημέρωσης trust score');
    }
}

module.exports = { analyze, THRESHOLDS };
