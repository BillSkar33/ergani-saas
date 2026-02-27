/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — SaaS Platform
 * Module Κρυπτογράφησης (AES-256-GCM)
 * 
 * Χρησιμοποιείται για κρυπτογράφηση/αποκρυπτογράφηση
 * των credentials ΕΡΓΑΝΗ (username, password) που αποθηκεύονται
 * στον πίνακα branches. Χρήση AES-256-GCM για authenticated
 * encryption (αποτρέπει tampering).
 * ============================================================
 */

'use strict';

const crypto = require('crypto');
const config = require('../config');

// Σταθερές κρυπτογράφησης
const ALGORITHM = 'aes-256-gcm';       // Αλγόριθμος: AES 256-bit σε GCM mode
const IV_LENGTH = config.encryption.ivLength || 16;  // Μέγεθος Initialization Vector (bytes)
const AUTH_TAG_LENGTH = 16;             // Μέγεθος authentication tag (bytes)
const KEY_ENCODING = 'hex';            // Κωδικοποίηση κλειδιού

/**
 * Κρυπτογράφηση κειμένου με AES-256-GCM
 * 
 * Η διαδικασία:
 * 1. Δημιουργεί τυχαίο IV (Initialization Vector) — μοναδικό ανά κρυπτογράφηση
 * 2. Κρυπτογραφεί τα δεδομένα με AES-256-GCM
 * 3. Εξάγει το authentication tag (αποτρέπει αλλοίωση)
 * 4. Συνενώνει IV + authTag + κρυπτογράφημα σε ένα Buffer
 * 
 * @param {string} plainText - Το κείμενο προς κρυπτογράφηση (π.χ. password ΕΡΓΑΝΗ)
 * @returns {Buffer} - Κρυπτογραφημένα δεδομένα (IV + authTag + ciphertext)
 * @throws {Error} - Αν το κλειδί κρυπτογράφησης δεν έχει οριστεί
 */
function encrypt(plainText) {
    // Έλεγχος ότι υπάρχει κλειδί κρυπτογράφησης
    if (!config.encryption.key) {
        throw new Error('Δεν έχει οριστεί κλειδί κρυπτογράφησης (ENCRYPTION_KEY)');
    }

    // Μετατροπή κλειδιού από hex string σε Buffer (32 bytes)
    const key = Buffer.from(config.encryption.key, KEY_ENCODING);

    // Δημιουργία τυχαίου IV — κρίσιμο για ασφάλεια, πρέπει να είναι μοναδικό
    const iv = crypto.randomBytes(IV_LENGTH);

    // Δημιουργία cipher αντικειμένου με τον αλγόριθμο AES-256-GCM
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
        authTagLength: AUTH_TAG_LENGTH,
    });

    // Κρυπτογράφηση: μετατροπή κειμένου σε κρυπτογράφημα
    const encrypted = Buffer.concat([
        cipher.update(plainText, 'utf8'),   // Κρυπτογράφηση κυρίως μέρους
        cipher.final(),                     // Ολοκλήρωση κρυπτογράφησης
    ]);

    // Εξαγωγή authentication tag — αποτρέπει unauthorized αλλαγές
    const authTag = cipher.getAuthTag();

    // Συνένωση: [IV (16 bytes)] + [AuthTag (16 bytes)] + [Ciphertext]
    // Αυτή η δομή επιτρέπει εύκολη αποκρυπτογράφηση χωρίς ξεχωριστή αποθήκευση
    return Buffer.concat([iv, authTag, encrypted]);
}

/**
 * Αποκρυπτογράφηση δεδομένων AES-256-GCM
 * 
 * Η αντίστροφη διαδικασία:
 * 1. Εξάγει IV από τα πρώτα 16 bytes
 * 2. Εξάγει authTag από τα επόμενα 16 bytes
 * 3. Το υπόλοιπο είναι το ciphertext
 * 4. Αποκρυπτογραφεί και επαληθεύει την ακεραιότητα
 * 
 * @param {Buffer} encryptedData - Τα κρυπτογραφημένα δεδομένα (IV + authTag + ciphertext)
 * @returns {string} - Το αρχικό κείμενο (plaintext)
 * @throws {Error} - Αν η αποκρυπτογράφηση αποτύχει (λάθος κλειδί ή αλλοιωμένα δεδομένα)
 */
function decrypt(encryptedData) {
    // Έλεγχος ότι υπάρχει κλειδί κρυπτογράφησης
    if (!config.encryption.key) {
        throw new Error('Δεν έχει οριστεί κλειδί κρυπτογράφησης (ENCRYPTION_KEY)');
    }

    // Μετατροπή κλειδιού από hex string σε Buffer
    const key = Buffer.from(config.encryption.key, KEY_ENCODING);

    // Εξαγωγή IV: πρώτα 16 bytes
    const iv = encryptedData.subarray(0, IV_LENGTH);

    // Εξαγωγή authentication tag: επόμενα 16 bytes
    const authTag = encryptedData.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);

    // Εξαγωγή ciphertext: υπόλοιπα bytes
    const ciphertext = encryptedData.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    // Δημιουργία decipher αντικειμένου
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
        authTagLength: AUTH_TAG_LENGTH,
    });

    // Ορισμός auth tag για επαλήθευση ακεραιότητας
    decipher.setAuthTag(authTag);

    // Αποκρυπτογράφηση
    const decrypted = Buffer.concat([
        decipher.update(ciphertext),        // Αποκρυπτογράφηση κυρίως μέρους
        decipher.final(),                   // Ολοκλήρωση + επαλήθευση authTag
    ]);

    return decrypted.toString('utf8');
}

module.exports = { encrypt, decrypt };
