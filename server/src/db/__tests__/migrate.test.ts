import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { runMigrations } from '../migrate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '../migrations');

function openMemoryDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  return db;
}

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function allTables(db: Database.Database): string[] {
  return (db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
  ).all() as Array<{ name: string }>).map(r => r.name);
}

describe('runMigrations()', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = openMemoryDb();
  });

  it('creates _migrations tracking table', () => {
    runMigrations(db);
    const row = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'`
    ).get();
    expect(row).toBeTruthy();
  });

  it('creates _migrations with checksum column', () => {
    runMigrations(db);
    const cols = db.prepare('PRAGMA table_info(_migrations)').all() as Array<{ name: string }>;
    const names = cols.map(c => c.name);
    expect(names).toContain('checksum');
  });

  it('creates core tables from baseline', () => {
    runMigrations(db);
    const tables = allTables(db);
    const expected = ['users', 'agent_configs', 'reminders', 'subscriptions', 'portfolios'];
    for (const t of expected) {
      expect(tables, `expected table ${t} to exist`).toContain(t);
    }
  });

  it('populates _migrations for all applied SQL files', () => {
    const applied = runMigrations(db);
    expect(applied.length).toBeGreaterThan(0);

    const rows = db.prepare('SELECT name FROM _migrations').all() as Array<{ name: string }>;
    expect(rows.length).toBeGreaterThan(0);

    for (const name of applied) {
      expect(rows.map(r => r.name)).toContain(name);
    }
  });

  it('stores checksums for applied migrations', () => {
    runMigrations(db);
    const rows = db.prepare('SELECT checksum FROM _migrations').all() as Array<{ checksum: string | null }>;
    for (const row of rows) {
      expect(row.checksum).toBeTruthy();
      expect(row.checksum).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex
    }
  });

  it('is idempotent — running twice applies nothing new', () => {
    runMigrations(db);
    const second = runMigrations(db);
    expect(second).toHaveLength(0);
  });

  it('cutover detection: seeds existing populated DB without re-running', () => {
    // Simulate a DB that already has the schema applied but no _migrations history
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT ''
      )
    `);
    db.prepare(`INSERT INTO users (id, email, username, password_hash) VALUES (?, ?, ?, ?)`)
      .run('u1', 'test@example.com', 'testuser', 'hash');

    // runMigrations should detect this is a populated DB and seed without re-running
    const applied = runMigrations(db);
    expect(applied).toHaveLength(0);

    // _migrations should be seeded
    const rows = db.prepare('SELECT name FROM _migrations').all() as Array<{ name: string }>;
    expect(rows.length).toBeGreaterThan(0);
  });
});

// ─── Fresh apply: full migration suite ───────────────────────────────────────

describe('fresh apply — all migration files', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = openMemoryDb();
    runMigrations(db);
  });

  it('creates all tables from 0001_contact_requests', () => {
    const tables = allTables(db);
    const expected = [
      'contact_requests',
      'user_contact_preferences',
      'contact_request_audit',
      'contact_rate_limits',
    ];
    for (const t of expected) {
      expect(tables, `expected table ${t} to exist after 0001`).toContain(t);
    }
  });

  it('creates all tables from 0002_password_reset', () => {
    const tables = allTables(db);
    const expected = [
      'password_reset_tokens',
      'password_reset_rate_limits',
      'password_reset_audit',
    ];
    for (const t of expected) {
      expect(tables, `expected table ${t} to exist after 0002`).toContain(t);
    }
  });

  it('records all SQL migration files in _migrations', () => {
    const sqlFiles = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    const recorded = (db.prepare('SELECT name FROM _migrations ORDER BY id').all() as Array<{ name: string }>)
      .map(r => r.name);

    expect(recorded).toEqual(sqlFiles);
  });

  it('applies migrations in lexicographic order', () => {
    const recorded = (db.prepare('SELECT name FROM _migrations ORDER BY id').all() as Array<{ name: string }>)
      .map(r => r.name);

    // Verify the recorded order matches sort order
    const sorted = [...recorded].sort();
    expect(recorded).toEqual(sorted);

    // Verify 0000 comes before 0001 comes before 0002
    const idx = (name: string) => recorded.indexOf(name);
    if (recorded.includes('0000_baseline.sql') && recorded.includes('0001_contact_requests.sql')) {
      expect(idx('0000_baseline.sql')).toBeLessThan(idx('0001_contact_requests.sql'));
    }
    if (recorded.includes('0001_contact_requests.sql') && recorded.includes('0002_password_reset.sql')) {
      expect(idx('0001_contact_requests.sql')).toBeLessThan(idx('0002_password_reset.sql'));
    }
  });

  it('checksums match actual file content', () => {
    const rows = db.prepare('SELECT name, checksum FROM _migrations').all() as Array<{
      name: string;
      checksum: string;
    }>;

    for (const row of rows) {
      const filePath = path.join(MIGRATIONS_DIR, row.name);
      const content = fs.readFileSync(filePath, 'utf-8').trim();
      const expected = sha256(content);
      expect(row.checksum, `checksum mismatch for ${row.name}`).toBe(expected);
    }
  });

  it('sets applied_at timestamps for all migrations', () => {
    const rows = db.prepare('SELECT name, applied_at FROM _migrations').all() as Array<{
      name: string;
      applied_at: string;
    }>;
    for (const row of rows) {
      expect(row.applied_at, `missing applied_at for ${row.name}`).toBeTruthy();
      // Should parse as a valid date
      expect(new Date(row.applied_at).getTime()).not.toBeNaN();
    }
  });
});

// ─── Staging snapshot replay ──────────────────────────────────────────────────

describe('staging snapshot replay', () => {
  /**
   * Builds a realistic staging-like DB: multiple tables from the baseline
   * schema already exist with data, but there is no _migrations tracking table.
   * Mirrors the state of a live server that was set up before the migration
   * runner was introduced.
   */
  function buildStagingSnapshot(): Database.Database {
    const db = openMemoryDb();

    // Minimal pre-cutover schema: only the tables needed to satisfy isPopulatedDb()
    // and data-preservation assertions. Other tables will be created fresh by the
    // baseline SQL (using IF NOT EXISTS), which is exactly the cutover behavior we test.
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        plan TEXT DEFAULT 'free',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        plan TEXT NOT NULL DEFAULT 'free',
        credits INTEGER DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // Insert real data so isPopulatedDb() returns true
    db.prepare(
      `INSERT INTO users (id, email, username, password_hash, name, plan) VALUES (?, ?, ?, ?, ?, ?)`
    ).run('u-staging-1', 'alice@staging.test', 'alice', 'bcrypt$hash', 'Alice', 'pro');

    db.prepare(
      `INSERT INTO subscriptions (id, user_id, plan, credits) VALUES (?, ?, ?, ?)`
    ).run('sub-1', 'u-staging-1', 'pro', 1000);

    return db;
  }

  it('detects populated staging DB and applies nothing', () => {
    const db = buildStagingSnapshot();
    const applied = runMigrations(db);
    expect(applied).toHaveLength(0);
  });

  it('seeds _migrations for all SQL files on staging cutover', () => {
    const db = buildStagingSnapshot();
    runMigrations(db);

    const sqlFiles = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    const seeded = (db.prepare('SELECT name FROM _migrations').all() as Array<{ name: string }>)
      .map(r => r.name);

    expect(seeded.sort()).toEqual(sqlFiles.sort());
  });

  it('stores correct file-content checksums on staging cutover', () => {
    const db = buildStagingSnapshot();
    runMigrations(db);

    const rows = db.prepare('SELECT name, checksum FROM _migrations').all() as Array<{
      name: string;
      checksum: string;
    }>;

    for (const row of rows) {
      const filePath = path.join(MIGRATIONS_DIR, row.name);
      const content = fs.readFileSync(filePath, 'utf-8').trim();
      const expected = sha256(content);
      expect(row.checksum, `checksum mismatch for ${row.name}`).toBe(expected);
    }
  });

  it('is idempotent after staging cutover — second run applies nothing', () => {
    const db = buildStagingSnapshot();
    runMigrations(db); // cutover: seed
    const second = runMigrations(db); // idempotent: nothing to do
    expect(second).toHaveLength(0);
  });

  it('preserves existing data on staging cutover', () => {
    const db = buildStagingSnapshot();
    runMigrations(db);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get('u-staging-1') as {
      email: string;
      plan: string;
    };
    expect(user).toBeTruthy();
    expect(user.email).toBe('alice@staging.test');
    expect(user.plan).toBe('pro');

    const sub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get('u-staging-1') as {
      plan: string;
      credits: number;
    };
    expect(sub.plan).toBe('pro');
    expect(sub.credits).toBe(1000);
  });

  it('does not create _migrations on empty DB before runMigrations is called', () => {
    const db = buildStagingSnapshot();
    const row = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'`
    ).get();
    expect(row).toBeFalsy();
  });
});
