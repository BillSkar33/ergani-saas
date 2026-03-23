/**
 * ============================================================
 * Admin API — Auth Routes (🔒 Security Enhanced)
 * 
 * POST /login  — Σύνδεση (rate limited, lockout)
 * POST /register — Εγγραφή (password strength)
 * POST /logout — Αποσύνδεση (JWT blacklist)
 * GET  /me — Τρέχων χρήστης
 * PUT  /change-password — Αλλαγή κωδικού
 * ============================================================
 */
'use strict';

const bcrypt = require('bcryptjs');
const db = require('../../../shared/db');
const logger = require('../../../shared/logger');
const { loginEmployer, authMiddleware, createToken, blacklistToken } = require('../middleware/auth');
const { rateLimiter } = require('../../../shared/security/rate-limiter');
const { validatePasswordStrength, sanitizeHtml, isValidEmail } = require('../../../shared/security/sanitize');
const { invalidateAllTokens } = require('../../../shared/security/jwt-blacklist');
const { logAuditEvent } = require('../../../shared/security/audit-logger');

async function authRoutes(fastify) {

    // --- POST /login — 🔒 Rate limited (5/min) + lockout ---
    fastify.post('/login', { preHandler: rateLimiter('auth') }, async (request, reply) => {
        const { email, password } = request.body || {};
        if (!email || !password) {
            return reply.code(400).send({ error: 'Απαιτούνται email και κωδικός' });
        }

        try {
            const result = await loginEmployer(email, password, request.ip);
            return reply.send(result);
        } catch (err) {
            logger.warn({ email, err: err.message }, 'Αποτυχημένη σύνδεση');
            return reply.code(401).send({ error: err.message });
        }
    });

    // --- POST /register — 🔒 Password strength + input sanitization ---
    fastify.post('/register', { preHandler: rateLimiter('auth') }, async (request, reply) => {
        const { email, password, companyName, afmErgodoti } = request.body || {};

        // Validation
        if (!email || !password || !companyName || !afmErgodoti) {
            return reply.code(400).send({ error: 'Λείπουν υποχρεωτικά πεδία' });
        }
        if (!isValidEmail(email)) {
            return reply.code(400).send({ error: 'Μη έγκυρο email' });
        }
        if (!/^\d{9}$/.test(afmErgodoti)) {
            return reply.code(400).send({ error: 'Μη έγκυρο ΑΦΜ (9 ψηφία)' });
        }

        // 🔒 Password strength check
        const pwCheck = validatePasswordStrength(password);
        if (!pwCheck.valid) {
            return reply.code(400).send({ error: 'Αδύναμος κωδικός', details: pwCheck.errors });
        }

        try {
            const passwordHash = await bcrypt.hash(password, 12);
            const cleanCompany = sanitizeHtml(companyName);

            const result = await db.query(
                `INSERT INTO employers (email, password_hash, company_name, afm_ergodoti)
         VALUES ($1, $2, $3, $4) RETURNING id, email, company_name`,
                [email, passwordHash, cleanCompany, afmErgodoti]
            );

            const employer = result.rows[0];

            // Default notification settings
            await db.query(
                'INSERT INTO employer_notification_settings (employer_id) VALUES ($1)',
                [employer.id]
            );

            const token = createToken({
                employerId: employer.id,
                email: employer.email,
                companyName: employer.company_name,
            });

            // 🔒 Audit log
            await logAuditEvent({
                eventType: 'auth_register',
                entityType: 'employer',
                entityId: employer.id,
                payload: { email, companyName: cleanCompany },
                ipAddress: request.ip,
            });

            logger.info({ email }, 'Νέος εργοδότης εγγράφηκε');
            return reply.code(201).send({ token, employer });
        } catch (err) {
            if (err.code === '23505') {
                return reply.code(409).send({ error: 'Email ή ΑΦΜ υπάρχει ήδη' });
            }
            logger.error({ err }, 'Σφάλμα εγγραφής');
            return reply.code(500).send({ error: 'Σφάλμα εγγραφής' });
        }
    });

    // --- POST /logout — 🔒 JWT blacklist ---
    fastify.post('/logout', { preHandler: authMiddleware }, async (request) => {
        await blacklistToken(request.rawToken, request.tokenPayload.exp);
        await logAuditEvent({
            eventType: 'auth_logout',
            entityType: 'employer',
            entityId: request.employer.id,
            payload: {},
            ipAddress: request.ip,
        });
        return { success: true, message: 'Αποσυνδεθήκατε' };
    });

    // --- GET /me — Τρέχων χρήστης ---
    fastify.get('/me', { preHandler: authMiddleware }, async (request) => {
        return { employer: request.employer };
    });

    // --- PUT /change-password — 🔒 Αλλαγή κωδικού + invalidate tokens ---
    fastify.put('/change-password', { preHandler: authMiddleware }, async (request, reply) => {
        const { currentPassword, newPassword } = request.body || {};
        if (!currentPassword || !newPassword) {
            return reply.code(400).send({ error: 'Απαιτούνται τρέχων και νέος κωδικός' });
        }

        // 🔒 Password strength
        const pwCheck = validatePasswordStrength(newPassword);
        if (!pwCheck.valid) {
            return reply.code(400).send({ error: 'Αδύναμος νέος κωδικός', details: pwCheck.errors });
        }

        // Verify current password
        const result = await db.query(
            'SELECT password_hash FROM employers WHERE id = $1',
            [request.employer.id]
        );
        const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
        if (!valid) {
            return reply.code(401).send({ error: 'Λάθος τρέχων κωδικός' });
        }

        // Update password
        const newHash = await bcrypt.hash(newPassword, 12);
        await db.query(
            'UPDATE employers SET password_hash = $1 WHERE id = $2',
            [newHash, request.employer.id]
        );

        // 🔒 Ακύρωση ΟΛΩΝ των tokens (force re-login)
        await invalidateAllTokens(request.employer.id);

        await logAuditEvent({
            eventType: 'auth_password_change',
            entityType: 'employer',
            entityId: request.employer.id,
            payload: { email: request.employer.email },
            ipAddress: request.ip,
        });

        logger.info({ email: request.employer.email }, 'Αλλαγή κωδικού');
        return { success: true, message: 'Κωδικός άλλαξε. Συνδεθείτε ξανά.' };
    });
}

module.exports = authRoutes;
