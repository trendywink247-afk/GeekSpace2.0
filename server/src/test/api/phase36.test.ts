// ============================================================
// Phase 36 — Unit tests for snooze log, invite Telegram notify,
// individual snooze endpoint, snooze history
// ============================================================

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { db } from '../../db/index.js';
import { v4 as uuid } from 'uuid';

const app = createApp();

// ---- 36.1: Individual Snooze Endpoint ----

describe('Individual Snooze — POST /api/reminders/:id/snooze (Phase 36.1)', () => {
  beforeAll(() => { resetDatabase(); });
  afterEach(() => { resetDatabase(); });

  it('requires authentication', async () => {
    await request(app)
      .post('/api/reminders/some-id/snooze')
      .send({ preset: '1h' })
      .expect(401);
  });

  it('returns 404 for non-existent reminder', async () => {
    const user = createTestUser();
    await request(app)
      .post('/api/reminders/nonexistent-id/snooze')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ preset: '1h' })
      .expect(404);
  });

  it('returns 400 for invalid preset', async () => {
    const user = createTestUser();
    const id = uuid();
    db.prepare(
      'INSERT INTO reminders (id, user_id, text, datetime, channel, category, recurring, created_by, scheduled_for, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, user.id, 'Test', new Date().toISOString(), 'push', 'general', '', 'user', Date.now(), 'normal');

    await request(app)
      .post(`/api/reminders/${id}/snooze`)
      .set('Authorization', makeAuthHeader(user.id))
      .send({ preset: 'invalid-preset' })
      .expect(400);
  });

  it('snoozes reminder and logs to snooze_log', async () => {
    const user = createTestUser();
    const id = uuid();
    db.prepare(
      'INSERT INTO reminders (id, user_id, text, datetime, channel, category, recurring, created_by, scheduled_for, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, user.id, 'Test snooze', new Date().toISOString(), 'push', 'general', '', 'user', Date.now(), 'normal');

    const res = await request(app)
      .post(`/api/reminders/${id}/snooze`)
      .set('Authorization', makeAuthHeader(user.id))
      .send({ preset: '1h' })
      .expect(200);

    expect(res.body.snoozed).toBe(true);
    expect(res.body.newDatetime).toBeDefined();

    // Verify log entry
    const log = db.prepare('SELECT * FROM snooze_log WHERE reminder_id = ?').get(id) as Record<string, unknown> | undefined;
    expect(log).toBeDefined();
    expect(log!.preset).toBe('1h');
    expect(log!.user_id).toBe(user.id);

    // Verify snooze_count incremented
    const reminder = db.prepare('SELECT snooze_count FROM reminders WHERE id = ?').get(id) as { snooze_count: number };
    expect(reminder.snooze_count).toBe(1);
  });

  it('returns 404 for completed reminder (cannot snooze)', async () => {
    const user = createTestUser();
    const id = uuid();
    db.prepare(
      'INSERT INTO reminders (id, user_id, text, datetime, channel, category, recurring, created_by, scheduled_for, priority, completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)'
    ).run(id, user.id, 'Done', new Date().toISOString(), 'push', 'general', '', 'user', Date.now(), 'normal');

    await request(app)
      .post(`/api/reminders/${id}/snooze`)
      .set('Authorization', makeAuthHeader(user.id))
      .send({ preset: '1h' })
      .expect(404);
  });
});

// ---- 36.1: Snooze History Endpoint ----

describe('Snooze History — GET /api/reminders/:id/snooze-history (Phase 36.1)', () => {
  beforeAll(() => { resetDatabase(); });
  afterEach(() => { resetDatabase(); });

  it('requires authentication', async () => {
    await request(app)
      .get('/api/reminders/some-id/snooze-history')
      .expect(401);
  });

  it('returns 404 for non-existent reminder', async () => {
    const user = createTestUser();
    await request(app)
      .get('/api/reminders/nonexistent/snooze-history')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(404);
  });

  it('returns empty history for reminder with no snoozes', async () => {
    const user = createTestUser();
    const id = uuid();
    db.prepare(
      'INSERT INTO reminders (id, user_id, text, datetime, channel, category, recurring, created_by, scheduled_for, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, user.id, 'No snooze', new Date().toISOString(), 'push', 'general', '', 'user', Date.now(), 'normal');

    const res = await request(app)
      .get(`/api/reminders/${id}/snooze-history`)
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(res.body.history).toEqual([]);
  });

  it('returns snooze history after snoozing', async () => {
    const user = createTestUser();
    const id = uuid();
    db.prepare(
      'INSERT INTO reminders (id, user_id, text, datetime, channel, category, recurring, created_by, scheduled_for, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, user.id, 'Snoozable', new Date().toISOString(), 'push', 'general', '', 'user', Date.now(), 'normal');

    // Insert log entries manually
    const newDt = new Date(Date.now() + 3600000).toISOString();
    db.prepare('INSERT INTO snooze_log (id, reminder_id, user_id, snoozed_at, preset, new_datetime) VALUES (?, ?, ?, ?, ?, ?)')
      .run(uuid(), id, user.id, Date.now(), '1h', newDt);

    const res = await request(app)
      .get(`/api/reminders/${id}/snooze-history`)
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(res.body.history).toHaveLength(1);
    expect(res.body.history[0].preset).toBe('1h');
    expect(res.body.history[0].new_datetime).toBe(newDt);
  });

  it('limits history to 10 entries', async () => {
    const user = createTestUser();
    const id = uuid();
    db.prepare(
      'INSERT INTO reminders (id, user_id, text, datetime, channel, category, recurring, created_by, scheduled_for, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, user.id, 'Many snoozes', new Date().toISOString(), 'push', 'general', '', 'user', Date.now(), 'normal');

    const stmt = db.prepare('INSERT INTO snooze_log (id, reminder_id, user_id, snoozed_at, preset, new_datetime) VALUES (?, ?, ?, ?, ?, ?)');
    for (let i = 0; i < 12; i++) {
      stmt.run(uuid(), id, user.id, Date.now() + i * 1000, '1h', new Date(Date.now() + 3600000).toISOString());
    }

    const res = await request(app)
      .get(`/api/reminders/${id}/snooze-history`)
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(res.body.history.length).toBeLessThanOrEqual(10);
  });
});

// ---- 36.1: Bulk Snooze logs to snooze_log ----

describe('Bulk Snooze log — POST /api/reminders/bulk-snooze (Phase 36.1)', () => {
  beforeAll(() => { resetDatabase(); });
  afterEach(() => { resetDatabase(); });

  it('logs snooze events for each snoozed reminder', async () => {
    const user = createTestUser();
    const ids: string[] = [];

    for (let i = 0; i < 3; i++) {
      const id = uuid();
      ids.push(id);
      db.prepare(
        'INSERT INTO reminders (id, user_id, text, datetime, channel, category, recurring, created_by, scheduled_for, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(id, user.id, `Reminder ${i}`, new Date().toISOString(), 'push', 'general', '', 'user', Date.now(), 'normal');
    }

    const res = await request(app)
      .post('/api/reminders/bulk-snooze')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ ids, preset: 'tomorrow' })
      .expect(200);

    expect(res.body.snoozed).toBe(3);

    const logs = db.prepare('SELECT * FROM snooze_log WHERE user_id = ?').all(user.id) as unknown[];
    expect(logs.length).toBe(3);
  });
});
