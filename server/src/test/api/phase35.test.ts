// ============================================================
// Phase 35 — Unit tests for streak counter, portfolio view count,
// Telegram auto-push config, briefing quality, widget reorder
// ============================================================

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { db } from '../../db/index.js';
import { v4 as uuid } from 'uuid';

const app = createApp();

// ---- 35.1: Streak Counter ----

describe('Reminder Streak — GET /api/reminders/streak (Phase 35.1)', () => {
  beforeAll(() => {
    resetDatabase();
  });

  afterEach(() => {
    resetDatabase();
  });

  it('requires authentication', async () => {
    await request(app)
      .get('/api/reminders/streak')
      .expect(401);
  });

  it('returns streak=0 with no completed reminders', async () => {
    const user = createTestUser();
    const res = await request(app)
      .get('/api/reminders/streak')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(res.body.streak).toBe(0);
    expect(res.body.longestStreak).toBe(0);
    expect(res.body.completedToday).toBe(false);
  });

  it('returns streak=1 after completing a reminder today', async () => {
    const user = createTestUser();
    const id = uuid();
    const now = Date.now();

    // Insert a reminder already completed today
    db.prepare(
      'INSERT INTO reminders (id, user_id, text, datetime, channel, category, recurring, created_by, completed, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)'
    ).run(id, user.id, 'Test reminder', new Date().toISOString(), 'push', 'personal', '', 'user', now);

    const res = await request(app)
      .get('/api/reminders/streak')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(res.body.streak).toBe(1);
    expect(res.body.completedToday).toBe(true);
  });

  it('sets completed_at when completing a reminder via POST /:id/complete', async () => {
    const user = createTestUser();
    const id = uuid();

    db.prepare(
      'INSERT INTO reminders (id, user_id, text, datetime, channel, category, recurring, created_by, completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)'
    ).run(id, user.id, 'Complete me', new Date().toISOString(), 'push', 'personal', '', 'user');

    await request(app)
      .post(`/api/reminders/${id}/complete`)
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    const row = db.prepare('SELECT completed_at, completed FROM reminders WHERE id = ?').get(id) as { completed_at: number | null; completed: number };
    expect(row.completed).toBe(1);
    expect(row.completed_at).toBeGreaterThan(0);
  });
});

// ---- 35.5: Portfolio View Count in Public Response ----

describe('Portfolio viewCount — GET /api/portfolio/:username (Phase 35.5)', () => {
  beforeAll(() => {
    resetDatabase();
  });

  afterEach(() => {
    resetDatabase();
  });

  it('includes viewCount=0 in public portfolio response', async () => {
    const user = createTestUser();

    // Create portfolio for test user (portfolios PK is user_id, no id column)
    db.prepare(
      "INSERT INTO portfolios (user_id, username, is_public, view_count) VALUES (?, ?, 1, 0)"
    ).run(user.id, user.username);

    const res = await request(app)
      .get(`/api/portfolio/${user.username}`)
      .expect(200);

    expect(res.body).toHaveProperty('viewCount');
    expect(res.body.viewCount).toBe(0);
  });

  it('reflects incremented view_count in public response', async () => {
    const user = createTestUser();

    db.prepare(
      "INSERT INTO portfolios (user_id, username, is_public, view_count) VALUES (?, ?, 1, 5)"
    ).run(user.id, user.username);

    const res = await request(app)
      .get(`/api/portfolio/${user.username}`)
      .expect(200);

    expect(res.body.viewCount).toBe(5);
  });
});

// ---- 35.1 (bonus): streak endpoint not confused by completed reminders with no completed_at ----

describe('Streak — null completed_at safety (Phase 35.1)', () => {
  beforeAll(() => {
    resetDatabase();
  });

  afterEach(() => {
    resetDatabase();
  });

  it('ignores reminders completed=1 but completed_at IS NULL (legacy)', async () => {
    const user = createTestUser();
    const id = uuid();

    // Insert old-style completed reminder without completed_at
    db.prepare(
      'INSERT INTO reminders (id, user_id, text, datetime, channel, category, recurring, created_by, completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)'
    ).run(id, user.id, 'Old reminder', new Date().toISOString(), 'push', 'personal', '', 'user');

    const res = await request(app)
      .get('/api/reminders/streak')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(res.body.streak).toBe(0);
    expect(res.body.completedToday).toBe(false);
  });
});
