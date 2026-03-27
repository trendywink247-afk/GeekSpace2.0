import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../app.js';
import { resetDatabase } from '../../../test/setup.js';
import { config } from '../../../config.js';

const TEST_ADMIN_TOKEN = 'test-admin-token-integrations';
config.adminToken = TEST_ADMIN_TOKEN;

const app = createApp();

describe('Integrations Module', () => {
  beforeAll(() => resetDatabase());

  // ---- GET /api/integrations (requires auth) ----
  describe('GET /api/integrations', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app)
        .get('/api/integrations')
        .expect(401);

      expect(res.body).toHaveProperty('error');
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/integrations')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(res.body).toHaveProperty('error');
    });
  });

  // ---- GET /api/calendar/events (requires auth) ----
  describe('GET /api/calendar/events', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app)
        .get('/api/calendar/events')
        .expect(401);

      expect(res.body).toHaveProperty('error');
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/calendar/events')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(res.body).toHaveProperty('error');
    });
  });
});
