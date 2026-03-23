/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — Security Module
 * JWT Token Blacklist (Redis-based)
 * 
 * Ακυρώνει tokens κατά:
 *   - Logout (μεμονωμένο token)
 *   - Αλλαγή κωδικού (ΟΛΑ τα tokens ενός employer)
 * Αποθήκευση στο Redis με TTL = remaining token lifetime
 * ============================================================
 */
'use strict';

const redis = require('../redis');
const logger = require('../logger');

const BLACKLIST_PREFIX = 'jwt_blacklist:';
const TOKEN_EXPIRY_HOURS = 8;

/**
 * Προσθήκη token στη blacklist
 * TTL = remaining lifetime (για auto-cleanup μετά τη λήξη)
 * 
 * @param {string} token - JWT token string
 * @param {number} [expiresAt] - Unix timestamp λήξης token
 */
async function blacklistToken(token, expiresAt) {
    try {
        const key = `${BLACKLIST_PREFIX}${hashToken(token)}`;
        const ttl = expiresAt
            ? Math.max(1, expiresAt - Math.floor(Date.now() / 1000))
            : TOKEN_EXPIRY_HOURS * 3600;

        await redis.set(key, '1', 'EX', ttl);
        logger.info('Token blacklisted');
    } catch (err) {
        logger.error({ err }, 'JWT blacklist Redis error');
    }
}

/**
 * Ακύρωση ΟΛΩΝ των tokens ενός employer (αλλαγή κωδικού)
 * Χρησιμοποιεί employer-level key
 * 
 * @param {string} employerId - UUID employer
 */
async function invalidateAllTokens(employerId) {
    try {
        const key = `jwt_invalidated_before:${employerId}`;
        // Αποθηκεύουμε τον χρόνο ακύρωσης — tokens πριν από αυτό = invalid
        await redis.set(key, Math.floor(Date.now() / 1000).toString(), 'EX', TOKEN_EXPIRY_HOURS * 3600);
        logger.info({ employerId }, 'Όλα τα tokens ακυρώθηκαν');
    } catch (err) {
        logger.error({ err }, 'JWT invalidateAll Redis error');
    }
}

/**
 * Έλεγχος αν ένα token είναι blacklisted
 * 
 * @param {string} token - JWT token string
 * @param {string} employerId - UUID employer
 * @param {number} issuedAt - IAT claim του token
 * @returns {boolean} - true αν blacklisted
 */
async function isTokenBlacklisted(token, employerId, issuedAt) {
    try {
        // 1. Μεμονωμένο token blacklist
        const key = `${BLACKLIST_PREFIX}${hashToken(token)}`;
        const exists = await redis.exists(key);
        if (exists) return true;

        // 2. Employer-level invalidation (αλλαγή κωδικού)
        if (employerId && issuedAt) {
            const invalidatedBefore = await redis.get(`jwt_invalidated_before:${employerId}`);
            if (invalidatedBefore && issuedAt < parseInt(invalidatedBefore)) {
                return true; // Token εκδόθηκε πριν την αλλαγή κωδικού
            }
        }

        return false;
    } catch {
        return false; // fail-open
    }
}

/**
 * SHA-256 hash token (αποφυγή αποθήκευσης πλήρους token)
 */
function hashToken(token) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(token).digest('hex').slice(0, 32);
}

module.exports = { blacklistToken, invalidateAllTokens, isTokenBlacklisted };
