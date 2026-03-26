// ============================================================
// ArtifactRepository — centralised DB access for `generated_artifacts`
//
// Extracts queries verbatim from existing inline route usage.
// Does NOT replace any route code yet — additive only.
// ============================================================

import type Database from 'better-sqlite3';

/** Raw row shape from the `generated_artifacts` table. */
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
 * Stores HTML/CSS/JS artifacts from code-generation and image-generation tools.
 * Use `getByIdAndUser` in route handlers (enforces ownership); `getById` for internal lookups only.
 */
export class ArtifactRepository {
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
   * Create a new artifact.
   * Matches the INSERT pattern from routes/artifacts.ts and action-executor.ts.
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
   * Partial update. Only provided fields are SET.
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
