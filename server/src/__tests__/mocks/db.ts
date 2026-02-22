// ============================================================
// Test Database Mock
// Provides in-memory SQLite for testing
// ============================================================

import Database from 'better-sqlite3';
import { vi } from 'vitest';

let testDb: Database.Database | null = null;

/**
 * Initialize test database with schema
 */
export function initTestDb(): Database.Database {
  if (testDb) {
    testDb.close();
  }
  
  testDb = new Database(':memory:');
  
  // Create tables
  testDb.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      username TEXT,
      name TEXT,
      avatar TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE channel_links (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      channel TEXT,
      external_id TEXT,
      is_verified INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE contact_requests (
      id TEXT PRIMARY KEY,
      from_user_id TEXT,
      from_name TEXT,
      from_phone TEXT,
      from_email TEXT,
      to_user_id TEXT,
      source TEXT,
      intention TEXT,
      initial_message TEXT,
      status TEXT DEFAULT 'pending',
      decided_at TEXT,
      expires_at TEXT,
      channel_notified TEXT,
      y_response_message TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE user_contact_preferences (
      user_id TEXT PRIMARY KEY,
      availability_mode TEXT DEFAULT 'auto_reply_on',
      share_availability_level TEXT DEFAULT 'preferences_only',
      default_response_template TEXT,
      quiet_hours_start INTEGER,
      quiet_hours_end INTEGER,
      working_hours_start INTEGER DEFAULT 9,
      working_hours_end INTEGER DEFAULT 18,
      allow_guest_contacts INTEGER DEFAULT 1,
      require_mutual_connection INTEGER DEFAULT 0,
      updated_at TEXT
    );

    CREATE TABLE contact_request_audit (
      id TEXT PRIMARY KEY,
      request_id TEXT,
      action TEXT,
      actor_type TEXT,
      actor_id TEXT,
      metadata TEXT,
      created_at TEXT
    );

    CREATE TABLE conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      agent_mode TEXT,
      title TEXT,
      summary TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE reminders (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      text TEXT,
      datetime TEXT,
      channel TEXT,
      created_at TEXT
    );
  `);
  
  return testDb;
}

/**
 * Get test database instance
 */
export function getTestDb(): Database.Database {
  if (!testDb) {
    return initTestDb();
  }
  return testDb;
}

/**
 * Close and cleanup test database
 */
export function closeTestDb(): void {
  if (testDb) {
    testDb.close();
    testDb = null;
  }
}

/**
 * Clear all data from test database
 */
export function clearTestDb(): void {
  if (!testDb) return;
  
  testDb.exec(`
    DELETE FROM contact_requests;
    DELETE FROM contact_request_audit;
    DELETE FROM conversations;
    DELETE FROM reminders;
    DELETE FROM channel_links;
    DELETE FROM user_contact_preferences;
    DELETE FROM users;
  `);
}

/**
 * Mock the db module
 */
export function mockDb(): void {
  const db = getTestDb();
  
  vi.doMock('../../src/db/index', () => ({
    db: {
      prepare: (sql: string) => ({
        run: (...params: unknown[]) => db.prepare(sql).run(...params),
        get: (...params: unknown[]) => db.prepare(sql).get(...params),
        all: (...params: unknown[]) => db.prepare(sql).all(...params),
      }),
    },
  }));
}

/**
 * Seed test data
 */
export function seedTestData(): void {
  const db = getTestDb();
  const now = new Date().toISOString();
  
  // Create test users
  db.prepare(`
    INSERT INTO users (id, email, username, name, avatar, created_at, updated_at)
    VALUES 
      ('user-x', 'x@test.com', 'userx', 'User X', null, ?, ?),
      ('user-y', 'y@test.com', 'usery', 'User Y', null, ?, ?)
  `).run(now, now, now, now);
  
  // Create channel links for User Y
  db.prepare(`
    INSERT INTO channel_links (id, user_id, channel, external_id, is_verified, created_at, updated_at)
    VALUES 
      ('link-1', 'user-y', 'telegram', '123456789', 1, ?, ?)
  `).run(now, now);
  
  // Create default preferences for User Y
  db.prepare(`
    INSERT INTO user_contact_preferences (user_id, availability_mode, working_hours_start, working_hours_end, updated_at)
    VALUES ('user-y', 'auto_reply_on', 9, 18, ?)
  `).run(now);
}
