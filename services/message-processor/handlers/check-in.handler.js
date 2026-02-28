/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — SaaS Platform
 * Handler Check-in — Έναρξη Βάρδιας
 * 
 * Ο βασικός handler για check-in εργαζομένου.
 * Ροή:
 * 1. Έλεγχος duplicate check-in (idempotency)
 * 2. Geofence validation (Haversine + accuracy)
 * 3. Δημιουργία WRKCardSE payload
 * 4. Υποβολή στο ΕΡΓΑΝΗ ΙΙ API
 * 5. Αποθήκευση χρονοσήμανσης στη βάση
 * 6. Ειδοποίηση εργαζομένου (chatbot message)
 * 7. Fraud detection (ανίχνευση ύποπτων μοτίβων)
 * ============================================================
 */

'use strict';

const { DateTime } = require('luxon');
const db = require('../../../shared/db');
const logger = require('../../../shared/logger');
const { validateGeofence, GeofenceStatus } = require('../geofencing/validator');
const { buildWRKCardSEPayload } = require('../../ergani-client/payload-builder');
const { submitWorkCard } = require('../../ergani-client/work-card');
const notifier = require('../../notification-service/template-engine');
const fraudDetector = require('../fraud/detector');
const { canEmployeeCheckIn } = require('../../../shared/scheduling/validator');

/**
 * Χειρισμός Check-in αιτήματος
 * 
 * @param {Object} payload - Kafka message payload (platform, platformUserId, messageData)
 * @param {Object} employee - Εγγραφή εργαζομένου (id, employer_id, branch_id, afm, eponymo, onoma)
 */
