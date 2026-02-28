/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — Security Module
 * Account Lockout (Brute-force Protection)
 * 
 * Μετά από 5 αποτυχημένα login → lockout 15 λεπτά.
 * Αποθηκεύει counters σε Redis (TTL-based).
 * ============================================================
 */
'use strict';

const redis = require('../redis');
const logger = require('../logger');

/** Ρυθμίσεις lockout */
const LOCKOUT_CONFIG = {
    maxAttempts: 5,         // Μέγιστες αποτυχημένες προσπάθειες
    lockoutMinutes: 15,     // Διάρκεια lockout (λεπτά)
    windowMinutes: 10,      // Παράθυρο μέτρησης αποτυχιών (λεπτά)
};

/**
 * Έλεγχος αν ο λογαριασμός είναι κλειδωμένος
 * 
 * @param {string} email - Email εργοδότη
 * @returns {Object} { locked: boolean, remainingMinutes?: number }
 */
async function isAccountLocked(email) {
    try {
        const lockKey = `lockout:${email}`;
        const ttl = await redis.ttl(lockKey);

        if (ttl > 0) {
            return { locked: true, remainingMinutes: Math.ceil(ttl / 60) };
        }
        return { locked: false };
    } catch {
        return { locked: false }; // fail-open
    }
}

/**
 * Καταγραφή αποτυχημένης σύνδεσης
 * Αν φτάσει τις 5 αποτυχίες → lockout
 * 
 * @param {string} email
 * @returns {Object} { attempts: number, locked: boolean }
 */
async function recordFailedLogin(email) {
    try {
        const key = `login_attempts:${email}`;
        const attempts = await redis.incr(key);

        // Set TTL στην πρώτη αποτυχία
        if (attempts === 1) {
            await redis.expire(key, LOCKOUT_CONFIG.windowMinutes * 60);
        }

        // Lockout!
        if (attempts >= LOCKOUT_CONFIG.maxAttempts) {
            const lockKey = `lockout:${email}`;
            await redis.set(lockKey, '1', 'EX', LOCKOUT_CONFIG.lockoutMinutes * 60);
            await redis.del(key); // Reset counter

            logger.warn({ email, attempts }, `🔒 Account locked: ${email} (${LOCKOUT_CONFIG.lockoutMinutes} λεπτά)`);
            return { attempts, locked: true };
        }

        return { attempts, locked: false, remaining: LOCKOUT_CONFIG.maxAttempts - attempts };
    } catch (err) {
        logger.error({ err }, 'Lockout Redis error');
        return { attempts: 0, locked: false };
    }
}

/**
 * Reset counter μετά από επιτυχή σύνδεση
 * 
 * @param {string} email
 */
async function clearFailedLogins(email) {
    try {
        await redis.del(`login_attempts:${email}`);
        await redis.del(`lockout:${email}`);
    } catch {
        // Αγνόηση — δεν είναι κρίσιμο
    }
}

module.exports = { isAccountLocked, recordFailedLogin, clearFailedLogins, LOCKOUT_CONFIG };
