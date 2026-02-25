// ============================================================
// Phase 39 — Unit tests for:
//   39.1 handleSnooze via proper endpoint (snooze_log entry)
//   39.3/39.7 GET /activity offset pagination
//   39.4 preferred_free_model in agent config
//   39.5 priority quick-edit via PATCH /reminders/:id
// ============================================================

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { db } from '../../db/index.js';
import { v4 as uuid } from 'uuid';

const app = createApp();

// ── 39.7: GET /activity with offset pagination ─────────────────────────────

describe('Activity — GET /api/activity offset pagination (Phase 39.7)', () => {
  beforeAll(() => { resetDatabase(); });
  afterEach(() => { resetDatabase(); });

  it('returns total count alongside activity', async () => {
    const user = createTestUser();
    // Insert 3 activity entries
    for (let i = 0; i < 3; i++) {
      db.prepare('INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, ?, ?, ?)')
        .run(uuid(), user.id, `Action ${i}`, 'detail', 'bell');
    }
    const res = await request(app)
      .get('/api/activity?limit=2&offset=0')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);
    expect(res.body.activity).toHaveLength(2);
    expect(res.body.total).toBe(3);
  });

  it('supports offset to load second page', async () => {
    const user = createTestUser();
    for (let i = 0; i < 5; i++) {
      db.prepare('INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, ?, ?, ?)')
        .run(uuid(), user.id, `Action ${i}`, 'detail', 'bell');
    }
    const page1 = await request(app)
      .get('/api/activity?limit=3&offset=0')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);
    const page2 = await request(app)
      .get('/api/activity?limit=3&offset=3')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);
    expect(page1.body.activity).toHaveLength(3);
    expect(page2.body.activity).toHaveLength(2);
    expect(page1.body.total).toBe(5);
    // Ensure no overlap between pages
    const ids1 = page1.body.activity.map((e: { id: string }) => e.id);
    const ids2 = page2.body.activity.map((e: { id: string }) => e.id);
    expect(ids1.filter((id: string) => ids2.includes(id))).toHaveLength(0);
  });

  it('requires auth', async () => {
    await request(app).get('/api/activity').expect(401);
  });

  it('returns empty array for user with no activity', async () => {
    const user = createTestUser();
    const res = await request(app)
      .get('/api/activity')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);
    expect(res.body.activity).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });

  it('only returns current user entries', async () => {
    const user1 = createTestUser();
    const user2 = createTestUser(`other-${Date.now()}@example.com`);
    db.prepare('INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, ?, ?, ?)')
      .run(uuid(), user2.id, 'Other action', 'detail', 'bell');
    const res = await request(app)
      .get('/api/activity')
      .set('Authorization', makeAuthHeader(user1.id))
      .expect(200);
    expect(res.body.activity).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });
});

// ── 39.1: POST /reminders/:id/snooze creates snooze_log entry ─────────────

