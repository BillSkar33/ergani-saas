/**
 * ============================================================
 * Admin API — Branches, Timestamps, Fraud, Settings Routes
 * ============================================================
 */
'use strict';

const db = require('../../../shared/db');
const logger = require('../../../shared/logger');

// ============================================================
// BRANCHES ROUTES
// ============================================================
async function branchRoutes(fastify) {
    // --- GET / — Λίστα παραρτημάτων ---
    fastify.get('/', async (request) => {
        const eid = request.employer.id;
        const result = await db.query(
            `SELECT b.*, 
              (SELECT COUNT(*) FROM employees e WHERE e.branch_id = b.id AND e.is_active = true) AS employee_count
       FROM branches b WHERE b.employer_id = $1 ORDER BY b.branch_number`, [eid]
        );
        return { branches: result.rows };
    });

    // --- POST / — Νέο παράρτημα ---
    fastify.post('/', async (request, reply) => {
        const eid = request.employer.id;
        const { branchNumber, name, latitude, longitude, geofenceRadiusMeters, address } = request.body || {};
        if (!branchNumber || !latitude || !longitude) {
            return reply.code(400).send({ error: 'Απαιτούνται αριθμός, latitude, longitude' });
        }
        try {
            const result = await db.query(
                `INSERT INTO branches (employer_id, branch_number, name, latitude, longitude, geofence_radius_meters)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [eid, branchNumber, name, latitude, longitude, geofenceRadiusMeters || 40]
            );
            return reply.code(201).send({ branch: result.rows[0] });
        } catch (err) {
            if (err.code === '23505') return reply.code(409).send({ error: 'Αριθμός παραρτήματος υπάρχει' });
            throw err;
        }
    });

    // --- PUT /:id — Ενημέρωση ---
    fastify.put('/:id', async (request, reply) => {
        const eid = request.employer.id;
        const { id } = request.params;
        const { name, latitude, longitude, geofenceRadiusMeters, maxAccuracyMeters, isActive } = request.body || {};
        const result = await db.query(
            `UPDATE branches SET
         name = COALESCE($1, name), latitude = COALESCE($2, latitude),
         longitude = COALESCE($3, longitude),
         geofence_radius_meters = COALESCE($4, geofence_radius_meters),
         max_accuracy_meters = COALESCE($5, max_accuracy_meters),
         is_active = COALESCE($6, is_active)
       WHERE id = $7 AND employer_id = $8 RETURNING *`,
            [name, latitude, longitude, geofenceRadiusMeters, maxAccuracyMeters, isActive, id, eid]
        );
        if (result.rowCount === 0) return reply.code(404).send({ error: 'Παράρτημα δεν βρέθηκε' });
        return { branch: result.rows[0] };
    });
}

// ============================================================
// TIMESTAMPS ROUTES
// ============================================================
async function timestampRoutes(fastify) {
    // --- GET / — Ιστορικό χρονοσημάνσεων ---
    fastify.get('/', async (request) => {
        const eid = request.employer.id;
        const { dateFrom, dateTo, employeeId, status, page = 1 } = request.query;
        const limit = 50;
        const offset = (parseInt(page) - 1) * limit;

        let query = `
      SELECT ts.*, e.eponymo, e.onoma, e.afm, b.name as branch_name
      FROM time_stamps ts
      JOIN employees e ON ts.employee_id = e.id
      LEFT JOIN branches b ON ts.branch_id = b.id
      WHERE e.employer_id = $1`;
        const params = [eid];
        let idx = 2;

        if (dateFrom) { query += ` AND ts.reference_date >= $${idx}`; params.push(dateFrom); idx++; }
        if (dateTo) { query += ` AND ts.reference_date <= $${idx}`; params.push(dateTo); idx++; }
        if (employeeId) { query += ` AND ts.employee_id = $${idx}`; params.push(employeeId); idx++; }
        if (status) { query += ` AND ts.ergani_status = $${idx}`; params.push(status); idx++; }

        // Count
        const countResult = await db.query(`SELECT COUNT(*) FROM (${query}) sub`, params);
        const total = parseInt(countResult.rows[0].count);

        query += ` ORDER BY ts.event_timestamp DESC LIMIT $${idx} OFFSET $${idx + 1}`;
        params.push(limit, offset);

        const result = await db.query(query, params);
        return { timestamps: result.rows, total, page: parseInt(page), totalPages: Math.ceil(total / limit) };
    });

    // --- GET /export — Export CSV ---
    fastify.get('/export', async (request, reply) => {
        const eid = request.employer.id;
        const { dateFrom, dateTo } = request.query;

        const result = await db.query(
            `SELECT e.afm, e.eponymo, e.onoma, ts.action_type, ts.event_timestamp,
              ts.reference_date, ts.geofence_status, ts.ergani_status, b.name as branch_name
       FROM time_stamps ts
       JOIN employees e ON ts.employee_id = e.id
       LEFT JOIN branches b ON ts.branch_id = b.id
       WHERE e.employer_id = $1
         AND ts.reference_date >= COALESCE($2, CURRENT_DATE - INTERVAL '30 days')
         AND ts.reference_date <= COALESCE($3, CURRENT_DATE)
       ORDER BY ts.event_timestamp DESC`,
            [eid, dateFrom || null, dateTo || null]
        );

        // CSV generation
        const header = 'ΑΦΜ,Επώνυμο,Όνομα,Ενέργεια,Ημ/νία Ώρα,Ημ. Αναφοράς,Geofence,ΕΡΓΑΝΗ,Παράρτημα\n';
        const rows = result.rows.map(r =>
            `${r.afm},${r.eponymo},${r.onoma},${r.action_type},${r.event_timestamp},${r.reference_date},${r.geofence_status},${r.ergani_status},${r.branch_name || ''}`
        ).join('\n');

        reply.header('Content-Type', 'text/csv; charset=utf-8');
        reply.header('Content-Disposition', 'attachment; filename="timestamps.csv"');
        return header + rows;
    });
}

// ============================================================
// FRAUD ALERTS ROUTES
// ============================================================
async function fraudRoutes(fastify) {
    // --- GET / — Λίστα alerts ---
    fastify.get('/', async (request) => {
        const eid = request.employer.id;
        const { reviewed } = request.query;

        let query = `
      SELECT fa.*, e.eponymo, e.onoma, e.afm
      FROM fraud_alerts fa
      JOIN employees e ON fa.employee_id = e.id
      WHERE e.employer_id = $1`;
        const params = [eid];

        if (reviewed !== undefined) {
            query += ` AND fa.is_reviewed = $2`;
            params.push(reviewed === 'true');
        }
        query += ' ORDER BY fa.created_at DESC LIMIT 100';

        const result = await db.query(query, params);
        return { alerts: result.rows };
    });

    // --- PUT /:id/review — Σημείωση ως εξετασμένου ---
    fastify.put('/:id/review', async (request, reply) => {
        const eid = request.employer.id;
        const { id } = request.params;

        await db.query(
            `UPDATE fraud_alerts SET is_reviewed = true, reviewed_by = $1, reviewed_at = NOW()
       WHERE id = $2 AND employee_id IN (SELECT e.id FROM employees e WHERE e.employer_id = $1)`,
            [eid, id]
        );
        return { success: true };
    });
}

// ============================================================
// SETTINGS ROUTES
// ============================================================
async function settingsRoutes(fastify) {
    // --- GET / — Τρέχουσες ρυθμίσεις ---
    fastify.get('/', async (request) => {
        const eid = request.employer.id;
        const result = await db.query(
            'SELECT * FROM employer_notification_settings WHERE employer_id = $1', [eid]
        );
        return { settings: result.rows[0] || {} };
    });

    // --- PUT / — Ενημέρωση ρυθμίσεων ---
    fastify.put('/', async (request) => {
        const eid = request.employer.id;
        const s = request.body || {};
        await db.query(
            `INSERT INTO employer_notification_settings (employer_id, notify_each_checkin,
       notify_late_arrival, notify_missed_checkout, notify_gps_rejection,
       notify_fraud_alerts, notify_ergani_errors, weekly_summary_enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (employer_id) DO UPDATE SET
         notify_each_checkin = EXCLUDED.notify_each_checkin,
         notify_late_arrival = EXCLUDED.notify_late_arrival,
         notify_missed_checkout = EXCLUDED.notify_missed_checkout,
         notify_gps_rejection = EXCLUDED.notify_gps_rejection,
         notify_fraud_alerts = EXCLUDED.notify_fraud_alerts,
         notify_ergani_errors = EXCLUDED.notify_ergani_errors,
         weekly_summary_enabled = EXCLUDED.weekly_summary_enabled,
         updated_at = NOW()`,
            [eid, s.notifyEachCheckin ?? false, s.notifyLateArrival ?? true,
                s.notifyMissedCheckout ?? true, s.notifyGpsRejection ?? true,
                s.notifyFraudAlerts ?? true, s.notifyErganiErrors ?? true,
                s.weeklySummaryEnabled ?? true]
        );
        return { success: true };
    });
}

module.exports = { branchRoutes, timestampRoutes, fraudRoutes, settingsRoutes };
