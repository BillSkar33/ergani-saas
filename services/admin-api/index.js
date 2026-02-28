/**
 * ============================================================
 * ΨΗΦΙΑΚΗ ΚΑΡΤΑ ΕΡΓΑΣΙΑΣ — SaaS Platform
 * Admin API — Entry Point (🔒 Security Enhanced)
 * 
 * Mounted στο webhook-gateway ως prefix /api/admin
 * 🔒: Rate limiting ανά κατηγορία, audit trail hooks
 * ============================================================
 */
'use strict';

const { authMiddleware } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const employeeRoutes = require('./routes/employees');
const { branchRoutes, timestampRoutes, fraudRoutes, settingsRoutes } = require('./routes/resources');
const { scheduleRoutes, leaveRoutes, calendarRoutes } = require('./routes/schedules');
const { rateLimiter } = require('../../shared/security/rate-limiter');
const { auditHook } = require('../../shared/security/audit-logger');
const { trialGuard } = require('../../shared/security/trial-guard');

/**
 * Εγγραφή admin API routes
 * @param {import('fastify').FastifyInstance} fastify
 */
async function adminApiPlugin(fastify) {

    // --- Public routes (χωρίς auth, αλλά με rate limiting) ---
    fastify.register(authRoutes, { prefix: '/auth' });

    // --- Protected routes ---
    fastify.register(async (protectedScope) => {
        // 🔒 Auth middleware σε ΟΛΑ τα protected routes
        protectedScope.addHook('preHandler', authMiddleware);

        // 🔒 Trial guard — ελέγχει κατάσταση subscription
        protectedScope.addHook('preHandler', trialGuard);

        // 🔒 Rate limiting — API: 60 req/min
        protectedScope.addHook('preHandler', rateLimiter('api'));

        // 🔒 Audit trail — auto-log ΟΛΑ τα mutating requests (POST/PUT/DELETE)
        protectedScope.addHook('onResponse', auditHook('admin'));

        protectedScope.register(dashboardRoutes, { prefix: '/dashboard' });
        protectedScope.register(employeeRoutes, { prefix: '/employees' });
        protectedScope.register(branchRoutes, { prefix: '/branches' });
        protectedScope.register(fraudRoutes, { prefix: '/fraud-alerts' });
        protectedScope.register(settingsRoutes, { prefix: '/settings' });
        protectedScope.register(scheduleRoutes, { prefix: '/schedules' });
        protectedScope.register(leaveRoutes, { prefix: '/leaves' });
        protectedScope.register(calendarRoutes, { prefix: '/calendar' });

        // 🔒 Timestamps: export has its own stricter rate limit
        protectedScope.register(async (tsScope) => {
            tsScope.register(timestampRoutes);
        }, { prefix: '/timestamps' });
    });
}

module.exports = adminApiPlugin;
