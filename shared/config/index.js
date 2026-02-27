/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — SaaS Platform
 * Κεντρικό Module Ρυθμίσεων (Configuration)
 * 
 * Φορτώνει και επικυρώνει όλες τις περιβαλλοντικές μεταβλητές
 * από το αρχείο .env. Κεντρικό σημείο πρόσβασης για κάθε
 * ρύθμιση του συστήματος.
 * ============================================================
 */

'use strict';

// Φόρτωση περιβαλλοντικών μεταβλητών από .env αρχείο
const dotenv = require('dotenv');
const path = require('path');

// Φορτώνουμε το .env από τον root φάκελο του project
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Κεντρικό αντικείμενο ρυθμίσεων
 * Ομαδοποιεί τις ρυθμίσεις ανά κατηγορία (db, redis, kafka, ergani κλπ.)
 */
const config = {
    // --- Γενικές ρυθμίσεις εφαρμογής ---
    env: process.env.NODE_ENV || 'development',             // Περιβάλλον εκτέλεσης
    port: parseInt(process.env.PORT, 10) || 3000,           // Port webhook gateway

    // --- PostgreSQL: Κύρια βάση δεδομένων ---
    db: {
        host: process.env.DB_HOST || 'localhost',              // Διεύθυνση PostgreSQL server
        port: parseInt(process.env.DB_PORT, 10) || 5432,      // Port PostgreSQL
        database: process.env.DB_NAME || 'ergani_db',          // Όνομα βάσης δεδομένων
        user: process.env.DB_USER || 'ergani_user',            // Χρήστης βάσης
        password: process.env.DB_PASSWORD || '',               // Κωδικός βάσης
        // Ρυθμίσεις connection pool (αποτρέπει connection exhaustion σε peak)
        min: parseInt(process.env.DB_POOL_MIN, 10) || 2,      // Ελάχιστες συνδέσεις
        max: parseInt(process.env.DB_POOL_MAX, 10) || 10,     // Μέγιστες συνδέσεις
    },

    // --- Redis: Cache, Sessions, JWT Cache ---
    redis: {
        host: process.env.REDIS_HOST || 'localhost',           // Διεύθυνση Redis server
        port: parseInt(process.env.REDIS_PORT, 10) || 6379,   // Port Redis
        password: process.env.REDIS_PASSWORD || undefined,     // Κωδικός Redis (αν υπάρχει)
    },

    // --- Apache Kafka: Message Broker ---
    kafka: {
        brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','), // Λίστα brokers
        clientId: process.env.KAFKA_CLIENT_ID || 'ergani-saas',             // Client ID
        groupId: process.env.KAFKA_GROUP_ID || 'ergani-workers',            // Consumer group
        topics: {
            incomingMessages: 'incoming-messages',  // Topic εισερχομένων μηνυμάτων webhook
            deadLetterQueue: 'dead-letter-queue',   // DLQ για αποτυχημένα μηνύματα
        },
    },

    // --- ΕΡΓΑΝΗ ΙΙ API ---
    ergani: {
        // Ενιαίο URL — αλλάξτε στο .env ανάλογα sandbox/production
        apiUrl: process.env.ERGANI_API_URL || 'https://trialeservices.yeka.gr/WebServicesAPI/api',
        env: process.env.ERGANI_ENV || 'sandbox',              // Τρέχον περιβάλλον
        // Ρυθμίσεις δικτύου
        timeoutMs: parseInt(process.env.ERGANI_TIMEOUT_MS, 10) || 30000,     // Timeout HTTP request
        // Ρυθμίσεις retry σε αποτυχία
        maxRetries: parseInt(process.env.ERGANI_MAX_RETRIES, 10) || 3,       // Μέγιστος αριθμός προσπαθειών
        retryBaseDelayMs: 1000,                                // Αρχική καθυστέρηση (1 δευτ.)
        retryMaxDelayMs: 30000,                                // Μέγιστη καθυστέρηση (30 δευτ.)
        jwtRefreshBeforeExpirySec: 300,                        // Refresh JWT 5 λεπτά πριν τη λήξη
    },

    // --- Κρυπτογράφηση AES-256-GCM ---
    encryption: {
        // Κλειδί κρυπτογράφησης (32 bytes σε hex = 64 χαρακτήρες)
        key: process.env.ENCRYPTION_KEY || '',
        ivLength: parseInt(process.env.ENCRYPTION_IV_LENGTH, 10) || 16,  // Μέγεθος IV
    },

    // --- Webhook Secrets ανά πλατφόρμα ---
    webhooks: {
        viber: {
            authToken: process.env.VIBER_AUTH_TOKEN || '',        // Viber Bot Auth Token
        },
        telegram: {
            botToken: process.env.TELEGRAM_BOT_TOKEN || '',       // Telegram Bot Token
            secretToken: process.env.TELEGRAM_SECRET_TOKEN || '', // Secret Token για webhook verification
        },
        whatsapp: {
            appSecret: process.env.WHATSAPP_APP_SECRET || '',     // Meta App Secret
            accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '', // Access Token
            phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '', // Phone Number ID
        },
    },

    // --- GDPR Ρυθμίσεις ---
    gdpr: {
        gpsRetentionHours: parseInt(process.env.GPS_RETENTION_HOURS, 10) || 48,   // Κράτηση GPS δεδομένων (ώρες)
        auditLogRetentionYears: parseInt(process.env.AUDIT_LOG_RETENTION_YEARS, 10) || 5, // Κράτηση audit logs (χρόνια)
    },

    // --- Rate Limiting ---
    rateLimit: {
        max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,                    // Μέγιστα requests
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,       // Χρονικό παράθυρο (ms)
    },

    // --- Geofencing Defaults ---
    geofencing: {
        defaultRadiusMeters: 40,              // Προεπιλεγμένη ακτίνα geofence (μέτρα)
        minRadiusMeters: 10,                  // Ελάχιστη ακτίνα
        maxRadiusMeters: 200,                 // Μέγιστη ακτίνα
        maxAccuracyMeters: 100,               // Μέγιστη αποδεκτή ακρίβεια GPS
    },
};

module.exports = config;
