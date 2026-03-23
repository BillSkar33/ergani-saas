/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — SaaS Platform
 * Geofence Validator — Επαλήθευση Τοποθεσίας Εργαζομένου
 * 
 * Ελέγχει αν ο εργαζόμενος βρίσκεται εντός του geofence
 * του καταστήματος, λαμβάνοντας υπόψη:
 * 1. Ακρίβεια GPS (horizontal_accuracy)
 * 2. Απόσταση Haversine
 * 3. Ειδική αντιμετώπιση external workers
 * 4. Ανίχνευση ύποπτων μοτίβων (GPS spoofing)
 * ============================================================
 */

'use strict';

const { haversine } = require('./haversine');
const logger = require('../../../shared/logger');

/**
 * Αποτελέσματα επαλήθευσης (enum-like)
 * 
 * APPROVED: Εντός geofence — η ενέργεια εγκρίνεται
 * REJECTED: Εκτός geofence — η ενέργεια απορρίπτεται
 * BYPASSED: Εξωτερικός εργαζόμενος — παράκαμψη geofence
 * LOW_ACCURACY: Η ακρίβεια GPS είναι πολύ χαμηλή
 * SUSPICIOUS: Ύποπτα GPS δεδομένα (πιθανό spoofing)
 */
const GeofenceStatus = {
    APPROVED: 'approved',
    REJECTED: 'rejected',
    BYPASSED: 'bypassed',
    LOW_ACCURACY: 'low_accuracy',
    SUSPICIOUS: 'suspicious',
};

/**
 * Κύρια συνάρτηση επαλήθευσης geofence
 * 
 * Εκτελεί τη σειρά ελέγχων:
 * 1. Εξωτερικός εργαζόμενος → BYPASSED
 * 2. Έλεγχος ακρίβειας GPS → LOW_ACCURACY αν πάνω από threshold
 * 3. Ανίχνευση ύποπτων GPS (accuracy = 0, zero coordinates)
 * 4. Υπολογισμός Haversine → APPROVED/REJECTED
 * 
 * @param {Object} params - Παράμετροι επαλήθευσης
 * @param {number} params.employeeLat - GPS πλάτος εργαζομένου
 * @param {number} params.employeeLng - GPS μήκος εργαζομένου
 * @param {number} params.branchLat - GPS πλάτος καταστήματος
 * @param {number} params.branchLng - GPS μήκος καταστήματος
 * @param {number} params.radiusMeters - Ακτίνα geofence (μέτρα)
 * @param {number} [params.horizontalAccuracy] - Ακρίβεια GPS (μέτρα, αν διαθέσιμo)
 * @param {number} [params.maxAccuracyMeters=100] - Μέγιστη αποδεκτή ακρίβεια
 * @param {boolean} [params.isExternalWorker=false] - Εξωτερικός εργαζόμενος
 * 
 * @returns {Object} Αποτέλεσμα:
 *   - status: GeofenceStatus (approved/rejected/bypassed/low_accuracy/suspicious)
 *   - distance: Απόσταση σε μέτρα
 *   - message: Μήνυμα προς τον εργαζόμενο (Ελληνικά)
 *   - flags: Πιθανές ενδείξεις (π.χ. zero_accuracy)
 */
function validateGeofence({
    employeeLat,
    employeeLng,
    branchLat,
    branchLng,
    radiusMeters,
    horizontalAccuracy = null,
    maxAccuracyMeters = 100,
    isExternalWorker = false,
}) {
    // Συλλογή flags για πιθανές ανωμαλίες
    const flags = [];

    // --- Βήμα 1: Εξωτερικός εργαζόμενος — παράκαμψη geofence ---
    // Ο εργοδότης μπορεί να mark-άρει εργαζομένους ως εξωτερικούς
    // Η τοποθεσία καταγράφεται μόνο για audit
    if (isExternalWorker) {
        const distance = haversine(employeeLat, employeeLng, branchLat, branchLng);

        logger.info({
            status: GeofenceStatus.BYPASSED,
            distance,
        }, 'Εξωτερικός εργαζόμενος — geofence bypass');

        return {
            status: GeofenceStatus.BYPASSED,
            distance,
            message: 'Η τοποθεσία καταγράφηκε (εξωτερικός εργαζόμενος).',
            flags,
        };
    }

    // --- Βήμα 2: Ανίχνευση ύποπτων GPS δεδομένων ---

    // Ύποπτο: accuracy ακριβώς 0 — πιθανή χρήση mock GPS app
    if (horizontalAccuracy !== null && horizontalAccuracy === 0) {
        flags.push('zero_accuracy');
        logger.warn({
            accuracy: horizontalAccuracy,
        }, 'Ύποπτη ακρίβεια GPS: 0 — πιθανό mock GPS');
    }

    // Ύποπτο: συντεταγμένες (0, 0) — μέση Ατλαντικού ωκεανού
    if (employeeLat === 0 && employeeLng === 0) {
        flags.push('zero_coordinates');
        logger.warn('Μηδενικές GPS συντεταγμένες (0, 0) — σημαία');
    }

    // --- Βήμα 3: Έλεγχος ακρίβειας GPS ---
    // Αν η ακρίβεια υπερβαίνει το threshold, δεν μπορούμε να εμπιστευτούμε τη θέση
    if (horizontalAccuracy !== null && horizontalAccuracy > maxAccuracyMeters) {
        logger.info({
            accuracy: horizontalAccuracy,
            threshold: maxAccuracyMeters,
        }, 'Χαμηλή ακρίβεια GPS — απόρριψη');

        return {
            status: GeofenceStatus.LOW_ACCURACY,
            distance: null,
            message: `Αδυναμία εντοπισμού θέσης. Η ακρίβεια GPS είναι ${Math.round(horizontalAccuracy)}m (μέγιστο: ${maxAccuracyMeters}m). Ανοίξτε το GPS και δοκιμάστε ξανά.`,
            flags,
        };
    }

    // --- Βήμα 4: Υπολογισμός απόστασης Haversine ---
    const distance = haversine(employeeLat, employeeLng, branchLat, branchLng);

    // Έλεγχος: είναι η απόσταση εντός της ακτίνας; (inclusive — ακριβώς στο όριο = OK)
    if (distance <= radiusMeters) {
        logger.info({
            status: GeofenceStatus.APPROVED,
            distance,
            radius: radiusMeters,
        }, 'Geofence OK — εντός ακτίνας');

        return {
            status: GeofenceStatus.APPROVED,
            distance,
            message: null, // Δεν χρειάζεται μήνυμα — η ενέργεια προχωράει κανονικά
            flags,
        };
    }

    // --- Εκτός ακτίνας → REJECTED ---
    logger.info({
        status: GeofenceStatus.REJECTED,
        distance,
        radius: radiusMeters,
    }, 'Geofence FAIL — εκτός ακτίνας');

    return {
        status: GeofenceStatus.REJECTED,
        distance,
        message: `Δεν βρίσκεστε κοντά στο κατάστημα. Απόσταση: ${Math.round(distance)}m (μέγιστο: ${radiusMeters}m).`,
        flags,
    };
}

module.exports = { validateGeofence, GeofenceStatus };
