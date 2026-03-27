/**
 * @module ArtifactRepository
 *
 * Centralised data-access layer for the **`generated_artifacts`** table.
 *
 * Artifacts are the user-visible outputs of code-generation and
 * image-generation tools -- HTML pages, CSS themes, JS snippets, logos, etc.
 * Each artifact is scoped to a single user and may optionally carry an
 * expiry timestamp for auto-cleanup of ephemeral outputs.
 *
 * **Owned table:** `generated_artifacts`
 *
 * @remarks
 * - Two lookup methods exist intentionally: {@link ArtifactRepository.getById | getById()}
 *   performs an **unscoped** lookup (internal/admin use only), while
 *   {@link ArtifactRepository.getByIdAndUser | getByIdAndUser()} enforces
 *   row-level ownership and should be used in all route handlers.
 * - The `metadata` column stores a JSON-encoded object with generation
 *   context (prompt, model, dimensions, etc.) and must be parsed by the caller.
 * - The `expires_at` column is nullable; `null` means the artifact is permanent.
 */

import type Database from 'better-sqlite3';

/**
 * Raw row shape returned by `SELECT * FROM generated_artifacts`.
 *
 * Each row represents a single generated output.  Text columns (`html`,
 * `css`, `js`) may be empty strings for artifact types that do not use them.
 * The `metadata` column is a JSON-encoded object and must be parsed by the
 * caller.
 */
export interface ArtifactRow {
  id: string;
  user_id: string;
  /** Artifact kind: 'logo' | 'image' | 'code' | 'component' | etc. */
  type: string;
  /** Human-readable display name. */
  title: string;
  /** Generated HTML markup (may be empty for non-HTML artifact types). */
  html: string;
  /** Generated CSS styles (may be empty). */
  css: string;
  /** Generated JavaScript code (may be empty). */
  js: string;
  /** JSON-encoded metadata object (dimensions, prompt, model, etc.). */
  metadata: string;
  /** ISO 8601 creation timestamp. */
  created_at: string;
  /** ISO 8601 expiry timestamp, or null for permanent artifacts. */
  expires_at: string | null;
}

/**
 * Centralised data-access layer for the `generated_artifacts` table.
 *
 * Stores HTML/CSS/JS artifacts produced by code-generation and
 * image-generation tools.  Use {@link ArtifactRepository.getByIdAndUser | getByIdAndUser()}
 * in route handlers (enforces ownership); use {@link ArtifactRepository.getById | getById()}
 * only for internal/admin lookups where ownership is already verified.
 *
 * Prefer these methods over inline `db.prepare()` calls in route handlers
 * and the action executor.
 */
export class ArtifactRepository {
  /**
   * @param db - The shared better-sqlite3 database instance.
   */
  constructor(private readonly db: Database.Database) {}

  /**
   * Fetch an artifact by ID (no ownership check — use only for internal lookups).
   * @param id - UUID of the `generated_artifacts` row.
   * @returns The matching ArtifactRow, or undefined if not found.
   */
  getById(id: string): ArtifactRow | undefined {
    return this.db
      .prepare('SELECT * FROM generated_artifacts WHERE id = ?')
      .get(id) as ArtifactRow | undefined;
  }

  /**
   * Fetch an artifact by ID scoped to the owning user (safe for route handlers).
   * @param id - UUID of the `generated_artifacts` row.
   * @param userId - UUID of the owning user (enforces row-level access).
   * @returns The matching ArtifactRow, or undefined if not found or not owned.
   */
  getByIdAndUser(id: string, userId: string): ArtifactRow | undefined {
    return this.db
      .prepare('SELECT * FROM generated_artifacts WHERE id = ? AND user_id = ?')
      .get(id, userId) as ArtifactRow | undefined;
  }

  /**
   * Create a new artifact (INSERT).
   *
   * Matches the INSERT pattern from `routes/artifacts.ts` and
   * `action-executor.ts`.  Optional text columns default to empty strings
   * and `metadata` defaults to `'{}'` so downstream queries never encounter NULL.
   *
   * @param artifact - The artifact payload.
   * @param artifact.id - Pre-generated UUID for the new row.
   * @param artifact.userId - UUID of the owning user.
   * @param artifact.type - Artifact kind: `'logo'` | `'image'` | `'code'` | `'component'` | etc.
   * @param artifact.title - Human-readable display name.
   * @param artifact.html - Generated HTML markup (default: `''`).
   * @param artifact.css - Generated CSS styles (default: `''`).
   * @param artifact.js - Generated JavaScript code (default: `''`).
   * @param artifact.metadata - JSON-encoded metadata object (default: `'{}'`).
   * @param artifact.expiresAt - ISO 8601 expiry timestamp, or `null` / `undefined`
   *   for permanent artifacts (default: `null`).
   */
  create(artifact: {
    id: string;
    userId: string;
    type: string;
    title: string;
    html?: string;
    css?: string;
    js?: string;
    metadata?: string;
    expiresAt?: string | null;
  }): void {
    this.db
      .prepare(`
        INSERT INTO generated_artifacts (id, user_id, type, title, html, css, js, metadata, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        artifact.id,
        artifact.userId,
        artifact.type,
        artifact.title,
        artifact.html || '',
        artifact.css || '',
        artifact.js || '',
        artifact.metadata || '{}',
        artifact.expiresAt ?? null,
      );
  }

  /**
   * Partial update -- only the provided fields are SET.
   *
   * Dynamically builds `UPDATE generated_artifacts SET col1 = ?, col2 = ? ... WHERE id = ?`.
   * Fields whose value is `undefined` are silently skipped.  If every field is
   * `undefined` the method skips the UPDATE and returns the current row as-is.
   *
   * @param id - UUID of the artifact to update.
   * @param fields - A partial map of mutable column names to new values.
   *   Only `title`, `html`, `css`, `js`, `metadata`, and `expires_at` are
   *   accepted; immutable keys (`id`, `user_id`, `type`, `created_at`) are
   *   excluded by the type.
   * @returns The updated {@link ArtifactRow}, or `undefined` if the row does
   *   not exist.  The returned row is re-fetched after the UPDATE so that
   *   the caller sees the latest state.
   */
  update(id: string, fields: Partial<Pick<ArtifactRow, 'title' | 'html' | 'css' | 'js' | 'metadata' | 'expires_at'>>): ArtifactRow | undefined {
    const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return this.getById(id);

    const setClauses = entries.map(([key]) => `${key} = ?`).join(', ');
    const values = entries.map(([, v]) => v);

    this.db
      .prepare(`UPDATE generated_artifacts SET ${setClauses} WHERE id = ?`)
      .run(...values, id);

    return this.getById(id);
  }

  /**
   * Returns the total number of artifacts owned by a user.
   * Used by billing routes to enforce per-plan storage limits.
   * @param userId - UUID of the user.
   * @returns Count of all artifact rows owned by this user.
   */
  countByUser(userId: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) as count FROM generated_artifacts WHERE user_id = ?')
      .get(userId) as { count: number };
    return row.count;
  }
}
