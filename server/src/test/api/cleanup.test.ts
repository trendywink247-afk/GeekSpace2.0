/**
 * DB Cleanup Cron Tests
 *
 * Verifies that runDbCleanup() respects the 90-day retention policy
 * for activity_log entries.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { v4 as uuid } from 'uuid';
import { db } from '../../db/index.js';
import { runDbCleanup } from '../../services/cleanup.js';
import { resetDatabase, createTestUser } from '../setup.js';

describe('runDbCleanup', () => {
  let userId: string;

  beforeEach(() => {
    resetDatabase();
    const user = createTestUser('cleanup@test.com');
    userId = user.id;
  });

  afterEach(() => {
    resetDatabase();
  });

  it('deletes activity_log entries older than 90 days', () => {
    // Insert an old entry (91 days ago)
    db.prepare(
      `INSERT INTO activity_log (id, user_id, action, details, icon, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now', '-91 days'))`
    ).run(uuid(), userId, 'Old action', 'old details', 'activity');

    // Insert a recent entry
    db.prepare(
      `INSERT INTO activity_log (id, user_id, action, details, icon, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`
    ).run(uuid(), userId, 'Recent action', 'recent details', 'activity');

    const before = db.prepare('SELECT COUNT(*) as cnt FROM activity_log').get() as { cnt: number };
    expect(before.cnt).toBe(2);

    runDbCleanup();

    const after = db.prepare('SELECT COUNT(*) as cnt FROM activity_log').get() as { cnt: number };
    expect(after.cnt).toBe(1);

    const remaining = db.prepare('SELECT action FROM activity_log').get() as { action: string };
    expect(remaining.action).toBe('Recent action');
  });

  it('preserves activity_log entries younger than 90 days', () => {
    // Insert entries at 89 days ago (within retention window)
    const id1 = uuid();
    const id2 = uuid();
    db.prepare(
      `INSERT INTO activity_log (id, user_id, action, details, icon, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now', '-89 days'))`
    ).run(id1, userId, 'Near boundary action', 'details', 'activity');

    db.prepare(
      `INSERT INTO activity_log (id, user_id, action, details, icon, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now', '-1 day'))`
    ).run(id2, userId, 'Yesterday action', 'details', 'activity');

    runDbCleanup();

    const after = db.prepare('SELECT COUNT(*) as cnt FROM activity_log').get() as { cnt: number };
    expect(after.cnt).toBe(2);
  });

  it('does not fail when tables are empty', () => {
    // Should complete without throwing
    expect(() => runDbCleanup()).not.toThrow();
  });

  it('deletes multiple old entries in one pass', () => {
    // Insert 5 old entries
    for (let i = 0; i < 5; i++) {
      db.prepare(
        `INSERT INTO activity_log (id, user_id, action, details, icon, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now', '-${91 + i} days'))`
      ).run(uuid(), userId, `Old action ${i}`, `details ${i}`, 'activity');
    }

    // Insert 2 recent entries
    for (let i = 0; i < 2; i++) {
      db.prepare(
        `INSERT INTO activity_log (id, user_id, action, details, icon, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now', '-${i} days'))`
      ).run(uuid(), userId, `Recent action ${i}`, `details ${i}`, 'activity');
    }

    runDbCleanup();

    const after = db.prepare('SELECT COUNT(*) as cnt FROM activity_log').get() as { cnt: number };
    expect(after.cnt).toBe(2);
  });
});
