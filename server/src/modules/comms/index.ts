// ============================================================
// Comms module — barrel export + AppModule registration
//
// Groups notification and content delivery routes: briefings,
// suggestions, and recipes.
// ============================================================

import type { Application } from 'express';
import type { AppModule } from '../../shared/module.js';

// Re-export route routers
export { briefingsRouter } from '../../routes/briefings.js';
export { suggestionsRouter, invalidateClustersCache } from '../../routes/suggestions.js';
export { recipesRouter } from '../../routes/recipes.js';

// Re-export types
export type {
  Briefing,
  BriefingListResponse,
  BriefingTriggerResponse,
  Suggestion,
  SuggestionCreateBody,
  SuggestionEditBody,
  SuggestionVoteBody,
  SuggestionVoteResponse,
  SuggestionListResponse,
  SuggestionCluster,
  SuggestionClusterListResponse,
  SuggestionEvent,
  SuggestionEventListResponse,
  RewardEntry,
  RewardListResponse,
  Recipe,
  RecipeInstallBody,
  RecipeListItem,
} from './types.js';

// Import routers for module registration
import { briefingsRouter } from '../../routes/briefings.js';
import { suggestionsRouter } from '../../routes/suggestions.js';
import { recipesRouter } from '../../routes/recipes.js';

export const commsModule: AppModule = {
  name: 'comms',

  registerRoutes(app: Application) {
    app.use('/api/briefings', briefingsRouter);
    app.use('/api/suggestions', suggestionsRouter);
    app.use('/api/recipes', recipesRouter);
  },
};
