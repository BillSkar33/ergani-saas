/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — SaaS Platform
 * Admin API — Entry Point (Fastify Plugin)
 * 
 * Mounted στο κύριο webhook-gateway server ως prefix /api/admin
 * Παρέχει REST API για το Admin Dashboard.
 * ============================================================
 */
'use strict';

const { authMiddleware } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const employeeRoutes = require('./routes/employees');
const { branchRoutes, timestampRoutes, fraudRoutes, settingsRoutes } = require('./routes/resources');

/**
 * Registra όλα τα admin API routes
 * @param {import('fastify').FastifyInstance} fastify
 */
async function adminApiPlugin(fastify) {

    // --- Public routes (χωρίς auth) ---
    fastify.register(authRoutes, { prefix: '/auth' });

    // --- Protected routes (απαιτούν JWT token) ---
    fastify.register(async (protectedScope) => {
        // Εφαρμογή auth middleware σε ΟΛΑ τα protected routes
        protectedScope.addHook('preHandler', authMiddleware);

        protectedScope.register(dashboardRoutes, { prefix: '/dashboard' });
        protectedScope.register(employeeRoutes, { prefix: '/employees' });
        protectedScope.register(branchRoutes, { prefix: '/branches' });
        protectedScope.register(timestampRoutes, { prefix: '/timestamps' });
        protectedScope.register(fraudRoutes, { prefix: '/fraud-alerts' });
        protectedScope.register(settingsRoutes, { prefix: '/settings' });
    });
}

module.exports = adminApiPlugin;
