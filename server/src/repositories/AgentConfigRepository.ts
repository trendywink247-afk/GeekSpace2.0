// ============================================================
// AgentConfigRepository — centralised DB access for `agent_configs`
//
// Extracts queries verbatim from existing inline route usage.
// Does NOT replace any route code yet — additive only.
// ============================================================

import type Database from 'better-sqlite3';

/** Raw row shape from the `agent_configs` table. One row per user. */
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
 * Each user has at most one agent config row.
 */
export class AgentConfigRepository {
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
   * Generic partial update. Only the keys present in `fields` are SET.
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
