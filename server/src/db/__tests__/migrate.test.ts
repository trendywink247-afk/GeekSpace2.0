import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../migrate.js';

function openMemoryDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  return db;
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
    const tables = (db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
    ).all() as Array<{ name: string }>).map(r => r.name);

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
