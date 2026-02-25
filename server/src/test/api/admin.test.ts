import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { config } from '../../config.js';
import { createTestUser, cleanupTestUser, resetDatabase } from '../setup.js';

// Patch the config object directly — setup.ts runs first (sets TEST_MODE + DB_PATH)
// so config is already loaded; we override adminToken before any requests are made.
const TEST_ADMIN_TOKEN = 'test-admin-token-phase18';
config.adminToken = TEST_ADMIN_TOKEN;

const app = createApp();

const adminAuth = { Authorization: `Bearer ${TEST_ADMIN_TOKEN}` };

describe('Admin Endpoints', () => {
  beforeAll(() => {
    resetDatabase();
  });

  afterEach(() => {
    resetDatabase();
  });

  // ---- GET /admin/users ----
  describe('GET /api/admin/users', () => {
    it('should return 401 without admin token', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 401 with wrong admin token', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', 'Bearer wrong-token')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should return paginated user list with valid token', async () => {
      const user = createTestUser('admin-users-test@example.com');

      const response = await request(app)
        .get('/api/admin/users')
        .set(adminAuth)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      expect(response.body).toHaveProperty('pages');
      expect(Array.isArray(response.body.users)).toBe(true);
      expect(response.body.total).toBeGreaterThanOrEqual(1);

      // Verify user fields present
      const found = response.body.users.find((u: { id: string }) => u.id === user.id);
      expect(found).toBeDefined();
      expect(found).toHaveProperty('username');
      expect(found).toHaveProperty('email');
      expect(found).toHaveProperty('created_at');

      cleanupTestUser(user.id);
    });

    it('should respect limit and page query params', async () => {
      const response = await request(app)
        .get('/api/admin/users?limit=5&page=1')
        .set(adminAuth)
        .expect(200);

      expect(response.body.limit).toBe(5);
      expect(response.body.page).toBe(1);
      expect(Array.isArray(response.body.users)).toBe(true);
      expect(response.body.users.length).toBeLessThanOrEqual(5);
    });
  });

  // ---- GET /admin/usage ----
  describe('GET /api/admin/usage', () => {
    it('should return 401 without admin token', async () => {
      const response = await request(app)
        .get('/api/admin/usage')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should return usage stats with valid token', async () => {
      const response = await request(app)
        .get('/api/admin/usage')
        .set(adminAuth)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('totals');
      expect(response.body).toHaveProperty('byProvider');
      expect(response.body).toHaveProperty('topUsers');
      expect(response.body).toHaveProperty('timestamp');

      const { totals } = response.body;
      expect(totals).toHaveProperty('total_tokens_in');
      expect(totals).toHaveProperty('total_tokens_out');
      expect(totals).toHaveProperty('total_cost_usd');

      expect(Array.isArray(response.body.byProvider)).toBe(true);
      expect(Array.isArray(response.body.topUsers)).toBe(true);
    });
  });

  // ---- GET /admin/audit ----
  describe('GET /api/admin/audit', () => {
    it('should return 401 without admin token', async () => {
      const response = await request(app)
        .get('/api/admin/audit')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 401 with wrong admin token', async () => {
      const response = await request(app)
        .get('/api/admin/audit')
        .set('Authorization', 'Bearer bad-token')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should return audit log entries with valid token', async () => {
      const response = await request(app)
        .get('/api/admin/audit')
        .set(adminAuth)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('entries');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('limit');
      expect(Array.isArray(response.body.entries)).toBe(true);
    });

    it('should respect limit query param', async () => {
      const response = await request(app)
        .get('/api/admin/audit?limit=50')
        .set(adminAuth)
        .expect(200);

      expect(response.body.limit).toBe(50);
      expect(response.body.entries.length).toBeLessThanOrEqual(50);
    });

    it('should cap limit at 200', async () => {
      const response = await request(app)
        .get('/api/admin/audit?limit=9999')
        .set(adminAuth)
        .expect(200);

      expect(response.body.limit).toBe(200);
    });

    it('should return entries with required fields when data exists', async () => {
      const user = createTestUser('audit-test@example.com');

      const { db } = await import('../../db/index.js');
      const { v4: uuid } = await import('uuid');
      db.prepare(
        'INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, ?, ?, ?)'
      ).run(uuid(), user.id, 'test_action', 'test details', 'activity');

      const response = await request(app)
        .get('/api/admin/audit')
        .set(adminAuth)
        .expect(200);

      expect(response.body.entries.length).toBeGreaterThanOrEqual(1);
      const entry = response.body.entries.find((e: { action: string }) => e.action === 'test_action');
      expect(entry).toBeDefined();
      expect(entry).toHaveProperty('user_id');
      expect(entry).toHaveProperty('action');
      expect(entry).toHaveProperty('details');
      expect(entry).toHaveProperty('icon');
      expect(entry).toHaveProperty('created_at');

      cleanupTestUser(user.id);
    });
  });
});
