/**
 * ============================================================
 * Pending Retry — Επαναυποβολή Αποτυχημένων Κάρτας ΕΡΓΑΝΗ
 * 
 * Βρίσκει χρονοσημάνσεις με status 'pending' και retry_count < 3
 * και τις ξαναυποβάλλει στο ΕΡΓΑΝΗ API.
 * ============================================================
 */
'use strict';
const db = require('../../shared/db');
const logger = require('../../shared/logger');
const { submitWorkCard } = require('../ergani-client/work-card');
const { buildWRKCardSEPayload } = require('../ergani-client/payload-builder');

async function run() {
    // Εύρεση εκκρεμών υποβολών
    const result = await db.query(
        `SELECT ts.*, e.afm, e.eponymo, e.onoma, e.employer_id,
            b.branch_number, b.ergani_username_encrypted, b.ergani_password_encrypted,
            b.id as branch_id_ref, emp.afm_ergodoti
     FROM time_stamps ts
     JOIN employees e ON ts.employee_id = e.id
     JOIN branches b ON ts.branch_id = b.id
     JOIN employers emp ON e.employer_id = emp.id
     WHERE ts.ergani_status = 'pending'
       AND ts.retry_count < 3
       AND ts.geofence_status IN ('approved', 'bypassed')
     ORDER BY ts.created_at ASC
     LIMIT 10`
    );

    for (const row of result.rows) {
        try {
            const payload = buildWRKCardSEPayload({
                afmErgodoti: row.afm_ergodoti,
                branchNumber: row.branch_number,
                afmEmployee: row.afm,
                eponymo: row.eponymo,
                onoma: row.onoma,
                fType: row.action_type === 'check_in' ? 0 : 1,
                eventDate: row.event_timestamp,
                checkInReferenceDate: row.reference_date,
                platform: row.platform,
            });

            await submitWorkCard(
                { id: row.branch_id_ref, ergani_username_encrypted: row.ergani_username_encrypted, ergani_password_encrypted: row.ergani_password_encrypted },
                payload,
                row.id,
                row.retry_count
            );
        } catch (err) {
            logger.error({ err, timeStampId: row.id }, 'Αποτυχία retry υποβολής');
        }
    }

    if (result.rowCount > 0) {
        logger.info({ count: result.rowCount }, 'Pending retries εκτελέστηκαν');
    }
}

module.exports = { run };
