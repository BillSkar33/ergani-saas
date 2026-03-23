/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — SaaS Platform
 * ΕΡΓΑΝΗ ΙΙ API Client — JWT Authentication Module
 * 
 * Διαχειρίζεται τo JWT token authentication προς το ΕΡΓΑΝΗ ΙΙ API.
 * Λειτουργίες:
 * - Authentication με Branch User credentials
 * - Caching JWT tokens στο Redis (ανά παράρτημα)
 * - Proactive refresh 5 λεπτά πριν τη λήξη
 * - Auto-refresh σε 401 Unauthorized response
 * 
 * Endpoint: POST /api/authenticate
 * ============================================================
 */

'use strict';

const axios = require('axios');
const redis = require('../../shared/redis');
const config = require('../../shared/config');
const logger = require('../../shared/logger');
const { decrypt } = require('../../shared/encryption');

// Πρόθεμα Redis key για JWT cache
const JWT_REDIS_PREFIX = 'ergani:jwt:';

/**
 * Αυθεντικοποίηση στο ΕΡΓΑΝΗ ΙΙ API
 * 
 * Στέλνει POST request στο /api/authenticate με τα credentials
 * του Branch User. Λαμβάνει JWT access token.
 * 
 * @param {string} username - Username Branch User ΕΡΓΑΝΗ
 * @param {string} password - Password Branch User ΕΡΓΑΝΗ
 * @returns {Promise<Object>} - { accessToken, expiresIn }
 * @throws {Error} - Αν η αυθεντικοποίηση αποτύχει (401, network error)
 */
async function authenticate(username, password) {
    const url = `${config.ergani.apiUrl}/authenticate`;

    logger.info('Αυθεντικοποίηση στο ΕΡΓΑΝΗ ΙΙ API...');

    try {
        const response = await axios.post(url, {
            Username: username,
            Password: password,
        }, {
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: 10000,   // 10 δευτ. timeout
        });

        // Εξαγωγή token από response
        // Η δομή response εξαρτάται από τη μορφή του ΕΡΓΑΝΗ API
        const accessToken = response.data?.accessToken || response.data?.access_token || response.data;

        if (!accessToken) {
            throw new Error('Δεν ελήφθη access token από ΕΡΓΑΝΗ');
        }

        logger.info('Αυθεντικοποίηση ΕΡΓΑΝΗ επιτυχής');

        return {
            accessToken,
            // Εκτίμηση χρόνου λήξης — αν δεν επιστρέφεται, 3600 δευτ. (1 ώρα)
            expiresIn: response.data?.expiresIn || 3600,
        };
    } catch (err) {
        if (err.response?.status === 401) {
            logger.error('Αυθεντικοποίηση ΕΡΓΑΝΗ αποτυχημένη — λάθος credentials');
            throw new Error('ΕΡΓΑΝΗ: Λάθος username ή password');
        }
        logger.error({ err: err.message }, 'Σφάλμα αυθεντικοποίησης ΕΡΓΑΝΗ');
        throw err;
    }
}

/**
 * Λήψη valid JWT token για συγκεκριμένο παράρτημα
 * 
 * Ροή:
 * 1. Ελέγχει Redis cache — αν υπάρχει και δεν λήγει σύντομα → χρήση
 * 2. Αν δεν υπάρχει ή λήγει σε < 5 λεπτά → fresh authentication
 * 3. Αποθήκευση νέου token στο Redis με TTL
 * 
 * @param {Object} branch - Αντικείμενο παραρτήματος (id, encrypted credentials)
 * @returns {Promise<string>} - Valid JWT access token
 * @throws {Error} - Αν η αυθεντικοποίηση αποτύχει
 */
async function getToken(branch) {
    const cacheKey = `${JWT_REDIS_PREFIX}${branch.id}`;

    try {
        // --- Βήμα 1: Έλεγχος Redis cache ---
        const cached = await redis.get(cacheKey);

        if (cached) {
            const { accessToken, expiresAt } = JSON.parse(cached);
            const now = Date.now();
            const expiresAtMs = new Date(expiresAt).getTime();

            // Ελέγχουμε αν λήγει σε > 5 λεπτά (proactive refresh)
            const refreshThreshold = config.ergani.jwtRefreshBeforeExpirySec * 1000;

            if ((expiresAtMs - now) > refreshThreshold) {
                // Token ακόμα OK — χρήση cached
                logger.debug({ branchId: branch.id }, 'JWT cache hit — χρήση cached token');
                return accessToken;
            }

            logger.info({ branchId: branch.id }, 'JWT token λήγει σύντομα — proactive refresh');
        }

        // --- Βήμα 2: Fresh authentication ---
        // Αποκρυπτογράφηση credentials από τη βάση (AES-256-GCM)
        const username = decrypt(branch.ergani_username_encrypted);
        const password = decrypt(branch.ergani_password_encrypted);

        // Αυθεντικοποίηση στο ΕΡΓΑΝΗ
        const { accessToken, expiresIn } = await authenticate(username, password);

        // --- Βήμα 3: Αποθήκευση στο Redis ---
        const expiresAt = new Date(Date.now() + (expiresIn * 1000)).toISOString();

        await redis.setex(
            cacheKey,
            expiresIn,           // TTL σε δευτερόλεπτα
            JSON.stringify({ accessToken, expiresAt })
        );

        logger.info({ branchId: branch.id }, 'Νέο JWT token αποθηκεύτηκε στο cache');

        return accessToken;

    } catch (err) {
        logger.error({ err, branchId: branch.id }, 'Σφάλμα λήψης JWT token');
        throw err;
    }
}

/**
 * Ακύρωση cached JWT token
 * 
 * Καλείται σε:
 * - 401 response (token expired πριν το αναμενόμενο)
 * - Αλλαγή credentials από τον εργοδότη
 * 
 * @param {string} branchId - ID παραρτήματος
 */
async function invalidateToken(branchId) {
    const cacheKey = `${JWT_REDIS_PREFIX}${branchId}`;
    await redis.del(cacheKey);
    logger.info({ branchId }, 'JWT token ακυρώθηκε (cache invalidation)');
}

module.exports = { authenticate, getToken, invalidateToken };
