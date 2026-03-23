/**
 * ============================================================
 * UNIT TESTS: Webhook Signature Verification
 * 
 * Τεστάρει την επαλήθευση υπογραφής webhook
 * ανά πλατφόρμα (Viber, Telegram, WhatsApp).
 * ============================================================
 */

const crypto = require('crypto');
const {
    verifyViberSignature,
    verifyTelegramSecret,
    verifyWhatsAppSignature,
} = require('../../services/webhook-gateway/middleware/signature-verify');

// Mock config
jest.mock('../../shared/config', () => ({
    webhooks: {
        viber: { authToken: 'test-viber-auth-token' },
        telegram: { secretToken: 'test-telegram-secret' },
        whatsapp: { appSecret: 'test-whatsapp-secret' },
    },
}));

describe('Webhook Signature Verification', () => {

    // === VIBER ===
    describe('Viber — HMAC-SHA256', () => {
        test('valid υπογραφή πρέπει να επιστρέφει true', () => {
            const body = '{"event":"message","timestamp":123}';
            const signature = crypto
                .createHmac('sha256', 'test-viber-auth-token')
                .update(body)
                .digest('hex');

            expect(verifyViberSignature(body, signature)).toBe(true);
        });

        test('invalid υπογραφή πρέπει να επιστρέφει false', () => {
            const body = '{"event":"message"}';
            expect(verifyViberSignature(body, 'invalid_hex_signature_here_0000')).toBe(false);
        });

        test('τροποποιημένο body πρέπει να αποτυγχάνει', () => {
            const originalBody = '{"event":"message"}';
            const signature = crypto
                .createHmac('sha256', 'test-viber-auth-token')
                .update(originalBody)
                .digest('hex');

            // Τροποποιημένο body — δεν ταιριάζει
            expect(verifyViberSignature('{"event":"hack"}', signature)).toBe(false);
        });
    });

    // === TELEGRAM ===
    describe('Telegram — Secret Token', () => {
        test('valid secret token πρέπει να επιστρέφει true', () => {
            expect(verifyTelegramSecret('test-telegram-secret')).toBe(true);
        });

        test('invalid secret token πρέπει να επιστρέφει false', () => {
            expect(verifyTelegramSecret('wrong-secret')).toBe(false);
        });

        test('κενό token πρέπει να επιστρέφει false', () => {
            expect(verifyTelegramSecret('')).toBe(false);
        });
    });

    // === WHATSAPP ===
    describe('WhatsApp — SHA256 HMAC', () => {
        test('valid υπογραφή πρέπει να επιστρέφει true', () => {
            const body = '{"object":"whatsapp_business_account"}';
            const expectedSig = crypto
                .createHmac('sha256', 'test-whatsapp-secret')
                .update(body)
                .digest('hex');

            expect(verifyWhatsAppSignature(body, `sha256=${expectedSig}`)).toBe(true);
        });

        test('invalid υπογραφή πρέπει να επιστρέφει false', () => {
            const body = '{"object":"whatsapp"}';
            expect(verifyWhatsAppSignature(body, 'sha256=wrong_signature_here')).toBe(false);
        });
    });
});
