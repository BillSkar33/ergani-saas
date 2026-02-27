/**
 * ============================================================
 * Daily Summary — Ημερήσια Σύνοψη Εργοδότη
 * 
 * Εκτελείται κάθε βράδυ στις 23:00 (Europe/Athens).
 * Δημιουργεί αναφορά βάρδιας της ημέρας για κάθε εργοδότη.
 * ============================================================
 */
'use strict';
const db = require('../../shared/db');
const logger = require('../../shared/logger');

async function run() {
    // Εύρεση ενεργών εργοδοτών με ενεργοποιημένη σύνοψη
    const employers = await db.query(
        `SELECT e.id, e.email, e.company_name
     FROM employers e
     JOIN employer_notification_settings ns ON e.id = ns.employer_id
     WHERE e.is_active = true`
    );

    for (const employer of employers.rows) {
        try {
            // Μέτρηση check-ins / check-outs σήμερα
            const stats = await db.query(
                `SELECT 
           COUNT(CASE WHEN action_type = 'check_in' THEN 1 END) as checkins,
           COUNT(CASE WHEN action_type = 'check_out' THEN 1 END) as checkouts,
           COUNT(CASE WHEN geofence_status = 'rejected' THEN 1 END) as rejections,
           COUNT(CASE WHEN ergani_status = 'failed' THEN 1 END) as failures
         FROM time_stamps ts
         JOIN employees emp ON ts.employee_id = emp.id
         WHERE emp.employer_id = $1
           AND ts.reference_date = CURRENT_DATE`,
                [employer.id]
            );

            const s = stats.rows[0];

            // Ανοιχτά check-ins (ξεχασμένα check-outs)
            const openShifts = await db.query(
                `SELECT COUNT(*) as count
         FROM time_stamps ts
         JOIN employees emp ON ts.employee_id = emp.id
         WHERE emp.employer_id = $1
           AND ts.action_type = 'check_in'
           AND ts.reference_date = CURRENT_DATE
           AND NOT EXISTS (
             SELECT 1 FROM time_stamps t2
             WHERE t2.employee_id = ts.employee_id
               AND t2.action_type = 'check_out'
               AND t2.reference_date = CURRENT_DATE
           )`,
                [employer.id]
            );

            logger.info({
                employer: employer.company_name,
                checkins: s.checkins,
                checkouts: s.checkouts,
                openShifts: openShifts.rows[0].count,
                rejections: s.rejections,
                failures: s.failures,
            }, '📊 Ημερήσια σύνοψη εργοδότη');

            // TODO: Αποστολή email μέσω SMTP
        } catch (err) {
            logger.error({ err, employerId: employer.id }, 'Σφάλμα ημερήσιας σύνοψης');
        }
    }
}

module.exports = { run };
