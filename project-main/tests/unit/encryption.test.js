/**
 * ============================================================
 * UNIT TESTS: AES-256-GCM Encryption
 * 
 * Τεστάρει κρυπτογράφηση/αποκρυπτογράφηση credentials ΕΡΓΑΝΗ.
 * ============================================================
 */

// Mock config πριν φορτωθεί το encryption module
jest.mock('../../shared/config', () => ({
    encryption: {
        key: 'a'.repeat(64), // 32 bytes σε hex (64 χαρακτήρες)
        ivLength: 16,
    },
}));

const { encrypt, decrypt } = require('../../shared/encryption');

describe('AES-256-GCM Encryption', () => {
    test('encrypt → decrypt πρέπει να επιστρέφει το αρχικό κείμενο', () => {
        const plainText = 'MySecretPassword123!';
        const encrypted = encrypt(plainText);
        const decrypted = decrypt(encrypted);
        expect(decrypted).toBe(plainText);
    });

    test('ελληνικοί χαρακτήρες πρέπει να κρυπτογραφούνται σωστά', () => {
        const plainText = 'Κωδικός123_Τεστ!';
        const encrypted = encrypt(plainText);
        const decrypted = decrypt(encrypted);
        expect(decrypted).toBe(plainText);
    });

    test('δύο κρυπτογραφήσεις του ίδιου κειμένου πρέπει να δίνουν διαφορετικό αποτέλεσμα', () => {
        const plainText = 'SameText';
        const enc1 = encrypt(plainText);
        const enc2 = encrypt(plainText);
        // Λόγω τυχαίου IV, τα αποτελέσματα πρέπει να είναι διαφορετικά
        expect(Buffer.compare(enc1, enc2)).not.toBe(0);
    });

    test('αποκρυπτογράφηση αλλοιωμένων δεδομένων πρέπει να πετάει error', () => {
        const plainText = 'TestData';
        const encrypted = encrypt(plainText);
        // Αλλοίωση ενός byte
        encrypted[encrypted.length - 1] ^= 0xFF;
        expect(() => decrypt(encrypted)).toThrow();
    });

    test('κενό string πρέπει να κρυπτογραφείται', () => {
        const encrypted = encrypt('');
        const decrypted = decrypt(encrypted);
        expect(decrypted).toBe('');
    });

    test('πολύ μεγάλο string πρέπει να κρυπτογραφείται', () => {
        const longText = 'A'.repeat(10000);
        const encrypted = encrypt(longText);
        const decrypted = decrypt(encrypted);
        expect(decrypted).toBe(longText);
    });
});
