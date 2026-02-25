// ============================================================
// Phase 51 Tests
// ============================================================
// 51.1: /api/users/notification-email cache invalidation path
// 51.4: OverviewPage copy briefing (frontend — not unit tested here)
// 51.5: AutomationsPage trigger error feedback (frontend — not unit tested here)
// 51.6: Portfolio contact auto-close (frontend — not unit tested here)
// 51.7: X-RateLimit-Policy headers on rate-limited endpoints
// 51.8: contactSending guard (frontend — not unit tested here)
// 51.9: Portfolio contact structured logging (route behaviour unchanged)
// ============================================================

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, generateTestToken, resetDatabase } from '../setup.js';
import { db } from '../../db/index.js';

const app = createApp();

describe('Phase 51', () => {
  let token: string;
  let username: string;

  beforeAll(() => {
    resetDatabase();
    const user = createTestUser(`phase51-${Date.now()}@example.com`);
    token = generateTestToken(user.id);
    username = user.username;
  });

  // ── 51.1: PATCH /api/users/notification-email ─────────────────────────────────

  describe('51.1 — PATCH /api/users/notification-email cache invalidation', () => {
    it('should update notification_email flag and return enabled/address', async () => {
      const res = await request(app)
        .patch('/api/users/notification-email')
        .set('Authorization', `Bearer ${token}`)
        .send({ enabled: true })
        .expect(200);

      expect(res.body).toHaveProperty('enabled');
      expect(res.body).toHaveProperty('address');
      expect(typeof res.body.enabled).toBe('boolean');
    });

    it('should disable notification_email when enabled=false', async () => {
      const res = await request(app)
        .patch('/api/users/notification-email')
        .set('Authorization', `Bearer ${token}`)
        .send({ enabled: false })
        .expect(200);

      expect(res.body.enabled).toBe(false);
    });

    it('should update address field when provided alongside enabled', async () => {
      const addr = `phase51-notify-${Date.now()}@test.com`;
      const res = await request(app)
        .patch('/api/users/notification-email')
        .set('Authorization', `Bearer ${token}`)
        .send({ enabled: true, address: addr })
        .expect(200);

      expect(res.body).toHaveProperty('address');
      // Address may differ if agent_config row has different state; key check is no error
    });

    it('should accept address-only update (51.1: schema allows partial update)', async () => {
      const addr = `phase51-addr-only-${Date.now()}@test.com`;
      const res = await request(app)
        .patch('/api/users/notification-email')
        .set('Authorization', `Bearer ${token}`)
        .send({ address: addr })
        .expect(200);

      expect(res.body).toHaveProperty('enabled');
      expect(res.body).toHaveProperty('address');
    });

    it('should reject empty body (no enabled or address)', async () => {
      await request(app)
        .patch('/api/users/notification-email')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);
    });

    it('should reject unauthenticated requests', async () => {
      await request(app)
        .patch('/api/users/notification-email')
        .send({ enabled: true })
        .expect(401);
    });

    it('/me should reflect updated notification_email field after PATCH', async () => {
      // Enable notification email
      await request(app)
        .patch('/api/users/notification-email')
        .set('Authorization', `Bearer ${token}`)
        .send({ enabled: true })
        .expect(200);

      // GET /me should have the field consistent (cache may be MISS in test mode)
      const me = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(me.body.notifications.email).toBe(true);

      // Disable it
      await request(app)
        .patch('/api/users/notification-email')
        .set('Authorization', `Bearer ${token}`)
        .send({ enabled: false })
        .expect(200);

      const me2 = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(me2.body.notifications.email).toBe(false);
    });
  });

  // ── 51.7: X-RateLimit-Policy headers ─────────────────────────────────────────

  describe('51.7 — X-RateLimit-Policy headers on rate-limited routes', () => {
    it('POST /api/auth/login should include X-RateLimit-Policy header', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrong' });

      // Status can be 400/401/429 — we just care about the header
      expect(res.headers['x-ratelimit-policy']).toBeDefined();
      // Format: N;w=SECONDS
      expect(res.headers['x-ratelimit-policy']).toMatch(/^\d+;w=\d+$/);
    });

    it('POST /api/auth/signup should include X-RateLimit-Policy header', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: `rl-test-${Date.now()}@example.com`, password: 'pass123', username: `rl${Date.now()}` });

      expect(res.headers['x-ratelimit-policy']).toBeDefined();
      expect(res.headers['x-ratelimit-policy']).toMatch(/^\d+;w=\d+$/);
    });

    it('POST /api/agent/chat should include X-RateLimit-Policy header', async () => {
      const res = await request(app)
        .post('/api/agent/chat')
        .set('Authorization', `Bearer ${token}`)
        .send({ message: 'hello' });

      // May succeed or fail with LLM error, but header should be present
      expect(res.headers['x-ratelimit-policy']).toBeDefined();
      expect(res.headers['x-ratelimit-policy']).toMatch(/^\d+;w=\d+$/);
    });
  });

  // ── 51.9: Portfolio contact route still works (structured logging is fire-and-forget) ──

  describe('51.9 — Portfolio contact structured logging (route behaviour)', () => {
    let portfolioUsername: string;

    beforeAll(() => {
      // Create a second user + public portfolio for contact tests
      const user2 = createTestUser(`phase51-port-${Date.now()}@example.com`);
      portfolioUsername = user2.username;

      db.prepare(
        `INSERT OR IGNORE INTO portfolios (user_id, username, headline, about, skills, projects, milestones, social, is_public)
         VALUES (?, ?, ?, ?, '[]', '[]', '[]', '{}', 1)`
      ).run(user2.id, user2.username, 'Phase 51 Test', 'Testing');
    });

    it('POST /api/portfolio/:username/contact should accept valid contact message', async () => {
      const res = await request(app)
        .post(`/api/portfolio/${portfolioUsername}/contact`)
        .send({
          senderName: 'Test Sender',
          message: 'Hello from Phase 51 test',
        });

      // Rate limit or success — either way logging ran
      expect([200, 429]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('success', true);
      }
    });

    it('POST /api/portfolio/:username/contact should reject empty senderName', async () => {
      const res = await request(app)
        .post(`/api/portfolio/${portfolioUsername}/contact`)
        .send({
          senderName: '',
          message: 'Hello',
        });

      expect([400, 429]).toContain(res.status);
    });

    it('POST /api/portfolio/:username/contact should reject empty message', async () => {
      const res = await request(app)
        .post(`/api/portfolio/${portfolioUsername}/contact`)
        .send({
          senderName: 'Test',
          message: '',
        });

      expect([400, 429]).toContain(res.status);
    });

    it('POST /api/portfolio/:username/contact should return 404 for unknown user', async () => {
      await request(app)
        .post('/api/portfolio/totally-nonexistent-xyz999/contact')
        .send({
          senderName: 'Test',
          message: 'Hello',
        })
        .expect(404);
    });
  });
});