async function handle(payload, employee) {
    const { platform, platformUserId, messageData } = payload;
    const now = DateTime.now().setZone('Europe/Athens');
    const today = now.toISODate();

    logger.info({
        employeeId: employee.employee_id,
        platform,
    }, 'Επεξεργασία check-in');

    try {
        // --- Βήμα 1: Έλεγχος duplicate check-in ---
        const existingCheckIn = await db.query(
            `SELECT id FROM time_stamps
       WHERE employee_id = $1 AND action_type = 'check_in'
       AND reference_date = $2
       AND NOT EXISTS (
         SELECT 1 FROM time_stamps t2
         WHERE t2.employee_id = $1 AND t2.action_type = 'check_out'
         AND t2.reference_date = $2
       )`,
            [employee.employee_id, today]
        );

        if (existingCheckIn.rowCount > 0) {
            // Ήδη υπάρχει check-in σήμερα → ενημέρωση εργαζομένου
            logger.info({ employeeId: employee.employee_id }, 'Duplicate check-in — ήδη ενεργή βάρδια');
            await notifier.sendMessage(platform, platformUserId, 'duplicate_checkin');
            return;
        }

        // --- Βήμα 1.5: 🔒 Έλεγχος Ωραρίου & Αδειών ---
        const scheduleCheck = await canEmployeeCheckIn(employee.employee_id);
        if (!scheduleCheck.allowed) {
            logger.info({
                employeeId: employee.employee_id,
                reason: scheduleCheck.reason,
            }, 'Check-in απορρίφθηκε — ωράριο/άδεια');
            await notifier.sendMessage(platform, platformUserId, 'schedule_blocked', {
                reason: scheduleCheck.reason,
                message: scheduleCheck.message,
            });
            return;
        }

        // Αν αργοπόρησε → log (αλλά επιτρέπεται)
        if (scheduleCheck.reason === 'late_arrival') {
            logger.info({
                employeeId: employee.employee_id,
                lateMinutes: scheduleCheck.schedule?.lateMinutes,
            }, 'Check-in αργοπορία');
        }

        // --- Βήμα 2: Εύρεση παραρτήματος (auto-detect ή default) ---
        const branch = await findBestBranch(employee, messageData);

        if (!branch) {
            logger.error({ employeeId: employee.employee_id }, 'Δεν βρέθηκε παράρτημα');
            await notifier.sendMessage(platform, platformUserId, 'no_branch');
            return;
        }

        // --- Βήμα 3: Geofence validation ---
        const geofenceResult = validateGeofence({
            employeeLat: messageData.latitude,
            employeeLng: messageData.longitude,
            branchLat: parseFloat(branch.latitude),
            branchLng: parseFloat(branch.longitude),
            radiusMeters: branch.geofence_radius_meters,
            horizontalAccuracy: messageData.horizontalAccuracy,
            maxAccuracyMeters: branch.max_accuracy_meters,
            isExternalWorker: employee.is_external_worker,
        });

        // --- Βήμα 4: Αποθήκευση χρονοσήμανσης στη βάση ---
        const timeStampResult = await db.query(
            `INSERT INTO time_stamps 
       (employee_id, branch_id, action_type, event_timestamp, reference_date,
        latitude, longitude, horizontal_accuracy, distance_meters,
        geofence_status, platform, ergani_status)
       VALUES ($1, $2, 'check_in', $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
            [
                employee.employee_id,
                branch.id,
                now.toJSDate(),
                today,
                messageData.latitude,
                messageData.longitude,
                messageData.horizontalAccuracy,
                geofenceResult.distance,
                geofenceResult.status,
                platform,
                geofenceResult.status === GeofenceStatus.APPROVED ||
                    geofenceResult.status === GeofenceStatus.BYPASSED ? 'pending' : 'rejected',
            ]
        );

        const timeStampId = timeStampResult.rows[0].id;

        // --- Βήμα 5: Fraud detection (ασύγχρονα) ---
        fraudDetector.analyze({
            employeeId: employee.employee_id,
            latitude: messageData.latitude,
            longitude: messageData.longitude,
            horizontalAccuracy: messageData.horizontalAccuracy,
            actionType: 'check_in',
        }).catch(err => logger.error({ err }, 'Fraud detection error'));

        // --- Βήμα 6: Ενέργεια βάσει αποτελέσματος geofence ---

        if (geofenceResult.status === GeofenceStatus.REJECTED) {
            // Εκτός ακτίνας → ενημέρωση εργαζομένου
            await notifier.sendMessage(platform, platformUserId, 'geofence_rejected', {
                distance: Math.round(geofenceResult.distance),
                radius: branch.geofence_radius_meters,
            });
            return;
        }

        if (geofenceResult.status === GeofenceStatus.LOW_ACCURACY) {
            // Χαμηλή ακρίβεια GPS → ενημέρωση
            await notifier.sendMessage(platform, platformUserId, 'low_accuracy', {
                accuracy: Math.round(messageData.horizontalAccuracy),
            });
            return;
        }

        // --- Βήμα 7: Υποβολή στο ΕΡΓΑΝΗ ΙΙ ---
        // Λήψη ΑΦΜ εργοδότη
        const employerResult = await db.query(
            'SELECT afm_ergodoti FROM employers WHERE id = $1',
            [employee.employer_id]
        );
        const afmErgodoti = employerResult.rows[0].afm_ergodoti;

        // Δημιουργία payload
        const erganiPayload = buildWRKCardSEPayload({
            afmErgodoti,
            branchNumber: branch.branch_number,
            afmEmployee: employee.afm,
            eponymo: employee.eponymo,
            onoma: employee.onoma,
            fType: 0,                    // 0 = Έναρξη βάρδιας
            eventDate: now.toJSDate(),
            platform,
        });

        // Υποβολή (ασύγχρονα — retry logic ενσωματωμένο)
        const result = await submitWorkCard(branch, erganiPayload, timeStampId);

        // --- Βήμα 8: Ειδοποίηση εργαζομένου ---
        if (result.success) {
            await notifier.sendMessage(platform, platformUserId, 'checkin_success', {
                time: now.toFormat('HH:mm'),
            });
        } else {
            // Αποθηκεύτηκε τοπικά, retry σε εξέλιξη
            await notifier.sendMessage(platform, platformUserId, 'checkin_pending');
        }

    } catch (err) {
        logger.error({ err, employeeId: employee.employee_id }, 'Σφάλμα check-in handler');
        await notifier.sendMessage(platform, platformUserId, 'generic_error');
    }
}

/**
 * Εύρεση καλύτερου παραρτήματος βάσει GPS
 * 
 * Αν ο εργοδότης έχει πολλαπλά παραρτήματα,
 * βρίσκουμε αυτό που είναι πιο κοντά στον εργαζόμενο
 * (και εντός ακτίνας).
 * 
 * @param {Object} employee - Εγγραφή εργαζομένου
 * @param {Object} messageData - GPS δεδομένα (latitude, longitude)
 * @returns {Object|null} - Το καλύτερο παράρτημα ή null
 */
async function findBestBranch(employee, messageData) {
    // Λήψη όلων των ενεργών παραρτημάτων του εργοδότη
    const branchesResult = await db.query(
        `SELECT b.*, e.afm_ergodoti 
     FROM branches b
     JOIN employers e ON b.employer_id = e.id
     WHERE b.employer_id = $1 AND b.is_active = true`,
        [employee.employer_id]
    );

    if (branchesResult.rowCount === 0) return null;

    // Αν υπάρχει μόνο 1 παράρτημα → επιστροφή αυτού
    if (branchesResult.rowCount === 1) return branchesResult.rows[0];

    // Πολλαπλά: βρίσκουμε το πιο κοντινό
    const { haversine } = require('../geofencing/haversine');
    let bestBranch = null;
    let minDistance = Infinity;

    for (const branch of branchesResult.rows) {
        const distance = haversine(
            messageData.latitude, messageData.longitude,
            parseFloat(branch.latitude), parseFloat(branch.longitude)
        );

        if (distance < minDistance) {
            minDistance = distance;
            bestBranch = branch;
        }
    }

    return bestBranch;
}

module.exports = { handle };
