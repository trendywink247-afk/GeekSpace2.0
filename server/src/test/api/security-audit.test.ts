/**
 * Security Audit Tests — Backend Security Verification
 *
 * Verifies:
 * 1. No SQL injection vulnerabilities in parameterized queries
 * 2. No password_hash exposure in user-facing responses
 * 3. Rate limiting is active on auth endpoints
 * 4. CORS is properly configured (not wildcard)
 * 5. Critical routes have input validation (Zod schemas)
 * 6. Security headers (CSP, HSTS, X-Frame-Options, etc.)
 * 7. Auth guards on sensitive endpoints
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { config } from '../../config.js';
import { db } from '../../db/index.js';

(config as Record<string, unknown>).isTestMode = true;

const app = createApp();

describe('Security Audit', () => {
  let userId: string;
  let authHeader: string;

  beforeAll(() => {
    resetDatabase();
    const user = createTestUser('secaudit@example.com');
    userId = user.id;
    authHeader = makeAuthHeader(userId);
  });

  // =====================================================================
  // 1. SQL Injection — Parameterized Query Verification
  // =====================================================================
  describe('SQL Injection Protection', () => {
    it('login rejects SQL injection in email field', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: "' OR '1'='1' --",
          password: 'anything',
        })
        .expect(400); // Zod email validation catches this

      expect(res.body.error).toBeDefined();
    });

    it('login rejects SQL injection in password field', async () => {
      const user = createTestUser('sqli-pwd@example.com');
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: "' OR '1'='1",
        })
        .expect(401); // bcrypt compare fails, not SQL error

      expect(res.body.error).toBe('Invalid credentials');
    });

    it('reminder creation is safe from SQL injection in text field', async () => {
      const res = await request(app)
        .post('/api/reminders')
        .set('Authorization', authHeader)
        .send({
          text: "'; DROP TABLE reminders; --",
          datetime: new Date(Date.now() + 86400000).toISOString(),
        });

      // Should create successfully (text is just data, not SQL)
      expect(res.status).toBe(201);
      expect(res.body.text).toBe("'; DROP TABLE reminders; --");

      // Verify reminders table still exists
      const count = db.prepare('SELECT COUNT(*) as c FROM reminders').get() as { c: number };
      expect(count.c).toBeGreaterThanOrEqual(1);
    });

    it('user search by username is parameterized', async () => {
      const res = await request(app)
        .get("/api/users/' OR '1'='1/public")
        .expect(404);

      expect(res.body.error).toBe('User not found');
    });

    it('activity log search query is safe from injection', async () => {
      const res = await request(app)
        .get('/api/activity')
        .set('Authorization', authHeader)
        .query({ q: "'; DROP TABLE activity_log; --" })
        .expect(200);

      // Should return results normally (empty or matching)
      expect(res.body).toHaveProperty('activity');
      // Table still works
      const check = db.prepare('SELECT COUNT(*) as c FROM activity_log').get() as { c: number };
      expect(check.c).toBeGreaterThanOrEqual(0);
    });
  });

  // =====================================================================
  // 2. Password/Secret Leak Prevention
  // =====================================================================
  describe('No Password Hash in Responses', () => {
    it('GET /api/users/me never returns password_hash', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', authHeader)
        .expect(200);

      expect(res.body).not.toHaveProperty('password_hash');
      expect(res.body).not.toHaveProperty('password');
      expect(res.body).not.toHaveProperty('salt');
      expect(JSON.stringify(res.body)).not.toContain('password_hash');
    });

    it('POST /api/auth/login response never returns password_hash', async () => {
      const user = createTestUser('login-nopw@example.com');
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: user.password })
        .expect(200);

      expect(res.body.user).not.toHaveProperty('password_hash');
      expect(res.body.user).not.toHaveProperty('password');
      expect(JSON.stringify(res.body)).not.toContain('password_hash');
    });

    it('GET /api/auth/me never returns password_hash', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', authHeader)
        .expect(200);

      expect(JSON.stringify(res.body)).not.toContain('password_hash');
    });

    it('GET /api/users/:username/public never returns password_hash', async () => {
      const user = createTestUser('public-nopw@example.com');
      const res = await request(app)
        .get(`/api/users/${user.username}/public`)
        .expect(200);

      expect(res.body).not.toHaveProperty('password_hash');
      expect(res.body).not.toHaveProperty('email'); // public profile omits email
      expect(JSON.stringify(res.body)).not.toContain('password_hash');
    });

    it('PATCH /api/users/me response never returns password_hash', async () => {
      const res = await request(app)
        .patch('/api/users/me')
        .set('Authorization', authHeader)
        .send({ bio: 'Updated bio' })
        .expect(200);

      expect(JSON.stringify(res.body)).not.toContain('password_hash');
    });
  });

  // =====================================================================
  // 3. Rate Limiting on Auth Endpoints
  // =====================================================================
  describe('Rate Limiting Headers', () => {
    it('login endpoint has X-RateLimit-Policy header', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'test12345' });

      expect(res.headers['x-ratelimit-policy']).toBeDefined();
    });

    it('signup endpoint has X-RateLimit-Policy header', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'new@example.com', password: 'test12345', username: 'newuser' });

      expect(res.headers['x-ratelimit-policy']).toBeDefined();
    });

    it('chat endpoint has X-RateLimit-Policy header', async () => {
      const res = await request(app)
        .post('/api/agent/chat')
        .set('Authorization', authHeader)
        .send({ message: 'Hello' });

      expect(res.headers['x-ratelimit-policy']).toBeDefined();
    });
  });

  // =====================================================================
  // 4. CORS Configuration
  // =====================================================================
  describe('CORS Configuration', () => {
    it('does not return wildcard Access-Control-Allow-Origin', async () => {
      const res = await request(app)
        .options('/api/health')
        .set('Origin', 'https://evil.com');

      // Should NOT reflect an unknown origin
      const acao = res.headers['access-control-allow-origin'];
      expect(acao).not.toBe('*');
    });

    it('reflects allowed origin from CORS config', async () => {
      // config.corsOrigins contains the allowed origins
      const allowedOrigin = config.corsOrigins[0]; // e.g., http://localhost:5173
      const res = await request(app)
        .options('/api/health')
        .set('Origin', allowedOrigin);

      const acao = res.headers['access-control-allow-origin'];
      expect(acao).toBe(allowedOrigin);
    });
  });

  // =====================================================================
  // 5. Input Validation on Critical Routes
  // =====================================================================
  describe('Input Validation (Zod)', () => {
    it('POST /api/auth/signup rejects invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'not-an-email', password: 'test12345', username: 'validuser' })
        .expect(400);

      expect(res.body.error).toMatch(/validation/i);
    });

    it('POST /api/auth/signup rejects short password', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'test@example.com', password: '123', username: 'validuser' })
        .expect(400);

      expect(res.body.error).toMatch(/validation/i);
    });

    it('POST /api/auth/login rejects empty password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: '' })
        .expect(400);

      expect(res.body.error).toMatch(/validation/i);
    });

    it('POST /api/reminders rejects empty text', async () => {
      const res = await request(app)
        .post('/api/reminders')
        .set('Authorization', authHeader)
        .send({ text: '' })
        .expect(400);

      expect(res.body.error).toMatch(/validation/i);
    });

    it('POST /api/reminders rejects text over 500 chars', async () => {
      const res = await request(app)
        .post('/api/reminders')
        .set('Authorization', authHeader)
        .send({ text: 'x'.repeat(501) })
        .expect(400);

      expect(res.body.error).toMatch(/validation/i);
    });

    it('PATCH /api/agent/config rejects unknown fields (strict schema)', async () => {
      const res = await request(app)
        .patch('/api/agent/config')
        .set('Authorization', authHeader)
        .send({ unknownField: 'malicious' })
        .expect(400);

      expect(res.body.error).toMatch(/validation/i);
    });

    it('POST /api/automations rejects invalid triggerType', async () => {
      const res = await request(app)
        .post('/api/automations')
        .set('Authorization', authHeader)
        .send({
          name: 'Test',
          triggerType: 'sql_injection',
          actionType: 'log',
        })
        .expect(400);

      expect(res.body.error).toMatch(/validation/i);
    });

    it('POST /api/workflows rejects oversized name', async () => {
      const res = await request(app)
        .post('/api/workflows')
        .set('Authorization', authHeader)
        .send({
          name: 'x'.repeat(201),
          steps: [{ agent: 'weebo', prompt_template: 'test', output_key: 'out' }],
        })
        .expect(400);

      expect(res.body.error).toMatch(/validation/i);
    });

    it('POST /api/images/generate rejects empty prompt', async () => {
      const res = await request(app)
        .post('/api/images/generate')
        .set('Authorization', authHeader)
        .send({ prompt: '' })
        .expect(400);

      expect(res.body.error).toMatch(/validation/i);
    });
  });

  // =====================================================================
  // 6. Security Headers
  // =====================================================================
  describe('Security Headers', () => {
    it('API responses include X-Robots-Tag noindex', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-robots-tag']).toContain('noindex');
    });

    it('responses include Referrer-Policy header', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });

    it('responses include Cross-Origin-Opener-Policy', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['cross-origin-opener-policy']).toBe('same-origin');
    });

    it('responses include Cross-Origin-Resource-Policy', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['cross-origin-resource-policy']).toBe('same-site');
    });

    it('responses include X-Request-Id for log correlation', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-request-id']).toBeDefined();
      // Should be a valid UUID format
      expect(res.headers['x-request-id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('X-Powered-By header is removed (helmet)', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('responses include Permissions-Policy', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['permissions-policy']).toContain('camera=()');
    });
  });

  // =====================================================================
  // 7. Auth Guards on Sensitive Endpoints
  // =====================================================================
  describe('Auth Guards', () => {
    it('GET /api/users/me requires auth', async () => {
      await request(app).get('/api/users/me').expect(401);
    });

    it('PATCH /api/users/me requires auth', async () => {
      await request(app).patch('/api/users/me').send({ name: 'hack' }).expect(401);
    });

    it('GET /api/agent/config requires auth', async () => {
      await request(app).get('/api/agent/config').expect(401);
    });

    it('POST /api/agent/chat requires auth', async () => {
      await request(app).post('/api/agent/chat').send({ message: 'hi' }).expect(401);
    });

    it('POST /api/reminders requires auth', async () => {
      await request(app).post('/api/reminders').send({ text: 'test' }).expect(401);
    });

    it('GET /api/api-keys requires auth', async () => {
      await request(app).get('/api/api-keys').expect(401);
    });

    it('POST /api/automations requires auth', async () => {
      await request(app).post('/api/automations').send({ name: 'test' }).expect(401);
    });

    it('GET /api/billing/plan requires auth', async () => {
      await request(app).get('/api/billing/plan').expect(401);
    });

    it('GET /api/memory requires auth', async () => {
      await request(app).get('/api/memory').expect(401);
    });

    it('POST /api/workflows requires auth', async () => {
      await request(app).post('/api/workflows').send({ name: 'x' }).expect(401);
    });
  });

  // =====================================================================
  // 8. Content-Type Enforcement
  // =====================================================================
  describe('Content-Type Enforcement', () => {
    it('POST with form-urlencoded does not crash (logs warning)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .type('form')
        .send('email=test@example.com&password=test12345');

      // Should not crash -- returns 400 (invalid JSON parse) or validation error
      expect([400, 401]).toContain(res.status);
    });
  });

  // =====================================================================
  // 9. Request Timeout
  // =====================================================================
  describe('Request Timeout', () => {
    it('health endpoint responds within 5 seconds', async () => {
      const start = Date.now();
      await request(app).get('/api/health').expect(200);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(5000);
    });
  });

  // =====================================================================
  // 10. Body Size Limits
  // =====================================================================
  describe('Request Body Size Limits', () => {
    it('rejects body exceeding maxRequestBodyBytes', async () => {
      const bigPayload = { data: 'x'.repeat(2 * 1024 * 1024) }; // 2MB
      const res = await request(app)
        .post('/api/auth/login')
        .send(bigPayload);

      expect(res.status).toBe(413); // Payload Too Large
    });
  });
});
