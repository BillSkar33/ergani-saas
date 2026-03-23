/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — SaaS Platform
 * Scheduler — Προγραμματισμένες Εργασίες (CRON Jobs)
 * 
 * Εκτελεί αυτόματες εργασίες σε τακτά χρονικά διαστήματα:
 * - Υπενθύμιση check-out (κάθε 5 λεπτά)
 * - Retry αποτυχημένων υποβολών ΕΡΓΑΝΗ (κάθε 2 λεπτά)
 * - Καθαρισμός GPS δεδομένων — GDPR (κάθε ώρα)
 * - Proactive JWT refresh (κάθε 10 λεπτά)
 * - Ημερήσια σύνοψη εργοδότη (κάθε βράδυ 23:00)
 * ============================================================
 */

'use strict';

const cron = require('node-cron');
const logger = require('../../shared/logger');
const checkoutReminder = require('./checkout-reminder');
const pendingRetry = require('./pending-retry');
const gpsCleanup = require('./gps-cleanup');
const jwtRefresh = require('./jwt-refresh');
const dailySummary = require('./daily-summary');
const empNotifications = require('./employee-notifications');
const autoActions = require('./auto-actions');

/**
 * Εκκίνηση όλων των CRON jobs
 * 
 * Κάθε job τρέχει σε δικό του schedule.
 * Τα schedules χρησιμοποιούν cron format: seconds minutes hours day month weekday
 */
function startAll() {
    logger.info('🕐 Εκκίνηση Scheduler — CRON jobs');

    // --- Υπενθύμιση Check-out: κάθε 5 λεπτά ---
    // Ελέγχει αν κάποιος εργαζόμενος πρέπει να κάνει check-out
    cron.schedule('*/5 * * * *', async () => {
        logger.debug('CRON: Εκτέλεση checkout-reminder');
        try {
            await checkoutReminder.run();
        } catch (err) {
            logger.error({ err }, 'CRON: Σφάλμα checkout-reminder');
        }
    });

    // --- Retry αποτυχημένων ΕΡΓΑΝΗ υποβολών: κάθε 2 λεπτά ---
    cron.schedule('*/2 * * * *', async () => {
        logger.debug('CRON: Εκτέλεση pending-retry');
        try {
            await pendingRetry.run();
        } catch (err) {
            logger.error({ err }, 'CRON: Σφάλμα pending-retry');
        }
    });

    // --- Καθαρισμός GPS δεδομένων (GDPR): κάθε ώρα ---
    cron.schedule('0 * * * *', async () => {
        logger.debug('CRON: Εκτέλεση gps-cleanup (GDPR)');
        try {
            await gpsCleanup.run();
        } catch (err) {
            logger.error({ err }, 'CRON: Σφάλμα gps-cleanup');
        }
    });

    // --- Proactive JWT refresh: κάθε 10 λεπτά ---
    cron.schedule('*/10 * * * *', async () => {
        logger.debug('CRON: Εκτέλεση jwt-refresh');
        try {
            await jwtRefresh.run();
        } catch (err) {
            logger.error({ err }, 'CRON: Σφάλμα jwt-refresh');
        }
    });

    // --- Ημερήσια σύνοψη: κάθε βράδυ 23:00 (Europe/Athens) ---
    cron.schedule('0 23 * * *', async () => {
        logger.info('CRON: Εκτέλεση daily-summary');
        try {
            await dailySummary.run();
        } catch (err) {
            logger.error({ err }, 'CRON: Σφάλμα daily-summary');
        }
    }, { timezone: 'Europe/Athens' });

    // --- 🔔 Υπενθύμιση βάρδιας εργαζομένου: κάθε 5 λεπτά ---
    // Στέλνει ειδοποίηση 30' πριν τη βάρδια
    cron.schedule('*/5 * * * *', async () => {
        logger.debug('CRON: Εκτέλεση shift-reminder');
        try {
            await empNotifications.shiftReminder();
        } catch (err) {
            logger.error({ err }, 'CRON: Σφάλμα shift-reminder');
        }
    });

    // --- 📊 Εβδομαδιαία σύνοψη εργαζομένου: Κυριακή 20:00 ---
    cron.schedule('0 20 * * 0', async () => {
        logger.info('CRON: Εκτέλεση weekly-employee-summary');
        try {
            await empNotifications.weeklyEmployeeSummary();
        } catch (err) {
            logger.error({ err }, 'CRON: Σφάλμα weekly-employee-summary');
        }
    }, { timezone: 'Europe/Athens' });

    // --- 🤖 Αυτόματο Check-out: κάθε 5 λεπτά ---
    // Checkout στο adjusted_end + grace (10') — αποτρέπει υπερωρία
    cron.schedule('*/5 * * * *', async () => {
        logger.debug('CRON: Εκτέλεση auto-checkout');
        try {
            await autoActions.autoCheckout();
        } catch (err) {
            logger.error({ err }, 'CRON: Σφάλμα auto-checkout');
        }
    });

    // --- 🤖 Αυτόματο Check-in (αργοπορία): κάθε 5 λεπτά ---
    cron.schedule('*/5 * * * *', async () => {
        logger.debug('CRON: Εκτέλεση auto-checkin-late');
        try {
            await autoActions.autoCheckinLate();
        } catch (err) {
            logger.error({ err }, 'CRON: Σφάλμα auto-checkin-late');
        }
    });

    logger.info('✅ Scheduler ξεκίνησε — 9 CRON jobs ενεργά');
}

// Αυτόματη εκκίνηση
if (require.main === module) {
    startAll();
}

module.exports = { startAll };
