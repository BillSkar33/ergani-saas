/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — SaaS Platform
 * Webhook Route — WhatsApp Cloud API
 * 
 * Δέχεται webhook updates από τo WhatsApp Cloud API (Meta).
 * Υποστηριζόμενα events:
 * - messages (location): Check-in / Check-out
 * - messages (text): Εντολές και linking code
 * - messages (interactive): Απαντήσεις σε interactive messages
 * 
 * ΣΗΜΑΝΤΙΚΟ: 
 * - Εκτός 24ωρου → μόνο Template Messages (χρεώνονται)
 * - WhatsApp κάνει retries μέχρι 7 ημέρες — idempotency κρίσιμο!
 * ============================================================
 */

'use strict';

const { createSignatureVerifyHook } = require('../middleware/signature-verify');
const { createIdempotencyHook, markAsProcessed } = require('../middleware/idempotency');
const { sendMessage } = require('../../../shared/kafka');
const config = require('../../../shared/config');
const logger = require('../../../shared/logger');

/**
 * Εγγραφή WhatsApp routes στο Fastify
 * 
 * @param {Object} fastify - Fastify instance
 */
async function whatsappRoutes(fastify) {
    /**
     * GET /webhooks/whatsapp
     * 
     * WhatsApp Webhook Verification (Subscribe Challenge)
     * Το Meta χτυπά αυτό το endpoint κατά τη ρύθμιση του webhook
     * για να επαληθεύσει ότι ο server ανήκει σε εμάς.
     * 
     * Απαιτείται: hub.mode = 'subscribe', hub.verify_token = our token
     * Επιστρέφει: hub.challenge (ως plain text)
     */
    fastify.get('/', async (request, reply) => {
        const mode = request.query['hub.mode'];
        const token = request.query['hub.verify_token'];
        const challenge = request.query['hub.challenge'];

        // Έλεγχος mode και verify token
        if (mode === 'subscribe' && token === config.webhooks.whatsapp.appSecret) {
            logger.info('WhatsApp webhook verification — OK');
            return reply.code(200).send(challenge);
        }

        logger.warn('WhatsApp webhook verification — ΑΠΟΤΥΧΙΑ');
        return reply.code(403).send({ error: 'Μη έγκυρο verify token' });
    });

    /**
     * POST /webhooks/whatsapp
     * 
     * Δέχεται webhook notifications από WhatsApp Cloud API.
     * Hooks:
     * 1. Signature verification — SHA256 HMAC με App Secret
     * 2. Idempotency check — κρίσιμο! WhatsApp κάνει retries μέχρι 7 μέρες
     */
    fastify.post('/', {
        preHandler: [
            createSignatureVerifyHook('whatsapp'),
            createIdempotencyHook('whatsapp'),
        ],
    }, async (request, reply) => {
        const body = request.body;

        logger.debug('Λήψη WhatsApp webhook notification');

        try {
            // --- Εξαγωγή μηνύματος ---
            // Η δομή του WhatsApp webhook είναι βαθιά nested:
            // body.entry[0].changes[0].value.messages[0]
            const entry = body.entry?.[0];
            const changes = entry?.changes?.[0];
            const value = changes?.value;

            // Έλεγχος αν πρόκειται για μήνυμα (και όχι status update)
            if (!value?.messages || value.messages.length === 0) {
                // Status updates (delivered, read, etc.) — δεν χρειάζεται επεξεργασία
                logger.debug('WhatsApp status update — παράβλεψη');
                return reply.code(200).send({ status: 'ok' });
            }

            const message = value.messages[0];
            const userId = message.from;       // Αριθμός τηλεφώνου αποστολέα
            const messageId = message.id;      // Μοναδικό ID μηνύματος

            let messageType = 'unknown';
            let messageData = {};

            // --- Αναγνώριση τύπου μηνύματος ---

            switch (message.type) {
                case 'location':
                    // Μήνυμα τοποθεσίας — check-in / check-out
                    messageType = 'location';
                    messageData = {
                        latitude: message.location.latitude,
                        longitude: message.location.longitude,
                        // WhatsApp δεν παρέχει accuracy
                        horizontalAccuracy: null,
                    };
                    logger.info({ userId }, 'Λήψη τοποθεσίας WhatsApp');
                    break;

                case 'text':
                    // Κειμενικό μήνυμα
                    const text = message.text.body.trim();

                    if (text === '/start' || text === 'ΕΓΓΡΑΦΗ') {
                        messageType = 'start';
                    } else if (text === 'ΚΑΤΑΣΤΑΣΗ' || text === '/status') {
                        messageType = 'status';
                    } else if (text === 'ΙΣΤΟΡΙΚΟ' || text === '/history') {
                        messageType = 'history';
                    } else if (text === 'ΒΟΗΘΕΙΑ' || text === '/help') {
                        messageType = 'help';
                    } else if (/^\d{6}$/.test(text)) {
                        messageType = 'linking_code';
                        messageData = { code: text };
                    } else {
                        messageType = 'text';
                        messageData = { text };
                    }
                    break;

                case 'interactive':
                    // Απάντηση σε interactive message (buttons, lists)
                    messageType = 'interactive';
                    messageData = {
                        interactiveType: message.interactive?.type,
                        buttonReply: message.interactive?.button_reply,
                        listReply: message.interactive?.list_reply,
                    };
                    break;

                default:
                    logger.debug({ type: message.type }, 'Μη υποστηριζόμενος τύπος WhatsApp μηνύματος');
            }

            // --- Αποστολή στο Kafka ---
            const kafkaMessage = {
                platform: 'whatsapp',
                platformUserId: userId,
                messageType,
                messageData,
                rawMessage: message,
                receivedAt: new Date().toISOString(),
            };

            await sendMessage(
                config.kafka.topics.incomingMessages,
                userId,
                kafkaMessage
            );

            // Σημείωση idempotency
            if (request.messageId) {
                await markAsProcessed(request.messageId, 'whatsapp');
            }

            return reply.code(200).send({ status: 'ok' });

        } catch (err) {
            logger.error({ err }, 'Σφάλμα επεξεργασίας WhatsApp webhook');
            return reply.code(200).send({ status: 'error_logged' });
        }
    });
}

module.exports = whatsappRoutes;
