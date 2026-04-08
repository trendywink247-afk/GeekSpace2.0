/**
 * @module db
 *
 * SQLite database layer using `better-sqlite3` (synchronous, single-file).
 *
 * **Initialization sequence (runs at import time):**
 * 1. Ensures the data directory exists (`fs.mkdirSync`).
 * 2. Opens (or creates) the SQLite file at `DB_PATH`.
 * 3. Applies performance pragmas (WAL, cache, mmap, busy_timeout, FK).
 * 4. Runs `ANALYZE` to refresh query-planner statistics.
 * 5. Creates core tables via `schema.ts`.
 * 6. Applies incremental migrations via `migrations.ts`.
 * 7. Optionally seeds demo data via `seed.ts`.
 *
 * **Exported:** the `db` instance and `seedDemoData()`.
 */

// ============================================================
// GeekSpace Database -- SQLite via better-sqlite3
// ============================================================

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { logger } from '../logger.js';
import { applySchema } from './schema.js';
import { applyMigrations } from './migrations.js';
import { seedDemoData, runSeedIfNeeded } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/geekspace.db');

// Ensure data directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Performance pragmas
db.pragma('journal_mode = WAL');       // WAL: concurrent reads + single writer
db.pragma('synchronous = NORMAL');     // Safe with WAL; skips fsync on every write
db.pragma('cache_size = -32000');      // 32MB page cache
db.pragma('temp_store = MEMORY');      // Temp tables in RAM not disk
db.pragma('mmap_size = 268435456');    // 256MB memory-mapped I/O
db.pragma('busy_timeout = 5000');      // 5s wait instead of instant SQLITE_BUSY fail
db.pragma('foreign_keys = ON');

// 49.8: Run ANALYZE on startup to keep query plans fresh.
db.exec('ANALYZE');

// ── Schema + Migrations ────────────────────────────────────
applySchema(db);
await applyMigrations(db);

// ── Seed demo data ─────────────────────────────────────────
runSeedIfNeeded(db);

// ── Re-export plan definitions for backward compat ─────────
export { PLAN_DEFINITIONS } from './plan-defs.js';
export type { PlanDefinition } from './plan-defs.js';

export { db, seedDemoData };
