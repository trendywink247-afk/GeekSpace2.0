// ============================================================
// Admin module — barrel export + AppModule registration
// Groups admin/ops tools: dashboard, dev bridge, debug routing,
// routes reference, and model discovery.
// ============================================================

import type { Application } from 'express';
import type { AppModule } from '../../shared/module.js';

// Re-export routers from route files
export { adminRouter, serveAdminDashboard } from '../../routes/admin.js';
export { devRouter } from '../../routes/dev.js';
export { routingDebugRouter } from '../../routes/debug-routing.js';
export { routesListRouter } from '../../routes/routes-list.js';
export { modelsRouter } from '../../routes/models.js';

// Types
export type {
  AdminHealthStatus,
  AdminStats,
  AdminStreamEvent,
  DevStatusResponse,
  DevRunChecksRequest,
  DevRunChecksResponse,
  DevGitPushRequest,
  DevCreatePRRequest,
  DevCreatePRResponse,
  DevAuditLogResponse,
  RoutingTraceFilter,
  RoutingStatsResponse,
  RoutingConfigResponse,
  RouteEntry,
  RoutesListResponse,
  FreeModel,
  FreeModelsResponse,
  ModelChangelogEntry,
  ModelChangelogResponse,
} from './types.js';

// Import routers for module registration
import { adminRouter, serveAdminDashboard } from '../../routes/admin.js';
import { devRouter } from '../../routes/dev.js';
import { routingDebugRouter } from '../../routes/debug-routing.js';
import { routesListRouter } from '../../routes/routes-list.js';
import { modelsRouter } from '../../routes/models.js';

export const adminModule: AppModule = {
  name: 'admin',

  registerRoutes(app: Application) {
    app.use('/api/admin', adminRouter);
    app.use('/api/dev', devRouter);
    app.use('/api/debug', routingDebugRouter);
    app.use('/api/routes', routesListRouter);
    app.use('/api/models', modelsRouter);

    // Serve the admin dashboard HTML at /admin (top-level, not under /api)
    app.get('/admin', serveAdminDashboard);
  },
};
