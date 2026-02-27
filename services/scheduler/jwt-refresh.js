/**
 * ============================================================
 * JWT Refresh — Proactive Ανανέωση JWT Tokens
 * 
 * Ανανεώνει προληπτικά τα JWT tokens ενεργών παραρτημάτων
 * 5 λεπτά πριν τη λήξη τους, ώστε να αποφεύγονται
 * 401 errors κατά τη διάρκεια peak hours (π.χ. 08:00).
 * ============================================================
 */
'use strict';
const redis = require('../../shared/redis');
const db = require('../../shared/db');
const logger = require('../../shared/logger');
const { getToken } = require('../ergani-client/auth');

async function run() {
    // Λήψη ενεργών παραρτημάτων με credentials
    const result = await db.query(
        `SELECT id, ergani_username_encrypted, ergani_password_encrypted
     FROM branches
     WHERE is_active = true
       AND ergani_username_encrypted IS NOT NULL`
    );

    for (const branch of result.rows) {
        try {
            // getToken ελέγχει αυτόματα αν λήγει σύντομα
            await getToken(branch);
        } catch (err) {
            logger.warn({ branchId: branch.id, err: err.message },
                'JWT proactive refresh αποτυχία');
        }
    }
}

module.exports = { run };
