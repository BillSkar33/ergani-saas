/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — Schedule Validator
 * Έλεγχος ωραρίου κατά το check-in/check-out
 * 
 * Ελέγχει:
 *   1. Έχει ο εργαζόμενος ωράριο σήμερα;
 *   2. Είναι εντός ωραρίου (± grace minutes);
 *   3. Έχει εγκεκριμένη άδεια σήμερα;
 * 
 * ⚠️ Backward compatible: Αν ΔΕΝ έχει ωράριο → ελεύθερα
 * ============================================================
 */
'use strict';

const { DateTime } = require('luxon');
const db = require('../db');
const logger = require('../logger');

// Ελληνικά ονόματα ημερών (ISO: 1=Δευτέρα, 7=Κυριακή)
const DAY_NAMES = {
    1: 'Δευτέρα', 2: 'Τρίτη', 3: 'Τετάρτη', 4: 'Πέμπτη',
    5: 'Παρασκευή', 6: 'Σάββατο', 7: 'Κυριακή',
};

// Τύποι αδειών στα Ελληνικά
const LEAVE_TYPES = {
    annual: 'Κανονική',
    sick: 'Ασθενείας',
    unpaid: 'Άνευ αποδοχών',
    maternity: 'Μητρότητας',
    other: 'Άλλη',
};

/**
 * Κύρια συνάρτηση: Μπορεί ο εργαζόμενος να κάνει check-in τώρα;
 * 
 * @param {string} employeeId — UUID εργαζομένου
 * @returns {{ allowed: boolean, reason?: string, schedule?: Object }}
 */
async function canEmployeeCheckIn(employeeId) {
    const now = DateTime.now().setZone('Europe/Athens');
    const today = now.toISODate();
    const currentDayOfWeek = now.weekday; // 1=Δευ, 7=Κυρ (ISO)
    const currentTime = now.toFormat('HH:mm:ss');

    try {
        // --- Βήμα 1: Έλεγχος άδειας ---
        const leaveResult = await db.query(
            `SELECT * FROM leaves
       WHERE employee_id = $1
         AND status = 'approved'
         AND start_date <= $2
         AND end_date >= $2`,
            [employeeId, today]
        );

        if (leaveResult.rowCount > 0) {
            const leave = leaveResult.rows[0];
            const leaveTypeName = LEAVE_TYPES[leave.leave_type] || leave.leave_type;
            return {
                allowed: false,
                reason: `on_leave`,
                message: `Είσαι σε άδεια ${leaveTypeName} (${leave.start_date} - ${leave.end_date}).`,
            };
        }

        // --- Βήμα 2: Εύρεση ενεργού ωραρίου ---
        const scheduleResult = await db.query(
            `SELECT ws.*, es.effective_from, es.effective_until
       FROM employee_schedules es
       JOIN work_schedules ws ON es.schedule_id = ws.id
       WHERE es.employee_id = $1
         AND es.is_active = true
         AND ws.is_active = true
         AND es.effective_from <= $2
         AND (es.effective_until IS NULL OR es.effective_until >= $2)
       ORDER BY es.created_at DESC
       LIMIT 1`,
            [employeeId, today]
        );

        // ⚠️ Backward compatible: Αν δεν έχει ωράριο → ελεύθερα
        if (scheduleResult.rowCount === 0) {
            return { allowed: true, reason: 'no_schedule', message: null };
        }

        const schedule = scheduleResult.rows[0];

        // --- Βήμα 3: Έλεγχος ημέρας ---
        // days_of_week: INT[] πχ [1,2,3,4,5] (PostgreSQL returns as array)
        const scheduleDays = schedule.days_of_week;
        if (!scheduleDays.includes(currentDayOfWeek)) {
            const dayName = DAY_NAMES[currentDayOfWeek];
            return {
                allowed: false,
                reason: 'not_scheduled_day',
                message: `Δεν έχεις βάρδια σήμερα (${dayName}).`,
            };
        }

        // --- Βήμα 4: Έλεγχος ώρας (με grace) ---
        const graceBefore = schedule.grace_minutes_before || 15;
        const graceAfter = schedule.grace_minutes_after || 10;

        // Parse ώρες ωραρίου
        const shiftStart = DateTime.fromISO(`${today}T${schedule.start_time}`, { zone: 'Europe/Athens' });
        const shiftEnd = schedule.is_night_shift
            ? DateTime.fromISO(`${today}T${schedule.end_time}`, { zone: 'Europe/Athens' }).plus({ days: 1 })
            : DateTime.fromISO(`${today}T${schedule.end_time}`, { zone: 'Europe/Athens' });

        // Earliest allowed check-in = shift_start - grace_before
        const earliestCheckIn = shiftStart.minus({ minutes: graceBefore });
        // Latest allowed check-in = shift_start + grace_after (μετά θεωρείται αργοπορία)
        const latestCheckIn = shiftStart.plus({ minutes: graceAfter });

        if (now < earliestCheckIn) {
            return {
                allowed: false,
                reason: 'too_early',
                message: `Η βάρδια σου ξεκινά στις ${schedule.start_time.slice(0, 5)}. Μπορείς να χτυπήσεις από ${earliestCheckIn.toFormat('HH:mm')}.`,
            };
        }

        // Αν ήρθε πολύ μετά τη λήξη → πιθανόν λάθος ημέρα
        if (now > shiftEnd) {
            return {
                allowed: false,
                reason: 'shift_ended',
                message: `Η βάρδια σου (${schedule.start_time.slice(0, 5)}-${schedule.end_time.slice(0, 5)}) έχει λήξει.`,
            };
        }

        // Αν ήρθε μετά το grace period → επιτρέπεται αλλά είναι αργοπορία
        const isLate = now > latestCheckIn;

        return {
            allowed: true,
            reason: isLate ? 'late_arrival' : 'on_time',
            message: isLate ? `Αργοπορία (${Math.round(now.diff(shiftStart, 'minutes').minutes)} λεπτά)` : null,
            schedule: {
                name: schedule.name,
                startTime: schedule.start_time.slice(0, 5),
                endTime: schedule.end_time.slice(0, 5),
                isLate,
                lateMinutes: isLate ? Math.round(now.diff(shiftStart, 'minutes').minutes) : 0,
            },
        };

    } catch (err) {
        logger.error({ err, employeeId }, 'Schedule validation error');
        // Fail-open: αν crashάρει ο έλεγχος → ελεύθερα
        return { allowed: true, reason: 'error', message: null };
    }
}

