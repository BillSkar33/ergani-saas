/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — SaaS Platform
 * Module Apache Kafka (Producer & Consumer)
 * 
 * Χρησιμοποιεί KafkaJS για:
 * - Producer: Αποστολή webhook μηνυμάτων στο queue
 * - Consumer: Λήψη και επεξεργασία μηνυμάτων από workers
 * 
 * Topics:
 * - incoming-messages: Εισερχόμενα webhook payloads
 * - dead-letter-queue: Μηνύματα που αποτυχαίνουν μετά από max retries
 * ============================================================
 */

'use strict';

const { Kafka, Partitioners, logLevel } = require('kafkajs');
const config = require('../config');
const logger = require('../logger');

/**
 * Δημιουργία Kafka instance
 * 
 * Ρυθμίσεις:
 * - clientId: Μοναδικό αναγνωριστικό αυτής της εφαρμογής
 * - brokers: Λίστα Kafka brokers
 * - logLevel: WARN σε production, DEBUG σε development
 * - retry: 8 προσπάθειες σύνδεσης, αρχική καθυστέρηση 300ms
 */
const kafka = new Kafka({
    clientId: config.kafka.clientId,
    brokers: config.kafka.brokers,

    // Επίπεδο logging — μειωμένο σε production για performance
    logLevel: config.env === 'production' ? logLevel.WARN : logLevel.INFO,

    // Ρυθμίσεις επανασύνδεσης
    retry: {
        initialRetryTime: 300,        // Αρχική καθυστέρηση (ms)
        retries: 8,                   // Μέγιστες προσπάθειες
    },

    // Custom logger — μετατρέπει τα Kafka logs σε pino format
    logCreator: () => {
        return ({ namespace, level, log }) => {
            const { message, ...extra } = log;
            const pinoLevel = {
                [logLevel.ERROR]: 'error',
                [logLevel.WARN]: 'warn',
                [logLevel.INFO]: 'info',
                [logLevel.DEBUG]: 'debug',
            }[level] || 'info';

            logger[pinoLevel]({ kafka: namespace, ...extra }, message);
        };
    },
});

// --- Δημιουργία Producer ---

/**
 * Kafka Producer — χρησιμοποιείται από τo Webhook Gateway
 * για αποστολή εισερχομένων μηνυμάτων στο queue
 * 
 * Partitioner: LegacyPartitioner — κατανομή μηνυμάτων βάσει key
 * (χρήση employer_id ως key για ordering guarantee ανά εργοδότη)
 */
const producer = kafka.producer({
    createPartitioner: Partitioners.LegacyPartitioner,
    allowAutoTopicCreation: true,   // Αυτόματη δημιουργία topic αν δεν υπάρχει
});

// --- Δημιουργία Consumer ---

/**
 * Kafka Consumer — χρησιμοποιείται από τον Message Processor
 * για λήψη και επεξεργασία μηνυμάτων
 * 
 * groupId: Ομάδα consumers — αυτόματη κατανομή partitions
 * Πολλαπλοί workers μοιράζονται το φορτίο μέσω consumer groups
 */
const consumer = kafka.consumer({
    groupId: config.kafka.groupId,
    sessionTimeout: 30000,           // 30 δευτ. session timeout
    heartbeatInterval: 3000,         // 3 δευτ. heartbeat
    maxWaitTimeInMs: 5000,           // 5 δευτ. max wait για νέα μηνύματα
});

/**
 * Σύνδεση Producer στο Kafka cluster
 * Πρέπει να κληθεί πριν από οποιαδήποτε αποστολή μηνύματος
 * 
 * @throws {Error} - Αν η σύνδεση αποτύχει
 */
async function connectProducer() {
    await producer.connect();
    logger.info('Kafka Producer συνδέθηκε');
}

/**
 * Σύνδεση Consumer στο Kafka cluster και εγγραφή σε topics
 * Πρέπει να κληθεί πριν ξεκινήσει η λήψη μηνυμάτων
 * 
 * @param {string[]} topics - Λίστα topics για εγγραφή
 * @throws {Error} - Αν η σύνδεση αποτύχει
 */
async function connectConsumer(topics = [config.kafka.topics.incomingMessages]) {
    await consumer.connect();

    // Εγγραφή σε κάθε topic από τη λίστα
    for (const topic of topics) {
        await consumer.subscribe({ topic, fromBeginning: false });
        logger.info({ topic }, 'Kafka Consumer εγγράφηκε σε topic');
    }
}

/**
 * Αποστολή μηνύματος στο Kafka topic
 * 
 * @param {string} topic - Όνομα topic (π.χ. 'incoming-messages')
 * @param {string} key - Κλειδί μηνύματος (π.χ. employer_id — εξασφαλίζει ordering)
 * @param {Object} value - Δεδομένα μηνύματος (μετατρέπεται αυτόματα σε JSON)
 * 
 * @example
 * await sendMessage('incoming-messages', employerId, {
 *   platform: 'telegram',
 *   userId: '123456',
 *   type: 'location',
 *   lat: 37.9838,
 *   lng: 23.7275
 * });
 */
async function sendMessage(topic, key, value) {
    await producer.send({
        topic,
        messages: [
            {
                key: key,                          // Partitioning key
                value: JSON.stringify(value),      // Σειριοποίηση σε JSON
                timestamp: Date.now().toString(),  // Χρονοσήμανση Kafka
            },
        ],
    });

    logger.debug({ topic, key }, 'Μήνυμα στάλθηκε στο Kafka');
}

/**
 * Αποσύνδεση Producer και Consumer (graceful shutdown)
 * Ολοκληρώνει τα τρέχοντα μηνύματα πριν τον τερματισμό
 */
async function disconnect() {
    await producer.disconnect();
    await consumer.disconnect();
    logger.info('Kafka Producer & Consumer αποσυνδέθηκαν');
}

module.exports = {
    kafka,
    producer,
    consumer,
    connectProducer,
    connectConsumer,
    sendMessage,
    disconnect,
};
