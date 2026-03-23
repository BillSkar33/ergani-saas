/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — SaaS Platform
 * ΕΡΓΑΝΗ ΙΙ API — Error Mapper
 * 
 * Μετατρέπει τα τεχνικά σφάορματα του ΕΡΓΑΝΗ ΙΙ API
 * σε φιλικά μηνύματα στα Ελληνικά για τον εργαζόμενο
 * και τον εργοδότη.
 * 
 * Κρίσιμο: Ο εργαζόμενος δεν πρέπει να βλέπει τεχνικά
 * HTTP errors — μόνο κατανοητά μηνύματα στα Ελληνικά.
 * ============================================================
 */

'use strict';

const logger = require('../../shared/logger');

/**
 * Χάρτης σφαλμάτων ΕΡΓΑΝΗ → φιλικά μηνύματα
 * 
 * Δομή:
 * - employeeMessage: Μήνυμα προς τον εργαζόμενο (μέσω chatbot)
 * - employerMessage: Μήνυμα προς τον εργοδότη (στο portal)
 * - isRetryable: Αν αξίζει retry (5xx ναι, 400 όχι)
 * - notifyEmployer: Αν πρέπει να ειδοποιηθεί ο εργοδότης
 * - severity: Σοβαρότητα (low/medium/high/critical)
 */
const ERROR_MAP = {
    // --- 400 Bad Request — Λάθος δεδομένα ---
    400: {
        default: {
            employeeMessage: 'Υπήρξε σφάλμα με τα στοιχεία σας. Παρακαλώ επικοινωνήστε με τον εργοδότη σας.',
            employerMessage: 'Σφάλμα υποβολής στο ΕΡΓΑΝΗ (400): Ελέγξτε τα στοιχεία του εργαζομένου.',
            isRetryable: false,
            notifyEmployer: true,
            severity: 'high',
        },
        // Ειδικά μηνύματα βάσει response body
        patterns: [
            {
                // Μη αυθεντικοποιημένος χρήστης
                match: /Service Code is not authenticated/i,
                employeeMessage: 'Σφάλμα σύνδεσης με το ΕΡΓΑΝΗ. Ειδοποιήθηκε ο εργοδότης σας.',
                employerMessage: 'Τα credentials ΕΡΓΑΝΗ δεν είναι έγκυρα. Ελέγξτε username/password στο portal.',
                isRetryable: false,
                notifyEmployer: true,
                severity: 'critical',
            },
            {
                // Λάθος ΑΦΜ
                match: /afm|ΑΦΜ|invalid.*tax/i,
                employeeMessage: 'Ελέγξτε τα στοιχεία σας στο portal — πιθανό σφάλμα ΑΦΜ.',
                employerMessage: 'Λάθος ΑΦΜ εργαζομένου ή εργοδότη. Ελέγξτε τα στοιχεία.',
                isRetryable: false,
                notifyEmployer: true,
                severity: 'high',
            },
            {
                // Μη εξουσιοδοτημένη ενέργεια
                match: /unauthorized|not authorized|δεν.*εξουσ/i,
                employeeMessage: 'Δεν υπάρχει εξουσιοδότηση για αυτή την ενέργεια. Επικοινωνήστε με τον εργοδότη.',
                employerMessage: 'Ο Branch User δεν έχει δικαίωμα υποβολής κάρτας εργασίας. Ελέγξτε τα δικαιώματα στο ΕΡΓΑΝΗ.',
                isRetryable: false,
                notifyEmployer: true,
                severity: 'critical',
            },
            {
                // Λάθος ημερομηνία
                match: /date|ημερομηνία|f_date|f_reference_date/i,
                employeeMessage: 'Σφάλμα ημερομηνίας. Δοκιμάστε ξανά ή επικοινωνήστε με τον εργοδότη.',
                employerMessage: 'Σφάλμα ημερομηνίας στην υποβολή κάρτας. Ελέγξτε timezone και reference date.',
                isRetryable: false,
                notifyEmployer: true,
                severity: 'high',
            },
        ],
    },

    // --- 401 Unauthorized — Λήξη token ---
    401: {
        default: {
            employeeMessage: null, // Αυτόματο retry — ο εργαζόμενος δεν βλέπει τίποτα
            employerMessage: 'JWT token λήξη — αυτόματο refresh σε εξέλιξη.',
            isRetryable: true,
            notifyEmployer: false,
            severity: 'low',
        },
    },

    // --- 403 Forbidden ---
    403: {
        default: {
            employeeMessage: 'Δεν επιτρέπεται η πρόσβαση. Επικοινωνήστε με τον εργοδότη.',
            employerMessage: 'Απαγόρευση πρόσβασης ΕΡΓΑΝΗ (403). Ελέγξτε credentials και δικαιώματα.',
            isRetryable: false,
            notifyEmployer: true,
            severity: 'critical',
        },
    },

    // --- 500 Internal Server Error — ΕΡΓΑΝΗ down ---
    500: {
        default: {
            employeeMessage: 'Το ΕΡΓΑΝΗ δεν ανταποκρίνεται αυτή τη στιγμή. Η κάρτα σας θα υποβληθεί αυτόματα μόλις αποκατασταθεί.',
            employerMessage: 'Σφάλμα εξυπηρετητή ΕΡΓΑΝΗ (500). Αυτόματο retry σε εξέλιξη.',
            isRetryable: true,
            notifyEmployer: false,
            severity: 'medium',
        },
    },

    // --- 503 Service Unavailable — ΕΡΓΑΝΗ maintenance ---
    503: {
        default: {
            employeeMessage: 'Το ΕΡΓΑΝΗ βρίσκεται σε συντήρηση. Η κάρτα σας θα υποβληθεί αυτόματα μόλις επανέλθει.',
            employerMessage: 'Το ΕΡΓΑΝΗ είναι εκτός λειτουργίας (503). Αυτόματο retry σε εξέλιξη.',
            isRetryable: true,
            notifyEmployer: false,
            severity: 'medium',
        },
    },
};

