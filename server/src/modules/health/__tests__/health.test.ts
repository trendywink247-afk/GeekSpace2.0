import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../app.js';
import { resetDatabase } from '../../../test/setup.js';
import { config } from '../../../config.js';

const TEST_ADMIN_TOKEN = 'test-admin-token-health';
config.adminToken = TEST_ADMIN_TOKEN;

const app = createApp();

const adminAuth = { Authorization: `Bearer ${TEST_ADMIN_TOKEN}` };

describe('Health Module', () => {
  beforeAll(() => resetDatabase());

  // ---- GET /api/health (public, defined in app.ts) ----
  describe('GET /api/health', () => {
    it('should return 200 with status field', async () => {
      const res = await request(app)
        .get('/api/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(res.body).toHaveProperty('status');
      expect(typeof res.body.status).toBe('string');
      expect(['ok', 'degraded']).toContain(res.body.status);
    });

    it('should not require authentication', async () => {
      const res = await request(app)
        .get('/api/health')
        .expect(200);

      expect(res.body.status).toBeDefined();
    });
  });

  // ---- GET /api/health/detailed (admin-only) ----
  describe('GET /api/health/detailed', () => {
    it('should return 401 without admin token', async () => {
      const res = await request(app)
        .get('/api/health/detailed')
        .expect(401);

      expect(res.body).toHaveProperty('error');
    });

    it('should return 401 with wrong admin token', async () => {
      const res = await request(app)
        .get('/api/health/detailed')
        .set('Authorization', 'Bearer wrong-token')
        .expect(401);

      expect(res.body).toHaveProperty('error');
    });

    it('should return detailed health with valid admin token', async () => {
      const res = await request(app)
        .get('/api/health/detailed')
        .set(adminAuth)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('checkedAt');
      expect(res.body).toHaveProperty('probeTimeMs');
      expect(res.body).toHaveProperty('services');
      expect(typeof res.body.services).toBe('object');

      // Each service should have status and latencyMs fields
      for (const svc of Object.values(res.body.services) as Array<{ status: string; latencyMs: number | null }>) {
        expect(svc).toHaveProperty('status');
        expect(['ok', 'degraded', 'down', 'not_configured']).toContain(svc.status);
        expect(svc).toHaveProperty('latencyMs');
      }
    });
  });

  // ---- GET /api/health/stream (admin-only SSE) ----
  describe('GET /api/health/stream', () => {
    it('should return 401 without admin token', async () => {
      const res = await request(app)
        .get('/api/health/stream')
        .expect(401);

      expect(res.body).toHaveProperty('error');
    });

    it('should return 401 with wrong query token', async () => {
      const res = await request(app)
        .get('/api/health/stream?token=wrong-token')
        .expect(401);

      expect(res.body).toHaveProperty('error');
    });

    it('should return 401 with wrong bearer token', async () => {
      const res = await request(app)
        .get('/api/health/stream')
        .set('Authorization', 'Bearer bad-token')
        .expect(401);

      expect(res.body).toHaveProperty('error');
    });
  });
});
