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

    it('excludes the "monthly" plan alias', async () => {
      const res = await request(app).get('/api/billing/plans');
      const ids = res.body.map((p: { id: string }) => p.id);
      expect(ids).not.toContain('monthly');
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
});
