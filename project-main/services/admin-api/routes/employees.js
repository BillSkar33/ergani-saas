/**
 * ============================================================
 * Admin API — Employees Routes
 * GET    /api/admin/employees       — Λίστα εργαζομένων
 * POST   /api/admin/employees       — Προσθήκη εργαζομένου
 * PUT    /api/admin/employees/:id   — Ενημέρωση εργαζομένου
 * DELETE /api/admin/employees/:id   — Απενεργοποίηση
 * POST   /api/admin/employees/:id/linking-code — Νέος κωδικός
 * POST   /api/admin/employees/import-csv       — Μαζική εισαγωγή
 * ============================================================
 */
'use strict';

const crypto = require('crypto');
const db = require('../../../shared/db');
const logger = require('../../../shared/logger');
const { checkEmployeeLimit } = require('../../../shared/security/trial-guard');
const { sanitizeHtml } = require('../../../shared/security/sanitize');

async function employeeRoutes(fastify) {

    // --- GET / — Λίστα εργαζομένων ---
    fastify.get('/', async (request) => {
        const eid = request.employer.id;
        const { search, branchId, active } = request.query;

        let query = `
      SELECT e.*, b.name as branch_name,
             ml.platform as linked_platform,
             ml.linked_at
      FROM employees e
      LEFT JOIN branches b ON e.branch_id = b.id
      LEFT JOIN messenger_links ml ON e.id = ml.employee_id
      WHERE e.employer_id = $1`;
        const params = [eid];
        let paramIdx = 2;

        // Φίλτρο αναζήτησης
        if (search) {
            query += ` AND (e.eponymo ILIKE $${paramIdx} OR e.onoma ILIKE $${paramIdx} OR e.afm LIKE $${paramIdx})`;
            params.push(`%${search}%`);
            paramIdx++;
        }

        // Φίλτρο παραρτήματος
        if (branchId) {
            query += ` AND e.branch_id = $${paramIdx}`;
            params.push(branchId);
            paramIdx++;
        }

        // Φίλτρο ενεργού
        if (active !== undefined) {
            query += ` AND e.is_active = $${paramIdx}`;
            params.push(active === 'true');
        }

        query += ' ORDER BY e.eponymo, e.onoma';

        const result = await db.query(query, params);
        return { employees: result.rows, total: result.rowCount };
    });

    // --- POST / — Προσθήκη εργαζομένου ---
    fastify.post('/', async (request, reply) => {
        const eid = request.employer.id;
        const { afm, eponymo, onoma, branchId, isExternalWorker, phone } = request.body || {};

        if (!afm || !eponymo || !onoma) {
            return reply.code(400).send({ error: 'Απαιτούνται ΑΦΜ, Επώνυμο, Όνομα' });
        }

        if (!/^\d{9}$/.test(afm)) {
            return reply.code(400).send({ error: 'Μη έγκυρο ΑΦΜ (9 ψηφία)' });
        }

        // 🔒 Έλεγχος ορίου εργαζομένων (trial/plan limit)
        const limit = await checkEmployeeLimit(eid);
        if (!limit.allowed) {
            return reply.code(403).send({
                error: `Ξεπεράσατε το όριο εργαζομένων (${limit.current}/${limit.max}). Αναβαθμίστε το πλάνο σας.`,
                current: limit.current, max: limit.max,
            });
        }

        try {
            // Αυτόματη δημιουργία linking code
            const linkingCode = generateLinkingCode();

            const result = await db.query(
                `INSERT INTO employees (employer_id, branch_id, afm, eponymo, onoma, phone,
         is_external_worker, linking_code, linking_code_expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() + INTERVAL '30 days')
         RETURNING *`,
                [eid, branchId || null, afm, eponymo.toUpperCase(), onoma.toUpperCase(),
                    phone || null, isExternalWorker || false, linkingCode]
            );

            logger.info({ afm, eponymo }, 'Νέος εργαζόμενος καταχωρήθηκε');
            return reply.code(201).send({ employee: result.rows[0] });
        } catch (err) {
            if (err.code === '23505') {
                return reply.code(409).send({ error: 'Ο ΑΦΜ υπάρχει ήδη' });
            }
            throw err;
        }
    });

    // --- PUT /:id — Ενημέρωση ---
    fastify.put('/:id', async (request, reply) => {
        const eid = request.employer.id;
        const { id } = request.params;
        const { eponymo, onoma, branchId, isExternalWorker, phone, isActive } = request.body || {};

        const result = await db.query(
            `UPDATE employees SET
         eponymo = COALESCE($1, eponymo),
         onoma = COALESCE($2, onoma),
         branch_id = COALESCE($3, branch_id),
         is_external_worker = COALESCE($4, is_external_worker),
         phone = COALESCE($5, phone),
         is_active = COALESCE($6, is_active)
       WHERE id = $7 AND employer_id = $8
       RETURNING *`,
            [eponymo?.toUpperCase(), onoma?.toUpperCase(), branchId,
                isExternalWorker, phone, isActive, id, eid]
        );

        if (result.rowCount === 0) {
            return reply.code(404).send({ error: 'Εργαζόμενος δεν βρέθηκε' });
        }
        return { employee: result.rows[0] };
    });

    // --- DELETE /:id — Απενεργοποίηση (soft delete) ---
    fastify.delete('/:id', async (request, reply) => {
        const eid = request.employer.id;
        const { id } = request.params;

        await db.query(
            'UPDATE employees SET is_active = false WHERE id = $1 AND employer_id = $2',
            [id, eid]
        );
        return { success: true };
    });

    // --- POST /:id/linking-code — Νέος κωδικός σύνδεσης ---
    fastify.post('/:id/linking-code', async (request, reply) => {
        const eid = request.employer.id;
        const { id } = request.params;
        const code = generateLinkingCode();

        const result = await db.query(
            `UPDATE employees SET linking_code = $1,
       linking_code_expires_at = NOW() + INTERVAL '7 days'
       WHERE id = $2 AND employer_id = $3 RETURNING linking_code, linking_code_expires_at`,
            [code, id, eid]
        );

        if (result.rowCount === 0) {
            return reply.code(404).send({ error: 'Εργαζόμενος δεν βρέθηκε' });
        }
        return { linkingCode: code, expiresAt: result.rows[0].linking_code_expires_at };
    });

    // --- POST /import-csv — Μαζική εισαγωγή ---
    fastify.post('/import-csv', async (request, reply) => {
        const eid = request.employer.id;
        const { employees: rows } = request.body || {};

        if (!Array.isArray(rows) || rows.length === 0) {
            return reply.code(400).send({ error: 'Λείπουν δεδομένα εργαζομένων' });
        }

        const results = { success: 0, errors: [] };

        for (const row of rows) {
            try {
                const code = generateLinkingCode();
                await db.query(
                    `INSERT INTO employees (employer_id, branch_id, afm, eponymo, onoma,
           phone, linking_code, linking_code_expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '30 days')`,
                    [eid, row.branchId || null, row.afm, row.eponymo?.toUpperCase(),
                        row.onoma?.toUpperCase(), row.phone || null, code]
                );
                results.success++;
            } catch (err) {
                results.errors.push({
                    afm: row.afm,
                    error: err.code === '23505' ? 'ΑΦΜ υπάρχει ήδη' : err.message,
                });
            }
        }

        return results;
    });
}

/** Δημιουργία τυχαίου 6ψήφιου κωδικού */
function generateLinkingCode() {
    return String(crypto.randomInt(100000, 999999));
}

module.exports = employeeRoutes;
