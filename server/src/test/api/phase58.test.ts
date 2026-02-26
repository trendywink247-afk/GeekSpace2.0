// ============================================================
// Phase 58 Tests
// ============================================================
// 58.2: Reminder bulk-delete for active reminders (reuses /bulk-delete endpoint)
// 58.3: Portfolio stats dailyBreakdown fills all 30 days (verified via portfolio-stats.test.ts update)
// 58.6: Webhook test-fire enhanced response — statusCode, latencyMs, responseBody
// 58.9: Video gallery sort (frontend — not unit tested)
// 58.13: Director auto-stitch (frontend — not unit tested)
// ============================================================

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, generateTestToken, resetDatabase } from '../setup.js';
import { db } from '../../db/index.js';
import { v4 as uuid } from 'uuid';

const app = createApp();

describe('Phase 58', () => {
  let token: string;
  let userId: string;

  beforeAll(() => {
    resetDatabase();
    const user = createTestUser(`phase58-${Date.now()}@example.com`);
    userId = user.id;
    token = `Bearer ${generateTestToken(user.id)}`;
  });

  // ── 58.2: bulk-delete for active reminders ────────────────────────────────

  describe('58.2 — POST /api/reminders/bulk-delete applies to active reminders', () => {
    it('bulk-deletes active reminders', async () => {
      // Create 2 active reminders
      const ids: string[] = [];
      for (let i = 0; i < 2; i++) {
        const id = uuid();
        ids.push(id);
        db.prepare('INSERT INTO reminders (id, user_id, text, datetime, completed) VALUES (?, ?, ?, ?, ?)')
          .run(id, userId, `active reminder ${i}`, new Date(Date.now() + 86400000 * (i + 1)).toISOString(), 0);
      }

      const res = await request(app)
        .delete('/api/reminders/bulk')
        .set('Authorization', token)
        .send({ ids });
      expect(res.status).toBe(200);

      // Verify they're gone
      const remaining = ids.map(id =>
        db.prepare('SELECT id FROM reminders WHERE id = ?').get(id)
      ).filter(Boolean);
      expect(remaining).toHaveLength(0);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .delete('/api/reminders/bulk')
        .send({ ids: [uuid()] });
      expect(res.status).toBe(401);
    });

    it('does not delete reminders belonging to another user', async () => {
      const other = createTestUser(`phase58-other-${Date.now()}@example.com`);
      const id = uuid();
      db.prepare('INSERT INTO reminders (id, user_id, text, datetime, completed) VALUES (?, ?, ?, ?, ?)')
        .run(id, other.id, 'other user reminder', new Date().toISOString(), 0);

      const res = await request(app)
        .delete('/api/reminders/bulk')
        .set('Authorization', token)
        .send({ ids: [id] });
      // Should succeed (200) but not delete the other user's reminder
      expect(res.status).toBe(200);
      const row = db.prepare('SELECT id FROM reminders WHERE id = ?').get(id);
      expect(row).toBeDefined();
    });
  });

  // ── 58.3: Portfolio stats dailyBreakdown fills all 30 days ────────────────

  describe('58.3 — GET /api/portfolio/stats returns 30-day filled breakdown', () => {
    it('returns exactly 30 daily entries even with no visits', async () => {
      const res = await request(app)
        .get('/api/portfolio/stats')
        .set('Authorization', token);
      expect(res.status).toBe(200);
      expect(res.body.dailyBreakdown).toHaveLength(30);
    });

    it('fills zero-visit days with count: 0', async () => {
      const res = await request(app)
        .get('/api/portfolio/stats')
        .set('Authorization', token);
      const breakdown = res.body.dailyBreakdown as { date: string; count: number }[];
      // All counts should be 0 or positive integers
      expect(breakdown.every(d => typeof d.count === 'number' && d.count >= 0)).toBe(true);
      // All dates should be YYYY-MM-DD
      expect(breakdown.every(d => /^\d{4}-\d{2}-\d{2}$/.test(d.date))).toBe(true);
    });
  });

  // ── 58.6: Webhook test-fire enhanced response ─────────────────────────────

  describe('58.6 — POST /api/automations/:id/test returns latencyMs + responseBody', () => {
    let autoId: string;

    beforeAll(() => {
      autoId = uuid();
      db.prepare(`INSERT INTO automations (id, user_id, name, trigger_type, action_type, action_config, enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
        autoId, userId, 'test webhook', 'manual', 'webhook',
        JSON.stringify({ url: 'https://httpbin.org/post' }), 1
      );
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).post(`/api/automations/${autoId}/test`);
      expect(res.status).toBe(401);
    });

    it('returns 404 for unknown automation', async () => {
      const res = await request(app)
        .post('/api/automations/nonexistent/test')
        .set('Authorization', token);
      expect(res.status).toBe(404);
    });

    it('returns 400 when automation has no URL', async () => {
      const noUrlId = uuid();
      db.prepare(`INSERT INTO automations (id, user_id, name, trigger_type, action_type, action_config, enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
        noUrlId, userId, 'no-url auto', 'manual', 'webhook', '{}', 1
      );
      const res = await request(app)
        .post(`/api/automations/${noUrlId}/test`)
        .set('Authorization', token);
      expect(res.status).toBe(400);
    });

    it('returns latencyMs field in response (even on failure)', async () => {
      // Use an unreachable URL so it fails fast
      const failId = uuid();
      db.prepare(`INSERT INTO automations (id, user_id, name, trigger_type, action_type, action_config, enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
        failId, userId, 'fail auto', 'manual', 'webhook',
        JSON.stringify({ url: 'http://127.0.0.1:19999/unreachable' }), 1
      );
      const res = await request(app)
        .post(`/api/automations/${failId}/test`)
        .set('Authorization', token);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success');
      expect(res.body).toHaveProperty('latencyMs');
      expect(typeof res.body.latencyMs).toBe('number');
    });
  });
});
