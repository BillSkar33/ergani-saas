/**
 * ============================================================
 * Admin API — Dashboard Routes
 * GET /api/admin/dashboard/stats — Σημερινά στατιστικά
 * GET /api/admin/dashboard/chart — Δεδομένα γραφήματος (7 ημέρες)
 * ============================================================
 */
'use strict';

const db = require('../../../shared/db');

async function dashboardRoutes(fastify) {

    // --- GET /stats — Σημερινά στατιστικά ---
    fastify.get('/stats', async (request) => {
        const eid = request.employer.id;

        // Παράλληλα queries
        const [checkins, checkouts, openShifts, fraudAlerts, pendingErgani, totalEmployees] = await Promise.all([
            // Check-ins σήμερα
            db.query(
                `SELECT COUNT(*) as count FROM time_stamps ts
         JOIN employees e ON ts.employee_id = e.id
         WHERE e.employer_id = $1 AND ts.action_type = 'check_in'
         AND ts.reference_date = CURRENT_DATE`, [eid]),
            // Check-outs σήμερα
            db.query(
                `SELECT COUNT(*) as count FROM time_stamps ts
         JOIN employees e ON ts.employee_id = e.id
         WHERE e.employer_id = $1 AND ts.action_type = 'check_out'
         AND ts.reference_date = CURRENT_DATE`, [eid]),
            // Ανοιχτές βάρδιες (check-in χωρίς check-out)
            db.query(
                `SELECT COUNT(*) as count FROM time_stamps ts
         JOIN employees e ON ts.employee_id = e.id
         WHERE e.employer_id = $1 AND ts.action_type = 'check_in'
         AND ts.reference_date = CURRENT_DATE
         AND NOT EXISTS (
           SELECT 1 FROM time_stamps t2
           WHERE t2.employee_id = ts.employee_id
           AND t2.action_type = 'check_out'
           AND t2.reference_date = CURRENT_DATE
         )`, [eid]),
            // Ανεξέταστα fraud alerts
            db.query(
                `SELECT COUNT(*) as count FROM fraud_alerts fa
         JOIN employees e ON fa.employee_id = e.id
         WHERE e.employer_id = $1 AND fa.is_reviewed = false`, [eid]),
            // Εκκρεμείς υποβολές ΕΡΓΑΝΗ
            db.query(
                `SELECT COUNT(*) as count FROM time_stamps ts
         JOIN employees e ON ts.employee_id = e.id
         WHERE e.employer_id = $1 AND ts.ergani_status = 'pending'`, [eid]),
            // Σύνολο ενεργών εργαζομένων
            db.query(
                `SELECT COUNT(*) as count FROM employees
         WHERE employer_id = $1 AND is_active = true`, [eid]),
        ]);

        return {
            today: {
                checkIns: parseInt(checkins.rows[0].count),
                checkOuts: parseInt(checkouts.rows[0].count),
                openShifts: parseInt(openShifts.rows[0].count),
            },
            alerts: {
                fraudUnreviewed: parseInt(fraudAlerts.rows[0].count),
                pendingErgani: parseInt(pendingErgani.rows[0].count),
            },
            totalEmployees: parseInt(totalEmployees.rows[0].count),
        };
    });

    // --- GET /chart — Δεδομένα γραφήματος 7 ημερών ---
    fastify.get('/chart', async (request) => {
        const eid = request.employer.id;

        const result = await db.query(
            `SELECT ts.reference_date as date,
              COUNT(CASE WHEN ts.action_type = 'check_in' THEN 1 END) as checkins,
              COUNT(CASE WHEN ts.action_type = 'check_out' THEN 1 END) as checkouts
       FROM time_stamps ts
       JOIN employees e ON ts.employee_id = e.id
       WHERE e.employer_id = $1
         AND ts.reference_date >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY ts.reference_date
       ORDER BY ts.reference_date`, [eid]
        );

        return { chart: result.rows };
    });
}

module.exports = dashboardRoutes;
