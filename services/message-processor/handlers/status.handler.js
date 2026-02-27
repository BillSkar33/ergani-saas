/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — SaaS Platform
 * Handler Κατάστασης — Status & History
 * 
 * Χειρίζεται τις εντολές:
 * - /status (ΚΑΤΑΣΤΑΣΗ): Τρέχουσα κατάσταση βάρδιας
 * - /history (ΙΣΤΟΡΙΚΟ): Τελευταίες 5 βάρδιες
 * ============================================================
 */

'use strict';

const { DateTime } = require('luxon');
const db = require('../../../shared/db');
const logger = require('../../../shared/logger');
const notifier = require('../../notification-service/template-engine');

/**
 * Χειρισμός αίτησης κατάστασης / ιστορικού
 * 
 * @param {Object} payload - Kafka message payload
 */
async function handle(payload) {
    const { platform, platformUserId, messageType } = payload;

    logger.info({ platform, userId: platformUserId, type: messageType }, 'Επεξεργασία αίτησης κατάστασης');

    try {
        // --- Εύρεση εργαζομένου ---
        const linkResult = await db.query(
            `SELECT e.id as employee_id, e.onoma, e.eponymo
       FROM messenger_links ml
       JOIN employees e ON ml.employee_id = e.id
       WHERE ml.platform = $1 AND ml.platform_user_id = $2 AND e.is_active = true`,
            [platform, platformUserId]
        );

        if (linkResult.rowCount === 0) {
            await notifier.sendMessage(platform, platformUserId, 'unregistered');
            return;
        }

        const employee = linkResult.rows[0];
        const now = DateTime.now().setZone('Europe/Athens');

        if (messageType === 'status') {
            // --- /status — Τρέχουσα κατάσταση ---
            const today = now.toISODate();

            // Αναζήτηση τρέχοντος check-in
            const currentShift = await db.query(
                `SELECT ts.event_timestamp, ts.action_type, ts.ergani_status
         FROM time_stamps ts
         WHERE ts.employee_id = $1 AND ts.reference_date = $2
         ORDER BY ts.event_timestamp DESC`,
                [employee.employee_id, today]
            );

            if (currentShift.rowCount === 0) {
                // Δεν υπάρχει βάρδια σήμερα
                await notifier.sendMessage(platform, platformUserId, 'status_no_shift');
                return;
            }

            // Εύρεση τελευταίας ενέργειας
            const lastAction = currentShift.rows[0];
            const checkInTime = currentShift.rows.find(r => r.action_type === 'check_in');

            if (lastAction.action_type === 'check_in') {
                // Ανοιχτή βάρδια
                const startTime = DateTime.fromJSDate(new Date(checkInTime.event_timestamp), { zone: 'Europe/Athens' });
                const duration = now.diff(startTime, ['hours', 'minutes']);

                await notifier.sendMessage(platform, platformUserId, 'status_active', {
                    checkInTime: startTime.toFormat('HH:mm'),
                    duration: `${Math.floor(duration.hours)}ω ${Math.floor(duration.minutes)}λ`,
                    erganiStatus: lastAction.ergani_status,
                });
            } else {
                // Κλειστή βάρδια
                await notifier.sendMessage(platform, platformUserId, 'status_completed', {
                    shifts: currentShift.rows,
                });
            }

        } else if (messageType === 'history') {
            // --- /history — Τελευταίες 5 βάρδιες ---
            const historyResult = await db.query(
                `SELECT reference_date, action_type, event_timestamp, ergani_status
         FROM time_stamps
         WHERE employee_id = $1
         ORDER BY event_timestamp DESC
         LIMIT 10`,
                [employee.employee_id]
            );

            if (historyResult.rowCount === 0) {
                await notifier.sendMessage(platform, platformUserId, 'history_empty');
                return;
            }

            await notifier.sendMessage(platform, platformUserId, 'history', {
                entries: historyResult.rows,
            });
        }

    } catch (err) {
        logger.error({ err, userId: platformUserId }, 'Σφάλμα handler κατάστασης');
        await notifier.sendMessage(platform, platformUserId, 'generic_error');
    }
}

module.exports = { handle };
