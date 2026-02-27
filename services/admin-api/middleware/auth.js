/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — SaaS Platform
 * Admin API — JWT Authentication Middleware
 * 
 * Διαχείριση sessions εργοδοτών:
 * - Login (bcrypt verify → JWT token)
 * - Token verification σε κάθε request
 * - Refresh token
 * ============================================================
 */
'use strict';

const crypto = require('crypto');
const db = require('../../shared/db');
const logger = require('../../shared/logger');

// JWT Secret — παραγωγή από ENCRYPTION_KEY
const JWT_SECRET = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const TOKEN_EXPIRY_HOURS = 8;

/**
 * Δημιουργία απλού JWT-like token
 * (Base64 encoded JSON + HMAC-SHA256 signature)
 * 
 * @param {Object} payload - Δεδομένα token { employerId, email }
 * @returns {string} - Signed token
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
 * Επαλήθευση token
 * 
 * @param {string} token - JWT token string
 * @returns {Object|null} - Decoded payload ή null αν invalid
 */
function verifyToken(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const [header, body, signature] = parts;

        // Έλεγχος signature
        const expectedSig = crypto
            .createHmac('sha256', JWT_SECRET)
            .update(`${header}.${body}`)
            .digest('base64url');

        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
            return null;
        }

        // Decode payload
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString());

        // Έλεγχος expiry
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            return null;
        }

        return payload;
    } catch {
        return null;
    }
}

/**
 * Fastify preHandler — Προστασία admin routes
 * Ελέγχει Authorization header σε κάθε request.
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

    // Επισύναψη employer στο request
    request.employer = {
        id: payload.employerId,
        email: payload.email,
        companyName: payload.companyName,
    };
}

/**
 * Login εργοδότη
 * 
 * @param {string} email
 * @param {string} password
 * @returns {Object} - { token, employer } ή throws
 */
async function loginEmployer(email, password) {
    // Αναζήτηση εργοδότη
    const result = await db.query(
        'SELECT id, email, password_hash, company_name, is_active FROM employers WHERE email = $1',
        [email]
    );

    if (result.rowCount === 0) {
        throw new Error('Λάθος email ή κωδικός');
    }

    const employer = result.rows[0];

    if (!employer.is_active) {
        throw new Error('Ο λογαριασμός είναι απενεργοποιημένος');
    }

    // Bcrypt verify — χρήση crypto (απλοποιημένη σύγκριση)
    // Σε production χρήση bcrypt.compare()
    const bcrypt = require('bcryptjs');
    const valid = await bcrypt.compare(password, employer.password_hash);
    if (!valid) {
        throw new Error('Λάθος email ή κωδικός');
    }

    // Δημιουργία token
    const token = createToken({
        employerId: employer.id,
        email: employer.email,
        companyName: employer.company_name,
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

module.exports = { authMiddleware, loginEmployer, createToken, verifyToken };
