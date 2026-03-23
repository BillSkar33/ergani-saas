/**
 * ============================================================
 * GPS Cleanup — Καθαρισμός GPS Δεδομένων (GDPR)
 * 
 * Νομική υποχρέωση: Τα GPS δεδομένα (lat/lng) διαγράφονται
 * μετά 48 ώρες. Κρατάμε μόνο distance και geofence status.
 * ============================================================
 */
'use strict';
const db = require('../../shared/db');
const logger = require('../../shared/logger');
const config = require('../../shared/config');

async function run() {
    const retentionHours = config.gdpr.gpsRetentionHours;

    // Μηδενισμός GPS συντεταγμένων μετά το χρονικό όριο
    const result = await db.query(
        `UPDATE time_stamps
     SET latitude = NULL, longitude = NULL, horizontal_accuracy = NULL
     WHERE latitude IS NOT NULL
       AND created_at < NOW() - INTERVAL '${retentionHours} hours'`
    );

    if (result.rowCount > 0) {
        logger.info({ cleaned: result.rowCount, retentionHours },
            'GDPR: GPS δεδομένα καθαρίστηκαν');
    }
}

module.exports = { run };
