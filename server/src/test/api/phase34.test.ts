// ============================================================
// Phase 34 — Unit tests for sparklines stats, portfolio views,
// chat export days filter, and webhook test-fire
// ============================================================

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { db } from '../../db/index.js';
import { v4 as uuid } from 'uuid';

const app = createApp();

// ---- 34.2: Activity Stats ----

describe('Activity Stats — GET /api/activity/stats (Phase 34.2)', () => {
  beforeAll(() => {
    resetDatabase();
  });

  afterEach(() => {
    resetDatabase();
  });

  it('requires authentication', async () => {
    const res = await request(app)
      .get('/api/activity/stats')
      .expect('Content-Type', /json/)
      .expect(401);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 7 days of message and reminder counts', async () => {
    const user = createTestUser();

    // Insert a conversation_log entry for today
    const today = new Date().toISOString().slice(0, 10);
    db.prepare(
      `INSERT INTO conversation_log (id, user_id, role, content, created_at) VALUES (?, ?, 'user', 'hello', ?)`
    ).run(uuid(), user.id, `${today}T10:00:00.000Z`);

    // Insert a reminder for today
    db.prepare(
      `INSERT INTO reminders (id, user_id, text, datetime, channel, category, completed, created_by, created_at) VALUES (?, ?, ?, datetime('now'), 'push', 'personal', 0, 'test', ?)`
    ).run(uuid(), user.id, 'Test reminder', `${today}T10:00:00.000Z`);

    const res = await request(app)
      .get('/api/activity/stats')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(res.body).toHaveProperty('days');
    expect(Array.isArray(res.body.days)).toBe(true);
    expect(res.body.days).toHaveLength(7);

    // All entries should have date, messages, reminders
    for (const day of res.body.days) {
      expect(day).toHaveProperty('date');
      expect(day).toHaveProperty('messages');
      expect(day).toHaveProperty('reminders');
      expect(typeof day.messages).toBe('number');
      expect(typeof day.reminders).toBe('number');
    }

    // Today's entry should reflect the inserted data
    const todayEntry = res.body.days.find((d: { date: string }) => d.date === today);
    expect(todayEntry).toBeDefined();
    expect(todayEntry.messages).toBeGreaterThanOrEqual(1);
    expect(todayEntry.reminders).toBeGreaterThanOrEqual(1);
  });
});

// ---- 34.3: Portfolio View Count ----

describe('Portfolio View Count — POST /api/portfolio/:username/view (Phase 34.3)', () => {
  beforeAll(() => {
    resetDatabase();
  });

  afterEach(() => {
    resetDatabase();
  });

  it('increments view_count on portfolio for valid username', async () => {
    const user = createTestUser();

    // Create portfolio row with view_count starting at 0
    db.prepare(
      `INSERT OR IGNORE INTO portfolios (user_id, username, view_count) VALUES (?, ?, 0)`
    ).run(user.id, user.username);

    const res = await request(app)
      .post(`/api/portfolio/${user.username}/view`)
      .expect(200);

    expect(res.body).toHaveProperty('ok', true);

    const updated = db.prepare('SELECT view_count FROM portfolios WHERE user_id = ?').get(user.id) as { view_count: number } | undefined;
    expect(updated).toBeDefined();
    expect(updated!.view_count).toBeGreaterThanOrEqual(1);
  });

  it('returns 404 for unknown username', async () => {
    const res = await request(app)
      .post('/api/portfolio/unknown-user-xyz-9999/view')
      .expect(404);
    expect(res.body).toHaveProperty('error');
  });
});

// ---- 34.4: Chat Export Days Filter ----

describe('Chat Export Days Filter — GET /api/agent/conversations/export (Phase 34.4)', () => {
  beforeAll(() => {
    resetDatabase();
  });

  afterEach(() => {
    resetDatabase();
  });

  it('exports only conversations within the last N days when days param is provided', async () => {
    const user = createTestUser();

    // Insert an old conversation (15 days ago)
    const oldDate = new Date(Date.now() - 15 * 86400000).toISOString();
    db.prepare(
      `INSERT INTO conversation_log (id, user_id, role, content, created_at) VALUES (?, ?, 'user', 'old message', ?)`
    ).run(uuid(), user.id, oldDate);

    // Insert a recent conversation (today)
    db.prepare(
      `INSERT INTO conversation_log (id, user_id, role, content, created_at) VALUES (?, ?, 'user', 'recent message', datetime('now'))`
    ).run(uuid(), user.id);

    // Export last 7 days — should only include recent message
    const res = await request(app)
      .get('/api/agent/conversations/export?format=md&days=7')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    const body = res.text;
    expect(body).toContain('recent message');
    expect(body).not.toContain('old message');
  });

  it('exports all conversations when days param is 0 or omitted', async () => {
    const user = createTestUser();

    const oldDate = new Date(Date.now() - 30 * 86400000).toISOString();
    db.prepare(
      `INSERT INTO conversation_log (id, user_id, role, content, created_at) VALUES (?, ?, 'user', 'very old message', ?)`
    ).run(uuid(), user.id, oldDate);

    const res = await request(app)
      .get('/api/agent/conversations/export?format=md')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(res.text).toContain('very old message');
  });
});

// ---- 34.5: Webhook Test-Fire ----

describe('Webhook Test-Fire — POST /api/automations/:id/test (Phase 34.5)', () => {
  beforeAll(() => {
    resetDatabase();
  });

  afterEach(() => {
    resetDatabase();
    vi.restoreAllMocks();
  });

  it('requires authentication', async () => {
    const res = await request(app)
      .post('/api/automations/some-id/test')
      .expect(401);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 404 for unknown automation', async () => {
    const user = createTestUser();
    const res = await request(app)
      .post('/api/automations/nonexistent-automation-id/test')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(404);
    expect(res.body).toHaveProperty('error');
  });

  it('returns error when no URL is configured on automation', async () => {
    const user = createTestUser();
    const autoId = uuid();
    db.prepare(
      `INSERT INTO automations (id, user_id, name, trigger_type, action_type, action_config) VALUES (?, ?, ?, 'webhook', 'n8n-webhook', '{}')`
    ).run(autoId, user.id, 'Test Webhook');

    const res = await request(app)
      .post(`/api/automations/${autoId}/test`)
      .set('Authorization', makeAuthHeader(user.id))
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('No URL configured');
  });
});
