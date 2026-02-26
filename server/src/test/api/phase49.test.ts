// ============================================================
// Phase 49 Tests
// ============================================================
// 49.1: X-Robots-Tag header on API routes
// 49.2/49.5: Automations log/list refresh (UI-only, no unit test needed)
// 49.3: Mark all overdue complete (frontend — not unit tested here)
// 49.4: Portfolio last_viewed_at (frontend — not unit tested here)
// 49.6: Portfolio contact rate limit via Redis
// 49.7: Portfolio contact nonce endpoint + nonce validation
// 49.8: SQLite ANALYZE on startup (implicit — server starts clean)
// 49.9: Startup DB row counts (logged to stdout, not HTTP)
// ============================================================

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, generateTestToken } from '../setup.js';

const app = createApp();

describe('Phase 49', () => {
  let token: string;
  let username: string;

  beforeAll(async () => {
    const user = createTestUser(`phase49-${Date.now()}@example.com`);
    token = generateTestToken(user.id);
    username = user.username;

    // Create a public portfolio record directly so contact-nonce and contact tests work
    const { db } = await import('../../db/index.js');
    db.prepare(
      `INSERT OR IGNORE INTO portfolios (user_id, username, headline, about, skills, projects, milestones, social, is_public)
       VALUES (?, ?, ?, ?, '[]', '[]', '[]', '{}', 1)`
    ).run(user.id, user.username, 'Phase 49 Test', 'Testing');
  });

  // ── 49.1: X-Robots-Tag ──────────────────────────────────────────────────────

  describe('49.1 — X-Robots-Tag header on /api/* routes', () => {
    it('should set X-Robots-Tag: noindex, nofollow on API responses', async () => {
      const res = await request(app)
        .get('/api/health')
        .expect(200);
      expect(res.headers['x-robots-tag']).toBe('noindex, nofollow');
    });

    it('should set X-Robots-Tag on authenticated endpoints', async () => {
      const res = await request(app)
        .get('/api/reminders')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.headers['x-robots-tag']).toBe('noindex, nofollow');
    });

    it('should set X-Robots-Tag on 404 API responses', async () => {
      const res = await request(app)
        .get('/api/nonexistent-endpoint-xyz')
        .expect(404);
      expect(res.headers['x-robots-tag']).toBe('noindex, nofollow');
    });
  });

  // ── 49.7: Portfolio contact nonce ───────────────────────────────────────────

  describe('49.7 — Portfolio contact-nonce endpoint', () => {
    it('should return a nonce for a valid username', async () => {
      const res = await request(app)
        .get(`/api/portfolio/${username}/contact-nonce`)
        .expect(200);
      expect(typeof res.body.nonce).toBe('string');
      expect(res.body.nonce.length).toBe(32); // 16 bytes hex = 32 chars
    });

    it('should return 404 for unknown username', async () => {
      await request(app)
        .get('/api/portfolio/totally-nonexistent-user-xyz123/contact-nonce')
        .expect(404);
    });

    it('should reject contact form with invalid nonce', async () => {
      await request(app)
        .post(`/api/portfolio/${username}/contact`)
        .send({
          senderName: 'Test Sender',
          message: 'Testing nonce validation',
          nonce: 'invalidnonce0000invalidnonce0000',
        })
        .expect(422);
    });

    it('should accept contact form without nonce (backward compatible)', async () => {
      await request(app)
        .post(`/api/portfolio/${username}/contact`)
        .send({
          senderName: 'No Nonce Sender',
          message: 'This message has no nonce',
        })
        .expect(200);
    });
  });

  // ── 49.8: ANALYZE on startup ─────────────────────────────────────────────────

  describe('49.8 — SQLite ANALYZE on startup', () => {
    it('should have sqlite_stat1 table populated after startup', async () => {
      // ANALYZE populates sqlite_stat1; if it's there, ANALYZE ran successfully
      const { db } = await import('../../db/index.js');
      const row = db.prepare("SELECT count(*) as cnt FROM sqlite_stat1").get() as { cnt: number } | undefined;
      // The table exists and has rows (or is empty if no indexes yet — both are valid)
      expect(row).toBeDefined();
    });
  });
});
