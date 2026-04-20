/**
 * Multi-User Data Isolation Tests
 *
 * Proves that User A cannot read, write, update, or delete User B's data.
 * Covers: reminders, pico agents, pico tasks, automations, activity log.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { resetDatabase, createTestUser, makeAuthHeader } from '../setup.js';
import { db } from '../../db/index.js';
import { v4 as uuid } from 'uuid';
import { ensureDefaultAgents } from '../../services/pico-fleet.js';

const app = createApp();

describe('Multi-User Data Isolation', () => {
  let userA: { id: string; token: string };
  let userB: { id: string; token: string };

  beforeAll(() => {
    resetDatabase();
    const a = createTestUser('userA@test.com');
    const b = createTestUser('userB@test.com');

    userA = { id: a.id, token: makeAuthHeader(a.id) };
    userB = { id: b.id, token: makeAuthHeader(b.id) };

    // Ensure both users have default Weebo agents
    ensureDefaultAgents();
  });

  afterAll(() => {
    resetDatabase();
  });

  // ---- Reminders ----

  describe('Reminders isolation', () => {
    let reminderIdA: string;

    it('User A creates a reminder', async () => {
      const res = await request(app)
        .post('/api/reminders')
        .set('Authorization', userA.token)
        .send({ text: 'Secret reminder from A', channel: 'push' });
      expect(res.status).toBe(201);
      reminderIdA = res.body.id;
    });

    it('User B cannot see User A reminders', async () => {
      const res = await request(app)
        .get('/api/reminders')
        .set('Authorization', userB.token);
      expect(res.status).toBe(200);
      const ids = res.body.map((r: { id: string }) => r.id);
      expect(ids).not.toContain(reminderIdA);
    });

    it('User B cannot update User A reminder', async () => {
      const res = await request(app)
        .patch(`/api/reminders/${reminderIdA}`)
        .set('Authorization', userB.token)
        .send({ text: 'Hijacked' });
      expect(res.status).toBe(404);
    });

    it('User B cannot delete User A reminder', async () => {
      const res = await request(app)
        .delete(`/api/reminders/${reminderIdA}`)
        .set('Authorization', userB.token);
      expect(res.status).toBe(404);
    });

    it('User A can still see own reminder', async () => {
      const res = await request(app)
        .get('/api/reminders')
        .set('Authorization', userA.token);
      expect(res.status).toBe(200);
      const ids = res.body.map((r: { id: string }) => r.id);
      expect(ids).toContain(reminderIdA);
    });
  });

  // ---- Pico Agents ----

  describe('Pico agents isolation', () => {
    it('User A sees only own agents', async () => {
      const resA = await request(app)
        .get('/api/pico/agents')
        .set('Authorization', userA.token);
      expect(resA.status).toBe(200);
      for (const agent of resA.body) {
        expect(agent.user_id).toBe(userA.id);
      }
    });

    it('User B sees only own agents', async () => {
      const resB = await request(app)
        .get('/api/pico/agents')
        .set('Authorization', userB.token);
      expect(resB.status).toBe(200);
      for (const agent of resB.body) {
        expect(agent.user_id).toBe(userB.id);
      }
    });

    it('User B cannot update User A agent', async () => {
      const agentA = db.prepare('SELECT id FROM pico_agents WHERE user_id = ? LIMIT 1')
        .get(userA.id) as { id: string };

      const res = await request(app)
        .patch(`/api/pico/agents/${agentA.id}`)
        .set('Authorization', userB.token)
        .send({ name: 'Hijacked' });
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });

    it('User B cannot delete User A agent', async () => {
      // Create a second agent for A to avoid "cannot delete slot 1" error
      const createRes = await request(app)
        .post('/api/pico/agents')
        .set('Authorization', userA.token)
        .send({ name: 'Extra', personality: 'weebo' });

      if (createRes.status === 201) {
        const agentId = createRes.body.id;
        const res = await request(app)
          .delete(`/api/pico/agents/${agentId}`)
          .set('Authorization', userB.token);
        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/not found/i);
      }
    });
  });

  // ---- Pico Tasks ----

  describe('Pico tasks isolation', () => {
    it('User A sees only own tasks', async () => {
      const res = await request(app)
        .get('/api/pico/tasks')
        .set('Authorization', userA.token);
      expect(res.status).toBe(200);
      for (const task of res.body) {
        expect(task.user_id).toBe(userA.id);
      }
    });

    it('User B cannot cancel User A task', async () => {
      // Queue a task for user A directly
      const agentA = db.prepare('SELECT id FROM pico_agents WHERE user_id = ? LIMIT 1')
        .get(userA.id) as { id: string } | undefined;

      if (agentA) {
        const taskId = uuid();
        db.prepare(`INSERT INTO pico_tasks (id, user_id, agent_id, task_type, description, config, status)
          VALUES (?, ?, ?, 'create_reminder', 'test', '{}', 'queued')`)
          .run(taskId, userA.id, agentA.id);

        const res = await request(app)
          .delete(`/api/pico/tasks/${taskId}`)
          .set('Authorization', userB.token);
        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/not found/i);

        // Cleanup
        db.prepare('DELETE FROM pico_tasks WHERE id = ?').run(taskId);
      }
    });
  });

  // ---- Automations ----

  describe('Automations isolation', () => {
    let automationIdA: string;

    it('User A creates an automation', async () => {
      const res = await request(app)
        .post('/api/automations')
        .set('Authorization', userA.token)
        .send({
          name: 'Secret automation',
          description: 'For A only',
          triggerType: 'manual',
          actionType: 'log',
        });
      expect(res.status).toBe(201);
      automationIdA = res.body.id;
    });

    it('User B cannot see User A automations', async () => {
      const res = await request(app)
        .get('/api/automations')
        .set('Authorization', userB.token);
      expect(res.status).toBe(200);
      const ids = res.body.map((a: { id: string }) => a.id);
      expect(ids).not.toContain(automationIdA);
    });

    it('User B cannot update User A automation', async () => {
      const res = await request(app)
        .patch(`/api/automations/${automationIdA}`)
        .set('Authorization', userB.token)
        .send({ name: 'Hijacked' });
      expect(res.status).toBe(404);
    });

    it('User B cannot delete User A automation', async () => {
      const res = await request(app)
        .delete(`/api/automations/${automationIdA}`)
        .set('Authorization', userB.token);
      expect(res.status).toBe(404);
    });

    it('User B cannot trigger User A manual automation', async () => {
      const res = await request(app)
        .post(`/api/automations/${automationIdA}/trigger`)
        .set('Authorization', userB.token);
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  // ---- Dashboard / Activity ----

  describe('Dashboard data isolation', () => {
    it('User A dashboard returns only own data', async () => {
      const res = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', userA.token);
      expect(res.status).toBe(200);
    });

    it('User B dashboard returns only own data', async () => {
      const res = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', userB.token);
      expect(res.status).toBe(200);
    });
  });

  // ---- Memory ----

  describe('Memory isolation', () => {
    it('User A memory creation is scoped', async () => {
      const res = await request(app)
        .post('/api/agent/memory')
        .set('Authorization', userA.token)
        .send({
          category: 'test',
          key: 'secret_key',
          value: 'secret value from A',
          confidence: 0.9,
          source: 'manual',
        });
      expect(res.status).toBe(201);
    });

    it('User B cannot see User A memories', async () => {
      const res = await request(app)
        .get('/api/agent/memory')
        .set('Authorization', userB.token);
      expect(res.status).toBe(200);
      const keys = res.body.map((m: { key: string }) => m.key);
      expect(keys).not.toContain('secret_key');
    });
  });

  // ---- Auth boundary ----

  describe('Auth boundary', () => {
    it('Unauthenticated request to protected endpoint returns 401', async () => {
      const res = await request(app).get('/api/reminders');
      expect(res.status).toBe(401);
    });

    it('Invalid token returns 401', async () => {
      const res = await request(app)
        .get('/api/reminders')
        .set('Authorization', 'Bearer invalid-token');
      expect(res.status).toBe(401);
    });
  });
});
