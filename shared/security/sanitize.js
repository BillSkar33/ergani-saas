/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — Security Module
 * Input Sanitization (XSS Protection)
 * 
 * Αποτρέπει Stored/Reflected XSS επιθέσεις μέσω
 * καθαρισμού HTML entities σε user input.
 * Χρησιμοποιείται σε ΟΛΕΣ τις φόρμες εισαγωγής.
 * ============================================================
 */
'use strict';

/**
 * Αντικατάσταση επικίνδυνων HTML χαρακτήρων
 * Μετατρέπει < > " ' & ` σε HTML entities
 * 
 * @param {string} str - Ακαθάριστο input
 * @returns {string} - Καθαρισμένο output
 * 
 * @example
 *   sanitizeHtml('<script>alert(1)</script>')
 *   → '&lt;script&gt;alert(1)&lt;/script&gt;'
 */
function sanitizeHtml(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[<>"'&`]/g, (char) => ({
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '&': '&amp;',
        '`': '&#96;',
    }[char]));
}

/**
 * Αφαίρεση SQL-like patterns από input
 * Επιπλέον προστασία πάνω από parameterized queries
 * 
 * @param {string} str - Input string
 * @returns {string} - Καθαρισμένο string
 */
function sanitizeSql(str) {
    if (typeof str !== 'string') return str;
    // Αφαίρεση κλασικών SQL injection patterns
    return str.replace(/['";\\]|--|\b(DROP|DELETE|INSERT|UPDATE|ALTER|EXEC|UNION|SELECT)\b/gi, '');
}

/**
 * Καθαρισμός object — εφαρμόζει sanitizeHtml σε ΟΛΑ τα string πεδία
 * 
 * @param {Object} obj - Object με πεδία
 * @returns {Object} - Καθαρισμένο object
 */
function sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const clean = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            clean[key] = sanitizeHtml(value);
        } else if (typeof value === 'object' && value !== null) {
            clean[key] = sanitizeObject(value);
        } else {
            clean[key] = value;
        }
    }
    return clean;
}

/**
 * Validation: ΑΦΜ (9 ψηφία, αριθμητικό)
 * @param {string} afm
 * @returns {boolean}
 */
function isValidAfm(afm) {
    return /^\d{9}$/.test(afm);
}

/**
 * Validation: Email (basic check)
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Password strength validation
 * Απαιτεί: min 8 χαρακτήρες, 1 κεφαλαίο, 1 αριθμό, 1 ειδικό
 * 
 * @param {string} password
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validatePasswordStrength(password) {
    const errors = [];
    if (!password || password.length < 8) errors.push('Τουλάχιστον 8 χαρακτήρες');
    if (!/[A-Z]/.test(password)) errors.push('Τουλάχιστον 1 κεφαλαίο γράμμα');
    if (!/[0-9]/.test(password)) errors.push('Τουλάχιστον 1 αριθμό');
    if (!/[!@#$%^&*()_+\-=\[\]{};':"|,.<>?]/.test(password)) errors.push('Τουλάχιστον 1 ειδικό χαρακτήρα');

    // Κοινοί αδύναμοι κωδικοί
    const weak = ['12345678', 'password', 'qwerty123', '11111111', 'admin123', 'letmein1'];
    if (weak.includes(password.toLowerCase())) errors.push('Πολύ κοινός κωδικός');

    return { valid: errors.length === 0, errors };
}

module.exports = {
    sanitizeHtml,
    sanitizeSql,
    sanitizeObject,
    isValidAfm,
    isValidEmail,
    validatePasswordStrength,
};
