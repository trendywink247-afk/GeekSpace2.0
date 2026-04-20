/**
 * Shim — re-exports from modules/memory/services/memory.ts
 * Kept for backward-compatibility with existing imports.
 * @module services/memory
 */
export {
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
} from '../modules/memory/services/memory.js';

export type { UserMemory } from '../modules/memory/services/memory.js';
