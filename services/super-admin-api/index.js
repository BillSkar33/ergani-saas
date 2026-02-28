/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — Super Admin API
 * Entry Point
 * 
 * Ξεχωριστό API για τον SaaS owner (εσάς):
 * - Διαχείριση ΟΛΩΝ των employers
 * - Trial management
 * - Global stats
 * ============================================================
 */
'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../../shared/db');
const logger = require('../../shared/logger');
const { rateLimiter } = require('../../shared/security/rate-limiter');

// Super Admin JWT Secret (ξεχωριστό από employer JWT)
const SUPER_SECRET = (process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex')) + '_super';

// --- JWT Helpers (ίδιο pattern με employer auth) ---
function createSuperToken(payload) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({
        ...payload, role: 'super_admin',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (24 * 3600), // 24h
    })).toString('base64url');
    const sig = crypto.createHmac('sha256', SUPER_SECRET).update(`${header}.${body}`).digest('base64url');
    return `${header}.${body}.${sig}`;
}

function verifySuperToken(token) {
    try {
        const [h, b, s] = token.split('.');
        const expected = crypto.createHmac('sha256', SUPER_SECRET).update(`${h}.${b}`).digest('base64url');
        if (!crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected))) return null;
        const payload = JSON.parse(Buffer.from(b, 'base64url').toString());
        if (payload.exp < Math.floor(Date.now() / 1000) || payload.role !== 'super_admin') return null;
        return payload;
    } catch { return null; }
}

// Super Admin Auth Middleware
async function superAuth(request, reply) {
    const auth = request.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return reply.code(401).send({ error: 'Απαιτείται σύνδεση Super Admin' });
    const payload = verifySuperToken(auth.slice(7));
    if (!payload) return reply.code(401).send({ error: 'Μη έγκυρο token' });
    request.superAdmin = payload;
}

/**
 * Super Admin Plugin
 */
