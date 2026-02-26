import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';
import { resetDatabase, createTestUser, generateTestToken } from '../setup';

const app = createApp();

describe('Phase 65', () => {
  beforeEach(() => { resetDatabase(); });

  // ── 65.3: Webhook URL validation in automation create schema ───────────────
  describe('65.3 — POST /api/automations with invalid URL', () => {
    it('returns 400 when actionConfig.url is not a valid URL for n8n-webhook', async () => {
      const user = createTestUser(`phase65-wh-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      const res = await request(app)
        .post('/api/automations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test Webhook',
          triggerType: 'manual',
          actionType: 'n8n-webhook',
          actionConfig: { url: 'not-a-url' },
        });
      expect(res.status).toBe(400);
    });

    it('accepts valid https URL for n8n-webhook', async () => {
      const user = createTestUser(`phase65-wh2-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      const res = await request(app)
        .post('/api/automations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Valid Webhook',
          triggerType: 'manual',
          actionType: 'n8n-webhook',
          actionConfig: { url: 'https://example.com/hook' },
        });
      expect(res.status).toBe(201);
    });

    it('accepts n8n-webhook without URL (URL optional at create time)', async () => {
      const user = createTestUser(`phase65-wh3-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      const res = await request(app)
        .post('/api/automations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Webhook No URL',
          triggerType: 'manual',
          actionType: 'n8n-webhook',
        });
      expect(res.status).toBe(201);
    });
  });

  // ── 65.4: Reminder near-duplicate warning ─────────────────────────────────
  describe('65.4 — POST /api/reminders duplicate_warning', () => {
    it('returns duplicate_warning when same text reminder exists', async () => {
      const user = createTestUser(`phase65-dup-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      const text = 'Call Dr. Smith about results';

      // Create first
      await request(app)
        .post('/api/reminders')
        .set('Authorization', `Bearer ${token}`)
        .send({ text, datetime: new Date(Date.now() + 3600000).toISOString(), channel: 'push' });

      // Create duplicate
      const res = await request(app)
        .post('/api/reminders')
        .set('Authorization', `Bearer ${token}`)
        .send({ text, datetime: new Date(Date.now() + 7200000).toISOString(), channel: 'push' });
      expect(res.status).toBe(201);
      expect(res.body.duplicate_warning).toBeTruthy();
      expect(res.body.duplicate_warning).toContain(text);
    });

    it('returns null duplicate_warning for unique reminder', async () => {
      const user = createTestUser(`phase65-uniq-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      const res = await request(app)
        .post('/api/reminders')
        .set('Authorization', `Bearer ${token}`)
        .send({ text: `Unique task ${Date.now()}`, channel: 'push' });
      expect(res.status).toBe(201);
      expect(res.body.duplicate_warning).toBeNull();
    });
  });

  // ── 65.5: Dashboard quick-stats ───────────────────────────────────────────
  describe('65.5 — GET /api/dashboard/quick-stats', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/dashboard/quick-stats');
      expect(res.status).toBe(401);
    });

    it('returns remindersActive, messagesToday, automationsActive', async () => {
      const user = createTestUser(`phase65-qs-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      const res = await request(app)
        .get('/api/dashboard/quick-stats')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(typeof res.body.remindersActive).toBe('number');
      expect(typeof res.body.messagesToday).toBe('number');
      expect(typeof res.body.automationsActive).toBe('number');
    });
  });

  // ── 65.6: Integration event log ───────────────────────────────────────────
  describe('65.6 — GET /api/integrations/events', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/integrations/events');
      expect(res.status).toBe(401);
    });

    it('returns events array', async () => {
      const user = createTestUser(`phase65-ev-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      const res = await request(app)
        .get('/api/integrations/events')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.events)).toBe(true);
    });
  });

  // ── 65.7: Memory bulk-clear ────────────────────────────────────────────────
  describe('65.7 — DELETE /api/agent/memory/bulk', () => {
    it('returns 400 without category param', async () => {
      const user = createTestUser(`phase65-mem-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      const res = await request(app)
        .delete('/api/agent/memory/bulk')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });

    it('clears memories by category and returns count', async () => {
      const user = createTestUser(`phase65-mem2-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);

      // Create two memories in 'note' category
      await request(app)
        .post('/api/agent/memory')
        .set('Authorization', `Bearer ${token}`)
        .send({ category: 'note', key: 'k1', value: 'v1', confidence: 0.9 });
      await request(app)
        .post('/api/agent/memory')
        .set('Authorization', `Bearer ${token}`)
        .send({ category: 'note', key: 'k2', value: 'v2', confidence: 0.8 });

      const res = await request(app)
        .delete('/api/agent/memory/bulk?category=note')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(2);

      // Verify cleared
      const listRes = await request(app)
        .get('/api/agent/memory?category=note')
        .set('Authorization', `Bearer ${token}`);
      expect(listRes.body.length ?? listRes.body.length).toBe(0);
    });
  });

  // ── 65.9: Activity date-range filter ──────────────────────────────────────
  describe('65.9 — GET /api/activity?from=&to=', () => {
    it('returns 200 with date params', async () => {
      const user = createTestUser(`phase65-date-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      const today = new Date().toISOString().slice(0, 10);
      const res = await request(app)
        .get(`/api/activity?from=${today}&to=${today}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.activity)).toBe(true);
    });
  });

  // ── 65.10: Portfolio visitor sources endpoint ──────────────────────────────
  describe('65.10 — GET /api/portfolio/me/analytics/sources', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/portfolio/me/analytics/sources');
      expect(res.status).toBe(401);
    });

    it('returns sources array for user without portfolio (404)', async () => {
      const user = createTestUser(`phase65-src-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      const res = await request(app)
        .get('/api/portfolio/me/analytics/sources')
        .set('Authorization', `Bearer ${token}`);
      // User with no portfolio returns 200 with empty sources
      expect([200, 404]).toContain(res.status);
      if (res.status === 200) {
        expect(Array.isArray(res.body.sources)).toBe(true);
      }
    });
  });

  // ── 65.13: Director expand-idea endpoint ──────────────────────────────────
  describe('65.13 — POST /api/videos/director/expand-idea', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/api/videos/director/expand-idea')
        .send({ idea: 'A sunset over mountains' });
      expect(res.status).toBe(401);
    });

    it('returns 400 for missing idea', async () => {
      const user = createTestUser(`phase65-exp-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      const res = await request(app)
        .post('/api/videos/director/expand-idea')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('returns expanded string (falls back to original in test mode)', async () => {
      const user = createTestUser(`phase65-exp2-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      const idea = 'A lone astronaut on Mars';
      const res = await request(app)
        .post('/api/videos/director/expand-idea')
        .set('Authorization', `Bearer ${token}`)
        .send({ idea });
      // In test mode LLM may fail → graceful fallback returns original idea
      expect(res.status).toBe(200);
      expect(typeof res.body.expanded).toBe('string');
      expect(res.body.expanded.length).toBeGreaterThan(0);
    });
  });
});
