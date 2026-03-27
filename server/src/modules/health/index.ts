// ============================================================
// Health module — barrel export + AppModule registration
// ============================================================

import type { Application } from 'express';
import type { AppModule } from '../../shared/module.js';

// Re-export route and services from existing locations (shim pattern)
export { healthRouter, startHealthProbeCache, getCachedComponents } from '../../routes/health.js';
export { runHealthTick, getServiceHealth } from '../../services/health-monitor.js';

// Types
export type { ComponentStatus, ServiceDetail, ServiceHealthMap } from './types.js';

// Import for module registration
import { healthRouter, startHealthProbeCache } from '../../routes/health.js';

export const healthModule: AppModule = {
  name: 'health',

  registerRoutes(app: Application) {
    app.use('/api/health', healthRouter);
  },

  async initialize() {
    startHealthProbeCache();
  },
};
