/**
 * Phase 105 Tests — Training Quality Scoring & JSONL Export
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { config } from '../../config.js';
import { db } from '../../db/index.js';
import { resetDatabase } from '../setup.js';

const TEST_ADMIN_TOKEN = 'test-admin-token-phase105';
config.adminToken = TEST_ADMIN_TOKEN;

const app = createApp();
const adminAuth = { Authorization: `Bearer ${TEST_ADMIN_TOKEN}` };

// Helper: insert a training_examples row and return its id
function insertTrainingExample(overrides: Partial<{
  id: string; user_id: string; input: string; output: string;
  system_prompt: string; provider: string; model: string;
  tokens_in: number; tokens_out: number; channel: string; quality_score: number | null;
}> = {}): string {
  const id = overrides.id ?? `test-ex-${Math.random().toString(36).slice(2)}`;
  db.prepare(`
    INSERT INTO training_examples (id, user_id, input, output, system_prompt, provider, model, tokens_in, tokens_out, channel, quality_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    overrides.user_id ?? 'user-1',
    overrides.input ?? 'What is the weather?',
    overrides.output ?? 'I cannot check real-time weather.',
    overrides.system_prompt ?? 'You are a helpful assistant.',
    overrides.provider ?? 'ollama',
    overrides.model ?? 'qwen2.5-coder:1.5b',
    overrides.tokens_in ?? 10,
    overrides.tokens_out ?? 20,
    overrides.channel ?? 'web',
    overrides.quality_score ?? null,
  );
  return id;
}

describe('Phase 105 — Training Quality Scoring & JSONL Export', () => {
  beforeAll(() => { resetDatabase(); });
  afterEach(() => { resetDatabase(); });

  // ---- POST /api/admin/training/:id/score ----
  describe('POST /api/admin/training/:id/score', () => {
    it('returns 401 without admin token', async () => {
      const id = insertTrainingExample();
      const res = await request(app)
        .post(`/api/admin/training/${id}/score`)
        .send({ score: 4 })
        .expect(401);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 400 for score below 1', async () => {
      const id = insertTrainingExample();
      const res = await request(app)
        .post(`/api/admin/training/${id}/score`)
        .set(adminAuth)
        .send({ score: 0 })
        .expect(400);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 400 for score above 5', async () => {
      const id = insertTrainingExample();
      const res = await request(app)
        .post(`/api/admin/training/${id}/score`)
        .set(adminAuth)
        .send({ score: 6 })
        .expect(400);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 400 for non-integer score', async () => {
      const id = insertTrainingExample();
      const res = await request(app)
        .post(`/api/admin/training/${id}/score`)
        .set(adminAuth)
        .send({ score: 3.5 })
        .expect(400);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 404 for unknown id', async () => {
      const res = await request(app)
        .post('/api/admin/training/nonexistent-id/score')
        .set(adminAuth)
        .send({ score: 3 })
        .expect(404);
      expect(res.body).toHaveProperty('error');
    });

    it('updates quality_score and returns 200 with the row', async () => {
      const id = insertTrainingExample();
      const res = await request(app)
        .post(`/api/admin/training/${id}/score`)
        .set(adminAuth)
        .send({ score: 5 })
        .expect(200);

      expect(res.body.id).toBe(id);
      expect(res.body.quality_score).toBe(5);

      // Verify persisted in DB
      const row = db.prepare('SELECT quality_score FROM training_examples WHERE id = ?').get(id) as { quality_score: number };
      expect(row.quality_score).toBe(5);
    });

    it('allows overwriting an existing score', async () => {
      const id = insertTrainingExample({ quality_score: 2 });
      const res = await request(app)
        .post(`/api/admin/training/${id}/score`)
        .set(adminAuth)
        .send({ score: 4 })
        .expect(200);
      expect(res.body.quality_score).toBe(4);
    });
  });

  // ---- GET /api/admin/training ----
  describe('GET /api/admin/training', () => {
    it('returns 401 without admin token', async () => {
      await request(app).get('/api/admin/training').expect(401);
    });

    it('returns JSONL content-type', async () => {
      const res = await request(app)
        .get('/api/admin/training')
        .set(adminAuth)
        .expect(200);
      expect(res.headers['content-type']).toMatch(/application\/x-ndjson|text\/plain/);
    });

    it('returns all rows when no filter applied', async () => {
      insertTrainingExample({ quality_score: 5 });
      insertTrainingExample({ quality_score: 2 });
      insertTrainingExample({ quality_score: null });

      const res = await request(app)
        .get('/api/admin/training')
        .set(adminAuth)
        .expect(200);

      const lines = res.text.trim().split('\n').filter(Boolean);
      expect(lines.length).toBe(3);
    });

    it('filters by min_score', async () => {
      insertTrainingExample({ quality_score: 5 });
      insertTrainingExample({ quality_score: 4 });
      insertTrainingExample({ quality_score: 2 });
      insertTrainingExample({ quality_score: null });

      const res = await request(app)
        .get('/api/admin/training?min_score=4')
        .set(adminAuth)
        .expect(200);

      const lines = res.text.trim().split('\n').filter(Boolean);
      expect(lines.length).toBe(2);
    });

    it('each JSONL line is valid JSON with messages array', async () => {
      insertTrainingExample({
        input: 'Hello',
        output: 'Hi there!',
        system_prompt: 'You are helpful.',
        quality_score: 5,
      });

      const res = await request(app)
        .get('/api/admin/training?min_score=5')
        .set(adminAuth)
        .expect(200);

      const lines = res.text.trim().split('\n').filter(Boolean);
      expect(lines.length).toBe(1);

      const parsed = JSON.parse(lines[0]);
      expect(parsed).toHaveProperty('messages');
      expect(Array.isArray(parsed.messages)).toBe(true);

      const roles = parsed.messages.map((m: { role: string }) => m.role);
      expect(roles).toContain('system');
      expect(roles).toContain('user');
      expect(roles).toContain('assistant');
    });

    it('respects limit query param', async () => {
      for (let i = 0; i < 5; i++) insertTrainingExample({ quality_score: 5 });

      const res = await request(app)
        .get('/api/admin/training?limit=2')
        .set(adminAuth)
        .expect(200);

      const lines = res.text.trim().split('\n').filter(Boolean);
      expect(lines.length).toBe(2);
    });

    it('returns empty body (no lines) when no rows match filter', async () => {
      const res = await request(app)
        .get('/api/admin/training?min_score=5')
        .set(adminAuth)
        .expect(200);

      const lines = res.text.trim().split('\n').filter(Boolean);
      expect(lines.length).toBe(0);
    });
  });
});
