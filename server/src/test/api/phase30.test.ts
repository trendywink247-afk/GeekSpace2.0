import { describe, test, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { resetDatabase, createTestUser, generateTestToken } from '../setup.js';

/**
 * Phase 30 Unit Tests
 * - 30.2: Markdown chat export (GET /api/agent/conversations/export?format=md)
 * - 30.3: reminders datetime index (structural, validated via reminder list sort)
 * - 30.4: snooze_count increments on bulk-snooze
 */

const app = createApp();

describe('Phase 30 — Markdown export & snooze_count', () => {
  let token: string;
  let userId: string;

  beforeEach(() => {
    resetDatabase();
    const user = createTestUser();
    userId = user.id;
    token = generateTestToken(userId);
  });

  const createReminder = async (text: string) => {
    const res = await request(app)
      .post('/api/reminders')
      .set('Authorization', `Bearer ${token}`)
      .send({ text, datetime: new Date(Date.now() + 60000).toISOString(), channel: 'push' });
    return res.body as { id: string };
  };

  // ── 30.2: Markdown export ──────────────────────────────────────────────────

  test('GET /conversations/export?format=md returns text/markdown', async () => {
    const res = await request(app)
      .get('/api/agent/conversations/export?format=md')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/markdown/);
    expect(res.headers['content-disposition']).toMatch(/agentin-chat\.md/);
  });

  test('GET /conversations/export?format=md body starts with markdown heading', async () => {
    const res = await request(app)
      .get('/api/agent/conversations/export?format=md')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Body should start with a markdown heading
    expect(res.text.trimStart()).toMatch(/^#\s/);
  });

  test('GET /conversations/export (no format param) still returns JSON', async () => {
    const res = await request(app)
      .get('/api/agent/conversations/export')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  // ── 30.4: snooze_count increments ─────────────────────────────────────────

  test('bulk-snooze increments snooze_count on each reminder', async () => {
    const r = await createReminder('Snooze counter test');

    // First snooze
    await request(app)
      .post('/api/reminders/bulk-snooze')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: [r.id], preset: '1h' });

    // Second snooze
    await request(app)
      .post('/api/reminders/bulk-snooze')
      .set('Authorization', `Bearer ${token}`)
      .send({ ids: [r.id], preset: '1h' });

    const listRes = await request(app)
      .get('/api/reminders')
      .set('Authorization', `Bearer ${token}`);

    const updated = (listRes.body as Array<{ id: string; snooze_count?: number }>)
      .find((rem) => rem.id === r.id);
    expect(updated?.snooze_count).toBe(2);
  });

  test('snooze_count starts at 0 for new reminders', async () => {
    const r = await createReminder('Fresh reminder');

    const listRes = await request(app)
      .get('/api/reminders')
      .set('Authorization', `Bearer ${token}`);

    const found = (listRes.body as Array<{ id: string; snooze_count?: number }>)
      .find((rem) => rem.id === r.id);
    // Default value is 0 (or null, treated as 0)
    expect(found?.snooze_count ?? 0).toBe(0);
  });

  // ── 30.3: datetime index presence (reminders list must be sorted) ──────────

  test('reminders are returned ordered by datetime ASC', async () => {
    const now = Date.now();
    await createReminder('Late');
    await (async () => {
      await request(app)
        .post('/api/reminders')
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'Early', datetime: new Date(now + 30000).toISOString(), channel: 'push' });
    })();

    const res = await request(app)
      .get('/api/reminders')
      .set('Authorization', `Bearer ${token}`);

    const datetimes = (res.body as Array<{ datetime: string }>).map((r) => r.datetime);
    const sorted = [...datetimes].sort();
    expect(datetimes).toEqual(sorted);
  });
});
