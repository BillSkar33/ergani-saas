/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — SaaS Platform
 * Template Engine — Πρότυπα Μηνυμάτων Chatbot (Ελληνικά)
 * 
 * Κεντρικό σημείο για όλα τα μηνύματα που στέλνει το chatbot
 * στους εργαζομένους. Κάθε μήνυμα είναι σε φιλικά Ελληνικά.
 * 
 * Η συνάρτηση sendMessage() αυτόματα δρομολογεί στον
 * κατάλληλο sender ανάλογα με την πλατφόρμα.
 * ============================================================
 */

'use strict';

const logger = require('../../shared/logger');

// --- Εισαγωγή platform-specific senders ---
const telegramSender = require('./telegram-sender');
const viberSender = require('./viber-sender');
const whatsappSender = require('./whatsapp-sender');

/**
 * Πρότυπα μηνυμάτων στα Ελληνικά
 * 
 * Κάθε template μπορεί να περιέχει placeholders: {{key}}
 * που αντικαθίστανται με τιμές από το data object.
 */
const TEMPLATES = {
    // --- Εγγραφή ---
    welcome: {
        text: '🏢 Καλωσόρισες στην Ψηφιακή Κάρτα Εργασίας!\n\n' +
            'Για να ξεκινήσεις, εισήγαγε τον 6ψήφιο κωδικό σύνδεσης\n' +
            'που σου έδωσε ο εργοδότης σου.\n\n' +
            '📌 Παράδειγμα: 123456',
    },

    registration_success: {
        text: '✅ Καλωσόρισες, {{name}}! \n\n' +
            'Η εγγραφή σου ολοκληρώθηκε επιτυχώς.\n' +
            'Μπορείς τώρα να χτυπήσεις κάρτα!\n\n' +
            '📍 Στείλε την τοποθεσία σου για ΕΝΑΡΞΗ βάρδιας.',
    },

    already_registered: {
        text: 'ℹ️ {{name}}, είστε ήδη εγγεγραμμένος/η.\n\n' +
            '📍 Στείλε τοποθεσία για check-in/check-out.',
    },

    invalid_code: {
        text: '❌ Ο κωδικός δεν αντιστοιχεί σε καμία επιχείρηση.\n\n' +
            'Ελέγξτε ότι πληκτρολογήσατε σωστά τον 6ψήφιο κωδικό\n' +
            'και δοκιμάστε ξανά.',
    },

    expired_code: {
        text: '⏰ Ο κωδικός σύνδεσης έχει λήξει.\n\n' +
            'Ζητήστε νέο κωδικό από τον εργοδότη σας.',
    },

    unregistered: {
        text: '⚠️ Δεν είστε εγγεγραμμένος/η.\n\n' +
            'Πατήστε /start ή στείλτε "ΕΓΓΡΑΦΗ" για να ξεκινήσετε.',
    },

    // --- Check-in ---
    checkin_success: {
        text: '✅ Η βάρδια ξεκίνησε στις {{time}}.\n\n' +
            'Η κάρτα εργασίας σας υποβλήθηκε στο ΕΡΓΑΝΗ.\n' +
            '📍 Στείλτε τοποθεσία ξανά για ΛΗΞΗ βάρδιας.',
    },

    checkin_pending: {
        text: '⏳ Η κάρτα εργασίας σας καταγράφηκε.\n\n' +
            'Αναμονή επιβεβαίωσης από το ΕΡΓΑΝΗ.\n' +
            'Θα ειδοποιηθείτε αυτόματα.',
    },

    duplicate_checkin: {
        text: '⚠️ Έχετε ήδη δηλώσει έναρξη βάρδιας σήμερα.\n\n' +
            'Στείλτε τοποθεσία για ΛΗΞΗ βάρδιας.',
    },

    // --- Check-out ---
    checkout_success: {
        text: '✅ Η βάρδια ολοκληρώθηκε στις {{time}}.\n' +
            '⏱️ Διάρκεια: {{duration}}\n\n' +
            'Καλή ξεκούραση! 👋',
    },

    checkout_pending: {
        text: '⏳ Η αποχώρησή σας καταγράφηκε.\n\n' +
            'Αναμονή επιβεβαίωσης από το ΕΡΓΑΝΗ.',
    },

    no_checkin: {
        text: '⚠️ Δεν υπάρχει ενεργή βάρδια σήμερα.\n\n' +
            'Πρέπει πρώτα να κάνετε ΕΝΑΡΞΗ βάρδιας.',
    },

    // --- Geofencing ---
    geofence_rejected: {
        text: '📍 Δεν βρίσκεστε κοντά στο κατάστημα.\n\n' +
            'Απόσταση: {{distance}}m (μέγιστο: {{radius}}m)\n\n' +
            'Μετακινηθείτε πιο κοντά και δοκιμάστε ξανά.',
    },

    low_accuracy: {
        text: '📡 Αδυναμία ακριβούς εντοπισμού θέσης.\n\n' +
            'Ακρίβεια GPS: {{accuracy}}m \n\n' +
            '💡 Συμβουλή: Ανοίξτε το GPS, βγείτε σε ανοιχτό χώρο,\n' +
            'και δοκιμάστε ξανά σε 30 δευτερόλεπτα.',
    },

    // --- Status ---
    status_active: {
        text: '📊 Κατάσταση Βάρδιας:\n\n' +
            '🟢 Ενεργή βάρδια\n' +
            '⏰ Έναρξη: {{checkInTime}}\n' +
            '⏱️ Διάρκεια: {{duration}}\n' +
            '📋 ΕΡΓΑΝΗ: {{erganiStatus}}',
    },

    status_completed: {
        text: '📊 Η σημερινή βάρδια έχει ολοκληρωθεί. ✅',
    },

    status_no_shift: {
        text: '📊 Δεν υπάρχει βάρδια σήμερα.\n\n' +
            'Στείλτε τοποθεσία για ΕΝΑΡΞΗ βάρδιας.',
    },

    // --- History ---
    history_empty: {
        text: '📋 Δεν υπάρχει ιστορικό βαρδιών.\n\n' +
            'Στείλτε τοποθεσία για την πρώτη σας βάρδια!',
    },

    history: {
        text: '📋 Τελευταίες βάρδιες:\n{{entries}}',
        format: (data) => {
            if (!data.entries || data.entries.length === 0) return 'Κανένα';
            return data.entries.map(e => {
                const type = e.action_type === 'check_in' ? '🟢 Έναρξη' : '🔴 Λήξη';
                const date = new Date(e.event_timestamp).toLocaleDateString('el-GR');
                const time = new Date(e.event_timestamp).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
                return `${type} ${date} ${time}`;
            }).join('\n');
        },
    },

    // --- Βοήθεια ---
    help: {
        text: '📖 Οδηγίες Χρήσης:\n\n' +
            '📍 Στείλτε τοποθεσία → Αυτόματο check-in/check-out\n' +
            '📊 ΚΑΤΑΣΤΑΣΗ → Τρέχουσα βάρδια\n' +
            '📋 ΙΣΤΟΡΙΚΟ → Τελευταίες βάρδιες\n' +
            '❓ ΒΟΗΘΕΙΑ → Αυτές οι οδηγίες\n\n' +
            '💡 Συμβουλή: Ενεργοποιήστε το GPS πριν στείλετε τοποθεσία.',
    },

    // --- Γενικά σφάλματα ---
    generic_error: {
        text: '⚠️ Προέκυψε ένα πρόσθετο σφάλμα.\n\n' +
            'Παρακαλώ δοκιμάστε ξανά σε λίγο.\n' +
            'Αν το πρόβλημα παραμένει, επικοινωνήστε με τον εργοδότη σας.',
    },

    no_branch: {
        text: '⚠️ Δεν βρέθηκε καταχωρημένο κατάστημα.\n\n' +
            'Επικοινωνήστε με τον εργοδότη σας.',
    },

    // --- Υπενθυμίσεις (CRON) ---
    checkout_reminder: {
        text: '⏰ Υπενθύμιση: Η βάρδια σας ολοκληρώνεται σε 5 λεπτά.\n\n' +
            'Μην ξεχάσετε να στείλετε τοποθεσία για ΛΗΞΗ βάρδιας.',
    },

    // --- Ωράριο / Άδειες ---
    schedule_blocked: {
        text: '🚫 {{message}}',
    },

    schedule_late: {
        text: '⏰ Αργοπορία: {{message}}\n\n' +
            'H βάρδια σας καταγράφηκε.',
    },
};

