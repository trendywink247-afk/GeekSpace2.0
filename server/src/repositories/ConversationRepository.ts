// ============================================================
// ConversationRepository — centralised DB access for `conversation_log`
//
// Extracts queries verbatim from existing inline route/service usage.
// Does NOT replace any route code yet — additive only.
// ============================================================

import type Database from 'better-sqlite3';

/** Raw row shape from the `conversation_log` table. */
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
 * Enforces row-level access — all multi-arg queries require both `id` and `userId`.
 */
export class ConversationRepository {
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
   * Get recent conversations for a user, ordered newest-first.
   * Mirrors the pattern used in memory.ts and route handlers.
   */
  getRecent(userId: string, limit = 50): ConversationRow[] {
    return this.db
      .prepare('SELECT * FROM conversation_log WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(userId, limit) as ConversationRow[];
  }

  /**
   * Log a new conversation entry.
   * Matches the INSERT pattern used across agent chat routes.
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
