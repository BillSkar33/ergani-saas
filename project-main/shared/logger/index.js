/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — SaaS Platform
 * Module Δομημένης Καταγραφής (Structured Logger)
 * 
 * Χρήση pino για JSON logging υψηλής απόδοσης.
 * Περιλαμβάνει GDPR-compliant log redaction:
 * αυτόματη αφαίρεση ευαίσθητων δεδομένων (ΑΦΜ, ονόματα, GPS)
 * από τα logs σε production.
 * ============================================================
 */

'use strict';

const pino = require('pino');
const config = require('../config');

// --- Λίστα πεδίων που πρέπει να αποκρύπτονται στα logs (GDPR) ---
// Σε production, αυτά τα πεδία αντικαθίστανται με '[REDACTED]'
const REDACTED_FIELDS = [
    'afm',              // ΑΦΜ εργαζομένου
    'f_afm',            // ΑΦΜ στο ΕΡΓΑΝΗ payload
    'f_afm_ergodoti',   // ΑΦΜ εργοδότη
    'eponymo',          // Επώνυμο
    'f_eponymo',        // Επώνυμο στο ΕΡΓΑΝΗ
    'onoma',            // Όνομα
    'f_onoma',          // Όνομα στο ΕΡΓΑΝΗ
    'latitude',         // GPS πλάτος
    'longitude',        // GPS μήκος
    'password',         // Κωδικοί
    'access_token',     // JWT tokens
];

/**
 * Δημιουργία paths αποκρύψεων pino
 * Μετατρέπει τη λίστα πεδίων σε μορφή κατάλληλη για pino redact
 * Π.χ. ['afm'] → ['afm', '*.afm', '*.*.afm'] για αναδρομική αποκρύψη
 */
const redactPaths = REDACTED_FIELDS.flatMap(field => [
    field,            // Top-level πεδίο
    `*.${field}`,     // Ένα επίπεδο βαθύτερα
    `*.*.${field}`,   // Δύο επίπεδα βαθύτερα
]);

/**
 * Δημιουργία και εξαγωγή του logger instance
 * 
 * Ρυθμίσεις:
 * - level: 'debug' σε development, 'info' σε production
 * - redact: GDPR-compliant αποκρύψη ευαίσθητων πεδίων
 * - transport: pino-pretty σε development για ευανάγνωστα logs
 * - timestamp: ISO 8601 format
 */
const logger = pino({
    // Ελάχιστο επίπεδο καταγραφής
    level: config.env === 'production' ? 'info' : 'debug',

    // GDPR: Αποκρύψη ευαίσθητων δεδομένων
    redact: {
        paths: redactPaths,
        censor: '[ΑΠΟΚΡΥΨΗ]',   // Κείμενο αντικατάστασης (Ελληνικά)
    },

    // ISO 8601 timestamps — σημαντικό για audit trail
    timestamp: pino.stdTimeFunctions.isoTime,

    // Pretty printing μόνο σε development
    ...(config.env !== 'production' && {
        transport: {
            target: 'pino-pretty',
            options: {
                colorize: true,           // Χρώματα στο terminal
                translateTime: 'HH:MM:ss.l',  // Μορφή ώρας
                ignore: 'pid,hostname',   // Απόκρυψη pid και hostname στο dev
            },
        },
    }),
});

module.exports = logger;
