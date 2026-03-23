/**
 * ============================================================
 * Admin API — Schedule & Leave Routes
 * 
 * Ωράρια:
 *   GET    /api/admin/schedules         — Λίστα πρότυπων
 *   POST   /api/admin/schedules         — Δημιουργία πρότυπου
 *   PUT    /api/admin/schedules/:id     — Ενημέρωση
 *   DELETE /api/admin/schedules/:id     — Διαγραφή
 *   POST   /api/admin/schedules/assign  — Ανάθεση σε εργαζόμενο
 *   DELETE /api/admin/schedules/assign/:id — Αφαίρεση ανάθεσης
 * 
 * Άδειες:
 *   GET    /api/admin/leaves            — Λίστα αδειών
 *   POST   /api/admin/leaves            — Αίτηση άδειας
 *   PUT    /api/admin/leaves/:id        — Approve/Reject
 *   DELETE /api/admin/leaves/:id        — Ακύρωση
 * 
 * Ημερολόγιο:
 *   GET    /api/admin/calendar          — Εβδομαδιαίο πρόγραμμα
 * ============================================================
 */
'use strict';

const db = require('../../../shared/db');
const logger = require('../../../shared/logger');
const { getWeeklyCalendar } = require('../../../shared/scheduling/validator');
const { notifyScheduleAssignment, notifyLeaveDecision, notifyScheduleChange } = require('../../scheduler/employee-notifications');