/**
 * Αποστολή μηνύματος σε εργαζόμενο
 * 
 * Επιλέγει αυτόματα τον σωστό sender (Telegram/Viber/WhatsApp)
 * και αντικαθιστά τα placeholders {{key}} με πραγματικά δεδομένα.
 * 
 * @param {string} platform - 'telegram', 'viber', ή 'whatsapp'
 * @param {string} userId - Platform-specific user ID
 * @param {string} templateName - Όνομα template (π.χ. 'checkin_success')
 * @param {Object} [data={}] - Δεδομένα για αντικατάσταση placeholders
 */
async function sendMessage(platform, userId, templateName, data = {}) {
    // Εύρεση template
    const template = TEMPLATES[templateName];
    if (!template) {
        logger.error({ templateName }, 'Δεν βρέθηκε template μηνύματος');
        return;
    }

    // Αντικατάσταση placeholders {{key}} → τιμή
    let text = template.text;

    // Ειδικός χειρισμός (αν υπάρχει custom format function)
    if (template.format) {
        const formatted = template.format(data);
        text = text.replace('{{entries}}', formatted);
    }

    // Γενική αντικατάσταση placeholders
    for (const [key, value] of Object.entries(data)) {
        text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
    }

    // Δρομολόγηση στον κατάλληλο sender
    try {
        switch (platform) {
            case 'telegram':
                await telegramSender.sendText(userId, text);
                break;
            case 'viber':
                await viberSender.sendText(userId, text);
                break;
            case 'whatsapp':
                await whatsappSender.sendText(userId, text);
                break;
            default:
                logger.error({ platform }, 'Άγνωστη πλατφόρμα αποστολής');
        }
    } catch (err) {
        logger.error({ err, platform, userId, templateName }, 'Σφάλμα αποστολής μηνύματος');
    }
}

module.exports = { sendMessage, TEMPLATES };
