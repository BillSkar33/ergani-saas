/**
 * ============================================================
 * Auto Actions — Αυτόματο Check-in / Check-out
 *
 * Δύο CRON jobs (κάθε 5 λεπτά):
 *
 * autoCheckout():
 *   Εφόσον ο εργοδότης έχει ενεργοποιήσει auto_checkout_enabled:
 *   - Βρίσκει εργαζομένους ΜΕ ωράριο + ανοιχτή βάρδια
 *   - Υπολογίζει adjusted_end = scheduled_end + λεπτά καθυστέρησης check-in
 *     Παράδειγμα: βάρδια 08:00-16:00, check-in 08:30
 *     → adjusted_end = 16:30
 *   - Αν now >= adjusted_end + grace_min → αυτόματο checkout στο adjusted_end
 *     (ο grace_min = 10 λεπτά = το όριο πριν θεωρείται υπερωρία)
 *   - Υποβολή στο ΕΡΓΑΝΗ + ειδοποίηση εργαζομένου
 *
 * autoCheckinLate():
 *   Εφόσον ο εργοδότης έχει ενεργοποιήσει auto_checkin_late_enabled:
 *   - Βρίσκει εργαζομένους που έπρεπε να έχουν βάρδια σήμερα
 *     αλλά δεν έχουν κάνει check-in και η καθυστέρηση > auto_checkin_late_after_min
 *   - Καταγράφει αυτόματο check-in + ειδοποίηση
 * ============================================================
 */
'use strict';

const { DateTime } = require('luxon');
const db = require('../../shared/db');
const logger = require('../../shared/logger');
const notifier = require('../notification-service/template-engine');
const { buildWRKCardSEPayload } = require('../ergani-client/payload-builder');
const { submitWorkCard } = require('../ergani-client/work-card');

