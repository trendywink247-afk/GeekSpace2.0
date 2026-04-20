// ============================================================
// Memory module — barrel export + AppModule registration
// ============================================================

import type { Application } from 'express';
import type { AppModule } from '../../shared/module.js';

// Re-export routes from local module paths
export { memoryRouter } from './routes/memory.js';
export { default as searchRouter } from './routes/search.js';

// Re-export services — memory core
export {
  initMemoryTables,
  upsertMemory,
  getMemories,
  getRelevantMemories,
  deleteMemory,
  logTrainingExample,
  logConversation,
  getRecentConversations,
  getConversationContext,
  extractMemories,
  extractMemoriesWithAI,
  extractMemoriesWithOllama,
  buildMemoryContext,
  buildOwnerContextForVisitor,
  startMemorySyncScheduler,
  startWeeklySummaryScheduler,
  getUserMemories,
  getTopUserMemories,
  upsertUserMemory,
  deleteUserMemory,
  formatMemoryContext,
  extractMemoriesFromConversation,
} from './services/memory.js';

export type { UserMemory } from './services/memory.js';

// Re-export services — vector search (Qdrant)
export {
  initQdrant,
  upsertMemoryVector,
  semanticSearch,
  deleteMemoryVector,
  bulkUpsertMemories,
  isQdrantHealthy,
  isEmbeddingAvailable,
} from './services/search-vector.js';

// Re-export services — full-text search (Meilisearch)
export {
  initMeilisearch,
  searchContent,
  indexDocument,
  indexNote,
  indexMemory,
  indexReminder,
  indexHabit,
  removeDocument,
  bulkIndex,
  bulkIndexExistingData,
  isMeilisearchHealthy,
} from './services/search-index.js';

// Re-export services — graph memory
export {
  upsertEntity,
  addRelation,
  recallEntity,
  extractEntitiesFromText,
  processMessageEntities,
  getUserEntities,
} from './services/graph-memory.js';

// Re-export services — memory summarizer
export {
  summarizeUserDay,
  summarizeConversationSession,
} from './services/memory-summarizer.js';

// Types
export type {
  MemoryEntry,
  ConversationEntry,
  SemanticResult,
  MeiliDocument,
  MemoryEntity,
  MemoryRelation,
} from './types.js';

// Import for module registration
import { memoryRouter } from './routes/memory.js';
import searchRouter from './routes/search.js';

export const memoryModule: AppModule = {
  name: 'memory',

  registerRoutes(app: Application) {
    app.use('/api/memory', memoryRouter);
    app.use('/api/search', searchRouter);
  },
};
