import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { resetDatabase } from '../setup.js';
import { config } from '../../config.js';

const app = createApp();
const ADMIN_TOKEN = config.adminToken || 'test-admin-token';

// Ensure config has a token for tests
if (!config.adminToken) {
  // Temporarily set it for test purposes
  Object.defineProperty(config, 'adminToken', { value: 'test-admin-token', writable: false });
}

function authHeader() {
  return `Bearer ${ADMIN_TOKEN}`;
}

describe('Dev API Endpoints', () => {
  beforeAll(() => {
    resetDatabase();
  });

  afterEach(() => {
    resetDatabase();
  });

  // ---- Auth rejection tests ----
  describe('Authentication', () => {
    it('should reject requests with no token', async () => {
      const res = await request(app)
        .get('/api/dev/status')
        .expect(401);

      expect(res.body.error).toBe('Missing admin token');
    });

    it('should reject requests with wrong token', async () => {
      const res = await request(app)
        .get('/api/dev/status')
        .set('Authorization', 'Bearer wrong-token-here')
        .expect(401);

      expect(res.body.error).toBe('Invalid admin token');
    });

    it('should reject requests with wrong header scheme', async () => {
      const res = await request(app)
        .get('/api/dev/status')
        .set('Authorization', `Basic ${ADMIN_TOKEN}`)
        .expect(401);

      expect(res.body.error).toBe('Missing admin token');
    });
  });

  // ---- Status endpoint ----
  describe('GET /api/dev/status', () => {
    it('should return expected status fields', async () => {
      const res = await request(app)
        .get('/api/dev/status')
        .set('Authorization', authHeader())
        .expect(200);

      expect(res.body).toHaveProperty('version');
      expect(res.body).toHaveProperty('gitSha');
      expect(res.body).toHaveProperty('branch');
      expect(res.body).toHaveProperty('uptime');
      expect(res.body).toHaveProperty('nodeVersion');
      expect(typeof res.body.uptime).toBe('number');
      expect(res.body.nodeVersion).toMatch(/^v\d+/);
    });

    it('should write an audit log entry', async () => {
      // Hit status endpoint
      await request(app)
        .get('/api/dev/status')
        .set('Authorization', authHeader())
        .expect(200);

      // Check audit log
      const res = await request(app)
        .get('/api/dev/audit-log')
        .set('Authorization', authHeader())
        .expect(200);

      const statusEntries = res.body.entries.filter(
        (e: { action: string }) => e.action === 'status',
      );
      expect(statusEntries.length).toBeGreaterThanOrEqual(1);
      expect(statusEntries[0].status).toBe('success');
    });
  });

  // ---- Audit log endpoint ----
  describe('GET /api/dev/audit-log', () => {
    it('should return entries array', async () => {
      const res = await request(app)
        .get('/api/dev/audit-log')
        .set('Authorization', authHeader())
        .expect(200);

      expect(res.body).toHaveProperty('entries');
      expect(Array.isArray(res.body.entries)).toBe(true);
      expect(res.body).toHaveProperty('count');
    });

    it('should respect limit param', async () => {
      // Create a few audit entries by hitting status
      await request(app).get('/api/dev/status').set('Authorization', authHeader());
      await request(app).get('/api/dev/status').set('Authorization', authHeader());
      await request(app).get('/api/dev/status').set('Authorization', authHeader());

      const res = await request(app)
        .get('/api/dev/audit-log?limit=2')
        .set('Authorization', authHeader())
        .expect(200);

      expect(res.body.entries.length).toBeLessThanOrEqual(2);
      expect(res.body.count).toBeLessThanOrEqual(2);
    });
  });
});
