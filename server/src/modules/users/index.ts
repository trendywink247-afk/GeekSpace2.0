// ============================================================
// Users module — barrel + AppModule registration
// ============================================================

import type { Application } from 'express';
import type { AppModule } from '../../shared/module.js';

// Re-export routers from existing locations
export { usersRouter } from '../../routes/users.js';
export { usageRouter } from '../../routes/usage.js';
export { apiKeysRouter } from '../../routes/api-keys.js';
export { featuresRouter } from '../../routes/features.js';

import { usersRouter } from '../../routes/users.js';
import { usageRouter } from '../../routes/usage.js';
import { apiKeysRouter } from '../../routes/api-keys.js';
import { featuresRouter } from '../../routes/features.js';

export const usersModule: AppModule = {
  name: 'users',
  registerRoutes(app: Application) {
    app.use('/api/users', usersRouter);
    app.use('/api/usage', usageRouter);
    app.use('/api/api-keys', apiKeysRouter);
    app.use('/api/features', featuresRouter);
  },
};
