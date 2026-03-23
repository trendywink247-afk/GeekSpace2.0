// ============================================================
// Phase 50 Tests
// ============================================================
// 50.1: dashboardStore loadErrors tracking (frontend — not unit tested here)
// 50.2: AutomationsPage timestamp normalization (frontend — not unit tested here)
// 50.3: OverviewPage streak widget (frontend — not unit tested here)
// 50.4: ConnectionsPage filter URL persistence (frontend — not unit tested here)
// 50.5: RemindersPage clear-all-filters button (frontend — not unit tested here)
// 50.7: HSTS header in production (not testable in test mode — NODE_ENV=test)
// 50.8: GET /api/users/me Redis cache (X-Cache header present)
// 50.9: /api/health includes db row counts
// ============================================================

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, generateTestToken } from '../setup.js';

const app = createApp();

describe('Phase 50', () => {
  let token: string;

  beforeAll(() => {
    const user = createTestUser(`phase50-${Date.now()}@example.com`);
    token = generateTestToken(user.id);
  });

  // ── 50.8: GET /api/users/me — X-Cache header ─────────────────────────────────

  describe('50.8 — GET /api/users/me Redis cache', () => {
    it('should return X-Cache header on first request', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // In test mode Redis is unavailable — X-Cache should be MISS (DB fallback path)
      // In production it would be MISS on first hit, HIT on subsequent
      expect(['HIT', 'MISS']).toContain(res.headers['x-cache']);
    });

    it('should return a valid user object', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('email');
      expect(res.body).toHaveProperty('username');
      expect(res.body).toHaveProperty('notifications');
      expect(res.body).toHaveProperty('privacy');
    });

    it('should reject unauthenticated requests', async () => {
      await request(app)
        .get('/api/users/me')
        .expect(401);
    });
  });

  // ── 50.9: /api/health — DB row counts ─────────────────────────────────────────

  describe('50.9 — /api/health does NOT leak db stats (H-3 hardened)', () => {
    it('public health endpoint returns only status', async () => {
      const res = await request(app)
        .get('/api/health')
        .expect(res => expect([200, 503]).toContain(res.status));

      expect(res.body).toHaveProperty('status');
      expect(res.body).not.toHaveProperty('db');
      expect(res.body).not.toHaveProperty('components');
      expect(res.body).not.toHaveProperty('metrics');
      expect(res.body).not.toHaveProperty('system');
    });
  });

  // ── 50.1: loadErrors field in store (implicit — store logic, covered by other tests) ───

  describe('50.1 — Dashboard API returns valid data for Promise.allSettled', () => {
    it('GET /api/dashboard/stats should return stats object', async () => {
      const res = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveProperty('messagesSent');
      expect(res.body).toHaveProperty('remindersActive');
    });
  });
});