// ============================================================
// AUTO CHECKOUT
// ============================================================
async function autoCheckout() {
    const now = DateTime.now().setZone('Europe/Athens');
    const today = now.toISODate();

    // Εύρεση εργαζομένων με ανοιχτό check-in + ωράριο + auto_checkout ενεργό
    const result = await db.query(
        `SELECT
            ts.id AS checkin_id,
            ts.employee_id,
            ts.event_timestamp AS checkin_time,
            ts.branch_id,
            ts.reference_date,
            ts.platform AS checkin_platform,
            ws.start_time,
            ws.end_time,
            ws.is_night_shift,
            COALESCE(ens.auto_checkout_grace_min, 10) AS grace_min,
            ml.platform,
            ml.platform_user_id,
            e.afm,
            e.eponymo,
            e.onoma,
            e.employer_id,
            b.afm_ergodoti,
            b.branch_number
         FROM time_stamps ts
         JOIN employees e ON ts.employee_id = e.id
         JOIN branches b ON ts.branch_id = b.id
         JOIN employer_notification_settings ens ON e.employer_id = ens.employer_id
         JOIN messenger_links ml ON ts.employee_id = ml.employee_id
         JOIN employee_schedules es
           ON ts.employee_id = es.employee_id
          AND es.is_active = true
          AND es.effective_from <= $1
          AND (es.effective_until IS NULL OR es.effective_until >= $1)
         JOIN work_schedules ws ON es.schedule_id = ws.id AND ws.is_active = true
         WHERE ts.action_type = 'check_in'
           AND ts.reference_date = $1
           AND ens.auto_checkout_enabled = true
           AND NOT EXISTS (
               SELECT 1 FROM time_stamps t2
               WHERE t2.employee_id = ts.employee_id
                 AND t2.action_type = 'check_out'
                 AND t2.reference_date = ts.reference_date
           )`,
        [today]
    );

    let count = 0;
    for (const row of result.rows) {
        const schedStart = DateTime.fromISO(`${today}T${row.start_time}`, { zone: 'Europe/Athens' });
        let schedEnd = DateTime.fromISO(`${today}T${row.end_time}`, { zone: 'Europe/Athens' });
        if (row.is_night_shift) schedEnd = schedEnd.plus({ days: 1 });

        const checkinTime = DateTime.fromJSDate(new Date(row.checkin_time), { zone: 'Europe/Athens' });

        // Λεπτά καθυστέρησης check-in (αν ήρθε στην ώρα ή νωρίτερα → 0)
        const lateMinutes = Math.max(0, Math.round(checkinTime.diff(schedStart, 'minutes').minutes));

        // Adjusted end = scheduled end + καθυστέρηση
        // Παράδειγμα: βάρδια 08:00-16:00, check-in 08:30 → adjusted 16:30
        const adjustedEnd = schedEnd.plus({ minutes: lateMinutes });

        // Αυτόματο checkout ενεργοποιείται adjusted_end + grace_min
        // (grace_min = 10 λεπτά = όριο πριν θεωρείται υπερωρία)
        const autoCheckoutTime = adjustedEnd.plus({ minutes: row.grace_min });

        if (now < autoCheckoutTime) continue;

        // Καταγραφή αυτόματου checkout (χρόνος = adjusted_end, όχι τώρα)
        let checkoutTimestampId;
        try {
            const insertResult = await db.query(
                `INSERT INTO time_stamps
                 (employee_id, branch_id, action_type, event_timestamp, reference_date,
                  geofence_status, platform, ergani_status, is_auto)
                 VALUES ($1, $2, 'check_out', $3, $4, 'bypassed', $5, 'pending', true)
                 RETURNING id`,
                [
                    row.employee_id,
                    row.branch_id,
                    adjustedEnd.toJSDate(),
                    row.reference_date,
                    row.platform,
                ]
            );
            checkoutTimestampId = insertResult.rows[0].id;
        } catch (err) {
            logger.error({ err, employeeId: row.employee_id }, 'Auto-checkout: σφάλμα εισαγωγής');
            continue;
        }

        // Υποβολή στο ΕΡΓΑΝΗ
        try {
            const erganiPayload = buildWRKCardSEPayload({
                afmErgodoti: row.afm_ergodoti,
                branchNumber: row.branch_number,
                afmEmployee: row.afm,
                eponymo: row.eponymo,
                onoma: row.onoma,
                fType: 1,                           // 1 = Λήξη βάρδιας
                eventDate: adjustedEnd.toJSDate(),
                checkInReferenceDate: row.reference_date,
                platform: row.platform,
            });

            const branch = await db.query(
                'SELECT * FROM branches WHERE id = $1', [row.branch_id]
            );
            await submitWorkCard(branch.rows[0], erganiPayload, checkoutTimestampId);
        } catch (err) {
            logger.error({ err, employeeId: row.employee_id }, 'Auto-checkout: σφάλμα ΕΡΓΑΝΗ');
            // Συνεχίζουμε — το pending-retry θα το αναλάβει
        }

        // Ειδοποίηση εργαζομένου
        const duration = adjustedEnd.diff(checkinTime, ['hours', 'minutes']);
        await notifier.sendMessage(row.platform, row.platform_user_id, 'auto_checkout', {
            time: adjustedEnd.toFormat('HH:mm'),
            duration: `${Math.floor(duration.hours)}ω ${Math.floor(duration.minutes)}λ`,
        });

        logger.info(
            { employeeId: row.employee_id, adjustedEnd: adjustedEnd.toFormat('HH:mm'), lateMinutes },
            'Αυτόματο check-out εκτελέστηκε'
        );
        count++;
    }

    if (count > 0) {
        logger.info({ count }, `Auto-checkout: ${count} εργαζόμενοι`);
    }
}

