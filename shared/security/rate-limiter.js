/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — Security Module
 * Rate Limiter (Per-endpoint)
 * 
 * Ευέλικτο rate limiting βασισμένο σε Redis.
 * Υποστηρίζει διαφορετικά όρια ανά endpoint κατηγορία:
 *   - Auth:   5 req/min   (αποτροπή brute-force)
 *   - API:    60 req/min  (κανονική χρήση)
 *   - Export: 5 req/min   (βαρύ query)
 * ============================================================
 */
'use strict';

const redis = require('../redis');
const logger = require('../logger');

/**
 * Presets rate limit ανά κατηγορία
 */
const RATE_LIMIT_PRESETS = {
    auth: { max: 5, windowSec: 60, message: 'Πάρα πολλές προσπάθειες σύνδεσης. Δοκιμάστε σε 1 λεπτό.' },
    api: { max: 60, windowSec: 60, message: 'Πάρα πολλά requests. Δοκιμάστε σε λίγο.' },
    export: { max: 5, windowSec: 60, message: 'Πάρα πολλά exports. Δοκιμάστε σε 1 λεπτό.' },
    webhook: { max: 200, windowSec: 60, message: 'Rate limit exceeded' },
};

/**
 * Δημιουργία rate limiter Fastify preHandler
 * 
 * @param {string} preset - Κατηγορία: 'auth', 'api', 'export', 'webhook'
 * @returns {Function} - Fastify preHandler hook
 * 
 * @example
 *   fastify.post('/login', { preHandler: rateLimiter('auth') }, handler)
 */
function rateLimiter(preset = 'api') {
    const config = RATE_LIMIT_PRESETS[preset] || RATE_LIMIT_PRESETS.api;

    return async function limitHandler(request, reply) {
        // Αναγνώριση client: IP + route (ή employer ID αν authenticated)
        const identifier = request.employer?.id || request.ip;
        const key = `ratelimit:${preset}:${identifier}`;

        try {
            // Αύξηση counter στο Redis
            const current = await redis.incr(key);

            // Αν πρώτο request → set TTL
            if (current === 1) {
                await redis.expire(key, config.windowSec);
            }

            // Headers ενημέρωσης
            const remaining = Math.max(0, config.max - current);
            const ttl = await redis.ttl(key);

            reply.header('X-RateLimit-Limit', config.max);
            reply.header('X-RateLimit-Remaining', remaining);
            reply.header('X-RateLimit-Reset', Math.floor(Date.now() / 1000) + ttl);

            // Υπέρβαση ορίου
            if (current > config.max) {
                logger.warn({ ip: request.ip, preset, current }, 'Rate limit exceeded');
                reply.header('Retry-After', ttl);
                return reply.code(429).send({ error: config.message });
            }
        } catch (err) {
            // Redis down → allow request (fail-open)
            logger.error({ err }, 'Rate limiter Redis error — fail-open');
        }
    };
}

module.exports = { rateLimiter, RATE_LIMIT_PRESETS };
