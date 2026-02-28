/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — SaaS Platform
 * Webhook Gateway — Κεντρικός HTTP Server
 * 
 * Fastify server που δέχεται webhook requests από τις
 * messenger πλατφόρμες (Viber, Telegram, WhatsApp),
 * τα επαληθεύει (signature verification), ελέγχει
 * για duplicates (idempotency), και τα σπρώχνει
 * στο Kafka queue για ασύγχρονη επεξεργασία.
 * 
 * 🔒 Security: CORS, Helmet, Rate Limiting, CSP
 * Στόχος: Απάντηση σε < 250ms στο webhook callback
 * ============================================================
 */

'use strict';

const fastify = require('fastify');
const config = require('../../shared/config');
const logger = require('../../shared/logger');
const { connectProducer } = require('../../shared/kafka');

// Εισαγωγή routes για κάθε πλατφόρμα
const viberRoutes = require('./routes/viber');
const telegramRoutes = require('./routes/telegram');
const whatsappRoutes = require('./routes/whatsapp');

/**
 * Δημιουργία και ρύθμιση Fastify server
 */
const app = fastify({
    logger: logger,
    trustProxy: true,
    bodyLimit: 1048576,                      // 1MB max body size
    requestTimeout: 10000,                   // 10 δευτ. timeout
});

// ============================================================
// 🔒 SECURITY: CORS — Επιτρεπόμενα origins
// Αποτρέπει cross-origin requests από μη εξουσιοδοτημένα domains
// ============================================================
app.register(require('@fastify/cors'), {
    // Σε development επιτρέπει localhost, σε production μόνο τα domains σας
    origin: config.env === 'production'
        ? (process.env.CORS_ALLOWED_ORIGINS || 'https://yourdomain.gr').split(',')
        : true,  // true = all origins στο development
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,                       // Επιτρέπει cookies/auth headers
    maxAge: 86400,                           // Preflight cache 24h
});

// ============================================================
// 🔒 SECURITY: Helmet — HTTP Security Headers
// Αποτρέπει clickjacking, XSS, MIME sniffing, κλπ.
// ============================================================
app.register(require('@fastify/helmet'), {
    // Content Security Policy — ελέγχει τι scripts/styles εκτελούνται
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:"],
            connectSrc: ["'self'"],
            frameSrc: ["'none'"],           // Αποτροπή embedding σε iframes
            objectSrc: ["'none'"],          // Αποτροπή plugins (Flash κλπ)
        },
    },
    // X-Frame-Options: DENY — αποτρέπει clickjacking
    frameguard: { action: 'deny' },
    // X-Content-Type-Options: nosniff
    noSniff: true,
    // X-XSS-Protection: 1; mode=block
    xssFilter: true,
    // Referrer-Policy: strict-origin-when-cross-origin
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // Strict-Transport-Security: 1 χρόνος
    hsts: {
        maxAge: 31536000,                    // 1 χρόνο
        includeSubDomains: true,
        preload: true,
    },
});

// ============================================================
// 🔒 SECURITY: Global Error Handler — Αποτροπή info leakage
// Στο production δεν αποκαλύπτουμε stack traces
// ============================================================
app.setErrorHandler(async (error, request, reply) => {
    logger.error({ err: error, url: request.url, method: request.method }, 'Unhandled error');

    // Σε production → generic error message
    if (config.env === 'production') {
        return reply.code(error.statusCode || 500).send({
            error: 'Εσωτερικό σφάλμα. Δοκιμάστε ξανά.',
        });
    }
    // Σε development → full error
    return reply.code(error.statusCode || 500).send({
        error: error.message,
        stack: error.stack,
    });
});

// --- Health Check Endpoint ---
app.get('/health', async () => ({
    status: 'ok',
    service: 'webhook-gateway',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
}));

// --- Readiness Check ---
app.get('/ready', async () => ({
    status: 'ready',
    service: 'webhook-gateway',
    timestamp: new Date().toISOString(),
}));

// --- Εγγραφή Webhook Routes ---
app.register(viberRoutes, { prefix: '/webhooks/viber' });
app.register(telegramRoutes, { prefix: '/webhooks/telegram' });
app.register(whatsappRoutes, { prefix: '/webhooks/whatsapp' });

// --- Admin API Routes ---
const adminApiPlugin = require('../admin-api');
app.register(adminApiPlugin, { prefix: '/api/admin' });

// --- Static Files — Admin Dashboard ---
const path = require('path');
const fastifyStatic = require('@fastify/static');
app.register(fastifyStatic, {
    root: path.join(__dirname, '../../dashboard'),
    prefix: '/admin/',
});

/**
 * Εκκίνηση του Webhook Gateway server
 */
async function start() {
    try {
        logger.info('Σύνδεση Kafka Producer...');
        await connectProducer();
        await app.listen({ port: config.port, host: '0.0.0.0' });
        logger.info({ port: config.port }, '🚀 Webhook Gateway ξεκίνησε (🔒 CORS + Helmet ενεργά)');
    } catch (err) {
        logger.error({ err }, 'Αποτυχία εκκίνησης Webhook Gateway');
        process.exit(1);
    }
}

// --- Graceful Shutdown ---
async function gracefulShutdown(signal) {
    logger.info({ signal }, 'Λήψη σήματος τερματισμού — graceful shutdown');
    try {
        await app.close();
        const { disconnect } = require('../../shared/kafka');
        await disconnect();
        logger.info('Webhook Gateway τερματίστηκε κανονικά');
        process.exit(0);
    } catch (err) {
        logger.error({ err }, 'Σφάλμα κατά το graceful shutdown');
        process.exit(1);
    }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

if (require.main === module) {
    start();
}

module.exports = { app, start };
