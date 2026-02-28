/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — Security Module
 * Audit Trail Logger (Enhanced)
 * 
 * Καταγράφει ΟΛΕΣ τις admin ενέργειες στο audit_log:
 * - Ποιος (employer_id)
 * - Τι (action)
 * - Πότε (timestamp)
 * - Από πού (IP)
 * - Payload (sanitized)
 * ============================================================
 */
'use strict';

const db = require('../db');
const logger = require('../logger');
const { sanitizeObject } = require('./sanitize');

/**
 * Καταγραφή admin ενέργειας στο audit log
 * 
 * @param {Object} params
 * @param {string} params.eventType - Τύπος: 'auth', 'employee_create', 'settings_update' κλπ
 * @param {string} params.entityType - Οντότητα: 'employer', 'employee', 'branch' κλπ
 * @param {string} [params.entityId] - UUID οντότητας
 * @param {Object} params.payload - Δεδομένα (sanitized ← αφαίρεση passwords/tokens)
 * @param {Object} [params.response] - Αποτέλεσμα ενέργειας
 * @param {number} [params.httpStatus] - HTTP status code
 * @param {string} [params.ipAddress] - IP αποστολέα
 */
async function logAuditEvent({
    eventType,
    entityType,
    entityId = null,
    payload = {},
    response = null,
    httpStatus = null,
    ipAddress = null,
}) {
    try {
        // Αφαίρεση ευαίσθητων πεδίων πριν αποθήκευση
        const safePayload = redactSensitive(sanitizeObject(payload));

        await db.query(
            `INSERT INTO audit_log (event_type, entity_type, entity_id, payload, response, http_status, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [eventType, entityType, entityId, safePayload, response, httpStatus, ipAddress]
        );
    } catch (err) {
        // Logging failure ΔΕΝ πρέπει να σπάσει τη ροή
        logger.error({ err, eventType, entityType }, 'Audit log write failure');
    }
}

/**
 * Αφαίρεση ευαίσθητων πεδίων (passwords, tokens, secrets)
 */
function redactSensitive(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const redacted = { ...obj };
    const sensitiveKeys = ['password', 'password_hash', 'token', 'secret', 'accessToken', 'authToken', 'encryptionKey'];

    for (const key of Object.keys(redacted)) {
        if (sensitiveKeys.some(s => key.toLowerCase().includes(s.toLowerCase()))) {
            redacted[key] = '[REDACTED]';
        }
    }
    return redacted;
}

/**
 * Fastify hook — αυτόματη καταγραφή admin API calls
 * Εγγράφεται ως onResponse hook
 */
function auditHook(eventTypePrefix = 'admin') {
    return async function (request, reply) {
        // Μόνο mutating operations (POST, PUT, DELETE)
        if (!['POST', 'PUT', 'DELETE'].includes(request.method)) return;

        const eventType = `${eventTypePrefix}_${request.method.toLowerCase()}`;
        const entityType = extractEntityType(request.url);

        await logAuditEvent({
            eventType,
            entityType,
            entityId: request.params?.id || null,
            payload: request.body || {},
            httpStatus: reply.statusCode,
            ipAddress: request.ip,
        });
    };
}

/**
 * Εξαγωγή entity type από URL path
 * /api/admin/employees/123 → 'employee'
 */
function extractEntityType(url) {
    const parts = url.split('/').filter(Boolean);
    const entityMap = {
        'employees': 'employee',
        'branches': 'branch',
        'timestamps': 'timestamp',
        'fraud-alerts': 'fraud_alert',
        'settings': 'settings',
        'auth': 'auth',
    };

    for (const part of parts) {
        if (entityMap[part]) return entityMap[part];
    }
    return 'unknown';
}

module.exports = { logAuditEvent, auditHook, redactSensitive };
