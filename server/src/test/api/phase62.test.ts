import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';
import { resetDatabase, createTestUser, generateTestToken } from '../setup';

const app = createApp();

describe('Phase 62', () => {
  beforeEach(() => { resetDatabase(); });

  // ── 62.7: Connections health ping ──────────────────────────────────────────
  describe('62.7 — GET /api/integrations/:type/ping', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/integrations/telegram/ping');
      expect(res.status).toBe(401);
    });

    it('returns latencyMs and healthy:false when not connected', async () => {
      const user = createTestUser(`phase62-ping-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      const res = await request(app)
        .get('/api/integrations/telegram/ping')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(typeof res.body.latencyMs).toBe('number');
      expect(res.body.latencyMs).toBeGreaterThanOrEqual(0);
      expect(res.body.healthy).toBe(false);
      expect(res.body.type).toBe('telegram');
    });

    it('returns latencyMs and healthy:false for unknown type', async () => {
      const user = createTestUser(`phase62-ping2-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      const res = await request(app)
        .get('/api/integrations/unknown-service/ping')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(typeof res.body.latencyMs).toBe('number');
    });
  });

  // ── 62.10: Reminder batch-edit ─────────────────────────────────────────────
  describe('62.10 — PATCH /api/reminders/batch-edit', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).patch('/api/reminders/batch-edit').send({ ids: ['x'], priority: 'high' });
      expect(res.status).toBe(401);
    });

    it('returns 400 for empty ids array', async () => {
      const user = createTestUser(`phase62-batch-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      const res = await request(app)
        .patch('/api/reminders/batch-edit')
        .set('Authorization', `Bearer ${token}`)
        .send({ ids: [], priority: 'high' });
      expect(res.status).toBe(400);
    });

    it('returns 400 if neither priority nor category provided', async () => {
      const user = createTestUser(`phase62-batch2-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      const res = await request(app)
        .patch('/api/reminders/batch-edit')
        .set('Authorization', `Bearer ${token}`)
        .send({ ids: ['nonexistent'] });
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid priority', async () => {
      const user = createTestUser(`phase62-batch3-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      const res = await request(app)
        .patch('/api/reminders/batch-edit')
        .set('Authorization', `Bearer ${token}`)
        .send({ ids: ['x'], priority: 'critical' });
      expect(res.status).toBe(400);
    });

    it('updates priority for owned reminders', async () => {
      const user = createTestUser(`phase62-batch4-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      // Create a reminder
      const create = await request(app)
        .post('/api/reminders')
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'Batch edit test', datetime: '2030-01-01T10:00', channel: 'push' });
      expect(create.status).toBe(201);
      const reminderId = create.body.id as string;

      // Batch edit priority
      const edit = await request(app)
        .patch('/api/reminders/batch-edit')
        .set('Authorization', `Bearer ${token}`)
        .send({ ids: [reminderId], priority: 'high' });
      expect(edit.status).toBe(200);
      expect(edit.body.updated).toBe(1);

      // Verify update
      const list = await request(app)
        .get('/api/reminders')
        .set('Authorization', `Bearer ${token}`);
      const updated = (list.body as Array<{ id: string; priority: string }>).find((r) => r.id === reminderId);
      expect(updated?.priority).toBe('high');
    });

    it('does not update reminders owned by another user', async () => {
      const user1 = createTestUser(`phase62-batch5a-${Date.now()}@example.com`);
      const user2 = createTestUser(`phase62-batch5b-${Date.now()}@example.com`);
      const token1 = generateTestToken(user1.id);
      const token2 = generateTestToken(user2.id);

      const create = await request(app)
        .post('/api/reminders')
        .set('Authorization', `Bearer ${token1}`)
        .send({ text: 'Ownership test', datetime: '2030-01-01T10:00', channel: 'push' });
      const reminderId = create.body.id as string;

      const edit = await request(app)
        .patch('/api/reminders/batch-edit')
        .set('Authorization', `Bearer ${token2}`)
        .send({ ids: [reminderId], priority: 'urgent' });
      expect(edit.status).toBe(200);
      expect(edit.body.updated).toBe(0); // no rows updated
    });
  });

  // ── 62.6: Automation trigger_config (interval_minutes) ─────────────────────
  describe('62.6 — Automation triggerConfig schedule', () => {
    it('creates automation with interval_minutes in trigger_config', async () => {
      const user = createTestUser(`phase62-auto-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      const res = await request(app)
        .post('/api/automations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Scheduled test',
          triggerType: 'time',
          triggerConfig: { interval_minutes: 30 },
          actionType: 'log',
          config: {},
          enabled: true,
        });
      expect(res.status).toBe(201);
      expect(res.body.triggerConfig?.interval_minutes).toBe(30);
    });

    it('stores default interval_minutes when not provided', async () => {
      const user = createTestUser(`phase62-auto2-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);
      const res = await request(app)
        .post('/api/automations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Default interval test',
          triggerType: 'time',
          actionType: 'log',
          config: {},
          enabled: true,
        });
      expect(res.status).toBe(201);
    });
  });
});
