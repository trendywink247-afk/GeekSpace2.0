// ============================================================
// Phase 38 — Unit tests for agent config fix (notif fields),
// reminder CSV export, test cleanup hardening
// ============================================================

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { db } from '../../db/index.js';
import { v4 as uuid } from 'uuid';

const app = createApp();

// ---- 38.1 + 38.2: PATCH /agent/config accepts notif_daily_briefing + notif_connections ----

describe('Agent Config — PATCH /api/agent/config notif fields (Phase 38.1)', () => {
  beforeAll(() => { resetDatabase(); });
  afterEach(() => { resetDatabase(); });

  it('saves notif_daily_briefing = 0', async () => {
    const user = createTestUser();
    const res = await request(app)
      .patch('/api/agent/config')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ notif_daily_briefing: 0 })
      .expect(200);
    expect(res.body.notif_daily_briefing).toBe(0);
  });

  it('saves notif_connections = 0', async () => {
    const user = createTestUser();
    const res = await request(app)
      .patch('/api/agent/config')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ notif_connections: 0 })
      .expect(200);
    expect(res.body.notif_connections).toBe(0);
  });

  it('returns 400 for notif_daily_briefing out of range', async () => {
    const user = createTestUser();
    await request(app)
      .patch('/api/agent/config')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ notif_daily_briefing: 5 })
      .expect(400);
  });

  it('returns 400 for notif_connections out of range', async () => {
    const user = createTestUser();
    await request(app)
      .patch('/api/agent/config')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ notif_connections: -1 })
      .expect(400);
  });

  it('can toggle both flags in one request', async () => {
    const user = createTestUser();
    const res = await request(app)
      .patch('/api/agent/config')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ notif_daily_briefing: 0, notif_connections: 0 })
      .expect(200);
    expect(res.body.notif_daily_briefing).toBe(0);
    expect(res.body.notif_connections).toBe(0);
  });

  it('GET /agent/config returns notif_daily_briefing after update', async () => {
    const user = createTestUser();
    await request(app)
      .patch('/api/agent/config')
      .set('Authorization', makeAuthHeader(user.id))
      .send({ notif_daily_briefing: 0 });
    const res = await request(app)
      .get('/api/agent/config')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);
    expect(res.body.notif_daily_briefing).toBe(0);
  });
});

// ---- 38.3: Reminder CSV Export ----

describe('Reminder CSV Export — GET /api/reminders/export.csv (Phase 38.3)', () => {
  beforeAll(() => { resetDatabase(); });
  afterEach(() => { resetDatabase(); });

  const insertReminder = (userId: string, completed = 0, text = 'Test reminder') => {
    const id = uuid();
    db.prepare(
      'INSERT INTO reminders (id, user_id, text, datetime, channel, category, recurring, created_by, scheduled_for, priority, completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, userId, text, new Date().toISOString(), 'push', 'general', '', 'user', Date.now(), 'normal', completed);
    return id;
  };

  it('requires authentication', async () => {
    await request(app).get('/api/reminders/export.csv').expect(401);
  });

  it('returns CSV with header for empty list', async () => {
    const user = createTestUser();
    const res = await request(app)
      .get('/api/reminders/export.csv')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text).toContain('text,datetime,category');
  });

  it('includes reminder data in CSV', async () => {
    const user = createTestUser();
    insertReminder(user.id, 0, 'Buy groceries');
    const res = await request(app)
      .get('/api/reminders/export.csv')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);
    expect(res.text).toContain('Buy groceries');
  });

  it('filters by status=active (only incomplete)', async () => {
    const user = createTestUser();
    insertReminder(user.id, 0, 'Active task');
    insertReminder(user.id, 1, 'Done task');
    const res = await request(app)
      .get('/api/reminders/export.csv?status=active')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);
    expect(res.text).toContain('Active task');
    expect(res.text).not.toContain('Done task');
  });

  it('filters by status=completed (only complete)', async () => {
    const user = createTestUser();
    insertReminder(user.id, 0, 'Active task');
    insertReminder(user.id, 1, 'Done task');
    const res = await request(app)
      .get('/api/reminders/export.csv?status=completed')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);
    expect(res.text).not.toContain('Active task');
    expect(res.text).toContain('Done task');
  });

  it('sets Content-Disposition attachment header', async () => {
    const user = createTestUser();
    const res = await request(app)
      .get('/api/reminders/export.csv')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    expect(res.headers['content-disposition']).toMatch(/\.csv/);
  });

  it('only exports current user reminders', async () => {
    const user = createTestUser();
    const other = createTestUser();
    insertReminder(user.id, 0, 'My reminder');
    insertReminder(other.id, 0, 'Other user reminder');
    const res = await request(app)
      .get('/api/reminders/export.csv')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);
    expect(res.text).toContain('My reminder');
    expect(res.text).not.toContain('Other user reminder');
  });

  it('escapes double quotes in CSV text', async () => {
    const user = createTestUser();
    insertReminder(user.id, 0, 'Say "hello" to team');
    const res = await request(app)
      .get('/api/reminders/export.csv')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);
    expect(res.text).toContain('""hello""');
  });
});

// ---- 38.4: Test cleanup includes new tables ----

describe('Test Cleanup — resetDatabase includes new Phase 37 tables (Phase 38.4)', () => {
  it('cleans portfolio_contacts between tests', () => {
    const user = createTestUser();
    db.prepare('INSERT INTO portfolio_contacts (id, username, user_id, sender_name, sender_email, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      uuid(), user.username, user.id, 'Test', null, 'Hi', Date.now()
    );
    expect((db.prepare('SELECT COUNT(*) as c FROM portfolio_contacts').get() as { c: number }).c).toBe(1);
    resetDatabase();
    expect((db.prepare('SELECT COUNT(*) as c FROM portfolio_contacts').get() as { c: number }).c).toBe(0);
  });

  it('cleans webhook_dead_letters between tests', () => {
    const user = createTestUser();
    db.prepare('INSERT INTO webhook_dead_letters (id, automation_id, user_id, url, error, payload, failed_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      uuid(), uuid(), user.id, 'https://test.com', 'err', null, Date.now()
    );
    expect((db.prepare('SELECT COUNT(*) as c FROM webhook_dead_letters').get() as { c: number }).c).toBe(1);
    resetDatabase();
    expect((db.prepare('SELECT COUNT(*) as c FROM webhook_dead_letters').get() as { c: number }).c).toBe(0);
  });

  it('cleans snooze_log between tests', () => {
    const user = createTestUser();
    const id = uuid();
    db.prepare('INSERT INTO reminders (id, user_id, text, datetime, channel, category, recurring, created_by, scheduled_for, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      id, user.id, 'Snooze test', new Date().toISOString(), 'push', 'general', '', 'user', Date.now(), 'normal'
    );
    db.prepare('INSERT INTO snooze_log (id, reminder_id, user_id, snoozed_at, preset, new_datetime) VALUES (?, ?, ?, ?, ?, ?)').run(
      uuid(), id, user.id, Date.now(), '1h', new Date(Date.now() + 3600000).toISOString()
    );
    expect((db.prepare('SELECT COUNT(*) as c FROM snooze_log').get() as { c: number }).c).toBe(1);
    resetDatabase();
    expect((db.prepare('SELECT COUNT(*) as c FROM snooze_log').get() as { c: number }).c).toBe(0);
  });
});
