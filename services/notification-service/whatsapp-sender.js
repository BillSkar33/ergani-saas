/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — SaaS Platform
 * WhatsApp Sender — Αποστολή Μηνυμάτων WhatsApp Cloud API
 * 
 * Χρησιμοποιεί το WhatsApp Cloud API (Meta) για αποστολή
 * μηνυμάτων και interactive location requests.
 * 
 * ΣΗΜΕΙΩΣΗ: Εκτός 24ωρου window → μόνο Template Messages
 * ============================================================
 */

'use strict';

const axios = require('axios');
const config = require('../../shared/config');
const logger = require('../../shared/logger');

// Base URL WhatsApp Cloud API
const BASE_URL = `https://graph.facebook.com/v18.0/${config.webhooks.whatsapp.phoneNumberId}/messages`;

/**
 * Αποστολή κειμενικού μηνύματος μέσω WhatsApp
 * 
 * @param {string} phone - Αριθμός τηλεφώνου (format: country code + number)
 * @param {string} text - Κείμενο μηνύματος
 */
async function sendText(phone, text) {
    try {
        const payload = {
            messaging_product: 'whatsapp',
            to: phone,
            type: 'text',
            text: {
                body: text,
                preview_url: false,
            },
        };

        await axios.post(BASE_URL, payload, {
            headers: {
                'Authorization': `Bearer ${config.webhooks.whatsapp.accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        logger.debug({ phone }, 'WhatsApp μήνυμα στάλθηκε');
    } catch (err) {
        logger.error({ err: err.message, phone }, 'Σφάλμα αποστολής WhatsApp μηνύματος');
        throw err;
    }
}

/**
 * Αποστολή interactive location request
 * 
 * Στέλνει ένα button μήνυμα που ζητά GPS τοποθεσία
 * (WhatsApp location_request_message — API v18.0+)
 * 
 * @param {string} phone - Αριθμός τηλεφώνου
 * @param {string} bodyText - Κείμενο μηνύματος
 */
async function sendLocationRequest(phone, bodyText) {
    try {
        const payload = {
            messaging_product: 'whatsapp',
            to: phone,
            type: 'interactive',
            interactive: {
                type: 'location_request_message',
                body: {
                    text: bodyText || '📍 Στείλτε την τοποθεσία σας για check-in/check-out.',
                },
                action: {
                    name: 'send_location',         // Ενεργοποιεί τον επιλογέα τοποθεσίας
                },
            },
        };

        await axios.post(BASE_URL, payload, {
            headers: {
                'Authorization': `Bearer ${config.webhooks.whatsapp.accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        logger.debug({ phone }, 'WhatsApp location request στάλθηκε');
    } catch (err) {
        logger.error({ err: err.message, phone }, 'Σφάλμα αποστολής WhatsApp location request');
        throw err;
    }
}

module.exports = { sendText, sendLocationRequest };
