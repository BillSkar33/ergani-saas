/**
 * ============================================================
 * Checkout Reminder — Υπενθύμιση Check-out
 *
 * Δύο λογικές:
 *
 * 1. Εργαζόμενοι ΜΕ ωράριο:
 *    Reminder 15 λεπτά πριν το ΠΡΟΣΑΡΜΟΣΜΕΝΟ τέλος βάρδιας.
 *    Adjusted end = scheduled_end + λεπτά καθυστέρησης check-in
 *    Παράδειγμα: βάρδια 08:00-16:00, check-in 08:30
 *    → adjusted end 16:30 → reminder στις 16:15
 *
 * 2. Εργαζόμενοι ΧΩΡΙΣ ωράριο:
 *    Παλιά λογική: reminder αν η βάρδια είναι ανοιχτή > 8 ώρες.
 * ============================================================
 */
'use strict';

const { DateTime } = require('luxon');
const db = require('../../shared/db');
const logger = require('../../shared/logger');
const notifier = require('../notification-service/template-engine');

async function run() {
    const now = DateTime.now().setZone('Europe/Athens');
    const today = now.toISODate();

    // -------------------------------------------------------
    // 1. Εργαζόμενοι ΜΕ ενεργό ωράριο σήμερα
    //    Reminder 15 λεπτά πριν το adjusted end time
    // -------------------------------------------------------
    const scheduledResult = await db.query(
        `SELECT
            ts.employee_id,
            ts.event_timestamp AS checkin_time,
            ws.start_time,
            ws.end_time,
            ws.is_night_shift,
            ml.platform,
            ml.platform_user_id
         FROM time_stamps ts
         JOIN messenger_links ml ON ts.employee_id = ml.employee_id
         JOIN employee_schedules es
           ON ts.employee_id = es.employee_id
          AND es.is_active = true
          AND es.effective_from <= $1
          AND (es.effective_until IS NULL OR es.effective_until >= $1)
         JOIN work_schedules ws ON es.schedule_id = ws.id AND ws.is_active = true
         WHERE ts.action_type = 'check_in'
           AND ts.reference_date = $1
           AND NOT EXISTS (
               SELECT 1 FROM time_stamps t2
               WHERE t2.employee_id = ts.employee_id
                 AND t2.action_type = 'check_out'
                 AND t2.reference_date = ts.reference_date
           )`,
        [today]
    );

    let scheduledCount = 0;
    for (const row of scheduledResult.rows) {
        const schedStart = DateTime.fromISO(`${today}T${row.start_time}`, { zone: 'Europe/Athens' });
        let schedEnd = DateTime.fromISO(`${today}T${row.end_time}`, { zone: 'Europe/Athens' });
        if (row.is_night_shift) schedEnd = schedEnd.plus({ days: 1 });

        const checkinTime = DateTime.fromJSDate(new Date(row.checkin_time), { zone: 'Europe/Athens' });

        // Καθυστέρηση check-in (αν ήρθε νωρίτερα ή στην ώρα → 0)
        const lateMinutes = Math.max(0, checkinTime.diff(schedStart, 'minutes').minutes);

        // Adjusted end: scheduled end + καθυστέρηση check-in
        const adjustedEnd = schedEnd.plus({ minutes: lateMinutes });

        // Στέλνουμε reminder αν είμαστε στο παράθυρο 12-17 λεπτά πριν το adjusted end
        // (5λ παράθυρο → ασφαλές για CRON κάθε 5 λεπτά)
        const minutesToEnd = adjustedEnd.diff(now, 'minutes').minutes;
        if (minutesToEnd >= 12 && minutesToEnd <= 17) {
            await notifier.sendMessage(
                row.platform,
                row.platform_user_id,
                'checkout_reminder_scheduled',
                { endTime: adjustedEnd.toFormat('HH:mm') }
            );
            logger.info(
                { employeeId: row.employee_id, adjustedEnd: adjustedEnd.toFormat('HH:mm') },
                'Υπενθύμιση check-out (ωράριο) στάλθηκε'
            );
            scheduledCount++;
        }
    }

    // -------------------------------------------------------
    // 2. Εργαζόμενοι ΧΩΡΙΣ ωράριο: reminder μετά 8 ώρες
    // -------------------------------------------------------
    const unscheduledResult = await db.query(
        `SELECT ts.employee_id, ts.event_timestamp, ml.platform, ml.platform_user_id
         FROM time_stamps ts
         JOIN messenger_links ml ON ts.employee_id = ml.employee_id
         WHERE ts.action_type = 'check_in'
           AND ts.event_timestamp < NOW() - INTERVAL '8 hours'
           AND ts.reference_date = $1
           AND NOT EXISTS (
               SELECT 1 FROM time_stamps t2
               WHERE t2.employee_id = ts.employee_id
                 AND t2.action_type = 'check_out'
                 AND t2.reference_date = ts.reference_date
           )
           AND NOT EXISTS (
               SELECT 1 FROM employee_schedules es
               WHERE es.employee_id = ts.employee_id AND es.is_active = true
           )`,
        [today]
    );

    for (const row of unscheduledResult.rows) {
        await notifier.sendMessage(row.platform, row.platform_user_id, 'checkout_reminder');
        logger.info({ employeeId: row.employee_id }, 'Υπενθύμιση check-out (8h) στάλθηκε');
    }

    const total = scheduledCount + unscheduledResult.rowCount;
    if (total > 0) {
        logger.info({ total, scheduled: scheduledCount, unscheduled: unscheduledResult.rowCount },
            'Checkout reminders στάλθηκαν');
    }
}

module.exports = { run };
