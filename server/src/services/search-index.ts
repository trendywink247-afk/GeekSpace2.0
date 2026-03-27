/**
 * Shim — re-exports from modules/memory/services/search-index.ts
 * Kept for backward-compatibility with existing imports.
 */
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
} from '../modules/memory/services/search-index.js';
