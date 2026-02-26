// ============================================================
// Phase 61 Tests
// ============================================================
// 61.2: Overdue reminder escalation schema (overdue_escalated_at column)
// 61.4: Agent memory quick-add via POST /api/agent/memory
// 61.8: Automation dry-run endpoint
// 61.13: Seedance soft-stitch URL persistence
// ============================================================

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, generateTestToken, resetDatabase } from '../setup.js';
import { db } from '../../db/index.js';
import { v4 as uuid } from 'uuid';

const app = createApp();

describe('Phase 61', () => {
  let token: string;
  let userId: string;

  beforeAll(() => {
    resetDatabase();
    const user = createTestUser(`phase61-${Date.now()}@example.com`);
    userId = user.id;
    token = `Bearer ${generateTestToken(user.id)}`;
  });

  // ── 61.2: Overdue escalation column exists ───────────────────────────────────

  describe('61.2 — overdue_escalated_at column on reminders', () => {
    it('reminders table has overdue_escalated_at column', () => {
      const info = db.prepare("PRAGMA table_info(reminders)").all() as Array<{ name: string }>;
      const colNames = info.map((c) => c.name);
      expect(colNames).toContain('overdue_escalated_at');
    });

    it('can create reminder with null overdue_escalated_at', async () => {
      const res = await request(app)
        .post('/api/reminders')
        .set('Authorization', token)
        .send({ text: 'Phase61 overdue test', datetime: '2099-01-01T10:00:00.000Z' });
      expect(res.status).toBe(201);
      // Column defaults to null
      const row = db.prepare('SELECT overdue_escalated_at FROM reminders WHERE id = ?').get(res.body.id) as { overdue_escalated_at: string | null };
      expect(row.overdue_escalated_at).toBeNull();
    });
  });

  // ── 61.4: Memory quick-add ────────────────────────────────────────────────────

  describe('61.4 — POST /api/agent/memory (quick-add)', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).post('/api/agent/memory').send({ category: 'note', key: 'k1', value: 'v1' });
      expect(res.status).toBe(401);
    });

    it('creates memory entry with note category', async () => {
      const key = `chat-note:${Date.now()}`;
      const res = await request(app)
        .post('/api/agent/memory')
        .set('Authorization', token)
        .send({ category: 'note', key, value: 'This is an important insight from chat', confidence: 0.8 });
      expect(res.status).toBe(201);
      expect(res.body.category).toBe('note');
      expect(res.body.value).toBe('This is an important insight from chat');
    });

    it('rejects missing required fields', async () => {
      const res = await request(app)
        .post('/api/agent/memory')
        .set('Authorization', token)
        .send({ category: 'note' }); // missing key + value
      expect(res.status).toBe(400);
    });

    it('retrieves saved memory entry via GET /api/agent/memory', async () => {
      const key = `chat-note-get:${Date.now()}`;
      await request(app)
        .post('/api/agent/memory')
        .set('Authorization', token)
        .send({ category: 'note', key, value: 'saved content', confidence: 0.9 });

      const listRes = await request(app)
        .get('/api/agent/memory')
        .set('Authorization', token);
      expect(listRes.status).toBe(200);
      const found = (listRes.body as Array<{ key: string }>).find((m) => m.key === key);
      expect(found).toBeDefined();
    });
  });

  // ── 61.8: Automation dry-run ──────────────────────────────────────────────────

  describe('61.8 — POST /api/automations/:id/dry-run', () => {
    let automationId: string;

    beforeAll(() => {
      automationId = uuid();
      db.prepare(`INSERT INTO automations (id, user_id, name, description, trigger_type, trigger_config, action_type, action_config)
        VALUES (?, ?, ?, '', 'manual', '{}', 'telegram-message', '{"message":"Hello from automation!"}')`
      ).run(automationId, userId, 'Phase61 DryRun Test');
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).post(`/api/automations/${automationId}/dry-run`);
      expect(res.status).toBe(401);
    });

    it('returns 404 for unknown automation', async () => {
      const res = await request(app)
        .post(`/api/automations/${uuid()}/dry-run`)
        .set('Authorization', token);
      expect(res.status).toBe(404);
    });

    it('returns dryRun: true for telegram-message action', async () => {
      const res = await request(app)
        .post(`/api/automations/${automationId}/dry-run`)
        .set('Authorization', token);
      expect(res.status).toBe(200);
      expect(res.body.dryRun).toBe(true);
      expect(res.body.simulatedOutput).toContain('Telegram');
      expect(res.body.automationId).toBe(automationId);
    });

    it('simulates call_api action type', async () => {
      const apiAutoId = uuid();
      db.prepare(`INSERT INTO automations (id, user_id, name, description, trigger_type, trigger_config, action_type, action_config)
        VALUES (?, ?, ?, '', 'manual', '{}', 'call_api', '{"url":"https://example.com/hook","method":"POST"}')`
      ).run(apiAutoId, userId, 'Phase61 API DryRun');

      const res = await request(app)
        .post(`/api/automations/${apiAutoId}/dry-run`)
        .set('Authorization', token);
      expect(res.status).toBe(200);
      expect(res.body.simulatedOutput).toContain('POST to: https://example.com/hook');
    });

    it('simulates create_reminder action type', async () => {
      const remAutoId = uuid();
      db.prepare(`INSERT INTO automations (id, user_id, name, description, trigger_type, trigger_config, action_type, action_config)
        VALUES (?, ?, ?, '', 'manual', '{}', 'create_reminder', '{"reminder_text":"Check metrics"}')`
      ).run(remAutoId, userId, 'Phase61 Reminder DryRun');

      const res = await request(app)
        .post(`/api/automations/${remAutoId}/dry-run`)
        .set('Authorization', token);
      expect(res.status).toBe(200);
      expect(res.body.simulatedOutput).toContain('Check metrics');
    });
  });

  // ── 61.13: Soft-stitch URL persistence ──────────────────────────────────────

  describe('61.13 — video_jobs stitched_url soft-stitch cache', () => {
    it('video_jobs table has stitched_url column', () => {
      const info = db.prepare("PRAGMA table_info(video_jobs)").all() as Array<{ name: string }>;
      const colNames = info.map((c) => c.name);
      expect(colNames).toContain('stitched_url');
    });

    it('stitch endpoint returns 404 for unknown job', async () => {
      const res = await request(app)
        .post(`/api/videos/director/${uuid()}/stitch`)
        .set('Authorization', token);
      expect(res.status).toBe(404);
    });

    it('returns cached clip URLs on second stitch call (soft-stitch cache)', async () => {
      // Insert a done director job with 2 successful clips
      const jobId = uuid();
      const clips = JSON.stringify([
        { success: true, url: 'https://cdn.example.com/clip1.mp4', prompt: 'scene 1' },
        { success: true, url: 'https://cdn.example.com/clip2.mp4', prompt: 'scene 2' },
      ]);
      db.prepare(`INSERT INTO video_jobs (id, user_id, idea, status, clips) VALUES (?, ?, 'test', 'done', ?)`).run(jobId, userId, clips);

      // First call — will soft-stitch (no ffmpeg in test env) and persist
      const first = await request(app)
        .post(`/api/videos/director/${jobId}/stitch`)
        .set('Authorization', token);
      expect(first.status).toBe(200);
      expect(first.body.stitched).toBe(true);
      expect(first.body.clipUrls.length).toBeGreaterThan(0);

      // The stitched_url should now be set (soft-stitch JSON)
      const row = db.prepare('SELECT stitched_url FROM video_jobs WHERE id = ?').get(jobId) as { stitched_url: string | null };
      expect(row.stitched_url).not.toBeNull();

      // Second call — should return cached result
      const second = await request(app)
        .post(`/api/videos/director/${jobId}/stitch`)
        .set('Authorization', token);
      expect(second.status).toBe(200);
      expect(second.body.cached).toBe(true);
      expect(second.body.clipUrls.length).toBeGreaterThan(0);
    });
  });
});
