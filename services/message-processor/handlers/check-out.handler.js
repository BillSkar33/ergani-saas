/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — SaaS Platform
 * Handler Check-out — Λήξη Βάρδιας
 * 
 * Παρόμοια ροή με check-in, αλλά:
 * - f_type = 1 (Λήξη)
 * - Validation: πρέπει να υπάρχει ανοιχτό check-in
 * - reference_date = η ημερομηνία του αντίστοιχου check-in
 *   (κρίσιμο για night shifts μετά μεσάνυχτα)
 * - Geofencing μπορεί να είναι πιο χαλαρό ή disabled
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

/**
 * Χειρισμός Check-out αιτήματος
 * 
 * @param {Object} payload - Kafka message payload
 * @param {Object} employee - Εγγραφή εργαζομένου
 * @param {Object} openCheckIn - Ανοιχτό check-in (id, reference_date)
 */
async function handle(payload, employee, openCheckIn) {
    const { platform, platformUserId, messageData } = payload;
    const now = DateTime.now().setZone('Europe/Athens');

    logger.info({
        employeeId: employee.employee_id,
        platform,
        checkInId: openCheckIn.id,
    }, 'Επεξεργασία check-out');

    try {
        // --- Βήμα 1: Εύρεση παραρτήματος ---
        const branchResult = await db.query(
            `SELECT b.*, e.afm_ergodoti
       FROM branches b
       JOIN employers e ON b.employer_id = e.id
       WHERE b.id = (
         SELECT branch_id FROM time_stamps WHERE id = $1
       )`,
            [openCheckIn.id]
        );

        if (branchResult.rowCount === 0) {
            logger.error({ checkInId: openCheckIn.id }, 'Παράρτημα check-in δεν βρέθηκε');
            await notifier.sendMessage(platform, platformUserId, 'generic_error');
            return;
        }

        const branch = branchResult.rows[0];

        // --- Βήμα 2: Geofence validation (μπορεί να είναι disabled) ---
        let geofenceResult;
        if (branch.checkout_geofence_enabled) {
            geofenceResult = validateGeofence({
                employeeLat: messageData.latitude,
                employeeLng: messageData.longitude,
                branchLat: parseFloat(branch.latitude),
                branchLng: parseFloat(branch.longitude),
                radiusMeters: branch.geofence_radius_meters,
                horizontalAccuracy: messageData.horizontalAccuracy,
                maxAccuracyMeters: branch.max_accuracy_meters,
                isExternalWorker: employee.is_external_worker,
            });
        } else {
            // Geofence disabled στο check-out — BYPASSED
            const { haversine } = require('../geofencing/haversine');
            const distance = haversine(
                messageData.latitude, messageData.longitude,
                parseFloat(branch.latitude), parseFloat(branch.longitude)
            );
            geofenceResult = {
                status: GeofenceStatus.BYPASSED,
                distance,
                message: null,
                flags: [],
            };
        }

        // --- Βήμα 3: Αποθήκευση χρονοσήμανσης ---
        // ΣΗΜΑΝΤΙΚΟ: reference_date = η ημερομηνία του CHECK-IN (night shift support)
        const timeStampResult = await db.query(
            `INSERT INTO time_stamps
       (employee_id, branch_id, action_type, event_timestamp, reference_date,
        latitude, longitude, horizontal_accuracy, distance_meters,
        geofence_status, platform, ergani_status)
       VALUES ($1, $2, 'check_out', $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
            [
                employee.employee_id,
                branch.id,
                now.toJSDate(),
                openCheckIn.reference_date,     // Ημερομηνία αναφοράς CHECK-IN (night shift!)
                messageData.latitude,
                messageData.longitude,
                messageData.horizontalAccuracy,
                geofenceResult.distance,
                geofenceResult.status,
                platform,
                geofenceResult.status === GeofenceStatus.REJECTED ? 'rejected' : 'pending',
            ]
        );

        const timeStampId = timeStampResult.rows[0].id;

        // --- Βήμα 4: Αν geofence rejected → ειδοποίηση ---
        if (geofenceResult.status === GeofenceStatus.REJECTED) {
            await notifier.sendMessage(platform, platformUserId, 'geofence_rejected', {
                distance: Math.round(geofenceResult.distance),
                radius: branch.geofence_radius_meters,
            });
            return;
        }

        if (geofenceResult.status === GeofenceStatus.LOW_ACCURACY) {
            await notifier.sendMessage(platform, platformUserId, 'low_accuracy', {
                accuracy: Math.round(messageData.horizontalAccuracy),
            });
            return;
        }

        // --- Βήμα 5: Υποβολή στο ΕΡΓΑΝΗ ---
        const erganiPayload = buildWRKCardSEPayload({
            afmErgodoti: branch.afm_ergodoti,
            branchNumber: branch.branch_number,
            afmEmployee: employee.afm,
            eponymo: employee.eponymo,
            onoma: employee.onoma,
            fType: 1,                                 // 1 = Λήξη βάρδιας
            eventDate: now.toJSDate(),
            checkInReferenceDate: openCheckIn.reference_date, // Night shift reference date
            platform,
        });

        const result = await submitWorkCard(branch, erganiPayload, timeStampId);

        // --- Βήμα 6: Ειδοποίηση εργαζομένου ---
        if (result.success) {
            // Υπολογισμός διάρκειας βάρδιας
            const checkInTime = await db.query(
                'SELECT event_timestamp FROM time_stamps WHERE id = $1',
                [openCheckIn.id]
            );
            const startTime = DateTime.fromJSDate(new Date(checkInTime.rows[0].event_timestamp), { zone: 'Europe/Athens' });
            const duration = now.diff(startTime, ['hours', 'minutes']);

            await notifier.sendMessage(platform, platformUserId, 'checkout_success', {
                time: now.toFormat('HH:mm'),
                duration: `${Math.floor(duration.hours)}ω ${Math.floor(duration.minutes)}λ`,
            });
        } else {
            await notifier.sendMessage(platform, platformUserId, 'checkout_pending');
        }

    } catch (err) {
        logger.error({ err, employeeId: employee.employee_id }, 'Σφάλμα check-out handler');
        await notifier.sendMessage(platform, platformUserId, 'generic_error');
    }
}

module.exports = { handle };
