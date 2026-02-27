/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — SaaS Platform
 * Viber Sender — Αποστολή Μηνυμάτων Viber
 * 
 * Χρησιμοποιεί το Viber Bot API για αποστολή μηνυμάτων
 * και custom keyboards (location-picker).
 * 
 * ΣΗΜΕΙΩΣΗ: Chatbot-initiated messages χρεώνονται (εκτός session)
 * ============================================================
 */

'use strict';

const axios = require('axios');
const config = require('../../shared/config');
const logger = require('../../shared/logger');

// Base URL Viber Bot API
const BASE_URL = 'https://chatapi.viber.com/pa/send_message';

/**
 * Αποστολή κειμενικού μηνύματος μέσω Viber
 * 
 * @param {string} userId - Viber user ID (sender.id)
 * @param {string} text - Κείμενο μηνύματος
 */
async function sendText(userId, text) {
    try {
        const payload = {
            receiver: userId,
            type: 'text',
            text: text,
            sender: {
                name: 'Κάρτα Εργασίας',        // Εμφανιζόμενο όνομα bot
                avatar: null,
            },
            // Keyboard με location-picker button
            keyboard: getDefaultKeyboard(),
        };

        await axios.post(BASE_URL, payload, {
            headers: {
                'X-Viber-Auth-Token': config.webhooks.viber.authToken,
                'Content-Type': 'application/json',
            },
        });

        logger.debug({ userId }, 'Viber μήνυμα στάλθηκε');
    } catch (err) {
        logger.error({ err: err.message, userId }, 'Σφάλμα αποστολής Viber μηνύματος');
        throw err;
    }
}

/**
 * Default Viber keyboard με location-picker
 * 
 * Τα Viber keyboards υποστηρίζουν ActionType: 'location-picker'
 * που ανοίγει τον χάρτη για αποστολή GPS τοποθεσίας.
 * 
 * @returns {Object} - Viber keyboard object
 */
function getDefaultKeyboard() {
    return {
        Type: 'keyboard',
        DefaultHeight: false,               // Μικρότερο ύψος
        Buttons: [
            {
                Columns: 6,                     // Πλήρες πλάτος
                Rows: 1,
                ActionType: 'location-picker',  // Ανοίγει τον χάρτη GPS
                ActionBody: 'location',
                Text: '📍 ΒΑΡΔΙΑ — Στείλε Τοποθεσία',
                TextSize: 'medium',
                BgColor: '#2196F3',             // Μπλε φόντο
            },
            {
                Columns: 3,                     // Μισό πλάτος
                Rows: 1,
                ActionType: 'reply',
                ActionBody: 'ΚΑΤΑΣΤΑΣΗ',
                Text: '📊 ΚΑΤΑΣΤΑΣΗ',
                TextSize: 'small',
                BgColor: '#E0E0E0',
            },
            {
                Columns: 3,
                Rows: 1,
                ActionType: 'reply',
                ActionBody: 'ΙΣΤΟΡΙΚΟ',
                Text: '📋 ΙΣΤΟΡΙΚΟ',
                TextSize: 'small',
                BgColor: '#E0E0E0',
            },
        ],
    };
}

module.exports = { sendText, getDefaultKeyboard };
