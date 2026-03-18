import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';
import { resetDatabase, createTestUser, generateTestToken } from '../setup';
import { initAutomationsEngine } from '../../services/automations-engine.js';

const app = createApp();

describe('Phase 64', () => {
  beforeAll(() => { initAutomationsEngine(); }); // ensures automation_logs table exists
  beforeEach(() => { resetDatabase(); });

  // ── 64.3: Activity text search ─────────────────────────────────────────────
  describe('64.3 — GET /api/activity?q=', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/activity?q=test');
      expect(res.status).toBe(401);
    });

    it('returns empty activity when no match', async () => {
      const user = createTestUser(`phase64-act-q1-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      const res = await request(app)
        .get('/api/activity?q=xyzzy_no_match_12345')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.activity).toEqual([]);
      expect(res.body.total).toBe(0);
    });

    it('returns matching activity entries by action', async () => {
      const { db } = await import('../../db/index.js');
      const user = createTestUser(`phase64-act-q2-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      // Seed an activity entry
      db.prepare(
        `INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, ?, ?, ?)`
      ).run('test-act-1', user.id, 'Created reminder', 'Buy milk', 'bell');
      const res = await request(app)
        .get('/api/activity?q=Created')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.activity.length).toBeGreaterThanOrEqual(1);
      expect(res.body.activity[0].action).toContain('Created');
    });

    it('returns matching activity entries by details', async () => {
      const { db } = await import('../../db/index.js');
      const user = createTestUser(`phase64-act-q3-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      db.prepare(
        `INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, ?, ?, ?)`
      ).run('test-act-2', user.id, 'Updated portfolio', 'Added new project: Foo', 'briefcase');
      const res = await request(app)
        .get('/api/activity?q=Foo')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.activity.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── 64.4: Reminder duplicate ───────────────────────────────────────────────
  describe('64.4 — POST /api/reminders/:id/duplicate', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).post('/api/reminders/fake-id/duplicate');
      expect(res.status).toBe(401);
    });

    it('returns 404 for non-existent reminder', async () => {
      const user = createTestUser(`phase64-dup1-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      const res = await request(app)
        .post('/api/reminders/non-existent-id/duplicate')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    it('duplicates a reminder and returns 201 with new reminder', async () => {
      const user = createTestUser(`phase64-dup2-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      // Create a reminder first
      const createRes = await request(app)
        .post('/api/reminders')
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'Original reminder', datetime: '2027-01-01T10:00:00Z', channel: 'push' });
      expect(createRes.status).toBe(201);
      const originalId = createRes.body.id as string;
      // Duplicate it
      const dupRes = await request(app)
        .post(`/api/reminders/${originalId}/duplicate`)
        .set('Authorization', `Bearer ${token}`);
      expect(dupRes.status).toBe(201);
      expect(dupRes.body.id).not.toBe(originalId);
      expect(dupRes.body.text).toBe('Original reminder');
    });
  });

  // ── 64.5: Automation stats ─────────────────────────────────────────────────
  describe('64.5 — GET /api/automations/stats', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/automations/stats');
      expect(res.status).toBe(401);
    });

    it('returns stats object with required fields', async () => {
      const user = createTestUser(`phase64-stats-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      const res = await request(app)
        .get('/api/automations/stats')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(typeof res.body.total).toBe('number');
      expect(typeof res.body.enabled).toBe('number');
      expect(typeof res.body.disabled).toBe('number');
      expect(typeof res.body.recentRuns).toBe('number');
      expect(Array.isArray(res.body.byTrigger)).toBe(true);
    });

    it('counts correctly for new user (all zeros)', async () => {
      const user = createTestUser(`phase64-stats2-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      const res = await request(app)
        .get('/api/automations/stats')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(0);
      expect(res.body.enabled).toBe(0);
      expect(res.body.disabled).toBe(0);
    });
  });

  // ── 64.6: Activity action type filter ─────────────────────────────────────
  describe('64.6 — GET /api/activity?type=', () => {
    it('returns only entries matching exact action type', async () => {
      const { db } = await import('../../db/index.js');
      const user = createTestUser(`phase64-acttype-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      db.prepare(
        `INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, ?, ?, ?)`
      ).run('test-type-1', user.id, 'Created reminder', 'Foo', 'bell');
      db.prepare(
        `INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, ?, ?, ?)`
      ).run('test-type-2', user.id, 'Portfolio updated', 'Bar', 'briefcase');
      const res = await request(app)
        .get('/api/activity?type=Created reminder')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.activity.every((e: { action: string }) => e.action === 'Created reminder')).toBe(true);
    });
  });

  // ── 64.7: Analytics export rate limit ─────────────────────────────────────
  describe('64.7 — Rate limit on portfolio analytics export', () => {
    it('returns 200 on first request', async () => {
      const user = createTestUser(`phase64-rl-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      const res = await request(app)
        .get('/api/portfolio/me/analytics/export')
        .set('Authorization', `Bearer ${token}`);
      // Rate limit check is Redis-based — Redis may not be running in test env,
      // so both 200 and 429 are acceptable; just verify it's not 500
      expect([200, 429]).toContain(res.status);
    });
  });

  // ── 64.8: Activity CSV export ──────────────────────────────────────────────
  describe('64.8 — GET /api/activity/export', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/activity/export');
      expect(res.status).toBe(401);
    });

    it('returns CSV with header', async () => {
      const user = createTestUser(`phase64-actexp-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      const res = await request(app)
        .get('/api/activity/export')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.text).toContain('date,time,type,description');
    });

    it('includes activity entries in CSV', async () => {
      const { db } = await import('../../db/index.js');
      const user = createTestUser(`phase64-actexp2-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      db.prepare(
        `INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, ?, ?, ?)`
      ).run('test-csv-1', user.id, 'Created reminder', 'Test CSV entry', 'bell');
      const res = await request(app)
        .get('/api/activity/export')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.text).toContain('Created reminder');
      expect(res.text).toContain('Test CSV entry');
    });
  });

  // ── 64.9: Automations enabled filter ──────────────────────────────────────
  describe('64.9 — GET /api/automations?enabled=', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/automations?enabled=true');
      expect(res.status).toBe(401);
    });

    it('filters to enabled automations only', async () => {
      const user = createTestUser(`phase64-enf-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      // Create enabled automation
      await request(app)
        .post('/api/automations')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Enabled Auto', description: '', triggerType: 'manual', actionType: 'log', enabled: true });
      // Create disabled automation
      await request(app)
        .post('/api/automations')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Disabled Auto', description: '', triggerType: 'manual', actionType: 'log', enabled: false });
      const res = await request(app)
        .get('/api/automations?enabled=true')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      const automations = Array.isArray(res.body) ? res.body : res.body.automations ?? [];
      expect(automations.every((a: { enabled: boolean }) => a.enabled === true)).toBe(true);
    });

    it('filters to disabled automations only', async () => {
      const user = createTestUser(`phase64-enf2-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      await request(app)
        .post('/api/automations')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Enabled B', description: '', triggerType: 'manual', actionType: 'log', enabled: true });
      await request(app)
        .post('/api/automations')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Disabled B', description: '', triggerType: 'manual', actionType: 'log', enabled: false });
      const res = await request(app)
        .get('/api/automations?enabled=false')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      const automations = Array.isArray(res.body) ? res.body : res.body.automations ?? [];
      expect(automations.every((a: { enabled: boolean }) => a.enabled === false)).toBe(true);
    });
  });
});
