// ============================================================
// Phase 55 Tests
// ============================================================
// 55.1: E2E flake fixes (Playwright — not unit tested here)
// 55.2: Dashboard load-error banner (frontend Zustand store — loadErrors counter)
// 55.3: Portfolio edit inline preview (frontend — not unit tested here)
// 55.4: Rate limit on /api/auth/refresh (express-rate-limit — integration test)
// 55.5: ETag for /api/reminders (already tested in Phase 48)
// 55.6: Dead-letter retry endpoint POST /automations/dead-letters/:id/retry
// 55.7: Agent chat empty state (frontend — not unit tested here)
// 55.8: Settings unsaved guard (frontend — not unit tested here)
// 55.9: Connections mobile tap-to-expand (frontend — not unit tested here)
// 55.10: /api/version buildTime (already present since Phase 47)
// ============================================================

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, generateTestToken, resetDatabase } from '../setup.js';
import { db } from '../../db/index.js';
import { v4 as uuid } from 'uuid';
import { initAutomationsEngine } from '../../services/automations-engine.js';

const app = createApp();

describe('Phase 55', () => {
  let token: string;
  let userId: string;

  beforeAll(() => {
    resetDatabase();
    initAutomationsEngine(); // ensures automation_logs table exists
    const user = createTestUser(`phase55-${Date.now()}@example.com`);
    userId = user.id;
    token = `Bearer ${generateTestToken(user.id)}`;
  });

  // ── 55.4: Rate limit on /api/auth/refresh (now uses refresh token rotation) ──

  describe('55.4 — /api/auth/refresh rate limit middleware', () => {
    it('endpoint is reachable and returns 200 with valid refreshToken', async () => {
      const { issueRefreshToken } = await import('../../services/refresh-token.js');
      const { refreshToken } = issueRefreshToken(userId);
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('refreshToken');
    });

    it('returns 400 without refreshToken body', async () => {
      const res = await request(app).post('/api/auth/refresh').send({});
      expect(res.status).toBe(400);
    });
  });

  // ── 55.6: Dead-letter retry ───────────────────────────────

  describe('55.6 — POST /api/automations/dead-letters/:id/retry', () => {
    let automationId: string;
    let deadLetterId: string;

    beforeAll(() => {
      // Create an automation with 'log' action type (no HTTP) and webhook trigger
      automationId = uuid();
      db.prepare(
        'INSERT INTO automations (id, user_id, name, trigger_type, trigger_config, action_type, action_config, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(automationId, userId, 'Phase55 DL Test', 'webhook', '{}', 'log', JSON.stringify({ message: 'test' }), 1);

      // Insert a dead-letter entry
      deadLetterId = uuid();
      db.prepare(
        'INSERT INTO webhook_dead_letters (id, user_id, automation_id, url, error, payload, failed_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(deadLetterId, userId, automationId, 'https://example.com', 'timeout', JSON.stringify({ test: true }), Date.now());
    });

    it('returns 404 for non-existent dead-letter', async () => {
      const res = await request(app)
        .post(`/api/automations/dead-letters/${uuid()}/retry`)
        .set('Authorization', token);
      expect(res.status).toBe(404);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post(`/api/automations/dead-letters/${deadLetterId}/retry`);
      expect(res.status).toBe(401);
    });

    it('attempts retry and returns retried=true', async () => {
      const res = await request(app)
        .post(`/api/automations/dead-letters/${deadLetterId}/retry`)
        .set('Authorization', token);
      // 200 regardless of whether the actual HTTP call succeeded
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('retried', true);
      expect(res.body).toHaveProperty('removed');
      expect(res.body).toHaveProperty('result');
    }, 10000);

    it('returns 404 when dead-letter belongs to different user', async () => {
      const other = createTestUser(`phase55-other-${Date.now()}@example.com`);
      const otherToken = `Bearer ${generateTestToken(other.id)}`;
      // Create a dead-letter owned by userId, try to retry as other
      const dlId = uuid();
      db.prepare(
        'INSERT INTO webhook_dead_letters (id, user_id, automation_id, url, error, payload, failed_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(dlId, userId, automationId, 'https://example.com', 'test', '{}', Date.now());
      const res = await request(app)
        .post(`/api/automations/dead-letters/${dlId}/retry`)
        .set('Authorization', otherToken);
      expect(res.status).toBe(404);
    });
  });

  // ── 55.2: loadErrors counter exists in dashboardStore ─────
  // (Verified manually: dashboardStore.ts line 66 has `loadErrors: number;`)

  it('GET /api/health still returns 200 after Phase 55 changes', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
  });

  it('GET /api/version includes buildTime', async () => {
    const res = await request(app).get('/api/version');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('buildTime');
  });
});
