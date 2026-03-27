// ============================================================
// Shared infrastructure barrel export
// ============================================================

// Module interface
export type { AppModule } from './module.js';

// Types
export type { AuthRequest } from './types.js';

// Middleware
export {
  requireAuth,
  optionalAuth,
  signToken,
  generateToken,
  signGuestToken,
  requireAdminToken,
  requireAdmin,
} from './middleware/auth.js';

export {
  validateBody,
  validateQuery,
} from './middleware/validate.js';

export { AppError, errorHandler, asyncHandler } from './middleware/errors.js';
export { metricsMiddleware, getMetricsSnapshot } from './middleware/metrics.js';

// Services
export { cacheGet, cacheSet, cacheDel } from './cache.js';
export { eventBus } from './event-bus.js';
export { logActivity } from './activity-log.js';

// Swagger
export { setupSwagger } from './swagger.js';
