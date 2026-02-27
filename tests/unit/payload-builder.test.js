/**
 * ============================================================
 * UNIT TESTS: WRKCardSE Payload Builder
 * 
 * Τεστάρει τη δημιουργία JSON payloads για υποβολή
 * στο ΕΡΓΑΝΗ ΙΙ API. Κρίσιμο: timezone, reference dates,
 * ελληνικοί χαρακτήρες, ΑΦΜ validation.
 * ============================================================
 */

const {
    buildWRKCardSEPayload,
    formatErganiDatetime,
    calculateReferenceDate,
    isValidAfm,
} = require('../../services/ergani-client/payload-builder');

describe('WRKCardSE Payload Builder', () => {
    // --- Test 1: Valid check-in payload (f_type=0) ---
    test('valid check-in payload πρέπει να έχει σωστή δομή', () => {
        const payload = buildWRKCardSEPayload({
            afmErgodoti: '123456789',
            branchNumber: '0',
            afmEmployee: '987654321',
            eponymo: 'ΠΑΠΑΔΟΠΟΥΛΟΣ',
            onoma: 'ΓΕΩΡΓΙΟΣ',
            fType: 0,
            eventDate: new Date('2026-02-26T08:02:15.000+02:00'),
            platform: 'telegram',
        });

        // Έλεγχος δομής
        expect(payload.Cards).toBeDefined();
        expect(payload.Cards.Card).toHaveLength(1);
        expect(payload.Cards.Card[0].f_afm_ergodoti).toBe('123456789');
        expect(payload.Cards.Card[0].f_aa).toBe('0');
        expect(payload.Cards.Card[0].CardDetails).toHaveLength(1);

        const details = payload.Cards.Card[0].CardDetails[0];
        expect(details.f_afm).toBe('987654321');
        expect(details.f_eponymo).toBe('ΠΑΠΑΔΟΠΟΥΛΟΣ');
        expect(details.f_onoma).toBe('ΓΕΩΡΓΙΟΣ');
        expect(details.f_type).toBe(0);
    });

    // --- Test 2: f_type=1 για check-out ---
    test('check-out payload πρέπει να έχει f_type=1', () => {
        const payload = buildWRKCardSEPayload({
            afmErgodoti: '123456789',
            branchNumber: '0',
            afmEmployee: '987654321',
            eponymo: 'ΠΑΠΑΔΟΠΟΥΛΟΣ',
            onoma: 'ΓΕΩΡΓΙΟΣ',
            fType: 1,
            eventDate: new Date('2026-02-26T16:00:00.000+02:00'),
        });

        expect(payload.Cards.Card[0].CardDetails[0].f_type).toBe(1);
    });

    // --- Test 3: Ονόματα μετατρέπονται σε ΚΕΦΑΛΑΙΑ ---
    test('ονόματα πρέπει να μετατρέπονται σε ΚΕΦΑΛΑΙΑ', () => {
        const payload = buildWRKCardSEPayload({
            afmErgodoti: '123456789',
            branchNumber: '0',
            afmEmployee: '987654321',
            eponymo: 'Παπαδόπουλος',
            onoma: 'γεώργιος',
            fType: 0,
            eventDate: new Date(),
        });

        const details = payload.Cards.Card[0].CardDetails[0];
        expect(details.f_eponymo).toBe('ΠΑΠΑΔΌΠΟΥΛΟΣ');
        expect(details.f_onoma).toBe('ΓΕΏΡΓΙΟΣ');
    });

    // --- Test 4: Μη έγκυρο ΑΦΜ πρέπει να πετάει error ---
    test('μη έγκυρο ΑΦΜ εργοδότη πρέπει να πετάει error', () => {
        expect(() => {
            buildWRKCardSEPayload({
                afmErgodoti: '12345',   // Λάθος — 5 ψηφία αντί 9
                branchNumber: '0',
                afmEmployee: '987654321',
                eponymo: 'ΤΕΣΤ',
                onoma: 'ΤΕΣΤ',
                fType: 0,
                eventDate: new Date(),
            });
        }).toThrow('Μη έγκυρο ΑΦΜ εργοδότη');
    });

    // --- Test 5: Μη έγκυρο ΑΦΜ εργαζομένου ---
    test('μη έγκυρο ΑΦΜ εργαζομένου πρέπει να πετάει error', () => {
        expect(() => {
            buildWRKCardSEPayload({
                afmErgodoti: '123456789',
                branchNumber: '0',
                afmEmployee: 'ABCDEFGHI',   // Γράμματα αντί αριθμών
                eponymo: 'ΤΕΣΤ',
                onoma: 'ΤΕΣΤ',
                fType: 0,
                eventDate: new Date(),
            });
        }).toThrow('Μη έγκυρο ΑΦΜ εργαζομένου');
    });

    // --- Test 6: Μη έγκυρος f_type ---
    test('μη έγκυρος f_type πρέπει να πετάει error', () => {
        expect(() => {
            buildWRKCardSEPayload({
                afmErgodoti: '123456789',
                branchNumber: '0',
                afmEmployee: '987654321',
                eponymo: 'ΤΕΣΤ',
                onoma: 'ΤΕΣΤ',
                fType: 2,       // Μόνο 0 ή 1 αποδεκτό
                eventDate: new Date(),
            });
        }).toThrow('Μη έγκυρος τύπος');
    });

    // --- Test 7: isValidAfm ---
    test('isValidAfm ελέγχει σωστά', () => {
        expect(isValidAfm('123456789')).toBe(true);
        expect(isValidAfm('000000000')).toBe(true);
        expect(isValidAfm('12345')).toBe(false);
        expect(isValidAfm('1234567890')).toBe(false);
        expect(isValidAfm('ABCDEFGHI')).toBe(false);
        expect(isValidAfm('')).toBe(false);
    });

    // --- Test 8: Night shift reference date ---
    test('night shift: reference date πρέπει να χρησιμοποιεί τη δοσμένη ημερομηνία check-in', () => {
        const refDate = calculateReferenceDate(
            new Date('2026-02-27T02:00:00.000+02:00'), // 2:00 πρωί
            '2026-02-26'                                 // check-in χτες
        );
        expect(refDate).toBe('2026-02-26');
    });

    // --- Test 9: f_aitiologia null ---
    test('f_aitiologia πρέπει να είναι null αν δεν δοθεί', () => {
        const payload = buildWRKCardSEPayload({
            afmErgodoti: '123456789',
            branchNumber: '0',
            afmEmployee: '987654321',
            eponymo: 'ΤΕΣΤ',
            onoma: 'ΤΕΣΤ',
            fType: 0,
            eventDate: new Date(),
        });

        expect(payload.Cards.Card[0].CardDetails[0].f_aitiologia).toBeNull();
    });
});
