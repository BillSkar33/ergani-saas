/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — SaaS Platform
 * ΕΡΓΑΝΗ ΙΙ API — WRKCardSE Payload Builder
 * 
 * Δημιουργεί τα JSON payloads για υποβολή κάρτας εργασίας
 * στο ΕΡΓΑΝΗ ΙΙ API (endpoint: /Documents/WRKCardSE).
 * 
 * ΚΡΙΣΙΜΑ ΣΗΜΕΙΑ:
 * 1. f_date ΠΡΕΠΕΙ να είναι ISO 8601 με σωστό timezone (+02:00 EET ή +03:00 EEST)
 * 2. f_reference_date = ημερομηνία ΕΝΑΡΞΗΣ βάρδιας (ακόμα κι αν check-out μετά μεσάνυχτα)
 * 3. f_eponymo & f_onoma ΠΡΕΠΕΙ να ταυτίζονται ΑΚΡΙΒΩΣ με το μητρώο ΕΡΓΑΝΗ (ΚΕΦΑΛΑΙΑ)
 * 4. f_type: 0 = Έναρξη, 1 = Λήξη
 * ============================================================
 */

'use strict';

const { DateTime } = require('luxon');
const logger = require('../../shared/logger');

// Timezone Ελλάδας — χειρίζεται αυτόματα EET↔EEST switch
const GREECE_TIMEZONE = 'Europe/Athens';

/**
 * Μορφοποίηση ημερομηνίας/ώρας σε format ΕΡΓΑΝΗ
 * 
 * Το ΕΡΓΑΝΗ απαιτεί: "2026-02-26T08:58:37.4578278+02:00"
 * - ISO 8601 format
 * - Timezone offset (ΟΧΙ 'Z' — πάντα explicit offset)
 * - 7 δεκαδικά ψηφία στα δευτερόλεπτα
 * 
 * ΣΗΜΑΝΤΙΚΟ: Λάθος offset = λάθος ώρα στο ΕΡΓΑΝΗ = πρόστιμο!
 * 
 * @param {Date|string} date - Η ημερομηνία/ώρα (JavaScript Date ή ISO string)
 * @returns {string} - Μορφοποιημένη ημερομηνία (π.χ. "2026-02-26T08:02:15.1234567+02:00")
 */
function formatErganiDatetime(date) {
    // Μετατροπή σε Luxon DateTime με timezone Ελλάδας
    const dt = DateTime.fromJSDate(new Date(date), { zone: GREECE_TIMEZONE });

    // Σχηματισμός ISO string με explicit offset
    // Π.χ. "2026-02-26T08:02:15.123+02:00"
    const isoString = dt.toISO({
        includeOffset: true,         // Πάντα offset (π.χ. +02:00)
        suppressMilliseconds: false, // Κράτηση milliseconds
    });

    // Προσθήκη extra ψηφίων (το ΕΡΓΑΝΗ αναμένει 7 δεκαδικά)
    // Αν η Luxon δίνει 3 δεκαδικά, συμπληρώνουμε σε 7
    return isoString.replace(
        /\.(\d{3})\+/,
        (_, ms) => `.${ms}0000+`
    );
}

/**
 * Υπολογισμός f_reference_date
 * 
 * Η reference date είναι πάντα η ημερομηνία ΕΝΑΡΞΗΣ της βάρδιας:
 * - Check-in στις 23:00 → reference_date = σημερινή ημερομηνία
 * - Check-out στις 02:00 (μετά μεσάνυχτα) → reference_date = χτεσινή ημερομηνία
 * 
 * Αν ο τύπος είναι check-out, ελέγχουμε αν υπάρχει ανοιχτό check-in.
 * Αν ναι, χρησιμοποιούμε την ημερομηνία αναφοράς του check-in.
 * 
 * @param {Date|string} eventDate - Η ημερομηνία/ώρα του event
 * @param {string} [checkInReferenceDate] - Reference date του αντίστοιχου check-in (για check-out)
 * @returns {string} - Ημερομηνία αναφοράς σε format YYYY-MM-DD
 */
function calculateReferenceDate(eventDate, checkInReferenceDate = null) {
    // Αν υπάρχει reference date από check-in, χρησιμοποιούμε αυτήν
    // (σενάριο night shift: check-out μετά μεσάνυχτα)
    if (checkInReferenceDate) {
        return checkInReferenceDate;
    }

    // Αλλιώς, η reference date είναι η ημερομηνία του event
    const dt = DateTime.fromJSDate(new Date(eventDate), { zone: GREECE_TIMEZONE });
    return dt.toISODate(); // YYYY-MM-DD format
}

/**
 * Επαλήθευση ΑΦΜ (9 ψηφία, αριθμητικό μόνο)
 * 
 * @param {string} afm - ΑΦΜ προς έλεγχο
 * @returns {boolean} - true αν είναι valid
 */
