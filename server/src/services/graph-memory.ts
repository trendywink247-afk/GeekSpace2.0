/**
 * Shim — re-exports from modules/memory/services/graph-memory.ts
 * Kept for backward-compatibility with existing imports.
 */
export {
  upsertEntity,
  addRelation,
  recallEntity,
  extractEntitiesFromText,
  processMessageEntities,
  getUserEntities,
} from '../modules/memory/services/graph-memory.js';
