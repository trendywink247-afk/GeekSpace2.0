// ============================================================
// SQL Migration Runner for better-sqlite3
//
// Reads .sql files from server/src/db/migrations/ in lexicographic
// order, tracks applied migrations in a `_migrations` table, and
// is fully idempotent — safe to run multiple times.
// ============================================================

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type Database from 'better-sqlite3';
import { logger } from '../logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function ensureMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now')),
      checksum TEXT
    )
  `);
  // Idempotently add checksum column for DBs created before this column existed
  try {
    db.exec(`ALTER TABLE _migrations ADD COLUMN checksum TEXT`);
  } catch { /* column already exists */ }
}

function getAppliedMigrations(db: Database.Database): Set<string> {
  const rows = db.prepare('SELECT name FROM _migrations').all() as Array<{ name: string }>;
  return new Set(rows.map(r => r.name));
}

function isPopulatedDb(db: Database.Database): boolean {
  const tableExists = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='users'`
  ).get();
  if (!tableExists) return false;
  const row = db.prepare('SELECT COUNT(*) as n FROM users').get() as { n: number };
  return row.n > 0;
}

function seedExistingMigrations(db: Database.Database, files: string[]): void {
  const insertStmt = db.prepare(
    `INSERT OR IGNORE INTO _migrations (name, applied_at, checksum) VALUES (?, datetime('now'), ?)`
  );
  const seedAll = db.transaction(() => {
    for (const file of files) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, 'utf-8').trim();
      // Run the SQL — all statements use IF NOT EXISTS so this is idempotent on pre-existing DBs.
      // This ensures any migration files added after the runner was introduced actually get applied.
      db.exec(sql);
      insertStmt.run(file, sha256(sql));
    }
  });
  seedAll();
  logger.info({ count: files.length }, 'migrate: cutover — ran all migrations idempotently and seeded history');
}

/**
 * Run all pending .sql migrations in lexicographic order.
 * Each migration runs inside a transaction so it either fully
 * applies or fully rolls back.
 *
 * Cutover detection: if the DB is already populated (users table
 * has rows) but has no _migrations entries, seeds the tracking
 * table without re-running the SQL — safe upgrade path.
 *
 * @returns The list of newly applied migration names.
 */
export function runMigrations(db: Database.Database): string[] {
  ensureMigrationsTable(db);

  const applied = getAppliedMigrations(db);

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    if (applied.size === 0) {
      // No migrations tracked AND no migrations directory = missing build artifact.
      // Silent no-op here would leave the DB schema-less and crash at first query.
      throw new Error(
        `migrate: migrations directory not found at ${MIGRATIONS_DIR}. ` +
        `If running from dist/, ensure the build step copies src/db/migrations/ → dist/db/migrations/.`
      );
    }
    // Migrations already applied (e.g. re-run after accidental dir deletion) — log and skip
    logger.warn({ dir: MIGRATIONS_DIR }, 'migrate: migrations directory not found but _migrations is populated — skipping');
    return [];
  }

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  // Cutover: populated DB with no migration history — seed without re-running
  if (applied.size === 0 && isPopulatedDb(db)) {
    seedExistingMigrations(db, files);
    return [];
  }

  const newlyApplied: string[] = [];

  for (const file of files) {
    if (applied.has(file)) continue;

    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf-8').trim();

    if (!sql) {
      logger.warn({ file }, 'migrate: skipping empty migration file');
      continue;
    }

    const checksum = sha256(sql);
    const runOne = db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO _migrations (name, checksum) VALUES (?, ?)').run(file, checksum);
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
  const { default: BetterSqlite3 } = await import('better-sqlite3');
  const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/geekspace.db');
  const cliDb = new BetterSqlite3(dbPath);
  try {
    const applied = runMigrations(cliDb);
    console.log(`Applied ${applied.length} migration(s):`, applied);
    cliDb.close();
    process.exit(0);
  } catch {
    cliDb.close();
    process.exit(1);
  }
}
