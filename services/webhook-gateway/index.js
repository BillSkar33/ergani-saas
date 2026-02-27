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
 * 
 * Ρυθμίσεις:
 * - logger: Χρήση του κοινού pino logger
 * - trustProxy: true — απαραίτητο πίσω από load balancer / nginx
 * - bodyLimit: 1MB — αρκετό για webhook payloads
 * - requestTimeout: 10 δευτ. — αποτρέπει hanging requests
 */
const app = fastify({
    logger: logger,                         // Κοινός structured logger
    trustProxy: true,                        // Πίσω από reverse proxy
    bodyLimit: 1048576,                      // 1MB max body size
    requestTimeout: 10000,                   // 10 δευτ. timeout
});

// --- Health Check Endpoint ---
// Χρησιμοποιείται από Kubernetes liveness/readiness probes
// και για manual verification ότι ο server τρέχει
app.get('/health', async (request, reply) => {
    return {
        status: 'ok',
        service: 'webhook-gateway',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    };
});

// --- Readiness Check ---
// Ελέγχει αν όλα τα dependencies (Kafka, DB) είναι έτοιμα
app.get('/ready', async (request, reply) => {
    // TODO: Έλεγχος σύνδεσης Kafka, Redis, PostgreSQL
    return {
        status: 'ready',
        service: 'webhook-gateway',
        timestamp: new Date().toISOString(),
    };
});

// --- Εγγραφή Webhook Routes ---
// Κάθε πλατφόρμα έχει το δικό της endpoint
app.register(viberRoutes, { prefix: '/webhooks/viber' });
app.register(telegramRoutes, { prefix: '/webhooks/telegram' });
app.register(whatsappRoutes, { prefix: '/webhooks/whatsapp' });

// --- Admin API Routes ---
// REST API για το Admin Dashboard (prefix: /api/admin)
const adminApiPlugin = require('../admin-api');
app.register(adminApiPlugin, { prefix: '/api/admin' });

// --- Static Files — Admin Dashboard ---
// Σερβίρει τα αρχεία του dashboard (HTML/CSS/JS)
const path = require('path');
const fastifyStatic = require('@fastify/static');
app.register(fastifyStatic, {
    root: path.join(__dirname, '../../dashboard'),
    prefix: '/admin/',
});

/**
 * Εκκίνηση του Webhook Gateway server
 * 
 * Ροή εκκίνησης:
 * 1. Σύνδεση Kafka Producer (για αποστολή μηνυμάτων στο queue)
 * 2. Εκκίνηση Fastify HTTP server
 * 3. Graceful shutdown σε SIGTERM/SIGINT
 */
async function start() {
    try {
        // Βήμα 1: Σύνδεση στο Kafka cluster — πρέπει πριν ξεκινήσουν τα routes
        logger.info('Σύνδεση Kafka Producer...');
        await connectProducer();

        // Βήμα 2: Εκκίνηση HTTP server
        await app.listen({ port: config.port, host: '0.0.0.0' });
        logger.info({ port: config.port }, '🚀 Webhook Gateway ξεκίνησε');
    } catch (err) {
        logger.error({ err }, 'Αποτυχία εκκίνησης Webhook Gateway');
        process.exit(1);
    }
}

// --- Graceful Shutdown ---
// Ολοκληρώνει τα τρέχοντα requests πριν τερματίσει
async function gracefulShutdown(signal) {
    logger.info({ signal }, 'Λήψη σήματος τερματισμού — graceful shutdown');

    try {
        // Κλείσιμο HTTP server (σταματάει νέα requests)
        await app.close();
        // Αποσύνδεση από Kafka
        const { disconnect } = require('../../shared/kafka');
        await disconnect();
        logger.info('Webhook Gateway τερματίστηκε κανονικά');
        process.exit(0);
    } catch (err) {
        logger.error({ err }, 'Σφάλμα κατά το graceful shutdown');
        process.exit(1);
    }
}

// Εγγραφή signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Αυτόματη εκκίνηση αν τρέχει ως standalone script
if (require.main === module) {
    start();
}

module.exports = { app, start };
