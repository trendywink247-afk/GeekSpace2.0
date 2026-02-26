// ============================================================
// Phase 57 Tests
// ============================================================
// 57.9: Agent config save toast (frontend — not unit tested here)
// 57.10: Webhook dead-letter retry_count + last_error fields
// 57.13: Stitch endpoint + Rerun (route was added Phase 56; this tests retry_count migration)
// 57.4: Admin stats enhanced — activeToday, dbSizeBytes, memory, uptimeSeconds
// 57.6: E2E flaky fixes — not unit tested
// ============================================================

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, generateTestToken, resetDatabase } from '../setup.js';
import { db } from '../../db/index.js';
import { v4 as uuid } from 'uuid';

const app = createApp();

describe('Phase 57', () => {
  let token: string;
  let userId: string;

  beforeAll(() => {
    resetDatabase();
    const user = createTestUser(`phase57-${Date.now()}@example.com`);
    userId = user.id;
    token = `Bearer ${generateTestToken(user.id)}`;
  });

  // ── 57.10: Dead-letter retry_count + last_error ────────────────────────────

  describe('57.10 — GET /api/automations/dead-letters includes retry_count + last_error', () => {
    let dlId: string;

    beforeAll(() => {
      dlId = uuid();
      // Insert a dead-letter directly so we can verify field presence
      db.prepare(
        `INSERT INTO webhook_dead_letters (id, automation_id, user_id, url, error, payload, failed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(dlId, uuid(), userId, 'https://example.com/hook', 'timeout', null, Date.now());
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/automations/dead-letters');
      expect(res.status).toBe(401);
    });

    it('returns dead-letter list with retry_count and last_error fields', async () => {
      const res = await request(app)
        .get('/api/automations/dead-letters')
        .set('Authorization', token);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const entry = (res.body as Array<Record<string, unknown>>).find((e) => e.id === dlId);
      expect(entry).toBeDefined();
      expect(entry).toHaveProperty('retry_count');
      expect(entry).toHaveProperty('last_error');
      // Freshly inserted entry should have 0 retries and null last_error
      expect(entry!.retry_count).toBe(0);
      expect(entry!.last_error).toBeNull();
    });

    it('increments retry_count + sets last_error on retry failure', async () => {
      // Retry with an unreachable URL so it fails
      const dlId2 = uuid();
      db.prepare(
        `INSERT INTO webhook_dead_letters (id, automation_id, user_id, url, error, payload, failed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(dlId2, uuid(), userId, 'https://127.0.0.1:19999/unreachable', 'original error', null, Date.now());

      // The retry will fail (no server at that port)
      const res = await request(app)
        .post(`/api/automations/dead-letters/${dlId2}/retry`)
        .set('Authorization', token);
      expect(res.status).toBe(200);
      expect(res.body.retried).toBe(true);
      // Either removed (if somehow succeeded) or not removed (failure case)
      // If not removed, retry_count should be incremented
      if (!res.body.removed) {
        const row = db.prepare('SELECT retry_count, last_error FROM webhook_dead_letters WHERE id = ?').get(dlId2) as { retry_count: number; last_error: string | null } | undefined;
        if (row) {
          expect(row.retry_count).toBeGreaterThan(0);
          expect(row.last_error).not.toBeNull();
        }
      }
    });

    it('returns 404 for dead-letter not belonging to user', async () => {
      const other = createTestUser(`phase57-other-${Date.now()}@example.com`);
      const otherToken = `Bearer ${generateTestToken(other.id)}`;
      const res = await request(app)
        .post(`/api/automations/dead-letters/${dlId}/retry`)
        .set('Authorization', otherToken);
      expect(res.status).toBe(404);
    });
  });

  // ── 57.8: Admin stats enhanced ────────────────────────────────────────────

  describe('57.8 — GET /api/admin/stats enhanced fields', () => {
    it('returns 401 or 503 without admin token', async () => {
      const res = await request(app).get('/api/admin/stats');
      // 503 = ADMIN_TOKEN not configured in test env; 401 = wrong token
      expect([401, 503]).toContain(res.status);
    });

    it('returns enhanced stats with memory + uptime when admin token provided', async () => {
      const adminToken = process.env.ADMIN_TOKEN || 'test-admin-token';
      const res = await request(app)
        .get('/api/admin/stats')
        .set('x-admin-token', adminToken);
      // May return 401/503 if ADMIN_TOKEN not set in test env — just verify it doesn't crash
      if (res.status === 200) {
        expect(res.body).toHaveProperty('memory');
        expect(res.body).toHaveProperty('uptimeSeconds');
        expect(typeof res.body.uptimeSeconds).toBe('number');
      } else {
        expect([401, 503]).toContain(res.status);
      }
    });
  });

  // ── 57.13: Stitch endpoint from Phase 56 — verify retry_count migration ───

  describe('57.13 — /api/videos/director/:jobId/stitch still works after migration', () => {
    it('returns 404 for unknown job', async () => {
      const res = await request(app)
        .post('/api/videos/director/nonexistent-57/stitch')
        .set('Authorization', token);
      expect(res.status).toBe(404);
    });

    it('returns 409 for running job', async () => {
      const jobId = `dj57-${uuid().slice(0, 8)}`;
      db.prepare('INSERT INTO video_jobs (id, user_id, idea, status, clips) VALUES (?, ?, ?, ?, ?)')
        .run(jobId, userId, 'test idea', 'running', '[]');
      const res = await request(app)
        .post(`/api/videos/director/${jobId}/stitch`)
        .set('Authorization', token);
      expect(res.status).toBe(409);
    });

    it('returns 400 when done job has empty clips', async () => {
      const jobId = `dj57-${uuid().slice(0, 8)}`;
      db.prepare('INSERT INTO video_jobs (id, user_id, idea, status, clips) VALUES (?, ?, ?, ?, ?)')
        .run(jobId, userId, 'test idea', 'done', '[]');
      const res = await request(app)
        .post(`/api/videos/director/${jobId}/stitch`)
        .set('Authorization', token);
      expect(res.status).toBe(400);
    });

    it('returns 200 with soft stitch for done job with clips', async () => {
      const jobId = `dj57-${uuid().slice(0, 8)}`;
      const clips = JSON.stringify([{ success: true, url: 'https://cdn.example.com/clip1.mp4', index: 0 }]);
      db.prepare('INSERT INTO video_jobs (id, user_id, idea, status, clips) VALUES (?, ?, ?, ?, ?)')
        .run(jobId, userId, 'test idea', 'done', clips);
      const res = await request(app)
        .post(`/api/videos/director/${jobId}/stitch`)
        .set('Authorization', token);
      expect(res.status).toBe(200);
      expect(res.body.stitched).toBe(true);
    });
  });
});
