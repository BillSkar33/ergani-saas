/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — SaaS Platform
 * Webhook Route — Viber
 * 
 * Δέχεται webhook events από το Viber Bot API.
 * Υποστηριζόμενα events:
 * - conversation_started: Πρώτη επαφή χρήστη με το bot
 * - message (location): Check-in / Check-out
 * - message (text): Εντολές και linking code
 * - subscribed / unsubscribed: Εγγραφή/απεγγραφή
 * 
 * ΣΗΜΑΝΤΙΚΟ: Viber Bots θέλουν commercial agreement (5/2/2024+)
 * ============================================================
 */

'use strict';

const { createSignatureVerifyHook } = require('../middleware/signature-verify');
const { createIdempotencyHook, markAsProcessed } = require('../middleware/idempotency');
const { sendMessage } = require('../../../shared/kafka');
const config = require('../../../shared/config');
const logger = require('../../../shared/logger');

/**
 * Εγγραφή Viber routes στο Fastify
 * 
 * @param {Object} fastify - Fastify instance
 */
async function viberRoutes(fastify) {
    /**
     * POST /webhooks/viber
     * 
     * Δέχεται webhook events από το Viber Bot API.
     * Hooks:
     * 1. Signature verification — HMAC-SHA256 με Auth Token
     * 2. Idempotency check — αποτροπή duplicate processing
     */
    fastify.post('/', {
        preHandler: [
            createSignatureVerifyHook('viber'),
            createIdempotencyHook('viber'),
        ],
    }, async (request, reply) => {
        const event = request.body;
        const eventType = event.event;

        logger.debug({ eventType }, 'Λήψη Viber webhook event');

        try {
            let messageType = 'unknown';
            let messageData = {};
            const userId = event.sender?.id || event.user?.id || null;

            // --- Αναγνώριση τύπου event ---

            switch (eventType) {
                case 'conversation_started':
                    // Ο χρήστης ανοίγει για πρώτη φορά τη συνομιλία
                    // Αντίστοιχο του /start στο Telegram
                    messageType = 'start';
                    logger.info({ userId }, 'Νέα συνομιλία Viber — conversation_started');
                    break;

                case 'message':
                    // Μήνυμα από τον χρήστη
                    if (event.message?.type === 'location') {
                        // Τοποθεσία — check-in ή check-out
                        messageType = 'location';
                        messageData = {
                            latitude: event.message.location.lat,
                            longitude: event.message.location.lon,
                            // Το Viber δεν παρέχει horizontal_accuracy στο location
                            horizontalAccuracy: null,
                        };
                        logger.info({ userId }, 'Λήψη τοποθεσίας Viber');

                    } else if (event.message?.type === 'text') {
                        // Κειμενικό μήνυμα
                        const text = event.message.text.trim();

                        if (text === 'ΕΓΓΡΑΦΗ' || text === '/start') {
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
                    }
                    break;

                case 'subscribed':
                    // Ο χρήστης εγγράφηκε στο bot
                    messageType = 'subscribed';
                    logger.info({ userId }, 'Εγγραφή χρήστη Viber');
                    break;

                case 'unsubscribed':
                    // Ο χρήστης απεγγράφηκε
                    messageType = 'unsubscribed';
                    logger.info({ userId }, 'Απεγγραφή χρήστη Viber');
                    break;

                case 'webhook':
                    // Viber webhook verification callback — απαντάμε άμεσα
                    logger.info('Viber webhook verification — OK');
                    return reply.code(200).send({ status: 'ok' });

                default:
                    logger.debug({ eventType }, 'Αγνοούμενο Viber event');
            }

            // --- Αποστολή στο Kafka ---
            if (userId && messageType !== 'unknown') {
                const kafkaMessage = {
                    platform: 'viber',
                    platformUserId: userId,
                    messageType,
                    messageData,
                    rawEvent: event,
                    receivedAt: new Date().toISOString(),
                };

                await sendMessage(
                    config.kafka.topics.incomingMessages,
                    userId,
                    kafkaMessage
                );

                // Σημείωση idempotency
                if (request.messageId) {
                    await markAsProcessed(request.messageId, 'viber');
                }
            }

            return reply.code(200).send({ status: 'ok' });

        } catch (err) {
            logger.error({ err, eventType }, 'Σφάλμα επεξεργασίας Viber webhook');
            return reply.code(200).send({ status: 'error_logged' });
        }
    });
}

module.exports = viberRoutes;
