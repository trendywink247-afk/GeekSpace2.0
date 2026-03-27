// ============================================================
// Portfolio module — barrel export + AppModule registration
// ============================================================

import type { Application } from 'express';
import type { AppModule } from '../../shared/module.js';

// Re-export route and services from existing locations (shim pattern)
export { portfolioRouter } from '../../routes/portfolio.js';
export {
  generatePortfolioSuggestions,
  applySuggestion,
} from '../../services/portfolio-suggestions.js';

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
import { portfolioRouter } from '../../routes/portfolio.js';

export const portfolioModule: AppModule = {
  name: 'portfolio',

  registerRoutes(app: Application) {
    app.use('/api/portfolio', portfolioRouter);
  },
};
