import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, cleanupTestUser, resetDatabase } from '../setup.js';
import { config } from '../../config.js';

// Verify we're in test mode
if (!config.isTestMode) {
  throw new Error('Test mode must be enabled for test-mode tests');
}

// Create the real app (same as production)
const app = createApp();

describe('Test-Only Endpoints', () => {
  beforeAll(() => {
    resetDatabase();
  });

  afterEach(() => {
    resetDatabase();
  });

  describe('GET /api/test/state', () => {
    it('should return test state', async () => {
      const response = await request(app)
        .get('/api/test/state')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('testMode', true);
      expect(response.body).toHaveProperty('state');
      expect(response.body).toHaveProperty('dbStats');
      expect(response.body).toHaveProperty('serverTime');

      // Check dbStats structure
      expect(response.body.dbStats).toHaveProperty('users');
      expect(response.body.dbStats).toHaveProperty('reminders');
      expect(response.body.dbStats).toHaveProperty('remindersPending');
      expect(response.body.dbStats).toHaveProperty('agents');
    });
  });

  describe('POST /api/test/reset', () => {
    it('should reset test state', async () => {
      const response = await request(app)
        .post('/api/test/reset')
        .send({ fullCleanup: true })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('fullCleanup', true);
    });
  });

  describe('POST /api/test/seed', () => {
    it('should create test user', async () => {
      const response = await request(app)
        .post('/api/test/seed')
        .send({
          email: 'seed-test@example.com',
          name: 'Seed Test User',
          plan: 'premium',
          credits: 10000,
        })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('seed-test@example.com');
      expect(response.body).toHaveProperty('agent');
      expect(response.body).toHaveProperty('credentials');

      // Cleanup
      if (response.body.user.id) {
        cleanupTestUser(response.body.user.id);
      }
    });

    it('should reject duplicate email', async () => {
      // Create user first
      const user = createTestUser('duplicate-seed@example.com');

      const response = await request(app)
        .post('/api/test/seed')
        .send({
          email: 'duplicate-seed@example.com',
          name: 'Duplicate User',
        })
        .expect('Content-Type', /json/)
        .expect(409);

      expect(response.body).toHaveProperty('error');

      cleanupTestUser(user.id);
    });
  });

  describe('GET /api/test/reminders', () => {
    it('should list reminders', async () => {
      const response = await request(app)
        .get('/api/test/reminders')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('reminders');
      expect(Array.isArray(response.body.reminders)).toBe(true);
    });
  });
});
