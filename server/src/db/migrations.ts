/**
 * Database migrations monolith — superseded by runMigrations() + SQL files.
 *
 * The stub below throws so any remaining call site fails loudly at startup.
 * Monolith content has been consolidated into 0000_baseline.sql.
 * The old ALTER TABLE history will be removed in Phase 3.
 */

import type Database from 'better-sqlite3';

/**
 * @deprecated Replaced by runMigrations() from migrate.ts. Throws on call.
 */
export async function applyMigrations(_db: Database.Database): Promise<void> {
  throw new Error(
    'applyMigrations() is deprecated — use runMigrations() from migrate.ts instead'
  );
}
