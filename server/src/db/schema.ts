/**
 * Core database schema — superseded by runMigrations() + 0000_baseline.sql.
 *
 * The function stub below throws so any call site still referencing
 * applySchema() fails loudly at startup rather than silently diverging.
 */

import type Database from 'better-sqlite3';

/**
 * @deprecated Replaced by runMigrations() + 0000_baseline.sql. Throws on call.
 */
export function applySchema(_db: Database.Database): void {
  throw new Error(
    'applySchema() is deprecated — use runMigrations() from migrate.ts instead'
  );
}
