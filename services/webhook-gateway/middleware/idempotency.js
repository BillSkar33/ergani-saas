/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — SaaS Platform
 * Middleware Idempotency — Αντι-Διπλότυπα Μηνυμάτων
 * 
 * Αποτρέπει την επεξεργασία του ίδιου webhook message δύο φορές.
 * Κρίσιμο ειδικά για WhatsApp που κάνει retries μέχρι 7 ημέρες
 * αν δεν λάβει 200 OK. Χωρίς αυτό → διπλό check-in → πρόστιμο!
 * 
 * Χρησιμοποιεί τον πίνακα processed_messages στη βάση δεδομένων
 * με upsert pattern (ON CONFLICT DO NOTHING) για thread-safety.
 * ============================================================
 */

'use strict';

const db = require('../../../shared/db');
const logger = require('../../../shared/logger');

/**
 * Έλεγχος αν ένα μήνυμα έχει ήδη επεξεργαστεί
 * 
 * Ελέγχει τον πίνακα processed_messages για το συγκεκριμένο
 * message_id. Αν βρεθεί, σημαίνει ότι τo μήνυμα ήδη
 * επεξεργάστηκε → skip.
 * 
 * @param {string} messageId - Μοναδικό ID μηνύματος (platform-specific)
 * @param {string} platform - Πλατφόρμα: 'viber', 'telegram', 'whatsapp'
 * @returns {Promise<boolean>} - true αν ήδη επεξεργάστηκε (=duplicate)
 */
async function isAlreadyProcessed(messageId, platform) {
    try {
        const result = await db.query(
            'SELECT 1 FROM processed_messages WHERE message_id = $1',
            [messageId]
        );
        return result.rowCount > 0;
    } catch (err) {
        // Σε σφάλμα DB, επιτρέπουμε την επεξεργασία (fail-open)
        // καλύτερα duplicate παρά χαμένο μήνυμα
        logger.error({ err, messageId }, 'Σφάλμα ελέγχου idempotency');
        return false;
    }
}

/**
 * Σημείωση μηνύματος ως επεξεργασμένο
 * 
 * Εισάγει εγγραφή στον πίνακα processed_messages.
 * Χρήση INSERT ... ON CONFLICT DO NOTHING για thread-safety:
 * αν δύο workers προσπαθήσουν ταυτόχρονα, μόνο ο ένας θα πετύχει.
 * 
 * @param {string} messageId - Μοναδικό ID μηνύματος
 * @param {string} platform - Πλατφόρμα προέλευσης
 * @returns {Promise<boolean>} - true αν η εγγραφή ήταν νέα (false αν ήδη υπήρχε)
 */
async function markAsProcessed(messageId, platform) {
    try {
        // ON CONFLICT DO NOTHING — αν ήδη υπάρχει, δεν κάνει τίποτα
        // Αυτό αποτρέπει race conditions μεταξύ concurrent workers
        const result = await db.query(
            `INSERT INTO processed_messages (message_id, platform, processed_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (message_id) DO NOTHING`,
            [messageId, platform]
        );

        // rowCount === 1 → νέα εγγραφή (πρώτη φορά)
        // rowCount === 0 → ήδη υπήρχε (duplicate)
        const isNew = result.rowCount === 1;

        if (!isNew) {
            logger.info({ messageId, platform }, 'Duplicate μήνυμα — παράβλεψη (idempotency)');
        }

        return isNew;
    } catch (err) {
        logger.error({ err, messageId }, 'Σφάλμα καταχώρησης idempotency');
        // Σε σφάλμα, επιτρέπουμε (fail-open)
        return true;
    }
}

/**
 * Εξαγωγή Message ID ανά πλατφόρμα
 * 
 * Κάθε πλατφόρμα χρησιμοποιεί διαφορετικό πεδίο/μορφή
 * για το unique message ID:
 * - Viber: message_token (string)
 * - Telegram: update_id (number)
 * - WhatsApp: messages[0].id (string, πιο βαθιά δομή)
 * 
 * @param {Object} payload - Webhook payload body
 * @param {string} platform - Πλατφόρμα: 'viber', 'telegram', 'whatsapp'
 * @returns {string|null} - Το message ID ή null αν δεν βρεθεί
 */
function extractMessageId(payload, platform) {
    switch (platform) {
        case 'viber':
            // Viber: message_token σε κάθε event
            return payload.message_token?.toString() || null;

        case 'telegram':
            // Telegram: update_id — μοναδικό ανά update
            return payload.update_id?.toString() || null;

        case 'whatsapp':
            // WhatsApp: messages[0].id — nested δομή
            return payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id || null;

        default:
            return null;
    }
}

/**
 * Fastify Hook — Middleware idempotency
 * 
 * Ενσωματώνεται ως preHandler hook σε κάθε webhook route.
 * Αν ένα μήνυμα ήδη επεξεργάστηκε, επιστρέφει 200 OK
 * χωρίς περαιτέρω επεξεργασία.
 * 
 * @param {string} platform - 'viber', 'telegram', ή 'whatsapp'
 * @returns {Function} - Fastify preHandler hook
 */
function createIdempotencyHook(platform) {
    return async function idempotencyHook(request, reply) {
        // Εξαγωγή message ID από το payload
        const messageId = extractMessageId(request.body, platform);

        // Αν δεν βρεθεί message ID, αφήνουμε να περάσει (ορισμένα events δεν έχουν)
        if (!messageId) {
            logger.debug({ platform }, 'Δεν βρέθηκε message ID — παράβλεψη idempotency check');
            return;
        }

        // Έλεγχος αν ήδη επεξεργάστηκε
        const isDuplicate = await isAlreadyProcessed(messageId, platform);

        if (isDuplicate) {
            logger.info({ messageId, platform }, 'Duplicate webhook — 200 OK χωρίς επεξεργασία');
            return reply.code(200).send({ status: 'already_processed' });
        }

        // Αποθήκευση του message ID στο request για μελλοντική χρήση
        request.messageId = messageId;
    };
}

module.exports = {
    isAlreadyProcessed,
    markAsProcessed,
    extractMessageId,
    createIdempotencyHook,
};
