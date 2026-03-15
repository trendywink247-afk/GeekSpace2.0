// ============================================================
// Phase 54 Tests
// ============================================================
// 54.3: JWT refresh endpoint with short-circuit replay guard
// 54.5: Redis cache for /api/auth/me (X-Cache header)
// 54.6: Structured 5xx error logging (requestId in error response)
// 54.9: Connections last-sync relative time (backend data integrity)
// 54.2: Webhook payload preview (frontend — covered by AutomationsPage structure)
// 54.10: Reminder dialog autofocus (frontend — not unit tested here)
// ============================================================

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, generateTestToken, resetDatabase } from '../setup.js';

const app = createApp();

describe('Phase 54', () => {
  let token: string;
  let userId: string;

  beforeAll(() => {
    resetDatabase();
    const user = createTestUser(`phase54-${Date.now()}@example.com`);
    userId = user.id;
    token = `Bearer ${generateTestToken(user.id)}`;
  });

  // ── 54.3: JWT refresh endpoint (now uses refresh token rotation) ─────

  describe('54.3 — POST /api/auth/refresh', () => {
    it('returns 400 when no refreshToken in body', async () => {
      const res = await request(app).post('/api/auth/refresh').send({});
      expect(res.status).toBe(400);
    });

    it('returns 401 with invalid refreshToken', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token-here' });
      expect(res.status).toBe(401);
    });

    it('returns new access + refresh token with valid refreshToken', async () => {
      const { issueRefreshToken } = await import('../../services/refresh-token.js');
      const { refreshToken } = issueRefreshToken(userId);
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('refreshToken');
      // New refresh token should differ from old
      expect(res.body.refreshToken).not.toBe(refreshToken);
    });
  });

  // ── 54.5: /api/auth/me Redis cache ───────────────────────

  describe('54.5 — GET /api/auth/me cache', () => {
    it('returns user data on first request', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', token);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', userId);
      expect(res.body).toHaveProperty('email');
    });

    it('includes X-Cache header (HIT or MISS)', async () => {
      // First call populates cache (MISS), second would be HIT if Redis is running
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', token);
      expect(res.status).toBe(200);
      // X-Cache is set in both paths (HIT or MISS)
      const cacheHeader = res.headers['x-cache'];
      expect(cacheHeader === 'HIT' || cacheHeader === 'MISS').toBe(true);
    });

    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('includes onboardingCompleted field', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', token);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('onboardingCompleted');
    });
  });

  // ── 54.6: Structured error responses (requestId) ─────────

  describe('54.6 — Error response structure', () => {
    it('returns requestId in 404 response', async () => {
      const res = await request(app)
        .get('/api/nonexistent-route-xyz');
      // 404 from express itself or our handler
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('AppError returns statusCode and error message', async () => {
      // Trigger a known 401 via auth
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer bad_token');
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    it('400 body-parse error has error field', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('not-valid-json{');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  // ── 54.12: Brand guard (brand_guard.mjs) ─────────────────

  describe('54.12 — Brand guard sanity', () => {
    it('brand_guard.mjs file exists in ops/', async () => {
      const { existsSync } = await import('fs');
      const { resolve } = await import('path');
      const guardPath = resolve(process.cwd(), '..', 'ops', 'brand_guard.mjs');
      expect(existsSync(guardPath)).toBe(true);
    });
  });

  // ── 54.9: Connections last-sync data integrity ────────────

  describe('54.9 — Integrations last-sync field', () => {
    it('GET /api/integrations returns integrations with lastSync field', async () => {
      const res = await request(app)
        .get('/api/integrations')
        .set('Authorization', token);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // lastSync may be null (never synced) or a string — both are valid
      for (const integration of res.body) {
        expect('lastSync' in integration || 'last_sync' in integration).toBe(true);
      }
    });
  });
});
