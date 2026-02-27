/**
 * ============================================================
 * Checkout Reminder — Υπενθύμιση Check-out
 * 
 * Βρίσκει εργαζόμενους με ανοιχτό check-in που πρέπει
 * να κλείσουν τη βάρδια τους. Στέλνει υπενθύμιση μέσω chatbot.
 * ============================================================
 */
'use strict';
const db = require('../../shared/db');
const logger = require('../../shared/logger');
const notifier = require('../notification-service/template-engine');

async function run() {
    // Εύρεση εργαζομένων με ανοιχτό check-in > 8 ώρες
    const result = await db.query(
        `SELECT ts.employee_id, ts.event_timestamp, ml.platform, ml.platform_user_id
     FROM time_stamps ts
     JOIN messenger_links ml ON ts.employee_id = ml.employee_id
     WHERE ts.action_type = 'check_in'
       AND ts.event_timestamp < NOW() - INTERVAL '8 hours'
       AND NOT EXISTS (
         SELECT 1 FROM time_stamps t2
         WHERE t2.employee_id = ts.employee_id
           AND t2.action_type = 'check_out'
           AND t2.reference_date = ts.reference_date
       )
       AND ts.reference_date = CURRENT_DATE`
    );

    for (const row of result.rows) {
        await notifier.sendMessage(row.platform, row.platform_user_id, 'checkout_reminder');
        logger.info({ employeeId: row.employee_id }, 'Υπενθύμιση check-out στάλθηκε');
    }

    if (result.rowCount > 0) {
        logger.info({ count: result.rowCount }, 'Checkout reminders στάλθηκαν');
    }
}

module.exports = { run };