function isValidAfm(afm) {
    return /^\d{9}$/.test(afm);
}

/**
 * Δημιουργία JSON payload WRKCardSE για υποβολή στο ΕΡΓΑΝΗ ΙΙ
 * 
 * @param {Object} params - Παράμετροι
 * @param {string} params.afmErgodoti - ΑΦΜ εργοδότη (9 ψηφία)
 * @param {string} params.branchNumber - Αριθμός παραρτήματος (f_aa)
 * @param {string} params.afmEmployee - ΑΦΜ εργαζομένου (9 ψηφία)
 * @param {string} params.eponymo - Επώνυμο εργαζομένου (ΚΕΦΑΛΑΙΑ)
 * @param {string} params.onoma - Όνομα εργαζομένου (ΚΕΦΑΛΑΙΑ)
 * @param {number} params.fType - 0 = Έναρξη, 1 = Λήξη
 * @param {Date|string} params.eventDate - Ημερομηνία/ώρα ενέργειας
 * @param {string} [params.checkInReferenceDate] - Reference date check-in (για check-out night shift)
 * @param {string} [params.comments] - Σχόλια (f_comments)
 * @param {string} [params.aitiologia] - Αιτιολογία (f_aitiologia, null αν δεν απαιτείται)
 * @param {string} [params.platform] - Πλατφόρμα αποστολής
 * 
 * @returns {Object} - Πλήρες JSON payload για POST /Documents/WRKCardSE
 * @throws {Error} - Αν λείπουν required πεδία ή τα δεδομένα δεν είναι valid
 */
function buildWRKCardSEPayload({
    afmErgodoti,
    branchNumber,
    afmEmployee,
    eponymo,
    onoma,
    fType,
    eventDate,
    checkInReferenceDate = null,
    comments = null,
    aitiologia = null,
    platform = 'unknown',
}) {
    // --- Validation (Επαλήθευση δεδομένων) ---

    if (!isValidAfm(afmErgodoti)) {
        throw new Error(`Μη έγκυρο ΑΦΜ εργοδότη: ${afmErgodoti} (πρέπει 9 ψηφία)`);
    }

    if (!isValidAfm(afmEmployee)) {
        throw new Error(`Μη έγκυρο ΑΦΜ εργαζομένου: ${afmEmployee} (πρέπει 9 ψηφία)`);
    }

    if (fType !== 0 && fType !== 1) {
        throw new Error(`Μη έγκυρος τύπος (f_type): ${fType} (0=Έναρξη, 1=Λήξη)`);
    }

    if (!eponymo || !onoma) {
        throw new Error('Απαιτούνται επώνυμο και όνομα');
    }

    // --- Δημιουργία Payload ---

    // Μορφοποίηση ημερομηνίας/ώρας στο format ΕΡΓΑΝΗ
    const fDate = formatErganiDatetime(eventDate);

    // Υπολογισμός reference date
    const fReferenceDate = calculateReferenceDate(eventDate, checkInReferenceDate);

    // Default comments αν δεν δοθούν
    const fComments = comments || `Υποβλήθηκε μέσω ${platform} chatbot`;

    // Δημιουργία του JSON payload σύμφωνα με τη δομή ΕΡΓΑΝΗ API
    const payload = {
        Cards: {
            Card: [
                {
                    f_afm_ergodoti: afmErgodoti,       // ΑΦΜ εργοδότη
                    f_aa: branchNumber,                 // Αριθμός παραρτήματος
                    f_comments: fComments,              // Σχόλια
                    CardDetails: [
                        {
                            f_afm: afmEmployee,             // ΑΦΜ εργαζομένου
                            f_eponymo: eponymo.toUpperCase(), // Επώνυμο (πάντα ΚΕΦΑΛΑΙΑ)
                            f_onoma: onoma.toUpperCase(),     // Όνομα (πάντα ΚΕΦΑΛΑΙΑ)
                            f_type: fType,                    // 0 = Έναρξη, 1 = Λήξη
                            f_reference_date: fReferenceDate, // Ημερομηνία αναφοράς
                            f_date: fDate,                    // Ακριβής χρόνος ενέργειας
                            f_aitiologia: aitiologia,         // Αιτιολογία (null αν δεν απαιτείται)
                        },
                    ],
                },
            ],
        },
    };

    logger.debug({
        afmErgodoti,
        branchNumber,
        fType: fType === 0 ? 'ΕΝΑΡΞΗ' : 'ΛΗΞΗ',
        fDate,
        fReferenceDate,
    }, 'Δημιουργία WRKCardSE payload');

    return payload;
}

module.exports = {
    buildWRKCardSEPayload,
    formatErganiDatetime,
    calculateReferenceDate,
    isValidAfm,
    GREECE_TIMEZONE,
};
