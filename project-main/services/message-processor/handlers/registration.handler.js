/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — SaaS Platform
 * Handler Εγγραφής — Registration & Linking
 * 
 * Χειρίζεται τη σύνδεση εργαζομένου με messenger account:
 * 1. /start → εμφάνιση οδηγιών εγγραφής
 * 2. 6ψήφιος κωδικός → αντιστοίχιση messenger ID ↔ εργαζόμενος
 * ============================================================
 */

'use strict';

const db = require('../../../shared/db');
const logger = require('../../../shared/logger');
const notifier = require('../../notification-service/template-engine');

/**
 * Χειρισμός εγγραφής / σύνδεσης εργαζομένου
 * 
 * @param {Object} payload - Kafka message payload
 */
async function handle(payload) {
    const { platform, platformUserId, messageType, messageData } = payload;

    logger.info({ platform, userId: platformUserId, type: messageType }, 'Επεξεργασία εγγραφής');

    try {
        // --- Βήμα 1: Έλεγχος αν ήδη εγγεγραμμένος ---
        const existingLink = await db.query(
            `SELECT ml.id, e.onoma, e.eponymo
       FROM messenger_links ml
       JOIN employees e ON ml.employee_id = e.id
       WHERE ml.platform = $1 AND ml.platform_user_id = $2`,
            [platform, platformUserId]
        );

        if (existingLink.rowCount > 0) {
            // Ήδη εγγεγραμμένος
            const employee = existingLink.rows[0];
            logger.info({ userId: platformUserId }, 'Χρήστης ήδη εγγεγραμμένος');
            await notifier.sendMessage(platform, platformUserId, 'already_registered', {
                name: `${employee.onoma} ${employee.eponymo}`,
            });
            return;
        }

        // --- Βήμα 2: Τύπος μηνύματος ---

        if (messageType === 'start') {
            // Νέος χρήστης → εμφάνιση οδηγιών εγγραφής
            await notifier.sendMessage(platform, platformUserId, 'welcome');
            return;
        }

        if (messageType === 'linking_code') {
            // Εισαγωγή 6ψήφιου κωδικού → σύνδεση
            const code = messageData.code;

            // Αναζήτηση κωδικού στη βάση
            const employeeResult = await db.query(
                `SELECT id, employer_id, onoma, eponymo, linking_code_expires_at
         FROM employees
         WHERE linking_code = $1 AND is_active = true`,
                [code]
            );

            if (employeeResult.rowCount === 0) {
                // Λάθος κωδικός
                logger.info({ code }, 'Μη έγκυρος κωδικός σύνδεσης');
                await notifier.sendMessage(platform, platformUserId, 'invalid_code');
                return;
            }

            const employee = employeeResult.rows[0];

            // Έλεγχος λήξης κωδικού
            if (employee.linking_code_expires_at && new Date(employee.linking_code_expires_at) < new Date()) {
                logger.info({ code }, 'Ληγμένος κωδικός σύνδεσης');
                await notifier.sendMessage(platform, platformUserId, 'expired_code');
                return;
            }

            // --- Βήμα 3: Δημιουργία σύνδεσης messenger ↔ εργαζόμενος ---
            const client = await db.getClient();
            try {
                await client.query('BEGIN');

                // Εισαγωγή στον πίνακα messenger_links
                await client.query(
                    `INSERT INTO messenger_links (employee_id, platform, platform_user_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (platform, platform_user_id) DO NOTHING`,
                    [employee.id, platform, platformUserId]
                );

                // Ακύρωση κωδικού σύνδεσης (μιας χρήσης)
                await client.query(
                    `UPDATE employees SET linking_code = NULL, linking_code_expires_at = NULL
           WHERE id = $1`,
                    [employee.id]
                );

                await client.query('COMMIT');

                logger.info({
                    employeeId: employee.id,
                    platform,
                    userId: platformUserId,
                }, 'Εργαζόμενος συνδέθηκε επιτυχώς');

                // Ειδοποίηση εργαζομένου
                await notifier.sendMessage(platform, platformUserId, 'registration_success', {
                    name: `${employee.onoma} ${employee.eponymo}`,
                });

            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            } finally {
                client.release();
            }
        }

    } catch (err) {
        logger.error({ err, userId: platformUserId }, 'Σφάλμα εγγραφής');
        await notifier.sendMessage(platform, platformUserId, 'generic_error');
    }
}

module.exports = { handle };
