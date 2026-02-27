/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — SaaS Platform
 * ΕΡΓΑΝΗ ΙΙ API — REST Client (Work Card Submission)
 * 
 * Υποβάλλει WRKCardSE (κάρτα εργασίας) στο ΕΡΓΑΝΗ ΙΙ API.
 * Περιλαμβάνει:
 * - Αυτόματο JWT token management
 * - Retry logic με exponential backoff
 * - Auto-refresh σε 401
 * - Dead Letter Queue σε max retries
 * - Πλήρη audit logging
 * 
 * Endpoint: POST /api/Documents/WRKCardSE
 * ============================================================
 */

'use strict';

const axios = require('axios');
const { getToken, invalidateToken } = require('./auth');
const { mapErganiError } = require('./error-mapper');
const config = require('../../shared/config');
const logger = require('../../shared/logger');
const db = require('../../shared/db');
const { sendMessage } = require('../../shared/kafka');

/**
 * Υποβολή κάρτας εργασίας στο ΕΡΓΑΝΗ ΙΙ API
 * 
 * Ροή:
 * 1. Λήψη valid JWT token (cache ή fresh auth)
 * 2. POST payload στο /Documents/WRKCardSE
 * 3. Αν 401 → invalidate token → retry 1 φορά
 * 4. Αν 5xx/timeout → retry με exponential backoff
 * 5. Αν εξαντληθούν τα retries → Dead Letter Queue
 * 6. Καταγραφή στο audit log σε κάθε προσπάθεια
 * 
 * @param {Object} branch - Αντικείμενο παραρτήματος (credentials, id)
 * @param {Object} payload - WRKCardSE payload (από buildWRKCardSEPayload)
 * @param {string} timeStampId - ID χρονοσήμανσης για ενημέρωση status
 * @param {number} [retryCount=0] - Τρέχουσα προσπάθεια (εσωτερικό)
 * 
 * @returns {Promise<Object>} - { success: boolean, response, error }
 */
async function submitWorkCard(branch, payload, timeStampId, retryCount = 0) {
    const url = `${config.ergani.apiUrl}/Documents/WRKCardSE`;
    const maxRetries = config.ergani.maxRetries;

    try {
        // --- Βήμα 1: Λήψη JWT token ---
        const token = await getToken(branch);

        // --- Βήμα 2: Αποστολή POST request ---
        logger.info({
            branchId: branch.id,
            attempt: retryCount + 1,
            maxRetries,
        }, 'Υποβολή κάρτας εργασίας στο ΕΡΓΑΝΗ...');

        const response = await axios.post(url, payload, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            timeout: 15000,   // 15 δευτ. timeout (το ΕΡΓΑΝΗ μπορεί να αργεί)
        });

        // --- Επιτυχία (200 OK) ---
        logger.info({
            branchId: branch.id,
            status: response.status,
        }, 'Κάρτα εργασίας υποβλήθηκε επιτυχώς στο ΕΡΓΑΝΗ');

        // Ενημέρωση status στη βάση → 'confirmed'
        await updateTimeStampStatus(timeStampId, 'confirmed', response.data);

        // Καταγραφή στο audit log
        await logAuditEntry('ergani_submission', 'time_stamp', timeStampId, payload, response.data, response.status);

        return { success: true, response: response.data };

    } catch (err) {
        const status = err.response?.status;
        const responseData = err.response?.data;

        // --- Χειρισμός 401 Unauthorized → Token expired ---
        if (status === 401 && retryCount === 0) {
            logger.warn({ branchId: branch.id }, 'JWT expired — invalidation και retry');

            // Ακύρωση cached token
            await invalidateToken(branch.id);

            // Retry μία φορά με νέο token
            return submitWorkCard(branch, payload, timeStampId, retryCount + 1);
        }

        // --- Χειρισμός 400 Bad Request → Δεδομένα λάθος ---
        if (status === 400) {
            logger.error({
                branchId: branch.id,
                responseData,
            }, 'ΕΡΓΑΝΗ 400 Bad Request — λανθασμένα δεδομένα');

            // Δεν κάνουμε retry σε 400 — τα δεδομένα είναι λάθος
            await updateTimeStampStatus(timeStampId, 'failed', responseData);
            await logAuditEntry('ergani_error', 'time_stamp', timeStampId, payload, responseData, status);

            return {
                success: false,
                error: mapErganiError(status, responseData),
                response: responseData,
            };
        }

        // --- Χειρισμός 5xx / Timeout → Retry με exponential backoff ---
        if (retryCount < maxRetries) {
            // Υπολογισμός delay: 1s, 2s, 4s, 8s... (max 30s)
            const delay = Math.min(
                config.ergani.retryBaseDelayMs * Math.pow(2, retryCount),
                config.ergani.retryMaxDelayMs
            );

            logger.warn({
                branchId: branch.id,
                status,
                retryCount: retryCount + 1,
                delayMs: delay,
            }, 'ΕΡΓΑΝΗ αποτυχία — retry σε εξέλιξη...');

            // Ενημέρωση retry count στη βάση
            await updateRetryCount(timeStampId, retryCount + 1);

            // Αναμονή πριν retry
            await sleep(delay);

            // Αναδρομική κλήση
            return submitWorkCard(branch, payload, timeStampId, retryCount + 1);
        }

        // --- Εξάντληση retries → Dead Letter Queue ---
        logger.error({
            branchId: branch.id,
            maxRetries,
            status,
        }, 'ΕΡΓΑΝΗ αποτυχία μετά από max retries — Dead Letter Queue');

        await updateTimeStampStatus(timeStampId, 'failed', responseData);
        await logAuditEntry('ergani_max_retries', 'time_stamp', timeStampId, payload, responseData, status);

        // Αποστολή στο DLQ για manual resolution
        await sendMessage(
            config.kafka.topics.deadLetterQueue,
            branch.id,
            {
                type: 'ergani_submission_failed',
                timeStampId,
                payload,
                lastError: err.message,
                retryCount,
                timestamp: new Date().toISOString(),
            }
        );

        return {
            success: false,
            error: mapErganiError(status, responseData),
            response: responseData,
        };
    }
}

