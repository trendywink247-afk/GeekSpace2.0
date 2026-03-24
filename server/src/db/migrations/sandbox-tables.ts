// ============================================================
// Sandbox Tables Migration — sandbox_sessions + sandbox_usage
//
// Tracks per-user sandbox lifecycle (for billing / analytics)
// and daily usage counters (for future rate limiting).
//
// Safe to run repeatedly — uses CREATE TABLE IF NOT EXISTS.
// Follows the same try/catch pattern as db/index.ts migrations.
// ============================================================

import type Database from 'better-sqlite3';
import { logger } from '../../logger.js';

/**
 * Run sandbox table migrations on the given database instance.
 * Idempotent: safe to call on every server startup.
 */
export function runSandboxMigration(db: Database.Database): void {
  // ── sandbox_sessions — one row per container lifecycle ─────
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sandbox_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        container_id TEXT NOT NULL,
        tier TEXT NOT NULL,
        memory_limit_mb INTEGER NOT NULL,
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        ended_at TEXT,
        total_exec_count INTEGER DEFAULT 0,
        total_exec_time_ms INTEGER DEFAULT 0,
        peak_memory_mb REAL DEFAULT 0,
        destroyed_reason TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_sandbox_sessions_user ON sandbox_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sandbox_sessions_active ON sandbox_sessions(ended_at) WHERE ended_at IS NULL;
    `);
  } catch { /* table/indexes already exist */ }

  // ── sandbox_usage — daily aggregates per user ──────────────
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sandbox_usage (
        user_id TEXT NOT NULL,
        date TEXT NOT NULL,
        session_count INTEGER DEFAULT 0,
        total_exec_count INTEGER DEFAULT 0,
        total_exec_time_ms INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, date)
      );
    `);
  } catch { /* table already exists */ }

  // ── Additive column migrations for existing sandbox_sessions ─
  // The old schema (from sandbox-service.ts) had duration_seconds
  // but not the richer columns. Add them safely.
  try { db.exec('ALTER TABLE sandbox_sessions ADD COLUMN total_exec_count INTEGER DEFAULT 0'); } catch { /* column already exists */ }
  try { db.exec('ALTER TABLE sandbox_sessions ADD COLUMN total_exec_time_ms INTEGER DEFAULT 0'); } catch { /* column already exists */ }
  try { db.exec('ALTER TABLE sandbox_sessions ADD COLUMN peak_memory_mb REAL DEFAULT 0'); } catch { /* column already exists */ }
  try { db.exec('ALTER TABLE sandbox_sessions ADD COLUMN destroyed_reason TEXT'); } catch { /* column already exists */ }
  try { db.exec('ALTER TABLE sandbox_sessions ADD COLUMN memory_limit_mb INTEGER'); } catch { /* column already exists */ }

  logger.info('Sandbox tables migration complete');
}
