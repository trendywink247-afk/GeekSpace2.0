/**
 * @module ConversationRepository
 *
 * Centralised data-access layer for the **`conversation_log`** table.
 *
 * Every message exchanged between a user and the AI agent is persisted here --
 * user prompts, assistant responses, and system messages.  The repository
 * provides CRUD helpers for logging, starring, quality-rating, and querying
 * conversation entries.
 *
 * **Owned table:** `conversation_log`
 *
 * @remarks
 * - All multi-argument queries require both `id` *and* `userId` to enforce
 *   row-level ownership.  Never expose `getById(id)` without a user scope.
 * - The `tags` column stores a JSON-encoded string array of topic labels
 *   and must be parsed by the caller.
 * - The `quality_score` column is nullable; a value of `null` means the user
 *   has not rated the assistant response yet.
 * - The `request_id` column ties a user message to its corresponding
 *   assistant reply within the same request chain.
 */

import type Database from 'better-sqlite3';

/**
 * Raw row shape returned by `SELECT * FROM conversation_log`.
 *
 * Each row represents a single message in a user-agent conversation.
 * JSON-encoded fields (`tags`) are stored as plain strings and must be
 * parsed by the caller.
 */
export interface ConversationRow {
  id: string;
  user_id: string;
  /** 'user' | 'assistant' | 'system'. */
  role: string;
  /** Full message text. */
  content: string;
  /** LLM provider used (e.g. 'openrouter', 'pico'). */
  provider: string;
  /** Model identifier (e.g. 'kimi-k2'). */
  model: string;
  /** Short auto-generated summary for memory retrieval. */
  summary: string;
  /** JSON-encoded string array of topic tags. */
  tags: string;
  /** UUID tying this entry to a specific request chain. */
  request_id: string;
  /** SQLite boolean (0 | 1). */
  starred: number;
  /** User quality rating 1–5, or null if not yet rated. */
  quality_score: number | null;
  /** ISO 8601 timestamp. */
  created_at: string;
}

/**
 * Centralised data-access layer for the `conversation_log` table.
 *
 * Enforces row-level access -- all multi-argument queries require both
 * `id` and `userId` so that one user can never read or mutate another
 * user's conversation history.
 *
 * Prefer these methods over inline `db.prepare()` calls in route handlers
 * and services such as `memory.ts`.
 */
export class ConversationRepository {
  /**
   * @param db - The shared better-sqlite3 database instance.
   */
  constructor(private readonly db: Database.Database) {}

  /**
   * Fetch a single conversation entry by ID, scoped to the owning user.
   * @param id - UUID of the `conversation_log` row.
   * @param userId - UUID of the owning user (enforces row-level access).
   * @returns The matching ConversationRow, or undefined if not found or not owned.
   */
  getById(id: string, userId: string): ConversationRow | undefined {
    return this.db
      .prepare('SELECT * FROM conversation_log WHERE id = ? AND user_id = ?')
      .get(id, userId) as ConversationRow | undefined;
  }

  /**
   * Get recent conversation entries for a user, ordered newest-first.
   *
   * Mirrors the query pattern used in `memory.ts` and chat route handlers
   * to build context windows for the LLM.
   *
   * @param userId - UUID of the owning user.
   * @param limit - Maximum number of rows to return (default: 50).
   * @returns An array of {@link ConversationRow} objects, newest first.
   *   Returns an empty array when no entries exist.
   */
  getRecent(userId: string, limit = 50): ConversationRow[] {
    return this.db
      .prepare('SELECT * FROM conversation_log WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(userId, limit) as ConversationRow[];
  }

  /**
   * Log a new conversation entry (INSERT).
   *
   * Matches the INSERT pattern used across agent chat routes.  Optional
   * fields default to empty strings or `'[]'` for JSON arrays so that
   * downstream queries never encounter NULL in text columns.
   *
   * @param entry - The conversation entry payload.
   * @param entry.id - Pre-generated UUID for the new row.
   * @param entry.userId - UUID of the owning user.
   * @param entry.role - Message role: `'user'` | `'assistant'` | `'system'`.
   * @param entry.content - Full message text.
   * @param entry.provider - LLM provider identifier (default: `''`).
   * @param entry.model - LLM model identifier (default: `''`).
   * @param entry.summary - Short auto-generated summary for memory retrieval (default: `''`).
   * @param entry.tags - JSON-encoded string array of topic tags (default: `'[]'`).
   * @param entry.requestId - UUID tying this entry to a request chain (default: `''`).
   */
  logConversation(entry: {
    id: string;
    userId: string;
    role: string;
    content: string;
    provider?: string;
    model?: string;
    summary?: string;
    tags?: string;
    requestId?: string;
  }): void {
    this.db
      .prepare(`
        INSERT INTO conversation_log (id, user_id, role, content, provider, model, summary, tags, request_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        entry.id,
        entry.userId,
        entry.role,
        entry.content,
        entry.provider || '',
        entry.model || '',
        entry.summary || '',
        entry.tags || '[]',
        entry.requestId || '',
      );
  }

  /**
   * Toggles the starred flag on a conversation entry.
   * @param id - UUID of the `conversation_log` row.
   * @param userId - UUID of the owning user (enforces row-level access).
   * @returns New starred value (0 or 1), or null if the row was not found.
   */
  toggleStar(id: string, userId: string): number | null {
    const row = this.db
      .prepare('SELECT id, starred FROM conversation_log WHERE id = ? AND user_id = ?')
      .get(id, userId) as { id: string; starred: number } | undefined;

    if (!row) return null;

    const newStarred = row.starred ? 0 : 1;
    this.db
      .prepare('UPDATE conversation_log SET starred = ? WHERE id = ? AND user_id = ?')
      .run(newStarred, id, userId);

    return newStarred;
  }

  /**
   * Persists a user quality rating (1–5) on an assistant message.
   * @param id - UUID of the `conversation_log` row (must be role='assistant').
   * @param userId - UUID of the owning user (enforces row-level access).
   * @param score - Rating value 1–5.
   * @returns True if the row was updated; false if not found or wrong role.
   */
  setQualityScore(id: string, userId: string, score: number): boolean {
    const row = this.db
      .prepare("SELECT id FROM conversation_log WHERE id = ? AND user_id = ? AND role = 'assistant'")
      .get(id, userId) as { id: string } | undefined;

    if (!row) return false;

    this.db
      .prepare('UPDATE conversation_log SET quality_score = ? WHERE id = ? AND user_id = ?')
      .run(score, id, userId);

    return true;
  }

  /**
   * Returns the total number of assistant messages generated for a user.
   * Used by usage/billing routes to compute per-cycle message counts.
   * @param userId - UUID of the user.
   * @returns Count of rows with role='assistant'.
   */
  countAssistantMessages(userId: string): number {
    const row = this.db
      .prepare("SELECT COUNT(*) as count FROM conversation_log WHERE user_id = ? AND role = 'assistant'")
      .get(userId) as { count: number };
    return row.count;
  }
}