/**
 * Ενημέρωση κατάστασης χρονοσήμανσης στη βάση
 * 
 * @param {string} timeStampId - ID χρονοσήμανσης
 * @param {string} status - Νέα κατάσταση (confirmed/failed/submitted)
 * @param {Object} erganiResponse - Απάντηση ΕΡΓΑΝΗ (αποθηκεύεται ως JSONB)
 */
async function updateTimeStampStatus(timeStampId, status, erganiResponse) {
    try {
        await db.query(
            `UPDATE time_stamps 
       SET ergani_status = $1, 
           ergani_response = $2, 
           ergani_submitted_at = NOW()
       WHERE id = $3`,
            [status, JSON.stringify(erganiResponse || {}), timeStampId]
        );
    } catch (err) {
        logger.error({ err, timeStampId }, 'Σφάλμα ενημέρωσης status χρονοσήμανσης');
    }
}

/**
 * Ενημέρωση μετρητή retries
 * 
 * @param {string} timeStampId - ID χρονοσήμανσης
 * @param {number} retryCount - Αριθμός retries
 */
async function updateRetryCount(timeStampId, retryCount) {
    try {
        await db.query(
            'UPDATE time_stamps SET retry_count = $1 WHERE id = $2',
            [retryCount, timeStampId]
        );
    } catch (err) {
        logger.error({ err, timeStampId }, 'Σφάλμα ενημέρωσης retry count');
    }
}

/**
 * Καταγραφή στο audit log
 * 
 * Αμετάβλητη εγγραφή στον πίνακα audit_log.
 * Νομική υποχρέωση: κράτηση 5 χρόνια.
 * 
 * @param {string} eventType - Τύπος event
 * @param {string} entityType - Τύπος οντότητας
 * @param {string} entityId - ID οντότητας
 * @param {Object} payload - Request payload
 * @param {Object} response - Response body
 * @param {number} httpStatus - HTTP status code
 */
async function logAuditEntry(eventType, entityType, entityId, payload, response, httpStatus) {
    try {
        await db.query(
            `INSERT INTO audit_log (event_type, entity_type, entity_id, payload, response, http_status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
            [eventType, entityType, entityId, JSON.stringify(payload), JSON.stringify(response || {}), httpStatus]
        );
    } catch (err) {
        logger.error({ err, eventType, entityId }, 'Σφάλμα εγγραφής audit log');
    }
}

/**
 * Βοηθητική: sleep function
 * @param {number} ms - Milliseconds αναμονής
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { submitWorkCard, logAuditEntry };
