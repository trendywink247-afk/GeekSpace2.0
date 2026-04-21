/**
 * Pico Fleet Tests — Agent CRUD + "At Least 1 Active" Rule
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { resetDatabase, createTestUser, makeAuthHeader } from '../setup.js';
import { db } from '../../db/index.js';
import { ensureDefaultAgents, validateExternalUrl } from '../../services/pico-fleet.js';

const app = createApp();

describe('Pico Fleet', () => {
  let user: { id: string; token: string };

  beforeAll(() => {
    resetDatabase();
    const u = createTestUser('fleet@test.com');
    user = { id: u.id, token: makeAuthHeader(u.id) };
    ensureDefaultAgents();
  });

  afterAll(() => {
    resetDatabase();
  });

  describe('Agent CRUD', () => {
    it('lists user agents (includes default slot 1)', async () => {
      const res = await request(app)
        .get('/api/pico/agents')
        .set('Authorization', user.token);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].slot).toBe(1);
    });

    it('creates a new agent', async () => {
      const res = await request(app)
        .post('/api/pico/agents')
        .set('Authorization', user.token)
        .send({ name: 'TestBot', personality: 'jarvis' });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('TestBot');
      expect(res.body.slot).toBe(2);
    });

    it('updates an agent', async () => {
      const agents = await request(app)
        .get('/api/pico/agents')
        .set('Authorization', user.token);
      const agent2 = agents.body.find((a: { slot: number }) => a.slot === 2);

      const res = await request(app)
        .patch(`/api/pico/agents/${agent2.id}`)
        .set('Authorization', user.token)
        .send({ name: 'UpdatedBot' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('UpdatedBot');
    });

    it('cannot delete slot 1 agent', async () => {
      const agents = await request(app)
        .get('/api/pico/agents')
        .set('Authorization', user.token);
      const slot1 = agents.body.find((a: { slot: number }) => a.slot === 1);

      const res = await request(app)
        .delete(`/api/pico/agents/${slot1.id}`)
        .set('Authorization', user.token);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/cannot delete/i);
    });

    it('can delete non-slot-1 agent', async () => {
      const agents = await request(app)
        .get('/api/pico/agents')
        .set('Authorization', user.token);
      const agent2 = agents.body.find((a: { slot: number }) => a.slot === 2);

      if (agent2) {
        const res = await request(app)
          .delete(`/api/pico/agents/${agent2.id}`)
          .set('Authorization', user.token);
        expect(res.status).toBe(200);
      }
    });
  });

  describe('At-Least-One-Active Rule', () => {
    it('cannot disable the only active agent', async () => {
      const agents = await request(app)
        .get('/api/pico/agents')
        .set('Authorization', user.token);

      // Ensure only 1 agent exists (slot 1)
      expect(agents.body.length).toBeGreaterThanOrEqual(1);
      const slot1 = agents.body.find((a: { slot: number }) => a.slot === 1);

      const res = await request(app)
        .patch(`/api/pico/agents/${slot1.id}`)
        .set('Authorization', user.token)
        .send({ enabled: false });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/last active/i);
    });

    it('can disable an agent when another is still active', async () => {
      // Create a second agent
      const create = await request(app)
        .post('/api/pico/agents')
        .set('Authorization', user.token)
        .send({ name: 'Agent2', personality: 'weebo' });
      expect(create.status).toBe(201);

      // Now disable the second agent (slot 1 still active)
      const res = await request(app)
        .patch(`/api/pico/agents/${create.body.id}`)
        .set('Authorization', user.token)
        .send({ enabled: false });
      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(0);
    });

    it('cannot disable last remaining active agent when others are disabled', async () => {
      const agents = await request(app)
        .get('/api/pico/agents')
        .set('Authorization', user.token);
      const slot1 = agents.body.find((a: { slot: number }) => a.slot === 1);

      // Agent2 is already disabled from previous test. Slot 1 is the only active one.
      const res = await request(app)
        .patch(`/api/pico/agents/${slot1.id}`)
        .set('Authorization', user.token)
        .send({ enabled: false });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/last active/i);
    });

    it('can re-enable a disabled agent', async () => {
      const agents = await request(app)
        .get('/api/pico/agents')
        .set('Authorization', user.token);
      const disabled = agents.body.find((a: { enabled: number }) => a.enabled === 0);

      if (disabled) {
        const res = await request(app)
          .patch(`/api/pico/agents/${disabled.id}`)
          .set('Authorization', user.token)
          .send({ enabled: true });
        expect(res.status).toBe(200);
        expect(res.body.enabled).toBe(1);
      }
    });
  });

  describe('SSRF Protection', () => {
    it('blocks private IPs', () => {
      expect(() => validateExternalUrl('http://10.0.0.1/api')).toThrow(/private/i);
      expect(() => validateExternalUrl('http://192.168.1.1/api')).toThrow(/private/i);
      expect(() => validateExternalUrl('http://172.16.0.1/api')).toThrow(/private/i);
      expect(() => validateExternalUrl('http://127.0.0.1/api')).toThrow(/private/i);
    });

    it('blocks Docker-internal hostnames', () => {
      expect(() => validateExternalUrl('http://redis:6379')).toThrow(/internal/i);
      expect(() => validateExternalUrl('http://picoclaw:8080')).toThrow(/internal/i);
      expect(() => validateExternalUrl('http://localhost:3001')).toThrow(/internal/i);
    });

    it('blocks non-http protocols', () => {
      expect(() => validateExternalUrl('ftp://example.com')).toThrow(/protocol/i);
      expect(() => validateExternalUrl('file:///etc/passwd')).toThrow(/protocol/i);
    });

    it('allows valid external URLs', () => {
      expect(() => validateExternalUrl('https://api.example.com/webhook')).not.toThrow();
      expect(() => validateExternalUrl('http://httpbin.org/post')).not.toThrow();
    });

    it('rejects invalid URL format', () => {
      expect(() => validateExternalUrl('not-a-url')).toThrow(/invalid/i);
      expect(() => validateExternalUrl('')).toThrow(/invalid/i);
    });
  });

  describe('Task queries', () => {
    it('lists tasks for user (empty initially)', async () => {
      const res = await request(app)
        .get('/api/pico/tasks')
        .set('Authorization', user.token);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('filters tasks by status', async () => {
      const res = await request(app)
        .get('/api/pico/tasks?status=completed')
        .set('Authorization', user.token);
      expect(res.status).toBe(200);
      for (const t of res.body) {
        expect(t.status).toBe('completed');
      }
    });
  });
});