/**
 * Μετατροπή σφάλματος ΕΡΓΑΝΗ σε φιλικό μήνυμα
 * 
 * Η συνάρτηση ελέγχει:
 * 1. Τον HTTP status code
 * 2. Το response body για specific patterns (regex matching)
 * 3. Αν δεν βρεθεί match → επιστρέφει default error
 * 
 * @param {number} httpStatus - HTTP status code απάντησης ΕΡΓΑΝΗ
 * @param {Object|string} responseBody - Response body ΕΡΓΑΝΗ
 * @returns {Object} - Mapped error object:
 *   - employeeMessage: Μήνυμα chatbot (ελληνικά)
 *   - employerMessage: Μήνυμα portal (ελληνικά)
 *   - isRetryable: Boolean
 *   - notifyEmployer: Boolean
 *   - severity: string
 */
function mapErganiError(httpStatus, responseBody) {
    // Μετατροπή response body σε string για pattern matching
    const bodyText = typeof responseBody === 'string'
        ? responseBody
        : JSON.stringify(responseBody || {});

    // Αναζήτηση στον error map βάσει status code
    const statusEntry = ERROR_MAP[httpStatus];

    if (statusEntry) {
        // Έλεγχος specific patterns (αν υπάρχουν)
        if (statusEntry.patterns) {
            for (const pattern of statusEntry.patterns) {
                if (pattern.match.test(bodyText)) {
                    logger.debug({
                        httpStatus,
                        matchedPattern: pattern.match.toString(),
                    }, 'ΕΡΓΑΝΗ error — pattern match');

                    return {
                        employeeMessage: pattern.employeeMessage,
                        employerMessage: pattern.employerMessage,
                        isRetryable: pattern.isRetryable,
                        notifyEmployer: pattern.notifyEmployer,
                        severity: pattern.severity,
                    };
                }
            }
        }

        // Επιστροφή default για αυτό το status code
        return statusEntry.default;
    }

    // --- Timeout / Network Error ---
    if (!httpStatus) {
        return {
            employeeMessage: 'Πρόβλημα σύνδεσης με το ΕΡΓΑΝΗ. Η κάρτα σας θα υποβληθεί αυτόματα.',
            employerMessage: 'Timeout ή σφάλμα δικτύου κατά τη σύνδεση με ΕΡΓΑΝΗ.',
            isRetryable: true,
            notifyEmployer: false,
            severity: 'medium',
        };
    }

    // --- Άγνωστο σφάλμα ---
    logger.warn({ httpStatus, bodyText: bodyText.substring(0, 200) }, 'Άγνωστο ΕΡΓΑΝΗ error');

    return {
        employeeMessage: 'Προέκυψε σφάλμα. Η κάρτα σας θα υποβληθεί αυτόματα.',
        employerMessage: `Μη αναμενόμενο σφάλμα ΕΡΓΑΝΗ (HTTP ${httpStatus}). Ελέγξτε το audit log.`,
        isRetryable: httpStatus >= 500,
        notifyEmployer: true,
        severity: 'high',
    };
}

module.exports = { mapErganiError, ERROR_MAP };
