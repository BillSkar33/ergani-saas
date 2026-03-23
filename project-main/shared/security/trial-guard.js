/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — Security Module
 * Trial Guard Middleware
 * 
 * Ελέγχει αν ο employer:
 *   - Έχει ενεργό trial/subscription
 *   - Δεν ξεπέρασε τα όρια εργαζομένων/παραρτημάτων
 * ============================================================
 */
'use strict';

const db = require('../db');
const logger = require('../logger');

/**
 * Fastify preHandler — Έλεγχος κατάστασης trial/subscription
 * Αν η δοκιμαστική περίοδος λήξει → μόνο read-only πρόσβαση
 */
async function trialGuard(request, reply) {
    if (!request.employer?.id) return; // Αν δεν είναι authenticated, πάει η authMiddleware

    try {
        const result = await db.query(
            `SELECT trial_status, trial_expires_at, subscription_plan, max_employees, max_branches
       FROM employers WHERE id = $1`,
            [request.employer.id]
        );

        if (result.rowCount === 0) {
            return reply.code(403).send({ error: 'Λογαριασμός δεν βρέθηκε' });
        }

        const employer = result.rows[0];

        // Αν trial ΚΑΙ expired → auto-update status
        if (employer.trial_status === 'trial' && employer.trial_expires_at) {
            const now = new Date();
            const expires = new Date(employer.trial_expires_at);
            if (now > expires) {
                await db.query(
                    "UPDATE employers SET trial_status = 'expired' WHERE id = $1",
                    [request.employer.id]
                );
                employer.trial_status = 'expired';
            }
        }

        // Suspended ή expired → block mutating operations
        if (['expired', 'suspended'].includes(employer.trial_status)) {
            // Επιτρέπεται μόνο GET (read-only) + logout
            if (request.method !== 'GET' && !request.url.includes('/auth/')) {
                const message = employer.trial_status === 'expired'
                    ? 'Η δοκιμαστική περίοδος έχει λήξει. Επικοινωνήστε για ενεργοποίηση.'
                    : 'Ο λογαριασμός είναι σε αναστολή. Επικοινωνήστε με τον διαχειριστή.';
                return reply.code(403).send({ error: message, trialStatus: employer.trial_status });
            }
        }

        // Προσθέτουμε trial info στο request
        request.employer.trialStatus = employer.trial_status;
        request.employer.trialExpiresAt = employer.trial_expires_at;
        request.employer.maxEmployees = employer.max_employees;
        request.employer.maxBranches = employer.max_branches;
        request.employer.plan = employer.subscription_plan;

    } catch (err) {
        logger.error({ err }, 'Trial guard error');
        // Fail-open: αφήνουμε τον request
    }
}

/**
 * Έλεγχος ορίου εργαζομένων
 * Καλείται πριν την πρόσθεση νέου εργαζομένου
 * 
 * @param {string} employerId
 * @returns {{ allowed: boolean, current: number, max: number }}
 */
async function checkEmployeeLimit(employerId) {
    try {
        const [countResult, limitResult] = await Promise.all([
            db.query('SELECT COUNT(*) as count FROM employees WHERE employer_id = $1 AND is_active = true', [employerId]),
            db.query('SELECT max_employees FROM employers WHERE id = $1', [employerId]),
        ]);

        const current = parseInt(countResult.rows[0].count);
        const max = limitResult.rows[0]?.max_employees || 5;

        return { allowed: current < max, current, max };
    } catch {
        return { allowed: true, current: 0, max: 999 }; // fail-open
    }
}

/**
 * Έλεγχος ορίου παραρτημάτων
 * Καλείται πριν την πρόσθεση νέου παραρτήματος
 */
async function checkBranchLimit(employerId) {
    try {
        const [countResult, limitResult] = await Promise.all([
            db.query('SELECT COUNT(*) as count FROM branches WHERE employer_id = $1', [employerId]),
            db.query('SELECT max_branches FROM employers WHERE id = $1', [employerId]),
        ]);

        const current = parseInt(countResult.rows[0].count);
        const max = limitResult.rows[0]?.max_branches || 1;

        return { allowed: current < max, current, max };
    } catch {
        return { allowed: true, current: 0, max: 999 };
    }
}

module.exports = { trialGuard, checkEmployeeLimit, checkBranchLimit };
