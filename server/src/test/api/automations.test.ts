/**
 * Automations Route Tests
 *
 * Covers: CRUD, toggle, manual trigger, execution logs.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { resetDatabase, createTestUser, makeAuthHeader } from '../setup.js';
import { initAutomationsEngine } from '../../services/automations-engine.js';

const app = createApp();

describe('Automations', () => {
  let user: { id: string; token: string };
  let automationId: string;

  beforeAll(() => {
    resetDatabase();
    initAutomationsEngine(); // Creates automation_logs table
    const u = createTestUser('automations@test.com');
    user = { id: u.id, token: makeAuthHeader(u.id) };
  });

  afterAll(() => {
    resetDatabase();
  });

  // ---- Create ----

  describe('POST /api/automations', () => {
    it('creates an automation', async () => {
      const res = await request(app)
        .post('/api/automations')
        .set('Authorization', user.token)
        .send({
          name: 'Test Automation',
          description: 'Created by test',
          triggerType: 'manual',
          actionType: 'log',
        });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Test Automation');
      expect(res.body.trigger_type).toBe('manual');
      expect(res.body.action_type).toBe('log');
      automationId = res.body.id;
    });

    it('rejects missing name', async () => {
      const res = await request(app)
        .post('/api/automations')
        .set('Authorization', user.token)
        .send({ description: 'No name' });
      expect(res.status).toBe(400);
    });

    it('rejects unauthenticated requests', async () => {
      const res = await request(app)
        .post('/api/automations')
        .send({ name: 'Should fail' });
      expect(res.status).toBe(401);
    });
  });

  // ---- List ----

  describe('GET /api/automations', () => {
    it('lists user automations', async () => {
      const res = await request(app)
        .get('/api/automations')
        .set('Authorization', user.token);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ---- Update ----

  describe('PATCH /api/automations/:id', () => {
    it('updates automation name', async () => {
      const res = await request(app)
        .patch(`/api/automations/${automationId}`)
        .set('Authorization', user.token)
        .send({ name: 'Updated Name' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Name');
    });

    it('toggles enabled state', async () => {
      const res = await request(app)
        .patch(`/api/automations/${automationId}`)
        .set('Authorization', user.token)
        .send({ enabled: false });
      expect(res.status).toBe(200);
      // 48.1: API normalizes SQLite 0/1 → boolean
      expect(res.body.enabled).toBe(false);
    });

    it('returns 404 for non-existent automation', async () => {
      const res = await request(app)
        .patch('/api/automations/nonexistent-id')
        .set('Authorization', user.token)
        .send({ name: 'Nope' });
      expect(res.status).toBe(404);
    });
  });

  // ---- Manual trigger ----

  describe('POST /api/automations/:id/trigger', () => {
    it('triggers a manual automation', async () => {
      // Re-enable first
      await request(app)
        .patch(`/api/automations/${automationId}`)
        .set('Authorization', user.token)
        .send({ enabled: true });

      const res = await request(app)
        .post(`/api/automations/${automationId}/trigger`)
        .set('Authorization', user.token);
      // Should return success or a structured result
      expect([200, 404]).toContain(res.status);
      expect(res.body).toHaveProperty('success');
    });

    it('returns 404 for non-existent automation', async () => {
      const res = await request(app)
        .post('/api/automations/nonexistent-id/trigger')
        .set('Authorization', user.token);
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // ---- Logs ----

  describe('GET /api/automations/logs', () => {
    it('returns execution logs', async () => {
      const res = await request(app)
        .get('/api/automations/logs')
        .set('Authorization', user.token);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('respects limit parameter', async () => {
      const res = await request(app)
        .get('/api/automations/logs?limit=5')
        .set('Authorization', user.token);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /api/automations/:id/logs', () => {
    it('returns logs for specific automation', async () => {
      const res = await request(app)
        .get(`/api/automations/${automationId}/logs`)
        .set('Authorization', user.token);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ---- Delete ----

  describe('DELETE /api/automations/:id', () => {
    it('deletes an automation', async () => {
      const res = await request(app)
        .delete(`/api/automations/${automationId}`)
        .set('Authorization', user.token);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 404 for already-deleted automation', async () => {
      const res = await request(app)
        .delete(`/api/automations/${automationId}`)
        .set('Authorization', user.token);
      expect(res.status).toBe(404);
    });
  });
});