async function superAdminPlugin(fastify) {

    // --- AUTH ---
    fastify.post('/auth/login', { preHandler: rateLimiter('auth') }, async (request, reply) => {
        const { email, password } = request.body || {};
        if (!email || !password) return reply.code(400).send({ error: 'Email + κωδικός' });

        const result = await db.query('SELECT * FROM super_admins WHERE email = $1 AND is_active = true', [email]);
        if (result.rowCount === 0) return reply.code(401).send({ error: 'Λάθος στοιχεία' });

        const admin = result.rows[0];
        const valid = await bcrypt.compare(password, admin.password_hash);
        if (!valid) return reply.code(401).send({ error: 'Λάθος στοιχεία' });

        const token = createSuperToken({ adminId: admin.id, email: admin.email, name: admin.name });
        return { token, admin: { id: admin.id, email: admin.email, name: admin.name } };
    });

    // --- Δημιουργία πρώτου super admin (μόνο αν δεν υπάρχει κανείς) ---
    fastify.post('/auth/setup', async (request, reply) => {
        const count = await db.query('SELECT COUNT(*) as c FROM super_admins');
        if (parseInt(count.rows[0].c) > 0) {
            return reply.code(403).send({ error: 'Super admin υπάρχει ήδη' });
        }
        const { email, password, name } = request.body || {};
        if (!email || !password || !name) return reply.code(400).send({ error: 'Λείπουν πεδία' });

        const hash = await bcrypt.hash(password, 12);
        await db.query('INSERT INTO super_admins (email, password_hash, name) VALUES ($1, $2, $3)', [email, hash, name]);
        logger.info({ email }, '🔑 Δημιουργήθηκε πρώτος Super Admin');
        return reply.code(201).send({ success: true, message: 'Super Admin δημιουργήθηκε' });
    });

    // === PROTECTED ROUTES ===
    fastify.register(async (protected) => {
        protected.addHook('preHandler', superAuth);

        // --- GLOBAL STATS ---
        protected.get('/stats', async () => {
            const [employers, employees, timestamps, alerts, plans] = await Promise.all([
                db.query(`SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE trial_status = 'trial') as trial,
          COUNT(*) FILTER (WHERE trial_status = 'active') as active,
          COUNT(*) FILTER (WHERE trial_status = 'expired') as expired,
          COUNT(*) FILTER (WHERE trial_status = 'suspended') as suspended
          FROM employers`),
                db.query('SELECT COUNT(*) as total FROM employees WHERE is_active = true'),
                db.query("SELECT COUNT(*) as today FROM time_stamps WHERE created_at >= CURRENT_DATE"),
                db.query("SELECT COUNT(*) as unreviewed FROM fraud_alerts WHERE reviewed_at IS NULL"),
                db.query('SELECT * FROM subscription_plans WHERE is_active = true ORDER BY price_monthly'),
            ]);
            return {
                employers: employers.rows[0],
                totalEmployees: parseInt(employees.rows[0].total),
                todayTimestamps: parseInt(timestamps.rows[0].today),
                unreviewedAlerts: parseInt(alerts.rows[0].unreviewed),
                plans: plans.rows,
            };
        });

        // --- ΛΙΣΤΑ EMPLOYERS (όλοι) ---
        protected.get('/employers', async (request) => {
            const { status, search, page = 1 } = request.query;
            const limit = 20;
            const offset = (page - 1) * limit;
            let where = 'WHERE 1=1';
            const params = [];
            let i = 1;

            if (status) { where += ` AND e.trial_status = $${i++}`; params.push(status); }
            if (search) { where += ` AND (e.company_name ILIKE $${i++} OR e.email ILIKE $${i - 1})`; params.push(`%${search}%`); }

            const result = await db.query(`
        SELECT e.*,
          (SELECT COUNT(*) FROM employees WHERE employer_id = e.id AND is_active = true) as employee_count,
          (SELECT COUNT(*) FROM branches WHERE employer_id = e.id) as branch_count,
          (SELECT COUNT(*) FROM time_stamps ts JOIN employees emp ON ts.employee_id = emp.id WHERE emp.employer_id = e.id AND ts.created_at >= CURRENT_DATE) as today_stamps
        FROM employers e
        ${where}
        ORDER BY e.created_at DESC
        LIMIT $${i++} OFFSET $${i++}
      `, [...params, limit, offset]);

            const total = await db.query(`SELECT COUNT(*) as c FROM employers e ${where}`, params);

            return { employers: result.rows, total: parseInt(total.rows[0].c), page: parseInt(page), pages: Math.ceil(total.rows[0].c / limit) };
        });

        // --- EMPLOYER DETAIL ---
        protected.get('/employers/:id', async (request) => {
            const result = await db.query(`
        SELECT e.*,
          (SELECT COUNT(*) FROM employees WHERE employer_id = e.id AND is_active = true) as employee_count,
          (SELECT COUNT(*) FROM branches WHERE employer_id = e.id) as branch_count
        FROM employers e WHERE e.id = $1`, [request.params.id]);
            if (result.rowCount === 0) return { error: 'Δεν βρέθηκε' };
            return { employer: result.rows[0] };
        });

        // --- TRIAL MANAGEMENT ---
        protected.put('/employers/:id/trial', async (request) => {
            const { action, days, plan, maxEmployees, maxBranches, notes } = request.body || {};
            const id = request.params.id;
            const updates = [];
            const params = [];
            let i = 1;

            switch (action) {
                case 'extend': // Παράταση trial
                    updates.push(`trial_expires_at = COALESCE(trial_expires_at, NOW()) + INTERVAL '${parseInt(days) || 14} days'`);
                    updates.push(`trial_status = 'trial'`);
                    break;
                case 'activate': // Ενεργοποίηση (πληρωμένο)
                    updates.push(`trial_status = 'active'`);
                    updates.push(`trial_expires_at = NULL`);
                    break;
                case 'suspend': // Αναστολή
                    updates.push(`trial_status = 'suspended'`);
                    break;
                case 'expire': // Λήξη
                    updates.push(`trial_status = 'expired'`);
                    break;
                default:
                    return { error: 'Μη έγκυρο action (extend/activate/suspend/expire)' };
            }

            if (plan) { updates.push(`subscription_plan = $${i++}`); params.push(plan); }
            if (maxEmployees) { updates.push(`max_employees = $${i++}`); params.push(parseInt(maxEmployees)); }
            if (maxBranches) { updates.push(`max_branches = $${i++}`); params.push(parseInt(maxBranches)); }
            if (notes !== undefined) { updates.push(`notes = $${i++}`); params.push(notes); }

            params.push(id);
            await db.query(`UPDATE employers SET ${updates.join(', ')} WHERE id = $${i}`, params);

            logger.info({ id, action }, `Super Admin: ${action} employer`);
            return { success: true, action };
        });

        // --- SUBSCRIPTION PLANS CRUD ---
        protected.get('/plans', async () => {
            const result = await db.query('SELECT * FROM subscription_plans ORDER BY price_monthly');
            return { plans: result.rows };
        });

        protected.put('/plans/:id', async (request) => {
            const { name, maxEmployees, maxBranches, trialDays, priceMonthly } = request.body;
            await db.query(`
        UPDATE subscription_plans SET name = COALESCE($1, name), max_employees = COALESCE($2, max_employees),
        max_branches = COALESCE($3, max_branches), trial_days = COALESCE($4, trial_days),
        price_monthly = COALESCE($5, price_monthly) WHERE id = $6`,
                [name, maxEmployees, maxBranches, trialDays, priceMonthly, request.params.id]);
            return { success: true };
        });
    });
}

module.exports = superAdminPlugin;