/**
 * Πρόγραμμα εβδομάδας: Ποιος δουλεύει πότε
 * 
 * @param {string} employerId
 * @param {string} weekStart — ISO date (Δευτέρα)
 * @returns {Array} — Λίστα εγγραφών ανά ημέρα/εργαζόμενο
 */
async function getWeeklyCalendar(employerId, weekStart) {
    const start = DateTime.fromISO(weekStart);
    const end = start.plus({ days: 6 });

    const result = await db.query(
        `SELECT e.id as employee_id, e.eponymo, e.onoma, e.afm,
            ws.name as schedule_name, ws.start_time, ws.end_time,
            ws.days_of_week, ws.is_night_shift,
            es.effective_from, es.effective_until,
            l.leave_type, l.start_date as leave_start, l.end_date as leave_end, l.status as leave_status
     FROM employees e
     LEFT JOIN employee_schedules es ON e.id = es.employee_id
       AND es.is_active = true
       AND es.effective_from <= $3
       AND (es.effective_until IS NULL OR es.effective_until >= $2)
     LEFT JOIN work_schedules ws ON es.schedule_id = ws.id AND ws.is_active = true
     LEFT JOIN leaves l ON e.id = l.employee_id
       AND l.status = 'approved'
       AND l.start_date <= $3
       AND l.end_date >= $2
     WHERE e.employer_id = $1 AND e.is_active = true
     ORDER BY e.eponymo, e.onoma`,
        [employerId, start.toISODate(), end.toISODate()]
    );

    return result.rows;
}

module.exports = { canEmployeeCheckIn, getWeeklyCalendar, DAY_NAMES, LEAVE_TYPES };
