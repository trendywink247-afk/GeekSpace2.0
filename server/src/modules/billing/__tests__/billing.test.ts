/**
 * Billing Module — Integration Tests
 *
 * Tests read-only billing endpoints: plans listing, subscription status.
 * Webhook and payment-provider endpoints are excluded (require external setup).
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../app.js';
import { resetDatabase, createTestUser, makeAuthHeader } from '../../../test/setup.js';

const app = createApp();

describe('Billing Module', () => {
  beforeAll(() => resetDatabase());
  afterEach(() => resetDatabase());

  // ---- GET /api/billing/plans (public) ----

  describe('GET /api/billing/plans', () => {
    it('should return 200 with a list of available plans', async () => {
      const res = await request(app)
        .get('/api/billing/plans')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);

      for (const plan of res.body) {
        expect(plan).toHaveProperty('id');
        expect(plan).toHaveProperty('credits');
      }
    });

    it('should not require authentication', async () => {
      const res = await request(app)
        .get('/api/billing/plans')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should include the monthly plan so subscribers can see it', async () => {
      const res = await request(app)
        .get('/api/billing/plans')
        .expect(200);

      const ids = res.body.map((p: { id: string }) => p.id);
      expect(ids).toContain('monthly');
    });
  });

  // ---- GET /api/billing/plan (auth required) ----

  describe('GET /api/billing/plan', () => {
    it('should return 200 with subscription status when authenticated', async () => {
      const user = createTestUser();

      const res = await request(app)
        .get('/api/billing/plan')
        .set('Authorization', makeAuthHeader(user.id))
        .expect('Content-Type', /json/)
        .expect(200);

      expect(res.body).toHaveProperty('plan');
      expect(res.body).toHaveProperty('credits_remaining');
      expect(res.body).toHaveProperty('user_id', user.id);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get('/api/billing/plan')
        .expect(401);

      expect(res.body).toHaveProperty('error');
    });

    it('should return 401 with an invalid token', async () => {
      const res = await request(app)
        .get('/api/billing/plan')
        .set('Authorization', 'Bearer invalid-token-here')
        .expect(401);

      expect(res.body).toHaveProperty('error');
    });
  });

  // ---- GET /api/billing/usage (auth required) ----

  describe('GET /api/billing/usage', () => {
    it('should return 200 with usage data when authenticated', async () => {
      const user = createTestUser();

      const res = await request(app)
        .get('/api/billing/usage')
        .set('Authorization', makeAuthHeader(user.id))
        .expect('Content-Type', /json/)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app)
        .get('/api/billing/usage')
        .expect(401);

      expect(res.body).toHaveProperty('error');
    });
  });
});
