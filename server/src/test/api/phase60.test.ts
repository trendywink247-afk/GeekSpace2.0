// ============================================================
// Phase 60 Tests
// ============================================================
// 60.2: Chat message starring/pinning
// 60.3: Reminder export to iCal (.ics)
// 60.13: Seedance per-clip retry endpoint
// ============================================================

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, generateTestToken, resetDatabase } from '../setup.js';
import { db } from '../../db/index.js';
import { v4 as uuid } from 'uuid';

const app = createApp();

describe('Phase 60', () => {
  let token: string;
  let userId: string;

  beforeAll(() => {
    resetDatabase();
    const user = createTestUser(`phase60-${Date.now()}@example.com`);
    userId = user.id;
    token = `Bearer ${generateTestToken(user.id)}`;
  });

  // ── 60.2: Chat message starring ──────────────────────────────────────────────

  describe('60.2 — POST /api/agent/conversations/:id/star', () => {
    let convId: string;

    beforeAll(() => {
      convId = uuid();
      db.prepare(`INSERT INTO conversation_log (id, user_id, role, content, provider, model, summary, tags)
        VALUES (?, ?, 'user', 'Hello world', 'test', 'test', '', '')`).run(convId, userId);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).post(`/api/agent/conversations/${convId}/star`);
      expect(res.status).toBe(401);
    });

    it('toggles starred to true on first call', async () => {
      const res = await request(app)
        .post(`/api/agent/conversations/${convId}/star`)
        .set('Authorization', token);
      expect(res.status).toBe(200);
      expect(res.body.starred).toBe(true);
    });

    it('toggles starred back to false on second call', async () => {
      const res = await request(app)
        .post(`/api/agent/conversations/${convId}/star`)
        .set('Authorization', token);
      expect(res.status).toBe(200);
      expect(res.body.starred).toBe(false);
    });

    it('returns 404 for nonexistent message', async () => {
      const res = await request(app)
        .post(`/api/agent/conversations/${uuid()}/star`)
        .set('Authorization', token);
      expect(res.status).toBe(404);
    });
  });

  describe('60.2 — GET /api/agent/conversations/starred', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/agent/conversations/starred');
      expect(res.status).toBe(401);
    });

    it('returns only starred messages for the user', async () => {
      // star one message
      const convId2 = uuid();
      db.prepare(`INSERT INTO conversation_log (id, user_id, role, content, provider, model, summary, tags, starred)
        VALUES (?, ?, 'assistant', 'Starred reply', 'test', 'test', '', '', 1)`).run(convId2, userId);

      const res = await request(app)
        .get('/api/agent/conversations/starred')
        .set('Authorization', token);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.messages)).toBe(true);
      expect(res.body.messages.some((m: { id: string }) => m.id === convId2)).toBe(true);
    });
  });

  // ── 60.3: Reminder iCal export ─────────────────────────────────────────────

  describe('60.3 — GET /api/reminders/export.ics', () => {
    beforeAll(() => {
      db.prepare(`INSERT INTO reminders (id, user_id, text, datetime, channel, category, completed)
        VALUES (?, ?, ?, ?, ?, ?, ?)`).run(uuid(), userId, 'Standup meeting', '2025-06-01T09:00:00.000Z', 'email', 'work', 0);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/reminders/export.ics');
      expect(res.status).toBe(401);
    });

    it('returns valid iCal content-type', async () => {
      const res = await request(app)
        .get('/api/reminders/export.ics')
        .set('Authorization', token);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/calendar/);
    });

    it('contains VCALENDAR and VEVENT blocks', async () => {
      const res = await request(app)
        .get('/api/reminders/export.ics')
        .set('Authorization', token);
      expect(res.text).toContain('BEGIN:VCALENDAR');
      expect(res.text).toContain('END:VCALENDAR');
      expect(res.text).toContain('BEGIN:VEVENT');
    });

    it('includes reminder text in SUMMARY', async () => {
      const res = await request(app)
        .get('/api/reminders/export.ics?status=all')
        .set('Authorization', token);
      expect(res.text).toContain('SUMMARY:Standup meeting');
    });
  });

  // ── 60.13: Per-clip retry ──────────────────────────────────────────────────

  describe('60.13 — POST /api/videos/director/:jobId/retry-clip/:clipIndex', () => {
    let jobId: string;

    beforeAll(() => {
      jobId = `dj-${uuid().slice(0, 12)}`;
      const packet = JSON.stringify({
        title: 'Test Film',
        genre: 'Cinematic',
        styleGuide: 'dark and moody',
        transitions: 'dissolve',
        shotlist: Array.from({ length: 6 }, (_, i) => ({
          index: i + 1,
          prompt: `Shot ${i + 1}: test scene`,
          cameraMove: 'static',
        })),
      });
      const clips = JSON.stringify([
        { success: true, url: 'https://cdn.example.com/clip1.mp4' },
        { success: false, url: '', error: 'timeout' },
        { success: true, url: 'https://cdn.example.com/clip3.mp4' },
        { success: false, url: '', error: 'timeout' },
        { success: true, url: 'https://cdn.example.com/clip5.mp4' },
        { success: true, url: 'https://cdn.example.com/clip6.mp4' },
      ]);
      db.prepare(`INSERT INTO video_jobs (id, user_id, idea, status, packet, clips)
        VALUES (?, ?, ?, ?, ?, ?)`).run(jobId, userId, 'test idea', 'done', packet, clips);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).post(`/api/videos/director/${jobId}/retry-clip/1`);
      expect(res.status).toBe(401);
    });

    it('returns 400 for invalid clip index', async () => {
      const res = await request(app)
        .post(`/api/videos/director/${jobId}/retry-clip/10`)
        .set('Authorization', token);
      expect(res.status).toBe(400);
    });

    it('returns 404 for nonexistent job', async () => {
      const res = await request(app)
        .post(`/api/videos/director/dj-nonexistent/retry-clip/0`)
        .set('Authorization', token);
      expect(res.status).toBe(404);
    });

    it('accepts retry for a valid failed clip and responds immediately', async () => {
      const res = await request(app)
        .post(`/api/videos/director/${jobId}/retry-clip/1`)
        .set('Authorization', token);
      // In TEST_MODE, fal.ai is stubbed so it should succeed
      expect(res.status).toBe(200);
      expect(res.body.clipIndex).toBe(1);
    });

    it('allows partial stitch when some clips succeeded', async () => {
      const res = await request(app)
        .post(`/api/videos/director/${jobId}/stitch`)
        .set('Authorization', token);
      // Status 200 — partial stitch using successful clips
      expect(res.status).toBe(200);
    });
  });
});
