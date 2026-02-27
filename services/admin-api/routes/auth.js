/**
 * ============================================================
 * Admin API — Auth Routes
 * POST /api/admin/auth/login — Σύνδεση εργοδότη
 * POST /api/admin/auth/register — Εγγραφή εργοδότη
 * GET  /api/admin/auth/me — Τρέχων χρήστης
 * ============================================================
 */
'use strict';

const bcrypt = require('bcryptjs');
const db = require('../../../shared/db');
const logger = require('../../../shared/logger');
const { loginEmployer, authMiddleware, createToken } = require('../middleware/auth');

async function authRoutes(fastify) {

    // --- POST /login — Σύνδεση ---
    fastify.post('/login', async (request, reply) => {
        const { email, password } = request.body || {};

        if (!email || !password) {
            return reply.code(400).send({ error: 'Απαιτούνται email και κωδικός' });
        }

        try {
            const result = await loginEmployer(email, password);
            return reply.send(result);
        } catch (err) {
            logger.warn({ email, err: err.message }, 'Αποτυχημένη σύνδεση');
            return reply.code(401).send({ error: err.message });
        }
    });

    // --- POST /register — Εγγραφή νέου εργοδότη ---
    fastify.post('/register', async (request, reply) => {
        const { email, password, companyName, afmErgodoti } = request.body || {};

        // Validation
        if (!email || !password || !companyName || !afmErgodoti) {
            return reply.code(400).send({ error: 'Λείπουν υποχρεωτικά πεδία' });
        }

        if (!/^\d{9}$/.test(afmErgodoti)) {
            return reply.code(400).send({ error: 'Μη έγκυρο ΑΦΜ (πρέπει 9 ψηφία)' });
        }

        if (password.length < 8) {
            return reply.code(400).send({ error: 'Ο κωδικός πρέπει τουλάχιστον 8 χαρακτήρες' });
        }

        try {
            // Hash password
            const passwordHash = await bcrypt.hash(password, 12);

            // Εισαγωγή
            const result = await db.query(
                `INSERT INTO employers (email, password_hash, company_name, afm_ergodoti)
         VALUES ($1, $2, $3, $4) RETURNING id, email, company_name`,
                [email, passwordHash, companyName, afmErgodoti]
            );

            const employer = result.rows[0];

            // Δημιουργία default notification settings
            await db.query(
                `INSERT INTO employer_notification_settings (employer_id) VALUES ($1)`,
                [employer.id]
            );

            // Auto-login
            const token = createToken({
                employerId: employer.id,
                email: employer.email,
                companyName: employer.company_name,
            });

            logger.info({ email, afm: afmErgodoti }, 'Νέος εργοδότης εγγράφηκε');
            return reply.code(201).send({ token, employer });
        } catch (err) {
            if (err.code === '23505') {
                return reply.code(409).send({ error: 'Email ή ΑΦΜ υπάρχει ήδη' });
            }
            logger.error({ err }, 'Σφάλμα εγγραφής εργοδότη');
            return reply.code(500).send({ error: 'Σφάλμα εγγραφής' });
        }
    });

    // --- GET /me — Πληροφορίες τρέχοντος χρήστη ---
    fastify.get('/me', { preHandler: authMiddleware }, async (request) => {
        return { employer: request.employer };
    });
}

module.exports = authRoutes;
