/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — SaaS Platform
 * Message Processor — Kafka Consumer & Message Router
 * 
 * Λαμβάνει μηνύματα από το Kafka topic 'incoming-messages'
 * και τα κατευθύνει στον κατάλληλο handler βάσει τύπου.
 * 
 * Handlers:
 * - check-in: Έναρξη βάρδιας (location → geofence → ΕΡΓΑΝΗ)
 * - check-out: Λήξη βάρδιας
 * - registration: Εγγραφή εργαζομένου (linking code)
 * - status: Κατάσταση τρέχουσας βάρδιας
 * - unknown: Αγνώριστο μήνυμα → βοήθεια
 * ============================================================
 */

'use strict';

const { consumer, connectConsumer } = require('../../shared/kafka');
const config = require('../../shared/config');
const logger = require('../../shared/logger');

// Εισαγωγή handlers
const checkInHandler = require('./handlers/check-in.handler');
const checkOutHandler = require('./handlers/check-out.handler');
const registrationHandler = require('./handlers/registration.handler');
const statusHandler = require('./handlers/status.handler');
const unknownHandler = require('./handlers/unknown.handler');

/**
 * Χάρτης δρομολόγησης μηνυμάτων
 * Αντιστοιχίζει τύπο μηνύματος → handler function
 */
const MESSAGE_HANDLERS = {
    location: null,              // Ειδικός χειρισμός — ελέγχεται η κατάσταση user
    start: registrationHandler,  // /start → εγγραφή
    linking_code: registrationHandler, // 6ψήφιος κωδικός σύνδεσης
    status: statusHandler,       // /status → κατάσταση
    history: statusHandler,      // /history → ιστορικό (ίδιος handler)
    help: unknownHandler,        // /help → βοήθεια
    text: unknownHandler,        // Γενικό κείμενο → βοήθεια
    callback: null,              // Callback queries (inline buttons)
    interactive: null,           // WhatsApp interactive replies
};

/**
 * Εκκίνηση Message Processor
 * 
 * Ροή:
 * 1. Σύνδεση στο Kafka cluster
 * 2. Εγγραφή στο topic 'incoming-messages'
 * 3. Για κάθε μήνυμα: parse, route, handle
 * 4. Graceful shutdown σε SIGTERM/SIGINT
 */
async function start() {
    logger.info('Εκκίνηση Message Processor...');

    try {
        // Σύνδεση Kafka consumer στο topic
        await connectConsumer([config.kafka.topics.incomingMessages]);

        // Εκκίνηση κατανάλωσης μηνυμάτων
        await consumer.run({
            // Αυτό-commit κάθε 5 δευτ. (ή μετά από κάθε batch)
            autoCommitInterval: 5000,

            // Handler για κάθε μήνυμα
            eachMessage: async ({ topic, partition, message }) => {
                const startTime = Date.now();

                try {
                    // Αποσειριοποίηση μηνύματος
                    const payload = JSON.parse(message.value.toString());
                    const { platform, platformUserId, messageType, messageData } = payload;

                    logger.info({
                        platform,
                        userId: platformUserId,
                        type: messageType,
                        partition,
                    }, 'Επεξεργασία μηνύματος από Kafka');

                    // --- Δρομολόγηση βάσει τύπου ---

                    if (messageType === 'location') {
                        // Τοποθεσία: πρέπει να ελέγξουμε αν ο χρήστης
                        // περιμένει check-in ή check-out
                        await handleLocationMessage(payload);

                    } else if (MESSAGE_HANDLERS[messageType]) {
                        // Γνωστός τύπος → κλήση κατάλληλου handler
                        await MESSAGE_HANDLERS[messageType].handle(payload);

                    } else {
                        // Άγνωστος τύπος → handler αγνώστου
                        await unknownHandler.handle(payload);
                    }

                    const duration = Date.now() - startTime;
                    logger.debug({ duration: `${duration}ms`, messageType }, 'Μήνυμα επεξεργάστηκε');

                } catch (err) {
                    logger.error({
                        err,
                        partition,
                        offset: message.offset,
                    }, 'Σφάλμα επεξεργασίας μηνύματος Kafka');

                    // Δεν κάνουμε throw — αφήνουμε τον consumer να συνεχίσει
                    // Τα failed messages μπαίνουν στο DLQ μέσω τους handlers
                }
            },
        });

        logger.info('🔄 Message Processor ξεκίνησε — αναμονή μηνυμάτων...');
    } catch (err) {
        logger.error({ err }, 'Αποτυχία εκκίνησης Message Processor');
        process.exit(1);
    }
}

/**
 * Χειρισμός μηνύματος τοποθεσίας (Location)
 * 
 * Η τοποθεσία μπορεί να σημαίνει check-in ή check-out,
 * ανάλογα με την κατάσταση του εργαζομένου:
 * - Δεν έχει ανοιχτό check-in σήμερα → CHECK-IN
 * - Έχει ανοιχτό check-in → CHECK-OUT
 * 
 * @param {Object} payload - Kafka message payload
 */
async function handleLocationMessage(payload) {
    const { platformUserId, platform } = payload;

    try {
        // Αναζήτηση εργαζομένου μέσω messenger ID
        const db = require('../../shared/db');

        const linkResult = await db.query(
            `SELECT e.id as employee_id, e.employer_id, e.branch_id, 
              e.is_external_worker, e.afm, e.eponymo, e.onoma
       FROM messenger_links ml
       JOIN employees e ON ml.employee_id = e.id
       WHERE ml.platform = $1 AND ml.platform_user_id = $2 AND e.is_active = true`,
            [platform, platformUserId]
        );

        // Αν ο χρήστης δεν είναι εγγεγραμμένος
        if (linkResult.rowCount === 0) {
            const notifier = require('../notification-service/template-engine');
            await notifier.sendMessage(platform, platformUserId, 'unregistered');
            return;
        }

        const employee = linkResult.rows[0];

        // Ελέγχουμε αν υπάρχει ανοιχτό check-in σήμερα
        const { DateTime } = require('luxon');
        const today = DateTime.now().setZone('Europe/Athens').toISODate();

        const openCheckIn = await db.query(
            `SELECT id, reference_date FROM time_stamps
       WHERE employee_id = $1 AND action_type = 'check_in'
       AND reference_date = $2
       AND NOT EXISTS (
         SELECT 1 FROM time_stamps t2
         WHERE t2.employee_id = $1 AND t2.action_type = 'check_out'
         AND t2.reference_date = $2
       )
       ORDER BY event_timestamp DESC LIMIT 1`,
            [employee.employee_id, today]
        );

        if (openCheckIn.rowCount === 0) {
            // Δεν υπάρχει check-in → κάνουμε CHECK-IN
            await checkInHandler.handle(payload, employee);
        } else {
            // Υπάρχει ανοιχτό check-in → κάνουμε CHECK-OUT
            await checkOutHandler.handle(payload, employee, openCheckIn.rows[0]);
        }

    } catch (err) {
        logger.error({ err, platformUserId }, 'Σφάλμα χειρισμού τοποθεσίας');
    }
}

// --- Graceful Shutdown ---
async function gracefulShutdown(signal) {
    logger.info({ signal }, 'Message Processor — Graceful shutdown');
    try {
        const { disconnect } = require('../../shared/kafka');
        await disconnect();
        const db = require('../../shared/db');
        await db.close();
        process.exit(0);
    } catch (err) {
        logger.error({ err }, 'Σφάλμα shutdown');
        process.exit(1);
    }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

if (require.main === module) {
    start();
}

module.exports = { start };
