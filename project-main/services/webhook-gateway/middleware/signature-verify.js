/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — SaaS Platform
 * Middleware Επαλήθευσης Υπογραφής Webhook (Signature Verify)
 * 
 * Κάθε messenger πλατφόρμα στέλνει cryptographic signature
 * μαζί με κάθε webhook request. Αυτό το middleware επαληθεύει
 * ότι το request προέρχεται πραγματικά από τη σωστή πλατφόρμα
 * και δεν έχει αλλοιωθεί (MITM protection).
 * 
 * Μηχανισμοί ανά πλατφόρμα:
 * - Viber: HMAC-SHA256 με Auth Token
 * - Telegram: X-Telegram-Bot-Api-Secret-Token header
 * - WhatsApp: SHA256 HMAC με App Secret
 * ============================================================
 */

'use strict';

const crypto = require('crypto');
const config = require('../../../shared/config');
const logger = require('../../../shared/logger');

/**
 * Επαλήθευση Viber webhook signature
 * 
 * Το Viber υπογράφει κάθε webhook payload με HMAC-SHA256
 * χρησιμοποιώντας το Auth Token ως κλειδί.
 * 
 * Η υπογραφή βρίσκεται στο header: X-Viber-Content-Signature
 * 
 * @param {string} rawBody - Το raw body του request (string)
 * @param {string} signature - Η υπογραφή από το header
 * @returns {boolean} - true αν η υπογραφή είναι έγκυρη
 */
function verifyViberSignature(rawBody, signature) {
    // Δημιουργία HMAC-SHA256 hash με Auth Token ως κλειδί
    const expectedSignature = crypto
        .createHmac('sha256', config.webhooks.viber.authToken)
        .update(rawBody)
        .digest('hex');

    // Χρήση timingSafeEqual για αποφυγή timing attacks
    // Μετατροπή σε Buffer γιατί η timingSafeEqual απαιτεί Buffers ίδιου μήκους
    try {
        return crypto.timingSafeEqual(
            Buffer.from(signature, 'hex'),
            Buffer.from(expectedSignature, 'hex')
        );
    } catch {
        // Αν τα buffers έχουν διαφορετικό μέγεθος → σίγουρα λάθος υπογραφή
        return false;
    }
}

/**
 * Επαλήθευση Telegram webhook secret token
 * 
 * Το Telegram χρησιμοποιεί ένα secret_token που ορίζεται
 * κατά τη ρύθμιση του webhook. Στέλνεται ως header:
 * X-Telegram-Bot-Api-Secret-Token
 * 
 * @param {string} receivedToken - Το token από το header
 * @returns {boolean} - true αν ταιριάζει
 */
function verifyTelegramSecret(receivedToken) {
    const expectedToken = config.webhooks.telegram.secretToken;

    // Αν δεν έχει οριστεί secret token, απορρίπτουμε πάντα
    if (!expectedToken) {
        logger.error('Δεν έχει οριστεί TELEGRAM_SECRET_TOKEN');
        return false;
    }

    // Χρήση timingSafeEqual
    try {
        return crypto.timingSafeEqual(
            Buffer.from(receivedToken),
            Buffer.from(expectedToken)
        );
    } catch {
        return false;
    }
}

/**
 * Επαλήθευση WhatsApp webhook signature
 * 
 * Το WhatsApp Cloud API υπογράφει κάθε webhook payload
 * με SHA256 HMAC χρησιμοποιώντας το App Secret.
 * 
 * Header: X-Hub-Signature-256 (format: "sha256=<hex>")
 * 
 * @param {string} rawBody - Το raw body του request
 * @param {string} signatureHeader - Η τιμή X-Hub-Signature-256
 * @returns {boolean} - true αν η υπογραφή είναι έγκυρη
 */
function verifyWhatsAppSignature(rawBody, signatureHeader) {
    // Αφαίρεση prefix "sha256=" — το header έχει format "sha256=abc123..."
    const signature = signatureHeader.replace('sha256=', '');

    // Δημιουργία αναμενόμενου HMAC
    const expectedSignature = crypto
        .createHmac('sha256', config.webhooks.whatsapp.appSecret)
        .update(rawBody)
        .digest('hex');

    // Σύγκριση secure
    try {
        return crypto.timingSafeEqual(
            Buffer.from(signature, 'hex'),
            Buffer.from(expectedSignature, 'hex')
        );
    } catch {
        return false;
    }
}

/**
 * Fastify Hook — Middleware επαλήθευσης υπογραφής
 * 
 * Εφαρμόζεται σε κάθε webhook route. Ανάλογα με την πλατφόρμα,
 * καλεί τη σωστή verify function.
 * 
 * @param {string} platform - 'viber', 'telegram', ή 'whatsapp'
 * @returns {Function} - Fastify preHandler hook
 */
function createSignatureVerifyHook(platform) {
    return async function signatureVerifyHook(request, reply) {
        let isValid = false;

        switch (platform) {
            case 'viber': {
                // Viber: Υπογραφή στο header X-Viber-Content-Signature
                const signature = request.headers['x-viber-content-signature'];
                if (!signature) {
                    logger.warn('Viber webhook χωρίς υπογραφή — απόρριψη');
                    return reply.code(403).send({ error: 'Λείπει η υπογραφή Viber' });
                }
                const rawBody = JSON.stringify(request.body);
                isValid = verifyViberSignature(rawBody, signature);
                break;
            }

            case 'telegram': {
                // Telegram: Secret token στο header X-Telegram-Bot-Api-Secret-Token
                const token = request.headers['x-telegram-bot-api-secret-token'];
                if (!token) {
                    logger.warn('Telegram webhook χωρίς secret token — απόρριψη');
                    return reply.code(403).send({ error: 'Λείπει το Telegram secret token' });
                }
                isValid = verifyTelegramSecret(token);
                break;
            }

            case 'whatsapp': {
                // WhatsApp: Υπογραφή στο header X-Hub-Signature-256
                const signature = request.headers['x-hub-signature-256'];
                if (!signature) {
                    logger.warn('WhatsApp webhook χωρίς υπογραφή — απόρριψη');
                    return reply.code(403).send({ error: 'Λείπει η υπογραφή WhatsApp' });
                }
                const rawBody = JSON.stringify(request.body);
                isValid = verifyWhatsAppSignature(rawBody, signature);
                break;
            }

            default:
                logger.error({ platform }, 'Άγνωστη πλατφόρμα webhook');
                return reply.code(400).send({ error: 'Άγνωστη πλατφόρμα' });
        }

        // Αν η υπογραφή δεν είναι έγκυρη → 403 Forbidden
        if (!isValid) {
            logger.warn({ platform }, 'Μη έγκυρη υπογραφή webhook — πιθανό spoofing');
            return reply.code(403).send({ error: 'Μη έγκυρη υπογραφή' });
        }

        // Η υπογραφή επαληθεύτηκε — συνεχίζουμε
        logger.debug({ platform }, 'Υπογραφή webhook επαληθεύτηκε');
    };
}

module.exports = {
    verifyViberSignature,
    verifyTelegramSecret,
    verifyWhatsAppSignature,
    createSignatureVerifyHook,
};
