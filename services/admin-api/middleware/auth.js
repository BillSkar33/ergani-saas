/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — SaaS Platform
 * Admin API — JWT Authentication Middleware
 * 
 * 🔒 Security Features:
 * - HMAC-SHA256 JWT tokens (timing-safe verify)
 * - bcrypt password hashing (factor 12)
 * - Account lockout (5 αποτυχίες → 15 λεπτά)
 * - JWT blacklist (logout + password change)
 * - Audit logging (ΟΛΑ τα auth events)
 * ============================================================
 */
'use strict';

const crypto = require('crypto');
const db = require('../../shared/db');
const logger = require('../../shared/logger');
const { isAccountLocked, recordFailedLogin, clearFailedLogins } = require('../../shared/security/account-lockout');
const { isTokenBlacklisted, blacklistToken } = require('../../shared/security/jwt-blacklist');
const { logAuditEvent } = require('../../shared/security/audit-logger');

// JWT Secret — παραγωγή από ENCRYPTION_KEY
const JWT_SECRET = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const TOKEN_EXPIRY_HOURS = 8;

/**
 * Δημιουργία JWT-like token (Base64url + HMAC-SHA256)
 */
function createToken(payload) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({
        ...payload,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (TOKEN_EXPIRY_HOURS * 3600),
    })).toString('base64url');

    const signature = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(`${header}.${body}`)
        .digest('base64url');

    return `${header}.${body}.${signature}`;
}

/**
 * Επαλήθευση token (timing-safe)
 */
function verifyToken(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const [header, body, signature] = parts;

        const expectedSig = crypto
            .createHmac('sha256', JWT_SECRET)
            .update(`${header}.${body}`)
            .digest('base64url');

        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
            return null;
        }

        const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            return null;
        }
        return payload;
    } catch {
        return null;
    }
}

/**
 * 🔒 Fastify preHandler — Προστασία admin routes
 * Ελέγχει: Authorization header → signature → expiry → blacklist
 */
async function authMiddleware(request, reply) {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.code(401).send({ error: 'Απαιτείται σύνδεση' });
    }

    const token = authHeader.slice(7);
    const payload = verifyToken(token);

    if (!payload) {
        return reply.code(401).send({ error: 'Μη έγκυρο ή ληγμένο token' });
    }

    // 🔒 Έλεγχος JWT blacklist (logout / αλλαγή κωδικού)
    const blacklisted = await isTokenBlacklisted(token, payload.employerId, payload.iat);
    if (blacklisted) {
        return reply.code(401).send({ error: 'Το session έχει ακυρωθεί. Συνδεθείτε ξανά.' });
    }

    request.employer = {
        id: payload.employerId,
        email: payload.email,
        companyName: payload.companyName,
    };
    // Αποθήκευση raw token για πιθανό logout
    request.rawToken = token;
    request.tokenPayload = payload;
}

/**
 * 🔒 Login εργοδότη — με lockout protection
 */
async function loginEmployer(email, password, ipAddress) {
    // 🔒 Έλεγχος lockout
    const lockStatus = await isAccountLocked(email);
    if (lockStatus.locked) {
        await logAuditEvent({
            eventType: 'auth_login_locked',
            entityType: 'employer',
            payload: { email },
            ipAddress,
        });
        throw new Error(`Ο λογαριασμός είναι κλειδωμένος. Δοκιμάστε σε ${lockStatus.remainingMinutes} λεπτά.`);
    }

    // Αναζήτηση εργοδότη
    const result = await db.query(
        'SELECT id, email, password_hash, company_name, is_active FROM employers WHERE email = $1',
        [email]
    );

    if (result.rowCount === 0) {
        await recordFailedLogin(email);
        await logAuditEvent({
            eventType: 'auth_login_failed',
            entityType: 'employer',
            payload: { email, reason: 'not_found' },
            ipAddress,
        });
        throw new Error('Λάθος email ή κωδικός');
    }

    const employer = result.rows[0];

    if (!employer.is_active) {
        throw new Error('Ο λογαριασμός είναι απενεργοποιημένος');
    }

    // Bcrypt verify
    const bcrypt = require('bcryptjs');
    const valid = await bcrypt.compare(password, employer.password_hash);
    if (!valid) {
        // 🔒 Καταγραφή αποτυχίας
        const lockResult = await recordFailedLogin(email);
        await logAuditEvent({
            eventType: 'auth_login_failed',
            entityType: 'employer',
            entityId: employer.id,
            payload: { email, reason: 'wrong_password', attempt: lockResult.attempts },
            ipAddress,
        });
        if (lockResult.locked) {
            throw new Error('Ο λογαριασμός κλειδώθηκε μετά από πολλές αποτυχίες. Δοκιμάστε σε 15 λεπτά.');
        }
        throw new Error(`Λάθος κωδικός (${lockResult.remaining} προσπάθειες απομένουν)`);
    }

    // 🔒 Επιτυχία → clear lockout counter
    await clearFailedLogins(email);

    const token = createToken({
        employerId: employer.id,
        email: employer.email,
        companyName: employer.company_name,
    });

    // 🔒 Audit log
    await logAuditEvent({
        eventType: 'auth_login_success',
        entityType: 'employer',
        entityId: employer.id,
        payload: { email },
        ipAddress,
    });

    logger.info({ email }, 'Επιτυχής σύνδεση εργοδότη');

    return {
        token,
        expiresIn: TOKEN_EXPIRY_HOURS * 3600,
        employer: {
            id: employer.id,
            email: employer.email,
            companyName: employer.company_name,
        },
    };
}

module.exports = { authMiddleware, loginEmployer, createToken, verifyToken, blacklistToken };
