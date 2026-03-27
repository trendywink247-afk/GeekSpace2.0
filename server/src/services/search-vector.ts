/**
 * Shim — re-exports from modules/memory/services/search-vector.ts
 * Kept for backward-compatibility with existing imports.
 */
export {
  initQdrant,
  upsertMemoryVector,
  semanticSearch,
  deleteMemoryVector,
  bulkUpsertMemories,
  isQdrantHealthy,
  isEmbeddingAvailable,
} from '../modules/memory/services/search-vector.js';
