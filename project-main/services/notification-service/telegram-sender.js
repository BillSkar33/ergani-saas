/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — SaaS Platform
 * Telegram Sender — Αποστολή Μηνυμάτων Telegram
 * 
 * Χρησιμοποιεί το Telegram Bot API για αποστολή μηνυμάτων,
 * πληκτρολογίων (keyboards), και location request buttons.
 * ============================================================
 */

'use strict';

const axios = require('axios');
const config = require('../../shared/config');
const logger = require('../../shared/logger');

// Base URL Telegram Bot API
const BASE_URL = `https://api.telegram.org/bot${config.webhooks.telegram.botToken}`;

/**
 * Αποστολή κειμενικού μηνύματος μέσω Telegram
 * 
 * @param {string} chatId - Telegram chat ID
 * @param {string} text - Κείμενο μηνύματος
 * @param {Object} [keyboard] - Optional custom keyboard
 */
async function sendText(chatId, text, keyboard = null) {
    try {
        const payload = {
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML',          // Υποστήριξη HTML formatting
        };

        // Προσθήκη keyboard αν υπάρχει
        if (keyboard) {
            payload.reply_markup = keyboard;
        } else {
            // Default keyboard με location button
            payload.reply_markup = getDefaultKeyboard();
        }

        await axios.post(`${BASE_URL}/sendMessage`, payload);
        logger.debug({ chatId }, 'Telegram μήνυμα στάλθηκε');
    } catch (err) {
        logger.error({ err: err.message, chatId }, 'Σφάλμα αποστολής Telegram μηνύματος');
        throw err;
    }
}

/**
 * Default keyboard με location button
 * 
 * Εμφανίζει κουμπιά:
 * - 📍 ΕΝΑΡΞΗ/ΛΗΞΗ ΒΑΡΔΙΑΣ (request_location)
 * - 📊 ΚΑΤΑΣΤΑΣΗ
 * - 📋 ΙΣΤΟΡΙΚΟ
 * 
 * @returns {Object} - Telegram ReplyKeyboardMarkup
 */
function getDefaultKeyboard() {
    return {
        keyboard: [
            [
                {
                    text: '📍 ΒΑΡΔΙΑ (Στείλε Τοποθεσία)',
                    request_location: true,        // Ζητάει GPS location
                },
            ],
            [
                { text: '📊 ΚΑΤΑΣΤΑΣΗ' },
                { text: '📋 ΙΣΤΟΡΙΚΟ' },
            ],
            [
                { text: '❓ ΒΟΗΘΕΙΑ' },
            ],
        ],
        resize_keyboard: true,               // Μικρότερο μέγεθος keyboard
        one_time_keyboard: false,            // Παραμένει ορατό
    };
}

module.exports = { sendText, getDefaultKeyboard };
