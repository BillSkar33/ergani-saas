/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — Proactive Employee Notifications
 * 
 * Υπηρεσία ειδοποιήσεων εργαζομένων (proactive):
 *   1. Υπενθύμιση βάρδιας (30' πριν)
 *   2. Εβδομαδιαία σύνοψη εργαζομένου
 * 
 * Αυτές οι ειδοποιήσεις στέλνονται μέσω chatbot
 * ΧΩΡΙΣ ο εργαζόμενος να κάνει κάποια ενέργεια.
 * ============================================================
 */
'use strict';

const { DateTime } = require('luxon');
const db = require('../../shared/db');
const logger = require('../../shared/logger');
const notifier = require('../notification-service/template-engine');

/**
 * CRON Job: Υπενθύμιση βάρδιας 30 λεπτά πριν
 * Τρέχει κάθε 5 λεπτά, ελέγχει ποιοι εργαζόμενοι
 * έχουν βάρδια που ξεκινά σε ~30 λεπτά.
 */
async function shiftReminder() {
    const now = DateTime.now().setZone('Europe/Athens');
    const today = now.toISODate();
    const currentDayOfWeek = now.weekday; // 1=Δευ, 7=Κυρ

    try {
        // Εύρεση εργαζομένων που έχουν βάρδια ξεκινάει σε 25-35 λεπτά
        const result = await db.query(
            `SELECT e.id as employee_id, e.eponymo, e.onoma,
                    ws.name as schedule_name, ws.start_time, ws.end_time,
                    ml.platform, ml.platform_user_id
             FROM employee_schedules es
             JOIN work_schedules ws ON es.schedule_id = ws.id
             JOIN employees e ON es.employee_id = e.id
             JOIN messenger_links ml ON e.id = ml.employee_id
             LEFT JOIN leaves l ON e.id = l.employee_id
               AND l.status = 'approved' AND l.start_date <= $1 AND l.end_date >= $1
             WHERE es.is_active = true
               AND ws.is_active = true
               AND e.is_active = true
               AND es.effective_from <= $1
               AND (es.effective_until IS NULL OR es.effective_until >= $1)
               AND $2 = ANY(ws.days_of_week)
               AND l.id IS NULL`,
            [today, currentDayOfWeek]
        );

        let sent = 0;
        for (const row of result.rows) {
            // Υπολογισμός σε πόσα λεπτά ξεκινά η βάρδια
            const shiftStart = DateTime.fromISO(`${today}T${row.start_time}`, { zone: 'Europe/Athens' });
            const minutesUntilShift = shiftStart.diff(now, 'minutes').minutes;

            // Στέλνουμε μόνο αν 25-35 λεπτά πριν (±5 λεπτά window)
            if (minutesUntilShift >= 25 && minutesUntilShift <= 35) {
                // Έλεγχος αν ΔΕΝ έχει ήδη κάνει check-in σήμερα
                const existing = await db.query(
                    `SELECT id FROM time_stamps
                     WHERE employee_id = $1 AND reference_date = $2 AND action_type = 'check_in'`,
                    [row.employee_id, today]
                );

                if (existing.rowCount === 0) {
                    await notifier.sendMessage(row.platform, row.platform_user_id, 'shift_reminder', {
                        name: `${row.onoma}`,
                        scheduleName: row.schedule_name,
                        startTime: row.start_time.slice(0, 5),
                        endTime: row.end_time.slice(0, 5),
                    });
                    sent++;
                }
            }
        }

        if (sent > 0) {
            logger.info({ sent }, `Shift reminders: ${sent} ειδοποιήσεις στάλθηκαν`);
        }
    } catch (err) {
        logger.error({ err }, 'Shift reminder error');
    }
}

/**
 * CRON Job: Εβδομαδιαία σύνοψη εργαζομένου
 * Τρέχει κάθε Κυριακή 20:00
 * Στέλνει σε κάθε εργαζόμενο: βάρδιες, ώρες, αργοπορίες
 */
async function weeklyEmployeeSummary() {
    const now = DateTime.now().setZone('Europe/Athens');
    const weekEnd = now.toISODate();
    const weekStart = now.minus({ days: 7 }).toISODate();

    try {
        // Εύρεση εργαζομένων με messenger link
        const employees = await db.query(
            `SELECT e.id, e.eponymo, e.onoma,
                    ml.platform, ml.platform_user_id
             FROM employees e
             JOIN messenger_links ml ON e.id = ml.employee_id
             WHERE e.is_active = true`
        );

        let sent = 0;
        for (const emp of employees.rows) {
            // Στατιστικά εβδομάδας
            const stats = await db.query(
                `SELECT 
                   COUNT(*) FILTER (WHERE action_type = 'check_in') as check_ins,
                   COUNT(*) FILTER (WHERE action_type = 'check_out') as check_outs
                 FROM time_stamps
                 WHERE employee_id = $1
                   AND reference_date BETWEEN $2 AND $3`,
                [emp.id, weekStart, weekEnd]
            );

            const checkIns = parseInt(stats.rows[0]?.check_ins || 0);
            if (checkIns === 0) continue; // Δεν δούλεψε αυτή τη βδομάδα

            const checkOuts = parseInt(stats.rows[0]?.check_outs || 0);
            const openShifts = checkIns - checkOuts;

            await notifier.sendMessage(emp.platform, emp.platform_user_id, 'weekly_employee_summary', {
                name: emp.onoma,
                weekStart,
                weekEnd,
                shifts: checkIns,
                openShifts: openShifts > 0 ? openShifts : 0,
            });
            sent++;
        }

        logger.info({ sent }, `Weekly employee summaries: ${sent} στάλθηκαν`);
    } catch (err) {
        logger.error({ err }, 'Weekly employee summary error');
    }
}

/**
 * Event-based: Ειδοποίηση ανάθεσης ωραρίου
 * Καλείται από τα schedule routes μετά από assign
 */
async function notifyScheduleAssignment(employeeId, scheduleName, startTime, endTime, effectiveFrom) {
    try {
        const link = await db.query(
            'SELECT platform, platform_user_id FROM messenger_links WHERE employee_id = $1',
            [employeeId]
        );
        if (link.rowCount === 0) return; // Δεν έχει messenger

        await notifier.sendMessage(link.rows[0].platform, link.rows[0].platform_user_id, 'schedule_assigned', {
            scheduleName,
            startTime: startTime.slice(0, 5),
            endTime: endTime.slice(0, 5),
            effectiveFrom,
        });
        logger.info({ employeeId, scheduleName }, 'Ειδοποίηση ανάθεσης ωραρίου στάλθηκε');
    } catch (err) {
        logger.error({ err, employeeId }, 'Schedule assignment notification error');
    }
}

/**
 * Event-based: Ειδοποίηση για άδεια (approved/rejected)
 * Καλείται από τα leave routes μετά από approve/reject
 */
async function notifyLeaveDecision(employeeId, leaveType, startDate, endDate, status) {
    const typeNames = {
        annual: 'Κανονική', sick: 'Ασθενείας', unpaid: 'Άνευ αποδοχών',
        maternity: 'Μητρότητας', other: 'Άλλη',
    };

    try {
        const link = await db.query(
            'SELECT platform, platform_user_id FROM messenger_links WHERE employee_id = $1',
            [employeeId]
        );
        if (link.rowCount === 0) return;

        const templateName = status === 'approved' ? 'leave_approved' : 'leave_rejected';
        await notifier.sendMessage(link.rows[0].platform, link.rows[0].platform_user_id, templateName, {
            leaveType: typeNames[leaveType] || leaveType,
            startDate,
            endDate,
        });
        logger.info({ employeeId, status }, `Ειδοποίηση άδειας (${status}) στάλθηκε`);
    } catch (err) {
        logger.error({ err, employeeId }, 'Leave notification error');
    }
}

/**
 * Event-based: Ειδοποίηση αλλαγής ωραρίου
 * Καλείται από PUT /schedules/assign/:id
 */
async function notifyScheduleChange(employeeId, scheduleName, startTime, endTime) {
    try {
        const link = await db.query(
            'SELECT platform, platform_user_id FROM messenger_links WHERE employee_id = $1',
            [employeeId]
        );
        if (link.rowCount === 0) return;

        await notifier.sendMessage(link.rows[0].platform, link.rows[0].platform_user_id, 'schedule_changed', {
            scheduleName,
            startTime: startTime.slice(0, 5),
            endTime: endTime.slice(0, 5),
        });
        logger.info({ employeeId, scheduleName }, 'Ειδοποίηση αλλαγής ωραρίου στάλθηκε');
    } catch (err) {
        logger.error({ err, employeeId }, 'Schedule change notification error');
    }
}

module.exports = {
    shiftReminder,
    weeklyEmployeeSummary,
    notifyScheduleAssignment,
    notifyLeaveDecision,
    notifyScheduleChange,
};
