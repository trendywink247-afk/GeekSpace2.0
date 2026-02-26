// ============================================================
// Phase 56 Tests
// ============================================================
// 56.2: Seedance stitch endpoint POST /api/videos/director/:jobId/stitch
// 56.5: API key rotation POST /api/api-keys/:id/rotate
// 56.7: Theme toggle (covered by PATCH /api/users/me, already tested)
// 56.8: /api/health/detailed
// 56.10: Reminder inline edit (frontend — not unit tested here)
// 56.13: Clip preview modal (frontend — not unit tested here)
// ============================================================

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, generateTestToken, resetDatabase } from '../setup.js';
import { db } from '../../db/index.js';
import { v4 as uuid } from 'uuid';
import { encrypt } from '../../utils/encryption.js';

const app = createApp();

describe('Phase 56', () => {
  let token: string;
  let userId: string;

  beforeAll(() => {
    resetDatabase();
    const user = createTestUser(`phase56-${Date.now()}@example.com`);
    userId = user.id;
    token = `Bearer ${generateTestToken(user.id)}`;
  });

  // ── 56.2: Stitch endpoint ────────────────────────────────────

  describe('56.2 — POST /api/videos/director/:jobId/stitch', () => {
    it('returns 404 for non-existent job', async () => {
      const res = await request(app)
        .post('/api/videos/director/nonexistent/stitch')
        .set('Authorization', token);
      expect(res.status).toBe(404);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).post('/api/videos/director/any/stitch');
      expect(res.status).toBe(401);
    });

    it('returns 409 when job is not done', async () => {
      const jobId = `dj-${uuid().slice(0, 12)}`;
      db.prepare('INSERT INTO video_jobs (id, user_id, idea, status, clips) VALUES (?, ?, ?, ?, ?)').run(
        jobId, userId, 'test idea', 'running', '[]'
      );
      const res = await request(app)
        .post(`/api/videos/director/${jobId}/stitch`)
        .set('Authorization', token);
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/running|not done|pending/i);
    });

    it('returns 400 when done job has no successful clips', async () => {
      const jobId = `dj-${uuid().slice(0, 12)}`;
      db.prepare('INSERT INTO video_jobs (id, user_id, idea, status, clips) VALUES (?, ?, ?, ?, ?)').run(
        jobId, userId, 'test idea', 'done',
        JSON.stringify([{ success: false, error: 'failed' }])
      );
      const res = await request(app)
        .post(`/api/videos/director/${jobId}/stitch`)
        .set('Authorization', token);
      expect(res.status).toBe(400);
    });

    it('returns stitch result with clipUrls for done job with successful clips', async () => {
      const jobId = `dj-${uuid().slice(0, 12)}`;
      const clips = [
        { success: true, url: 'https://cdn.fal-stub.test/clip1.mp4' },
        { success: true, url: 'https://cdn.fal-stub.test/clip2.mp4' },
      ];
      db.prepare('INSERT INTO video_jobs (id, user_id, idea, status, clips) VALUES (?, ?, ?, ?, ?)').run(
        jobId, userId, 'test idea', 'done', JSON.stringify(clips)
      );
      const res = await request(app)
        .post(`/api/videos/director/${jobId}/stitch`)
        .set('Authorization', token);
      expect(res.status).toBe(200);
      expect(res.body.stitched).toBe(true);
      expect(res.body.clipUrls).toHaveLength(2);
    });

    it('returns cached result on second stitch call', async () => {
      const jobId = `dj-${uuid().slice(0, 12)}`;
      const clips = [{ success: true, url: 'https://cdn.fal-stub.test/clip1.mp4' }];
      db.prepare('INSERT INTO video_jobs (id, user_id, idea, status, clips, stitched_url) VALUES (?, ?, ?, ?, ?, ?)').run(
        jobId, userId, 'idea', 'done', JSON.stringify(clips), 'https://cdn.example.test/stitched.mp4'
      );
      const res = await request(app)
        .post(`/api/videos/director/${jobId}/stitch`)
        .set('Authorization', token);
      expect(res.status).toBe(200);
      expect(res.body.cached).toBe(true);
      expect(res.body.stitchedUrl).toBe('https://cdn.example.test/stitched.mp4');
    });

    it('cross-user: cannot stitch another user job', async () => {
      const other = createTestUser(`phase56-other-${Date.now()}@example.com`);
      const jobId = `dj-${uuid().slice(0, 12)}`;
      db.prepare('INSERT INTO video_jobs (id, user_id, idea, status, clips) VALUES (?, ?, ?, ?, ?)').run(
        jobId, other.id, 'idea', 'done', JSON.stringify([{ success: true, url: 'https://x.test/c.mp4' }])
      );
      const res = await request(app)
        .post(`/api/videos/director/${jobId}/stitch`)
        .set('Authorization', token);
      expect(res.status).toBe(404);
    });
  });

  // ── 56.5: API key rotation ────────────────────────────────────

  describe('56.5 — POST /api/api-keys/:id/rotate', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).post('/api/api-keys/any/rotate').send({ key: 'newkey1234' });
      expect(res.status).toBe(401);
    });

    it('returns 404 for non-existent key', async () => {
      const res = await request(app)
        .post('/api/api-keys/nonexistent/rotate')
        .set('Authorization', token)
        .send({ key: 'newkey1234' });
      expect(res.status).toBe(404);
    });

    it('returns 400 for short key value', async () => {
      const keyId = uuid();
      db.prepare('INSERT INTO api_keys (id, user_id, provider, key_encrypted, masked_key) VALUES (?, ?, ?, ?, ?)').run(
        keyId, userId, 'openai', encrypt('sk-oldkey12345'), 'sk-...2345'
      );
      const res = await request(app)
        .post(`/api/api-keys/${keyId}/rotate`)
        .set('Authorization', token)
        .send({ key: 'short' });
      expect(res.status).toBe(400);
    });

    it('rotates key and returns new maskedKey', async () => {
      const keyId = uuid();
      db.prepare('INSERT INTO api_keys (id, user_id, provider, key_encrypted, masked_key) VALUES (?, ?, ?, ?, ?)').run(
        keyId, userId, 'openai', encrypt('sk-oldkey12345678'), 'sk-...5678'
      );
      const res = await request(app)
        .post(`/api/api-keys/${keyId}/rotate`)
        .set('Authorization', token)
        .send({ key: 'sk-newkeyABCDEFGH' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.maskedKey).toBe('sk-...FGHI'.slice(0, 3) + '...' + 'sk-newkeyABCDEFGH'.slice(-4));
    });

    it('cross-user: cannot rotate another user key', async () => {
      const other = createTestUser(`phase56-other2-${Date.now()}@example.com`);
      const keyId = uuid();
      db.prepare('INSERT INTO api_keys (id, user_id, provider, key_encrypted, masked_key) VALUES (?, ?, ?, ?, ?)').run(
        keyId, other.id, 'openai', encrypt('sk-otherkey12345'), 'sk-...2345'
      );
      const res = await request(app)
        .post(`/api/api-keys/${keyId}/rotate`)
        .set('Authorization', token)
        .send({ key: 'sk-newkeyABCDEFGH' });
      expect(res.status).toBe(404);
    });
  });

  // ── 56.8: /api/health/detailed ───────────────────────────────

  describe('56.8 — GET /api/health/detailed', () => {
    it('returns 200 with services object', async () => {
      const res = await request(app).get('/api/health/detailed');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('services');
      expect(res.body.services).toHaveProperty('database');
      expect(res.body.services.database.status).toBe('ok');
    });

    it('returns probeTimeMs and checkedAt', async () => {
      const res = await request(app).get('/api/health/detailed');
      expect(typeof res.body.probeTimeMs).toBe('number');
      expect(typeof res.body.checkedAt).toBe('string');
    });

    it('includes redis service', async () => {
      const res = await request(app).get('/api/health/detailed');
      expect(res.body.services).toHaveProperty('redis');
    });

    it('includes fal service', async () => {
      const res = await request(app).get('/api/health/detailed');
      expect(res.body.services).toHaveProperty('fal');
    });
  });
});
