// ============================================================
// SQL Migration Runner for better-sqlite3
//
// Reads .sql files from server/src/db/migrations/ in lexicographic
// order, tracks applied migrations in a `_migrations` table, and
// is fully idempotent — safe to run multiple times.
// ============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './index.js';
import { logger } from '../logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/**
 * Ensure the _migrations tracking table exists.
 */
function ensureMigrationsTable(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

/**
 * Get the set of already-applied migration names.
 */
function getAppliedMigrations(): Set<string> {
  const rows = db.prepare('SELECT name FROM _migrations').all() as Array<{ name: string }>;
  return new Set(rows.map(r => r.name));
}

/**
 * Run all pending .sql migrations in lexicographic order.
 * Each migration runs inside a transaction so it either fully
 * applies or fully rolls back.
 *
 * @returns The list of newly applied migration names.
 */
export function runMigrations(): string[] {
  ensureMigrationsTable();

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    logger.warn({ dir: MIGRATIONS_DIR }, 'migrate: migrations directory not found');
    return [];
  }

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort(); // lexicographic — 000_init.sql, 001_foo.sql, etc.

  const applied = getAppliedMigrations();
  const newlyApplied: string[] = [];

  for (const file of files) {
    if (applied.has(file)) continue;

    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf-8').trim();

    if (!sql) {
      logger.warn({ file }, 'migrate: skipping empty migration file');
      continue;
    }

    const runOne = db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
    });

    try {
      runOne();
      newlyApplied.push(file);
      logger.info({ file }, 'migrate: applied');
    } catch (err) {
      logger.error({ file, err }, 'migrate: FAILED — stopping');
      throw err;
    }
  }

  if (newlyApplied.length === 0) {
    logger.info('migrate: all migrations already applied');
  } else {
    logger.info({ count: newlyApplied.length, migrations: newlyApplied }, 'migrate: complete');
  }

  return newlyApplied;
}

// ── CLI entry point ─────────────────────────────────────────
// Run directly: npx tsx src/db/migrate.ts
const isMainModule = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  try {
    const applied = runMigrations();
    console.log(`Applied ${applied.length} migration(s):`, applied);
    process.exit(0);
  } catch {
    process.exit(1);
  }
}
