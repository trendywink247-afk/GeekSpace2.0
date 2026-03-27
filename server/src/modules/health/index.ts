// ============================================================
// Health module — barrel export + AppModule registration
// ============================================================

import type { Application } from 'express';
import type { AppModule } from '../../shared/module.js';

// Re-export from module-local files
export { healthRouter, startHealthProbeCache, getCachedComponents } from './routes.js';
export { runHealthTick, getServiceHealth } from './services.js';

// Types
export type { ComponentStatus, ServiceDetail, ServiceHealthMap } from './types.js';

// Import for module registration
import { healthRouter, startHealthProbeCache } from './routes.js';

export const healthModule: AppModule = {
  name: 'health',

  registerRoutes(app: Application) {
    app.use('/api/health', healthRouter);
  },

  async initialize() {
    startHealthProbeCache();
  },
};
