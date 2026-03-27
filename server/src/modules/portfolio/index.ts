// ============================================================
// Portfolio module — barrel export + AppModule registration
// ============================================================

import type { Application } from 'express';
import type { AppModule } from '../../shared/module.js';

// Re-export from module-local files
export { portfolioRouter } from './routes.js';
export {
  generatePortfolioSuggestions,
  applySuggestion,
} from './services.js';

// Types
export type {
  Portfolio,
  PortfolioProject,
  AnalyticsRow,
  PortfolioContact,
  PortfolioSocial,
  PortfolioVisibility,
  PortfolioMilestone,
  AnalyticsSource,
} from './types.js';

// Import for module registration
import { portfolioRouter } from './routes.js';

export const portfolioModule: AppModule = {
  name: 'portfolio',

  registerRoutes(app: Application) {
    app.use('/api/portfolio', portfolioRouter);
  },
};