// ============================================================
// AUTO CHECKIN LATE
// ============================================================
async function autoCheckinLate() {
    const now = DateTime.now().setZone('Europe/Athens');
    const today = now.toISODate();
    const currentDayOfWeek = now.weekday;

    // Εύρεση εργαζομένων που έχουν βάρδια σήμερα, δεν έχουν check-in,
    // και η καθυστέρηση υπερβαίνει το όριο
    const result = await db.query(
        `SELECT
            e.id AS employee_id,
            e.afm,
            e.eponymo,
            e.onoma,
            e.employer_id,
            ws.start_time,
            ws.end_time,
            b.id AS branch_id,
            b.afm_ergodoti,
            b.branch_number,
            COALESCE(ens.auto_checkin_late_after_min, 30) AS late_after_min,
            ml.platform,
            ml.platform_user_id
         FROM employees e
         JOIN employer_notification_settings ens ON e.employer_id = ens.employer_id
         JOIN employee_schedules es ON e.id = es.employee_id AND es.is_active = true
           AND es.effective_from <= $1
           AND (es.effective_until IS NULL OR es.effective_until >= $1)
         JOIN work_schedules ws ON es.schedule_id = ws.id AND ws.is_active = true
           AND $2 = ANY(ws.days_of_week)
         JOIN messenger_links ml ON e.id = ml.employee_id
         LEFT JOIN branches b ON e.branch_id = b.id
         WHERE e.is_active = true
           AND ens.auto_checkin_late_enabled = true
           AND NOT EXISTS (
               SELECT 1 FROM time_stamps ts
               WHERE ts.employee_id = e.id
                 AND ts.reference_date = $1
                 AND ts.action_type = 'check_in'
           )`,
        [today, currentDayOfWeek]
    );

    let count = 0;
    for (const row of result.rows) {
        const schedStart = DateTime.fromISO(`${today}T${row.start_time}`, { zone: 'Europe/Athens' });
        const autoCheckinThreshold = schedStart.plus({ minutes: row.late_after_min });

        if (now < autoCheckinThreshold) continue;
        if (!row.branch_id) continue; // Δεν μπορούμε να υποβάλουμε χωρίς κατάστημα

        const lateMinutes = Math.round(now.diff(schedStart, 'minutes').minutes);

        // Καταγραφή αυτόματου check-in (χρόνος = scheduled_start, όχι τώρα)
        let checkinTimestampId;
        try {
            const insertResult = await db.query(
                `INSERT INTO time_stamps
                 (employee_id, branch_id, action_type, event_timestamp, reference_date,
                  geofence_status, platform, ergani_status, is_auto)
                 VALUES ($1, $2, 'check_in', $3, $4, 'bypassed', $5, 'pending', true)
                 RETURNING id`,
                [
                    row.employee_id,
                    row.branch_id,
                    schedStart.toJSDate(),      // Χρόνος = έναρξη ωραρίου
                    today,
                    row.platform,
                ]
            );
            checkinTimestampId = insertResult.rows[0].id;
        } catch (err) {
            logger.error({ err, employeeId: row.employee_id }, 'Auto-checkin: σφάλμα εισαγωγής');
            continue;
        }

        // Υποβολή στο ΕΡΓΑΝΗ
        try {
            const erganiPayload = buildWRKCardSEPayload({
                afmErgodoti: row.afm_ergodoti,
                branchNumber: row.branch_number,
                afmEmployee: row.afm,
                eponymo: row.eponymo,
                onoma: row.onoma,
                fType: 0,                           // 0 = Έναρξη βάρδιας
                eventDate: schedStart.toJSDate(),
                platform: row.platform,
            });

            const branch = await db.query('SELECT * FROM branches WHERE id = $1', [row.branch_id]);
            await submitWorkCard(branch.rows[0], erganiPayload, checkinTimestampId);
        } catch (err) {
            logger.error({ err, employeeId: row.employee_id }, 'Auto-checkin: σφάλμα ΕΡΓΑΝΗ');
        }

        // Ειδοποίηση εργαζομένου
        await notifier.sendMessage(row.platform, row.platform_user_id, 'auto_checkin_late', {
            time: schedStart.toFormat('HH:mm'),
            lateMinutes,
        });

        logger.info(
            { employeeId: row.employee_id, lateMinutes },
            'Αυτόματο check-in (αργοπορία) εκτελέστηκε'
        );
        count++;
    }

    if (count > 0) {
        logger.info({ count }, `Auto-checkin-late: ${count} εργαζόμενοι`);
    }
}

module.exports = { autoCheckout, autoCheckinLate };
