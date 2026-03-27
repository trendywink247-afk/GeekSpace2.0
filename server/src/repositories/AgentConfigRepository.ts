/**
 * @module AgentConfigRepository
 *
 * Centralised data-access layer for the **`agent_configs`** table.
 *
 * Each user owns at most **one** agent configuration row that controls
 * personality, LLM model selection, creativity/formality dials, voice,
 * notification preferences, and visual theming for the AI assistant.
 *
 * **Owned table:** `agent_configs`
 *
 * @remarks
 * - The table has a 1-to-1 relationship with `users` (keyed on `user_id`).
 * - Personality presets (`jarvis`, `weebo`, `edith`, etc.) drive both the
 *   system prompt and the UI avatar/accent shown in the chat widget.
 * - The generic {@link AgentConfigRepository.update | update()} helper
 *   dynamically builds a `SET` clause; callers must validate field names.
 */

import type Database from 'better-sqlite3';

/**
 * Raw row shape returned by `SELECT * FROM agent_configs`.
 *
 * There is at most one row per user.  All columns map 1-to-1 to the SQLite
 * schema; numeric dials (`creativity`, `formality`) are integers 0--100.
 */
export interface AgentConfigRow {
  id: string;
  user_id: string;
  /** Internal codename (e.g. 'my-agent'). */
  name: string;
  /** Human-readable label shown in the UI. */
  display_name: string;
  /** Agent operating mode: 'builder' | 'assistant' | 'coach'. */
  mode: string;
  /** TTS voice identifier. */
  voice: string;
  /** System prompt injected at the start of every conversation. */
  system_prompt: string;
  /** Primary LLM model identifier (e.g. 'kimi-k2'). */
  primary_model: string;
  /** Fallback model used when primary is unavailable. */
  fallback_model: string;
  /** 0–100 creativity dial (maps to LLM temperature). */
  creativity: number;
  /** 0–100 formality dial (affects personality prompt). */
  formality: number;
  /** 'fast' | 'balanced' | 'thorough'. */
  response_speed: string;
  monthly_budget_usd: number;
  avatar_emoji: string;
  accent_color: string;
  bubble_style: string;
  /** 'active' | 'paused'. */
  status: string;
  /** Active personality preset: 'jarvis' | 'weebo' | 'edith' | etc. */
  personality: string;
  notification_email_address: string | null;
  /** ISO 8601 timestamp. */
  created_at: string;
}

/**
 * Centralised data-access layer for the `agent_configs` table.
 *
 * Each user has at most one agent config row that governs personality,
 * model routing, creativity/formality settings, and notification preferences.
 * Prefer these methods over inline `db.prepare()` calls in route handlers.
 */
export class AgentConfigRepository {
  /**
   * @param db - The shared better-sqlite3 database instance.
   */
  constructor(private readonly db: Database.Database) {}

  /**
   * Fetch the full agent config for a user.
   * @param userId - UUID of the owner.
   * @returns The matching AgentConfigRow, or undefined if none exists yet.
   */
  getByUserId(userId: string): AgentConfigRow | undefined {
    return this.db
      .prepare('SELECT * FROM agent_configs WHERE user_id = ?')
      .get(userId) as AgentConfigRow | undefined;
  }

  /**
   * Lightweight lookup of the active personality preset, used by premium routes.
   * @param userId - UUID of the user.
   * @returns Object with `personality` slug (e.g. 'jarvis'), or undefined if no config exists.
   */
  getPersonality(userId: string): { personality: string } | undefined {
    return this.db
      .prepare('SELECT personality FROM agent_configs WHERE user_id = ?')
      .get(userId) as { personality: string } | undefined;
  }

  /**
   * Lightweight lookup of email notification preferences, used by the integrations route.
   * @param userId - UUID of the user.
   * @returns Object with `notification_email_enabled` (0|1) and `notification_email_address`, or undefined if no config exists.
   */
  getNotificationPrefs(userId: string): { notification_email_enabled: number; notification_email_address: string | null } | undefined {
    return this.db
      .prepare('SELECT notification_email_enabled, notification_email_address FROM agent_configs WHERE user_id = ?')
      .get(userId) as { notification_email_enabled: number; notification_email_address: string | null } | undefined;
  }

  /**
   * Generic partial update -- only the keys present in `fields` are SET.
   *
   * Dynamically builds `UPDATE agent_configs SET col1 = ?, col2 = ? ... WHERE user_id = ?`.
   * Fields whose value is `undefined` are silently skipped; if every field is
   * `undefined` the method returns immediately without executing a query.
   *
   * @param userId - UUID of the owning user whose config should be updated.
   * @param fields - A partial map of column names to new values.
   *   The `id`, `user_id`, and `created_at` columns are excluded from the type
   *   to prevent accidental mutation of immutable keys.
   *
   * @remarks
   * Caller is responsible for validating field names -- this method trusts
   * that the keys in `fields` correspond to real columns.
   */
  update(userId: string, fields: Partial<Omit<AgentConfigRow, 'id' | 'user_id' | 'created_at'>>): void {
    const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return;

    const setClauses = entries.map(([key]) => `${key} = ?`).join(', ');
    const values = entries.map(([, v]) => v);

    this.db
      .prepare(`UPDATE agent_configs SET ${setClauses} WHERE user_id = ?`)
      .run(...values, userId);
  }
}
