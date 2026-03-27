// ============================================================
// Content module — barrel export + AppModule registration
// ============================================================

import type { Application } from 'express';
import type { AppModule } from '../../shared/module.js';

// Re-export routes from existing locations (shim pattern)
export { artifactsRouter } from '../../routes/artifacts.js';
export { templatesRouter, seedDefaultTemplates } from '../../routes/templates.js';

// Re-export services
export { cleanupExpiredArtifacts, startArtifactCleanupScheduler, stopArtifactCleanupScheduler } from '../../services/artifact-cleanup.js';

// Types
export type {
  Artifact,
  ArtifactDomain,
  ArtifactDeployment,
  Template,
  TemplateCategory,
} from './types.js';

// Import for module registration
import { artifactsRouter } from '../../routes/artifacts.js';
import { templatesRouter } from '../../routes/templates.js';

export const contentModule: AppModule = {
  name: 'content',

  registerRoutes(app: Application) {
    app.use('/api/artifacts', artifactsRouter);
    app.use('/api/templates', templatesRouter);
  },
};
