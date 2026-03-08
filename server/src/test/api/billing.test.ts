/**
 * Billing & Subscription Tests
 *
 * Covers: plans listing, current plan, upgrade, usage, day-pass.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { resetDatabase, createTestUser, makeAuthHeader } from '../setup.js';
import { db } from '../../db/index.js';

const app = createApp();

describe('Billing', () => {
  let user: { id: string; token: string };

  beforeAll(() => {
    resetDatabase();
    const u = createTestUser('billing@test.com');
    user = { id: u.id, token: makeAuthHeader(u.id) };
  });

  afterAll(() => {
    resetDatabase();
  });

  // ---- Plans (public) ----

  describe('GET /api/billing/plans', () => {
    it('returns available plans without auth', async () => {
      const res = await request(app).get('/api/billing/plans');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      // Each plan should have an id and credits field
      for (const plan of res.body) {
        expect(plan).toHaveProperty('id');
        expect(plan).toHaveProperty('credits');
      }
    });

    it('includes the "monthly" plan so monthly subscribers can see their plan', async () => {
      const res = await request(app).get('/api/billing/plans');
      const ids = res.body.map((p: { id: string }) => p.id);
      // monthly plan must be visible so monthly subscribers see their current plan
      expect(ids).toContain('monthly');
    });
  });

  // ---- Current plan ----

  describe('GET /api/billing/plan', () => {
    it('returns current subscription', async () => {
      const res = await request(app)
        .get('/api/billing/plan')
        .set('Authorization', user.token);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('plan');
      expect(res.body).toHaveProperty('credits_remaining');
    });

    it('rejects unauthenticated requests', async () => {
      const res = await request(app).get('/api/billing/plan');
      expect(res.status).toBe(401);
    });
  });

  // ---- Upgrade ----

  describe('POST /api/billing/upgrade', () => {
    it('upgrades to a valid plan', async () => {
      // Get available plans first
      const plansRes = await request(app).get('/api/billing/plans');
      const proPlan = plansRes.body.find((p: { id: string }) => p.id === 'pro');

      if (proPlan) {
        const res = await request(app)
          .post('/api/billing/upgrade')
          .set('Authorization', user.token)
          .send({ plan: 'pro', currency: 'USD' });
        expect(res.status).toBe(200);
        expect(res.body.plan).toBe('pro');
        expect(res.body.credits_remaining).toBe(proPlan.credits);
      }
    });

    it('rejects invalid plan name', async () => {
      const res = await request(app)
        .post('/api/billing/upgrade')
        .set('Authorization', user.token)
        .send({ plan: 'nonexistent', currency: 'USD' });
      expect(res.status).toBe(400);
    });

    it('rejects missing plan field', async () => {
      const res = await request(app)
        .post('/api/billing/upgrade')
        .set('Authorization', user.token)
        .send({ currency: 'USD' });
      expect(res.status).toBe(400);
    });
  });

  // ---- Usage ----

  describe('GET /api/billing/usage', () => {
    it('returns usage array', async () => {
      const res = await request(app)
        .get('/api/billing/usage')
        .set('Authorization', user.token);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('rejects unauthenticated requests', async () => {
      const res = await request(app).get('/api/billing/usage');
      expect(res.status).toBe(401);
    });
  });

  // ---- Day Pass ----

  describe('Day Pass', () => {
    let freeUser: { id: string; token: string };

    beforeAll(() => {
      // Create a free-plan user for day pass tests
      const u = createTestUser('freeuser@test.com');
      freeUser = { id: u.id, token: makeAuthHeader(u.id) };
      // Downgrade to free plan
      db.prepare('UPDATE subscriptions SET plan = ? WHERE user_id = ?').run('free', freeUser.id);
    });

    it('activates day pass for free user', async () => {
      const res = await request(app)
        .post('/api/billing/day-pass')
        .set('Authorization', freeUser.token);
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/day pass activated/i);
      expect(res.body.expiresAt).toBeTruthy();
    });

    it('rejects duplicate day pass', async () => {
      const res = await request(app)
        .post('/api/billing/day-pass')
        .set('Authorization', freeUser.token);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already have/i);
    });

    it('checks active day pass status', async () => {
      const res = await request(app)
        .get('/api/billing/day-pass')
        .set('Authorization', freeUser.token);
      expect(res.status).toBe(200);
      expect(res.body.active).toBe(true);
      expect(res.body.expiresAt).toBeTruthy();
    });

    it('rejects day pass for non-free users', async () => {
      const res = await request(app)
        .post('/api/billing/day-pass')
        .set('Authorization', user.token);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/free plan/i);
    });
  });

  // ---- Billing Events (Phase 19) ----

  describe('GET /api/billing/events', () => {
    it('requires authentication', async () => {
      const res = await request(app).get('/api/billing/events');
      expect(res.status).toBe(401);
    });

    it('returns an array', async () => {
      const res = await request(app)
        .get('/api/billing/events')
        .set('Authorization', user.token);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('returns empty array for new user with no usage', async () => {
      const freshUser = createTestUser('events-new@test.com');
      const res = await request(app)
        .get('/api/billing/events')
        .set('Authorization', makeAuthHeader(freshUser.id));
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('each event has expected shape when data exists', async () => {
      // Insert a synthetic usage event for the main user
      db.prepare(`
        INSERT OR IGNORE INTO usage_events (id, user_id, provider, model, tokens_in, tokens_out, cost_usd, channel, tool, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run('test-event-shape-001', user.id, 'ollama', 'llama3.1:8b', 100, 50, 0.001, 'web', null);

      const res = await request(app)
        .get('/api/billing/events')
        .set('Authorization', user.token);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);

      const event = res.body[0];
      expect(event).toHaveProperty('id');
      expect(event).toHaveProperty('provider');
      expect(event).toHaveProperty('model');
      expect(event).toHaveProperty('tokens_in');
      expect(event).toHaveProperty('tokens_out');
      expect(event).toHaveProperty('cost_usd');
      expect(event).toHaveProperty('channel');
      expect(event).toHaveProperty('created_at');
    });

    it('returns at most 20 events', async () => {
      // Insert 25 events
      const insertMany = db.prepare(`
        INSERT OR IGNORE INTO usage_events (id, user_id, provider, model, tokens_in, tokens_out, cost_usd, channel, tool, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);
      for (let i = 0; i < 25; i++) {
        insertMany.run(`bulk-event-${i}`, user.id, 'ollama', 'llama3.1:8b', 10, 5, 0.0001, 'web', null);
      }

      const res = await request(app)
        .get('/api/billing/events')
        .set('Authorization', user.token);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeLessThanOrEqual(20);
    });
  });

});
