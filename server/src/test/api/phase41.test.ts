// ============================================================
// Phase 41 — Unit tests for:
//   41.1 POST /reminders/bulk-complete — marks selected reminders complete
//   41.4 GET /reminders/stats — returns correct counts
//   41.5 DELETE /activity/:id — deletes single entry
// ============================================================

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { db } from '../../db/index.js';
import { v4 as uuid } from 'uuid';

const app = createApp();

// ── 41.1: Bulk Complete ────────────────────────────────────────────────────

describe('Reminders — POST /api/reminders/bulk-complete (Phase 41.1)', () => {
  beforeAll(() => { resetDatabase(); });
  afterEach(() => { resetDatabase(); });

  it('marks selected reminders as complete and returns updated count', async () => {
    const user = createTestUser();
    const id1 = uuid();
    const id2 = uuid();
    const id3 = uuid();
    const now = Date.now();

    for (const id of [id1, id2, id3]) {
      db.prepare(
        'INSERT INTO reminders (id, user_id, text, datetime, channel, category, created_by, scheduled_for) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(id, user.id, `Reminder ${id}`, new Date().toISOString(), 'push', 'general', 'user', now + 3600000);
    }

    const res = await request(app)
      .post('/api/reminders/bulk-complete')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ ids: [id1, id2] })
      .expect(200);

    expect(res.body.updated).toBe(2);

    const r1 = db.prepare('SELECT completed FROM reminders WHERE id = ?').get(id1) as { completed: number };
    const r3 = db.prepare('SELECT completed FROM reminders WHERE id = ?').get(id3) as { completed: number };
    expect(r1.completed).toBe(1);
    expect(r3.completed).toBe(0);
  });

  it('only affects reminders owned by the requesting user', async () => {
    const user1 = createTestUser();
    const user2 = createTestUser();
    const remId = uuid();
    const now = Date.now();

    db.prepare(
      'INSERT INTO reminders (id, user_id, text, datetime, channel, category, created_by, scheduled_for) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(remId, user2.id, 'Other user reminder', new Date().toISOString(), 'push', 'general', 'user', now + 3600000);

    const res = await request(app)
      .post('/api/reminders/bulk-complete')
      .set('Authorization', makeAuthHeader(user1.id))
      .send({ ids: [remId] })
      .expect(200);

    expect(res.body.updated).toBe(0);

    const r = db.prepare('SELECT completed FROM reminders WHERE id = ?').get(remId) as { completed: number };
    expect(r.completed).toBe(0);
  });

  it('returns 400 for empty ids array', async () => {
    const user = createTestUser();
    await request(app)
      .post('/api/reminders/bulk-complete')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ ids: [] })
      .expect(400);
  });

  it('requires authentication', async () => {
    await request(app)
      .post('/api/reminders/bulk-complete')
      .send({ ids: [uuid()] })
      .expect(401);
  });
});

// ── 41.4: Reminder Stats ───────────────────────────────────────────────────

describe('Reminders — GET /api/reminders/stats (Phase 41.4)', () => {
  beforeAll(() => { resetDatabase(); });
  afterEach(() => { resetDatabase(); });

  it('returns correct counts for total, active, completed, overdue, byPriority', async () => {
    const user = createTestUser();
    const now = Date.now();
    const future = now + 3600000;
    const past = now - 3600000;

    // 1 active (future, normal priority)
    db.prepare(
      'INSERT INTO reminders (id, user_id, text, datetime, channel, category, created_by, scheduled_for, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(uuid(), user.id, 'Active', new Date(future).toISOString(), 'push', 'general', 'user', future, 'normal');

    // 1 overdue (past, high priority)
    db.prepare(
      'INSERT INTO reminders (id, user_id, text, datetime, channel, category, created_by, scheduled_for, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(uuid(), user.id, 'Overdue', new Date(past).toISOString(), 'push', 'general', 'user', past, 'high');

    // 1 completed (future)
    const completedId = uuid();
    db.prepare(
      'INSERT INTO reminders (id, user_id, text, datetime, channel, category, created_by, scheduled_for, completed, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(completedId, user.id, 'Done', new Date(future).toISOString(), 'push', 'general', 'user', future, 1, 'low');

    const res = await request(app)
      .get('/api/reminders/stats')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(res.body.total).toBe(3);
    expect(res.body.active).toBe(1);
    expect(res.body.overdue).toBe(1);
    expect(res.body.completed).toBe(1);
    expect(res.body.byPriority.normal).toBe(1);
    expect(res.body.byPriority.high).toBe(1);
    expect(res.body.byPriority.low).toBe(0); // completed not counted
  });

  it('requires authentication', async () => {
    await request(app)
      .get('/api/reminders/stats')
      .expect(401);
  });
});

// ── 41.5: DELETE /activity/:id ─────────────────────────────────────────────

describe('Activity — DELETE /api/activity/:id (Phase 41.5)', () => {
  beforeAll(() => { resetDatabase(); });
  afterEach(() => { resetDatabase(); });

  it('deletes single activity entry and returns deleted: 1', async () => {
    const user = createTestUser();
    const entryId = uuid();
    db.prepare('INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, ?, ?, ?)')
      .run(entryId, user.id, 'Test action', 'test detail', 'bell');

    const res = await request(app)
      .delete(`/api/activity/${entryId}`)
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(res.body.deleted).toBe(1);

    const count = (db.prepare('SELECT COUNT(*) as c FROM activity_log WHERE id = ?').get(entryId) as { c: number }).c;
    expect(count).toBe(0);
  });

  it('returns 404 when trying to delete another user\'s entry', async () => {
    const user1 = createTestUser();
    const user2 = createTestUser();
    const entryId = uuid();
    db.prepare('INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, ?, ?, ?)')
      .run(entryId, user2.id, 'Other action', 'detail', 'bell');

    await request(app)
      .delete(`/api/activity/${entryId}`)
      .set('Authorization', makeAuthHeader(user1.id))
      .expect(404);

    // Entry still exists
    const count = (db.prepare('SELECT COUNT(*) as c FROM activity_log WHERE id = ?').get(entryId) as { c: number }).c;
    expect(count).toBe(1);
  });

  it('returns 404 for non-existent entry', async () => {
    const user = createTestUser();
    await request(app)
      .delete(`/api/activity/${uuid()}`)
      .set('Authorization', makeAuthHeader(user.id))
      .expect(404);
  });

  it('requires authentication', async () => {
    await request(app)
      .delete(`/api/activity/${uuid()}`)
      .expect(401);
  });
});
