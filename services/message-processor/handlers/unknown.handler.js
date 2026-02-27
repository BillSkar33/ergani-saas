/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — SaaS Platform
 * Handler Αγνώστου Μηνύματος — Unknown / Help
 * 
 * Χειρίζεται μηνύματα που δεν αναγνωρίζονται
 * και στέλνει οδηγίες χρήσης στον εργαζόμενο.
 * ============================================================
 */

'use strict';

const logger = require('../../../shared/logger');
const notifier = require('../../notification-service/template-engine');

/**
 * Χειρισμός αγνώριστου μηνύματος
 * 
 * Στέλνει φιλικό μήνυμα βοήθειας στον εργαζόμενο
 * με τις διαθέσιμες εντολές.
 * 
 * @param {Object} payload - Kafka message payload
 */
async function handle(payload) {
    const { platform, platformUserId, messageType } = payload;

    logger.debug({
        platform,
        userId: platformUserId,
        type: messageType,
    }, 'Αγνώριστο μήνυμα — αποστολή βοήθειας');

    try {
        await notifier.sendMessage(platform, platformUserId, 'help');
    } catch (err) {
        logger.error({ err }, 'Σφάλμα αποστολής μηνύματος βοήθειας');
    }
}

module.exports = { handle };
