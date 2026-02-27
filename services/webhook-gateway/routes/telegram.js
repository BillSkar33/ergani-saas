/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — SaaS Platform
 * Webhook Route — Telegram
 * 
 * Δέχεται webhook updates από το Telegram Bot API.
 * Υποστηριζόμενα events:
 * - /start: Εγγραφή εργαζομένου
 * - Location message: Check-in/Check-out (GPS coordinates)
 * - Text commands: /status, /history, /help
 * 
 * Κάθε μήνυμα σπρώχνεται στο Kafka queue για ασύγχρονη επεξεργασία
 * ============================================================
 */

'use strict';

const { createSignatureVerifyHook } = require('../middleware/signature-verify');
const { createIdempotencyHook, markAsProcessed } = require('../middleware/idempotency');
const { sendMessage } = require('../../../shared/kafka');
const config = require('../../../shared/config');
const logger = require('../../../shared/logger');

/**
 * Εγγραφή Telegram routes στο Fastify
 * 
 * @param {Object} fastify - Fastify instance
 */
async function telegramRoutes(fastify) {
    /**
     * POST /webhooks/telegram
     * 
     * Δέχεται webhook updates από το Telegram.
     * Hooks (εκτελούνται πριν τον handler):
     * 1. Signature verification — επαλήθευση secret token
     * 2. Idempotency check — αποτροπή duplicate processing
     */
    fastify.post('/', {
        preHandler: [
            createSignatureVerifyHook('telegram'),
            createIdempotencyHook('telegram'),
        ],
    }, async (request, reply) => {
        const update = request.body;
        const updateId = update.update_id;

        logger.debug({ updateId }, 'Λήψη Telegram webhook update');

        try {
            // --- Ανάλυση τύπου μηνύματος ---
            let messageType = 'unknown';     // Τύπος μηνύματος
            let messageData = {};            // Δεδομένα μηνύματος
            let chatId = null;               // Chat ID (για απάντηση)

            // Εξαγωγή message object (κανονικό μήνυμα ή callback_query)
            const message = update.message || update.callback_query?.message;

            if (message) {
                chatId = message.chat?.id?.toString();
            }

            // --- Αναγνώριση τύπου μηνύματος ---

            if (update.message?.location) {
                // Μήνυμα τοποθεσίας — check-in ή check-out
                messageType = 'location';
                messageData = {
                    latitude: update.message.location.latitude,
                    longitude: update.message.location.longitude,
                    // Ακρίβεια GPS — αν διαθέσιμη (Telegram 6.0+)
                    horizontalAccuracy: update.message.location.horizontal_accuracy || null,
                };
                logger.info({ chatId, lat: messageData.latitude, lng: messageData.longitude },
                    'Λήψη τοποθεσίας Telegram');

            } else if (update.message?.text) {
                // Κειμενικό μήνυμα — εντολή ή linking code
                const text = update.message.text.trim();

                if (text === '/start') {
                    messageType = 'start';         // Έναρξη εγγραφής
                } else if (text === '/status' || text === 'ΚΑΤΑΣΤΑΣΗ') {
                    messageType = 'status';        // Ζήτηση κατάστασης
                } else if (text === '/history' || text === 'ΙΣΤΟΡΙΚΟ') {
                    messageType = 'history';       // Ζήτηση ιστορικού
                } else if (text === '/help' || text === 'ΒΟΗΘΕΙΑ') {
                    messageType = 'help';          // Βοήθεια
                } else if (/^\d{6}$/.test(text)) {
                    messageType = 'linking_code';  // 6ψήφιος κωδικός σύνδεσης
                    messageData = { code: text };
                } else {
                    messageType = 'text';          // Γενικό κείμενο
                    messageData = { text };
                }
            } else if (update.callback_query) {
                // Callback query — πάτημα inline button
                messageType = 'callback';
                messageData = {
                    callbackData: update.callback_query.data,
                    callbackId: update.callback_query.id,
                };
            }

            // --- Αποστολή στο Kafka queue ---
            // Κλειδί: chatId (εγγυάται ordering ανά χρήστη)
            const kafkaMessage = {
                platform: 'telegram',
                platformUserId: chatId,
                messageType,
                messageData,
                rawUpdate: update,
                receivedAt: new Date().toISOString(),
            };

            await sendMessage(
                config.kafka.topics.incomingMessages,
                chatId || 'unknown',
                kafkaMessage
            );

            // Σημείωση ως επεξεργασμένο (idempotency)
            if (request.messageId) {
                await markAsProcessed(request.messageId, 'telegram');
            }

            // --- Επιστροφή 200 OK αμέσως (< 250ms) ---
            return reply.code(200).send({ status: 'ok' });

        } catch (err) {
            logger.error({ err, updateId }, 'Σφάλμα επεξεργασίας Telegram webhook');
            // Ακόμα και σε σφάλμα, επιστρέφουμε 200 για να μη γίνει retry
            return reply.code(200).send({ status: 'error_logged' });
        }
    });
}

module.exports = telegramRoutes;
