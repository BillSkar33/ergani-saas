/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — SaaS Platform
 * Module Σύνδεσης PostgreSQL (Connection Pool)
 * 
 * Χρησιμοποιεί pg Pool για αποδοτική διαχείριση συνδέσεων.
 * Υποστηρίζει connection pooling — αποτρέπει connection
 * exhaustion κατά τη διάρκεια peak hours (π.χ. 08:00).
 * ============================================================
 */

'use strict';

const { Pool } = require('pg');
const config = require('../config');
const logger = require('../logger');

/**
 * Δημιουργία connection pool για PostgreSQL
 * 
 * Ρυθμίσεις:
 * - min/max: Ελάχιστος/μέγιστος αριθμός ταυτόχρονων συνδέσεων
 * - idleTimeoutMillis: Χρόνος αδράνειας πριν κλείσει μια σύνδεση
 * - connectionTimeoutMillis: Μέγιστος χρόνος αναμονής για νέα σύνδεση
 */
const pool = new Pool({
    host: config.db.host,
    port: config.db.port,
    database: config.db.database,
    user: config.db.user,
    password: config.db.password,
    min: config.db.min,                         // Ελάχιστες συνδέσεις στο pool
    max: config.db.max,                         // Μέγιστες συνδέσεις στο pool
    idleTimeoutMillis: 30000,                   // 30 δευτ. αδράνειας → κλείσιμο σύνδεσης
    connectionTimeoutMillis: 5000,              // 5 δευτ. timeout για νέα σύνδεση
});

// Καταγραφή σφάλματος σύνδεσης — κρίσιμο για debugging
pool.on('error', (err) => {
    logger.error({ err }, 'Απρόσμενο σφάλμα σύνδεσης PostgreSQL');
});

// Καταγραφή σύνδεσης (μόνο σε development)
pool.on('connect', () => {
    logger.debug('Νέα σύνδεση PostgreSQL δημιουργήθηκε');
});

/**
 * Εκτέλεση SQL ερωτήματος
 * 
 * Wrapper γύρω από pool.query() για centralized error handling
 * και logging. Χρησιμοποιεί parameterized queries αποκλειστικά
 * για αποτροπή SQL injection.
 * 
 * @param {string} text - SQL ερώτημα (π.χ. 'SELECT * FROM employees WHERE afm = $1')
 * @param {Array} params - Παράμετροι ερωτήματος (π.χ. ['123456789'])
 * @returns {Promise<Object>} - Αποτέλεσμα ερωτήματος (rows, rowCount κλπ.)
 * 
 * @example
 * const result = await db.query(
 *   'SELECT * FROM employees WHERE employer_id = $1 AND is_active = $2',
 *   [employerId, true]
 * );
 */
async function query(text, params) {
    const start = Date.now();

    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;

        // Καταγραφή ερωτήματος σε debug level (μόνο σε development)
        logger.debug({
            query: text.substring(0, 100),  // Μόνο τα πρώτα 100 χαρακτήρες για ασφάλεια
            duration: `${duration}ms`,
            rows: result.rowCount,
        }, 'Εκτέλεση SQL ερωτήματος');

        return result;
    } catch (err) {
        logger.error({ err, query: text.substring(0, 100) }, 'Σφάλμα SQL ερωτήματος');
        throw err;
    }
}

/**
 * Λήψη client από το pool (για transactions)
 * 
 * Χρήση: Όταν χρειάζεται transaction (BEGIN/COMMIT/ROLLBACK)
 * ΣΗΜΑΝΤΙΚΟ: Πρέπει ΠΑΝΤΑ να γίνει client.release() στο finally
 * 
 * @returns {Promise<Object>} - PostgreSQL client
 * 
 * @example
 * const client = await db.getClient();
 * try {
 *   await client.query('BEGIN');
 *   await client.query('INSERT INTO ...', [...]);
 *   await client.query('COMMIT');
 * } catch (err) {
 *   await client.query('ROLLBACK');
 *   throw err;
 * } finally {
 *   client.release(); // ΠΡΕΠΕΙ ΠΑΝΤΑ — αλλιώς leak!
 * }
 */
async function getClient() {
    return pool.connect();
}

/**
 * Τερματισμός όλων των συνδέσεων (graceful shutdown)
 * Καλείται κατά το κλείσιμο της εφαρμογής
 */
async function close() {
    await pool.end();
    logger.info('Pool σύνδεσης PostgreSQL τερματίστηκε');
}

module.exports = { query, getClient, close, pool };