// ===========================
// ΩΡΑΡΙΑ (Work Schedules)
// ===========================
async function scheduleRoutes(fastify) {

    // --- GET / — Λίστα πρότυπων ωραρίων ---
    fastify.get('/', async (request) => {
        const result = await db.query(
            `SELECT ws.*,
        (SELECT COUNT(*) FROM employee_schedules es
         WHERE es.schedule_id = ws.id AND es.is_active = true) as assigned_count
       FROM work_schedules ws
       WHERE ws.employer_id = $1
       ORDER BY ws.name`,
            [request.employer.id]
        );
        return { schedules: result.rows };
    });

    // --- POST / — Δημιουργία πρότυπου ωραρίου ---
    fastify.post('/', async (request, reply) => {
        const { name, startTime, endTime, daysOfWeek, isNightShift, breakMinutes,
            graceMinutesBefore, graceMinutesAfter } = request.body || {};

        if (!name || !startTime || !endTime) {
            return reply.code(400).send({ error: 'Απαιτούνται: όνομα, ώρα έναρξης, ώρα λήξης' });
        }

        try {
            const result = await db.query(
                `INSERT INTO work_schedules (employer_id, name, start_time, end_time,
         days_of_week, is_night_shift, break_minutes, grace_minutes_before, grace_minutes_after)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
                [request.employer.id, name, startTime, endTime,
                daysOfWeek || [1, 2, 3, 4, 5], isNightShift || false, breakMinutes || 0,
                graceMinutesBefore || 15, graceMinutesAfter || 10]
            );
            logger.info({ name }, 'Νέο ωράριο δημιουργήθηκε');
            return reply.code(201).send({ schedule: result.rows[0] });
        } catch (err) {
            if (err.code === '23505') return reply.code(409).send({ error: 'Ωράριο με αυτό το όνομα υπάρχει ήδη' });
            throw err;
        }
    });

    // --- PUT /:id — Ενημέρωση ωραρίου ---
    fastify.put('/:id', async (request, reply) => {
        const { name, startTime, endTime, daysOfWeek, isNightShift, breakMinutes,
            graceMinutesBefore, graceMinutesAfter, isActive } = request.body || {};

        const result = await db.query(
            `UPDATE work_schedules SET
       name = COALESCE($1, name), start_time = COALESCE($2, start_time),
       end_time = COALESCE($3, end_time), days_of_week = COALESCE($4, days_of_week),
       is_night_shift = COALESCE($5, is_night_shift), break_minutes = COALESCE($6, break_minutes),
       grace_minutes_before = COALESCE($7, grace_minutes_before),
       grace_minutes_after = COALESCE($8, grace_minutes_after),
       is_active = COALESCE($9, is_active)
       WHERE id = $10 AND employer_id = $11 RETURNING *`,
            [name, startTime, endTime, daysOfWeek, isNightShift, breakMinutes,
                graceMinutesBefore, graceMinutesAfter, isActive, request.params.id, request.employer.id]
        );
        if (result.rowCount === 0) return reply.code(404).send({ error: 'Ωράριο δεν βρέθηκε' });
        return { schedule: result.rows[0] };
    });

    // --- DELETE /:id — Απενεργοποίηση ωραρίου ---
    fastify.delete('/:id', async (request) => {
        await db.query(
            'UPDATE work_schedules SET is_active = false WHERE id = $1 AND employer_id = $2',
            [request.params.id, request.employer.id]
        );
        return { success: true };
    });

    // --- POST /assign — Ανάθεση ωραρίου σε εργαζόμενο ---
    fastify.post('/assign', async (request, reply) => {
        const { employeeId, scheduleId, effectiveFrom, effectiveUntil } = request.body || {};

        if (!employeeId || !scheduleId || !effectiveFrom) {
            return reply.code(400).send({ error: 'Απαιτούνται: εργαζόμενος, ωράριο, ημερ. έναρξης' });
        }

        // Επιβεβαίωση ιδιοκτησίας
        const check = await db.query(
            'SELECT id FROM employees WHERE id = $1 AND employer_id = $2',
            [employeeId, request.employer.id]
        );
        if (check.rowCount === 0) return reply.code(404).send({ error: 'Εργαζόμενος δεν βρέθηκε' });

        // Απενεργοποίηση τυχόν παλαιών αναθέσεων
        await db.query(
            'UPDATE employee_schedules SET is_active = false WHERE employee_id = $1 AND is_active = true',
            [employeeId]
        );

        const result = await db.query(
            `INSERT INTO employee_schedules (employee_id, schedule_id, effective_from, effective_until)
       VALUES ($1, $2, $3, $4) RETURNING *`,
            [employeeId, scheduleId, effectiveFrom, effectiveUntil || null]
        );

        logger.info({ employeeId, scheduleId }, 'Ωράριο ανατέθηκε');

        // 🔔 Ειδοποίηση εργαζομένου (async, fire-and-forget)
        const sched = await db.query('SELECT name, start_time, end_time FROM work_schedules WHERE id = $1', [scheduleId]);
        if (sched.rowCount > 0) {
            notifyScheduleAssignment(employeeId, sched.rows[0].name, sched.rows[0].start_time, sched.rows[0].end_time, effectiveFrom)
                .catch(err => logger.error({ err }, 'Schedule notification failed'));
        }

        return reply.code(201).send({ assignment: result.rows[0] });
    });

    // --- PUT /assign/:id — Αλλαγή υπάρχουσας ανάθεσης (νέες ημερομηνίες / νέο ωράριο) ---
    fastify.put('/assign/:id', async (request, reply) => {
        const { scheduleId, effectiveFrom, effectiveUntil } = request.body || {};

        // Επιβεβαίωση ιδιοκτησίας
        const existing = await db.query(
            `SELECT es.*, e.employer_id, e.id AS emp_id
             FROM employee_schedules es
             JOIN employees e ON es.employee_id = e.id
             WHERE es.id = $1 AND e.employer_id = $2`,
            [request.params.id, request.employer.id]
        );
        if (existing.rowCount === 0) return reply.code(404).send({ error: 'Ανάθεση δεν βρέθηκε' });

        const assignment = existing.rows[0];

        const result = await db.query(
            `UPDATE employee_schedules SET
             schedule_id   = COALESCE($1, schedule_id),
             effective_from = COALESCE($2, effective_from),
             effective_until = $3
             WHERE id = $4 RETURNING *`,
            [scheduleId, effectiveFrom, effectiveUntil ?? assignment.effective_until, request.params.id]
        );

        logger.info({ assignmentId: request.params.id }, 'Ανάθεση ωραρίου ενημερώθηκε');

        // 🔔 Ειδοποίηση εργαζομένου
        const finalScheduleId = scheduleId || assignment.schedule_id;
        const sched = await db.query(
            'SELECT name, start_time, end_time FROM work_schedules WHERE id = $1', [finalScheduleId]
        );
        if (sched.rowCount > 0) {
            notifyScheduleChange(assignment.emp_id, sched.rows[0].name, sched.rows[0].start_time, sched.rows[0].end_time)
                .catch(err => logger.error({ err }, 'Schedule change notification failed'));
        }

        return { assignment: result.rows[0] };
    });

    // --- GET /assignments — Λίστα αναθέσεων ---
    fastify.get('/assignments', async (request) => {
        const result = await db.query(
            `SELECT es.*, e.eponymo, e.onoma, e.afm, ws.name as schedule_name,
              ws.start_time, ws.end_time, ws.days_of_week
       FROM employee_schedules es
       JOIN employees e ON es.employee_id = e.id
       JOIN work_schedules ws ON es.schedule_id = ws.id
       WHERE e.employer_id = $1 AND es.is_active = true
       ORDER BY e.eponymo`,
            [request.employer.id]
        );
        return { assignments: result.rows };
    });

    // --- DELETE /assign/:id —  Αφαίρεση ανάθεσης ---
    fastify.delete('/assign/:id', async (request) => {
        await db.query(
            `UPDATE employee_schedules SET is_active = false
       WHERE id = $1 AND employee_id IN (SELECT id FROM employees WHERE employer_id = $2)`,
            [request.params.id, request.employer.id]
        );
        return { success: true };
    });
}

// ===========================
// ΑΔΕΙΕΣ (Leaves)
// ===========================
async function leaveRoutes(fastify) {

    // --- GET / — Λίστα αδειών ---
    fastify.get('/', async (request) => {
        const { status, employeeId } = request.query;
        let where = 'WHERE e.employer_id = $1';
        const params = [request.employer.id];
        let i = 2;

        if (status) { where += ` AND l.status = $${i++}`; params.push(status); }
        if (employeeId) { where += ` AND l.employee_id = $${i++}`; params.push(employeeId); }

        const result = await db.query(
            `SELECT l.*, e.eponymo, e.onoma, e.afm
       FROM leaves l
       JOIN employees e ON l.employee_id = e.id
       ${where}
       ORDER BY l.start_date DESC`,
            params
        );
        return { leaves: result.rows };
    });

    // --- POST / — Νέα άδεια ---
    fastify.post('/', async (request, reply) => {
        const { employeeId, leaveType, startDate, endDate, notes } = request.body || {};

        if (!employeeId || !leaveType || !startDate || !endDate) {
            return reply.code(400).send({ error: 'Απαιτούνται: εργαζόμενος, τύπος, από, έως' });
        }

        const validTypes = ['annual', 'sick', 'unpaid', 'maternity', 'other'];
        if (!validTypes.includes(leaveType)) {
            return reply.code(400).send({ error: `Τύπος: ${validTypes.join(', ')}` });
        }

        // Έλεγχος overlap
        const overlap = await db.query(
            `SELECT id FROM leaves WHERE employee_id = $1
       AND status != 'rejected'
       AND start_date <= $3 AND end_date >= $2`,
            [employeeId, startDate, endDate]
        );
        if (overlap.rowCount > 0) {
            return reply.code(409).send({ error: 'Υπάρχει ήδη άδεια στις ίδιες ημερομηνίες' });
        }

        const result = await db.query(
            `INSERT INTO leaves (employee_id, leave_type, start_date, end_date, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [employeeId, leaveType, startDate, endDate, notes || null]
        );

        logger.info({ employeeId, leaveType, startDate, endDate }, 'Νέα άδεια δημιουργήθηκε');
        return reply.code(201).send({ leave: result.rows[0] });
    });

    // --- PUT /:id — Approve/Reject ---
    fastify.put('/:id', async (request, reply) => {
        const { status } = request.body || {};

        if (!['approved', 'rejected'].includes(status)) {
            return reply.code(400).send({ error: 'Status: approved ή rejected' });
        }

        const result = await db.query(
            `UPDATE leaves SET status = $1, approved_by = $2, approved_at = NOW()
       WHERE id = $3 AND employee_id IN (SELECT id FROM employees WHERE employer_id = $4)
       RETURNING *`,
            [status, request.employer.id, request.params.id, request.employer.id]
        );

        if (result.rowCount === 0) return reply.code(404).send({ error: 'Άδεια δεν βρέθηκε' });

        const leave = result.rows[0];
        logger.info({ leaveId: request.params.id, status }, `Άδεια ${status === 'approved' ? 'εγκρίθηκε' : 'απορρίφθηκε'}`);

        // 🔔 Ειδοποίηση εργαζομένου (async, fire-and-forget)
        notifyLeaveDecision(leave.employee_id, leave.leave_type, leave.start_date, leave.end_date, status)
            .catch(err => logger.error({ err }, 'Leave notification failed'));

        return { leave };
    });

    // --- DELETE /:id — Ακύρωση ---
    fastify.delete('/:id', async (request) => {
        await db.query(
            `DELETE FROM leaves WHERE id = $1
       AND employee_id IN (SELECT id FROM employees WHERE employer_id = $2)`,
            [request.params.id, request.employer.id]
        );
        return { success: true };
    });
}

// ===========================
// ΗΜΕΡΟΛΟΓΙΟ (Calendar)
// ===========================
async function calendarRoutes(fastify) {
    // --- GET / — Εβδομαδιαίο πρόγραμμα ---
    fastify.get('/', async (request) => {
        const { weekStart } = request.query;
        if (!weekStart) return { error: 'Απαιτείται weekStart (ISO date, πχ 2026-03-02)' };
        const data = await getWeeklyCalendar(request.employer.id, weekStart);
        return { calendar: data, weekStart };
    });
}

module.exports = { scheduleRoutes, leaveRoutes, calendarRoutes };
