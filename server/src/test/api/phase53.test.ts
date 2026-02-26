// ============================================================
// Phase 53 Tests
// ============================================================
// 53.1: CI workflow check (N/A — CI-level)
// 53.2: Agent chat search (frontend — not unit tested here)
// 53.3: CSP audit — form-action, worker-src, manifest-src directives
// 53.4: Reminder bulk-restore-snooze endpoint
// 53.5: Redis cache for automations list (X-Cache header)
// 53.6: /api/ready includes automations count
// 53.7: Automation log pagination (offset param)
// 53.8: Reminder count badge (frontend — not unit tested here)
// 53.9: Avatar upload preview (frontend — not unit tested here)
// ============================================================

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { v4 as uuid } from 'uuid';
import { createApp } from '../../app.js';
import { createTestUser, generateTestToken, resetDatabase } from '../setup.js';
import { db } from '../../db/index.js';

const app = createApp();

describe('Phase 53', () => {
  let token: string;
  let userId: string;

  beforeAll(() => {
    resetDatabase();
    const user = createTestUser(`phase53-${Date.now()}@example.com`);
    userId = user.id;
    token = `Bearer ${generateTestToken(user.id)}`;
  });

  // ── 53.3: CSP audit ───────────────────────────────────────

  describe('53.3 — CSP / security header coverage', () => {
    it('GET /api/health returns 200', async () => {
      const res = await request(app).get('/api/health').expect(200);
      expect(res.status).toBe(200);
    });

    it('Referrer-Policy header is always present', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['referrer-policy']).toBeDefined();
    });

    it('Permissions-Policy header is present', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['permissions-policy']).toBeDefined();
    });
  });

  // ── 53.4: Bulk restore-snooze ────────────────────────────

  describe('53.4 — POST /api/reminders/bulk-restore-snooze', () => {
    let completedReminderId: string;

    beforeAll(() => {
      completedReminderId = uuid();
      db.prepare(
        `INSERT INTO reminders (id, user_id, text, datetime, channel, completed)
         VALUES (?, ?, 'Completed task', datetime('now', '-1 hour'), 'telegram', 1)`
      ).run(completedReminderId, userId);
    });

    it('returns 400 when ids array is empty', async () => {
      const res = await request(app)
        .post('/api/reminders/bulk-restore-snooze')
        .set('Authorization', token)
        .send({ ids: [], preset: '1h' });
      expect(res.status).toBe(400);
    });

    it('returns 400 when preset is invalid', async () => {
      const res = await request(app)
        .post('/api/reminders/bulk-restore-snooze')
        .set('Authorization', token)
        .send({ ids: [completedReminderId], preset: 'invalid' });
      expect(res.status).toBe(400);
    });

    it('restores completed reminder and snoozes with 1h preset', async () => {
      // Mark as completed before test
      db.prepare('UPDATE reminders SET completed = 1 WHERE id = ?').run(completedReminderId);

      const res = await request(app)
        .post('/api/reminders/bulk-restore-snooze')
        .set('Authorization', token)
        .send({ ids: [completedReminderId], preset: '1h' });
      expect(res.status).toBe(200);
      expect(res.body.restored).toBe(1);
      expect(res.body.newDatetime).toBeDefined();

      const r = db.prepare('SELECT completed FROM reminders WHERE id = ?').get(completedReminderId) as { completed: number } | undefined;
      expect(r?.completed).toBe(0);
    });

    it('restores and snoozes with tomorrow preset', async () => {
      db.prepare('UPDATE reminders SET completed = 1 WHERE id = ?').run(completedReminderId);

      const res = await request(app)
        .post('/api/reminders/bulk-restore-snooze')
        .set('Authorization', token)
        .send({ ids: [completedReminderId], preset: 'tomorrow' });
      expect(res.status).toBe(200);
      expect(res.body.restored).toBe(1);
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app)
        .post('/api/reminders/bulk-restore-snooze')
        .send({ ids: [completedReminderId], preset: '1h' });
      expect(res.status).toBe(401);
    });
  });

  // ── 53.6: /api/ready includes automations count ──────────

  describe('53.6 — GET /api/ready', () => {
    it('returns 200 with status:ready and automations count', async () => {
      const res = await request(app).get('/api/ready').expect(200);
      expect(res.body.status).toBe('ready');
      expect(res.body.db).toBe('ok');
      expect(typeof res.body.automations).toBe('number');
      expect(res.body.automations).toBeGreaterThanOrEqual(0);
    });
  });

  // ── 53.7: Automation log pagination ──────────────────────

  describe('53.7 — GET /api/automations/logs pagination', () => {
    it('returns paginated response with logs, limit, offset fields', async () => {
      const res = await request(app)
        .get('/api/automations/logs?limit=10&offset=0')
        .set('Authorization', token);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.logs)).toBe(true);
      expect(typeof res.body.limit).toBe('number');
      expect(typeof res.body.offset).toBe('number');
    });

    it('respects limit parameter', async () => {
      const res = await request(app)
        .get('/api/automations/logs?limit=2')
        .set('Authorization', token);
      expect(res.status).toBe(200);
      expect(res.body.logs.length).toBeLessThanOrEqual(2);
    });

    it('returns empty logs with large offset', async () => {
      const res = await request(app)
        .get('/api/automations/logs?offset=9999')
        .set('Authorization', token);
      expect(res.status).toBe(200);
      expect(res.body.logs.length).toBe(0);
    });
  });

  // ── 53.5: Automations list caching ───────────────────────

  describe('53.5 — GET /api/automations Redis cache', () => {
    it('returns automations list with 200', async () => {
      const res = await request(app)
        .get('/api/automations')
        .set('Authorization', token);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('second call also returns 200 (Redis unavailable in test is graceful)', async () => {
      const res = await request(app)
        .get('/api/automations')
        .set('Authorization', token);
      expect(res.status).toBe(200);
    });
  });
});