describe('Reminders — snooze endpoint creates log entry (Phase 39.1)', () => {
  beforeAll(() => { resetDatabase(); });
  afterEach(() => { resetDatabase(); });

  it('snooze with preset creates snooze_log row', async () => {
    const user = createTestUser();
    const remId = uuid();
    db.prepare(
      'INSERT INTO reminders (id, user_id, text, datetime, channel, category, scheduled_for) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(remId, user.id, 'Test', new Date().toISOString(), 'push', 'general', Date.now() + 3600000);

    const res = await request(app)
      .post(`/api/reminders/${remId}/snooze`)
      .set('Authorization', makeAuthHeader(user.id))
      .send({ preset: '1h' })
      .expect(200);
    expect(res.body.snoozed).toBe(true);
    expect(res.body.newDatetime).toBeTruthy();

    const log = db.prepare('SELECT * FROM snooze_log WHERE reminder_id = ?').get(remId);
    expect(log).toBeTruthy();
    expect((log as { preset: string }).preset).toBe('1h');
  });

  it('snooze 1h returns datetime ~1h from now', async () => {
    const user = createTestUser();
    const remId = uuid();
    db.prepare(
      'INSERT INTO reminders (id, user_id, text, datetime, channel, category, scheduled_for) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(remId, user.id, 'Test', new Date().toISOString(), 'push', 'general', Date.now() + 3600000);

    const before = Date.now();
    const res = await request(app)
      .post(`/api/reminders/${remId}/snooze`)
      .set('Authorization', makeAuthHeader(user.id))
      .send({ preset: '1h' })
      .expect(200);
    const newTime = new Date(res.body.newDatetime).getTime();
    expect(newTime).toBeGreaterThan(before + 3500000);
    expect(newTime).toBeLessThan(before + 3700000);
  });

  it('404 on non-existent reminder', async () => {
    const user = createTestUser();
    await request(app)
      .post(`/api/reminders/${uuid()}/snooze`)
      .set('Authorization', makeAuthHeader(user.id))
      .send({ preset: '1h' })
      .expect(404);
  });
});

// ── 39.4: preferred_free_model in PATCH /agent/config ─────────────────────

describe('Agent Config — preferred_free_model (Phase 39.4)', () => {
  beforeAll(() => { resetDatabase(); });
  afterEach(() => { resetDatabase(); });

  it('saves preferred_free_model string', async () => {
    const user = createTestUser();
    const res = await request(app)
      .patch('/api/agent/config')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ preferred_free_model: 'meta-llama/llama-3.1-8b-instruct:free' })
      .expect(200);
    expect(res.body.preferred_free_model).toBe('meta-llama/llama-3.1-8b-instruct:free');
  });

  it('saves empty preferred_free_model (reset to auto)', async () => {
    const user = createTestUser();
    const res = await request(app)
      .patch('/api/agent/config')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ preferred_free_model: '' })
      .expect(200);
    // Should store empty string or null — just confirm it doesn't error
    expect(res.status).toBe(200);
  });

  it('rejects preferred_free_model > 200 chars', async () => {
    const user = createTestUser();
    await request(app)
      .patch('/api/agent/config')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ preferred_free_model: 'a'.repeat(201) })
      .expect(400);
  });
});

// ── 39.5: PATCH /reminders/:id for priority change ─────────────────────────

describe('Reminders — priority quick-edit (Phase 39.5)', () => {
  beforeAll(() => { resetDatabase(); });
  afterEach(() => { resetDatabase(); });

  it('PATCH priority to high', async () => {
    const user = createTestUser();
    const remId = uuid();
    db.prepare(
      'INSERT INTO reminders (id, user_id, text, datetime, channel, category, scheduled_for, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(remId, user.id, 'Test', new Date().toISOString(), 'push', 'general', Date.now(), 'normal');

    const res = await request(app)
      .patch(`/api/reminders/${remId}`)
      .set('Authorization', makeAuthHeader(user.id))
      .send({ priority: 'high' })
      .expect(200);
    expect(res.body.priority).toBe('high');
  });

  it('PATCH priority cycles to urgent', async () => {
    const user = createTestUser();
    const remId = uuid();
    db.prepare(
      'INSERT INTO reminders (id, user_id, text, datetime, channel, category, scheduled_for, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(remId, user.id, 'Test', new Date().toISOString(), 'push', 'general', Date.now(), 'high');

    const res = await request(app)
      .patch(`/api/reminders/${remId}`)
      .set('Authorization', makeAuthHeader(user.id))
      .send({ priority: 'urgent' })
      .expect(200);
    expect(res.body.priority).toBe('urgent');
  });

  it('PATCH priority to low', async () => {
    const user = createTestUser();
    const remId = uuid();
    db.prepare(
      'INSERT INTO reminders (id, user_id, text, datetime, channel, category, scheduled_for, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(remId, user.id, 'Test', new Date().toISOString(), 'push', 'general', Date.now(), 'normal');

    const res = await request(app)
      .patch(`/api/reminders/${remId}`)
      .set('Authorization', makeAuthHeader(user.id))
      .send({ priority: 'low' })
      .expect(200);
    expect(res.body.priority).toBe('low');
  });

  it('404 when reminder not found', async () => {
    const user = createTestUser();
    await request(app)
      .patch(`/api/reminders/${uuid()}`)
      .set('Authorization', makeAuthHeader(user.id))
      .send({ priority: 'high' })
      .expect(404);
  });
});
