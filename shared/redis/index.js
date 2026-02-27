/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — SaaS Platform
 * Module Σύνδεσης Redis (Cache, Sessions, JWT Cache)
 * 
 * Χρησιμοποιεί ioredis για σύνδεση στον Redis server.
 * Χρήσεις στο σύστημα:
 * - JWT token cache (ΕΡΓΑΝΗ)
 * - Rate limiting counters
 * - Conversation state machine (chatbot)
 * - Session storage
 * ============================================================
 */

'use strict';

const Redis = require('ioredis');
const config = require('../config');
const logger = require('../logger');

/**
 * Δημιουργία Redis client
 * 
 * Ρυθμίσεις:
 * - maxRetriesPerRequest: null — απεριόριστα retries (απαίτηση ioredis v5+)
 * - retryStrategy: Επανασύνδεση με εκθετική καθυστέρηση (max 3 δευτ.)
 * - lazyConnect: false — άμεση σύνδεση κατά τη δημιουργία
 */
const redis = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    maxRetriesPerRequest: null,     // Σημαντικό για Kafka consumers
    retryStrategy(times) {
        // Εκθετική καθυστέρηση: 50ms, 100ms, 200ms... max 3000ms
        const delay = Math.min(times * 50, 3000);
        logger.warn({ attempt: times, delay }, 'Επανασύνδεση Redis σε εξέλιξη...');
        return delay;
    },
});

// --- Event Handlers ---

// Επιτυχής σύνδεση
redis.on('connect', () => {
    logger.info('Σύνδεση στον Redis server επιτυχής');
});

// Σφάλμα σύνδεσης
redis.on('error', (err) => {
    logger.error({ err }, 'Σφάλμα σύνδεσης Redis');
});

// Αποσύνδεση
redis.on('close', () => {
    logger.warn('Αποσύνδεση από Redis server');
});

module.exports = redis;
