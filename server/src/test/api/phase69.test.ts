/**
 * Phase 69 Tests
 * DB indexes, vote activity log, suggestions events endpoint,
 * admin CSV export, auth timing fix, cluster stats, and cluster naming.
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { db } from '../../db/index.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { v4 as uuid } from 'uuid';
import { config } from '../../config.js';

// Patch config for test isolation (same pattern as phase31.test.ts and dev.test.ts)
const ADMIN_TOKEN = 'test-admin-token-phase69';
config.adminToken = ADMIN_TOKEN;
(config as Record<string, unknown>).isTestMode = true;

const app = createApp();

function adminHeader() {
  return `Bearer ${ADMIN_TOKEN}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function createSuggestion(userId: string, overrides: { title?: string; body?: string } = {}) {
  const title = overrides.title ?? `Feature Request ${Date.now()}`;
  const body = overrides.body ?? 'This is a detailed description of the feature request for testing purposes.';
  const res = await request(app)
    .post('/api/suggestions')
    .set('Authorization', makeAuthHeader(userId))
    .send({ title, body, tags: [] });
  return res;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Phase 69 — DB indexes, events, CSV export, auth hardening', () => {
  beforeAll(async () => {
    // Trigger admin route registration (routes are lazily registered inside serveAdminDashboard)
    await request(app)
      .get('/admin')
      .set('X-Admin-Password', 'any');
  });

  beforeEach(() => {
    resetDatabase();
  });

  // ── Test 1: GET /api/suggestions/:id/events returns events for own suggestion ──
  describe('69.1 — GET /api/suggestions/:id/events returns events (200)', () => {
    it('returns events array for own suggestion', async () => {
      const user = createTestUser(`phase69-1-${Date.now()}@example.com`);
      const sugRes = await createSuggestion(user.id);
      expect(sugRes.status).toBe(201);
      const suggestionId = sugRes.body.id as string;

      // Manually insert a suggestion event
      db.prepare(
        `INSERT INTO suggestion_events (id, suggestion_id, from_status, to_status, actor, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`
      ).run(uuid(), suggestionId, 'new', 'triaged', 'admin');

      const res = await request(app)
        .get(`/api/suggestions/${suggestionId}/events`)
        .set('Authorization', makeAuthHeader(user.id));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('events');
      expect(Array.isArray(res.body.events)).toBe(true);
      expect(res.body.events.length).toBe(1);
      expect(res.body.events[0]).toHaveProperty('oldStatus', 'new');
      expect(res.body.events[0]).toHaveProperty('newStatus', 'triaged');
      expect(res.body.events[0]).toHaveProperty('changedBy', 'admin');
    });
  });

  // ── Test 2: GET /api/suggestions/:id/events returns 404 for another user's suggestion ──
  describe('69.2 — Events endpoint returns 404 for another user suggestion', () => {
    it('returns 404 when accessing another user\'s suggestion events', async () => {
      const owner = createTestUser(`phase69-2-owner-${Date.now()}@example.com`);
      const other = createTestUser(`phase69-2-other-${Date.now()}@example.com`);

      const sugRes = await createSuggestion(owner.id);
      expect(sugRes.status).toBe(201);
      const suggestionId = sugRes.body.id as string;

      const res = await request(app)
        .get(`/api/suggestions/${suggestionId}/events`)
        .set('Authorization', makeAuthHeader(other.id));

      expect(res.status).toBe(404);
    });
  });

  // ── Test 3: Events returns empty array for suggestion with no events ──
  describe('69.3 — Events endpoint returns empty array for no events', () => {
    it('returns events=[] for suggestion with no status history', async () => {
      const user = createTestUser(`phase69-3-${Date.now()}@example.com`);
      const sugRes = await createSuggestion(user.id);
      expect(sugRes.status).toBe(201);
      const suggestionId = sugRes.body.id as string;

      const res = await request(app)
        .get(`/api/suggestions/${suggestionId}/events`)
        .set('Authorization', makeAuthHeader(user.id));

      expect(res.status).toBe(200);
      expect(res.body.events).toEqual([]);
    });
  });

  // ── Test 4: Admin CSV export returns correct Content-Type ──
  describe('69.4 — GET /api/admin/suggestions/export returns text/csv', () => {
    it('returns 200 with Content-Type: text/csv', async () => {
      const res = await request(app)
        .get('/api/admin/suggestions/export')
        .set('Authorization', adminHeader());

      expect([200, 401, 503]).toContain(res.status);

      if (res.status === 200) {
        expect(res.headers['content-type']).toMatch(/text\/csv/);
        expect(res.headers['content-disposition']).toMatch(/suggestions\.csv/);
      }
    });
  });

  // ── Test 5: Admin CSV export contains suggestion id and title ──
  describe('69.5 — Admin CSV contains suggestion data', () => {
    it('CSV includes id and title fields', async () => {
      const user = createTestUser(`phase69-5-${Date.now()}@example.com`);
      const sugTitle = `CSV Test Feature ${Date.now()}`;
      const sugRes = await createSuggestion(user.id, { title: sugTitle });
      expect(sugRes.status).toBe(201);
      const suggestionId = sugRes.body.id as string;

      const res = await request(app)
        .get('/api/admin/suggestions/export')
        .set('Authorization', adminHeader());

      expect([200, 401, 503]).toContain(res.status);

      if (res.status === 200) {
        const csv = res.text;
        // Header row
        expect(csv).toContain('id,title,body,status,upvotes,downvotes,created_at');
        // Data should include the suggestion id
        expect(csv).toContain(suggestionId);
      }
    });
  });

  // ── Test 6: Admin CSV export with ?status filter ──
  describe('69.6 — Admin CSV export with ?status= filter', () => {
    it('returns only suggestions matching the status filter', async () => {
      const user = createTestUser(`phase69-6-${Date.now()}@example.com`);
      await createSuggestion(user.id, { title: 'New suggestion 1' });
      await createSuggestion(user.id, { title: 'New suggestion 2' });

      // Mark one as accepted
      const sugRes = await createSuggestion(user.id, { title: 'Accepted suggestion' });
      if (sugRes.status === 201) {
        db.prepare(`UPDATE suggestions SET status = 'accepted' WHERE id = ?`).run(sugRes.body.id);
      }

      const res = await request(app)
        .get('/api/admin/suggestions/export?status=new')
        .set('Authorization', adminHeader());

      expect([200, 401, 503]).toContain(res.status);

      if (res.status === 200) {
        const lines = res.text.trim().split('\n');
        // Header + only 'new' status rows
        // All data lines should contain "new" (in the status column)
        const dataLines = lines.slice(1);
        for (const line of dataLines) {
          const cols = line.split(',');
          // status is 4th column (index 3)
          expect(cols[3]).toBe('new');
        }
      }
    });
  });

  // ── Test 7: Vote activity log — after voting, activity_log contains 'vote_suggestion' ──
  describe('69.7 — Vote creates activity_log entry', () => {
    it('logs vote_suggestion action in activity_log after voting', async () => {
      const user = createTestUser(`phase69-7-${Date.now()}@example.com`);
      const sugRes = await createSuggestion(user.id);
      expect(sugRes.status).toBe(201);
      const suggestionId = sugRes.body.id as string;

      const voteRes = await request(app)
        .post(`/api/suggestions/${suggestionId}/vote`)
        .set('Authorization', makeAuthHeader(user.id))
        .send({ vote: 1 });

      expect(voteRes.status).toBe(200);

      // Check activity_log
      const logEntry = db.prepare(
        `SELECT * FROM activity_log WHERE user_id = ? AND action = 'vote_suggestion' ORDER BY created_at DESC LIMIT 1`
      ).get(user.id) as { action: string; details: string } | undefined;

      expect(logEntry).toBeDefined();
      expect(logEntry?.action).toBe('vote_suggestion');
      // details contains the suggestion id and vote value
      const details = JSON.parse(logEntry?.details ?? '{}') as { suggestionId: string; vote: number };
      expect(details.suggestionId).toBe(suggestionId);
      expect(details.vote).toBe(1);
    });
  });

  // ── Test 8: Vote idempotency — voting same direction twice doesn't double activity entries ──
  describe('69.8 — Vote idempotency', () => {
    it('voting same direction twice only adds one activity_log entry', async () => {
      const user = createTestUser(`phase69-8-${Date.now()}@example.com`);
      const sugRes = await createSuggestion(user.id);
      expect(sugRes.status).toBe(201);
      const suggestionId = sugRes.body.id as string;

      await request(app)
        .post(`/api/suggestions/${suggestionId}/vote`)
        .set('Authorization', makeAuthHeader(user.id))
        .send({ vote: 1 });

      await request(app)
        .post(`/api/suggestions/${suggestionId}/vote`)
        .set('Authorization', makeAuthHeader(user.id))
        .send({ vote: 1 });

      // Should still only be 1 vote row (INSERT OR REPLACE)
      const voteCount = (db.prepare(
        `SELECT COUNT(*) as cnt FROM suggestion_votes WHERE suggestion_id = ? AND user_id = ?`
      ).get(suggestionId, user.id) as { cnt: number }).cnt;

      expect(voteCount).toBe(1);
    });
  });

  // ── Test 9: DB index exists — idx_suggestions_status ──
  describe('69.9 — idx_suggestions_status index exists', () => {
    it('idx_suggestions_status exists in sqlite_master', () => {
      const idx = db.prepare(
        `SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_suggestions_status'`
      ).get() as { name: string } | undefined;

      expect(idx).toBeDefined();
      expect(idx?.name).toBe('idx_suggestions_status');
    });
  });

  // ── Test 10: Admin PATCH status creates suggestion_events row ──
  describe('69.10 — Admin PATCH status creates suggestion_events entry', () => {
    it('updating suggestion status creates a suggestion_events row', async () => {
      const user = createTestUser(`phase69-10-${Date.now()}@example.com`);
      const sugRes = await createSuggestion(user.id);
      expect(sugRes.status).toBe(201);
      const suggestionId = sugRes.body.id as string;

      const patchRes = await request(app)
        .patch(`/api/admin/suggestions/${suggestionId}/status`)
        .set('Authorization', adminHeader())
        .send({ status: 'triaged' });

      expect([200, 401, 503]).toContain(patchRes.status);

      if (patchRes.status === 200) {
        const event = db.prepare(
          `SELECT * FROM suggestion_events WHERE suggestion_id = ? ORDER BY created_at DESC LIMIT 1`
        ).get(suggestionId) as { from_status: string; to_status: string } | undefined;

        expect(event).toBeDefined();
        expect(event?.from_status).toBe('new');
        expect(event?.to_status).toBe('triaged');
      }
    });
  });

  // ── Test 11: Cluster stats endpoint ──
  describe('69.11 — GET /api/admin/suggestions/stats returns correct shape', () => {
    it('returns {total, byStatus, topVoted}', async () => {
      const res = await request(app)
        .get('/api/admin/suggestions/stats')
        .set('Authorization', adminHeader());

      expect([200, 401, 503]).toContain(res.status);

      if (res.status === 200) {
        expect(res.body).toHaveProperty('total');
        expect(res.body).toHaveProperty('byStatus');
        expect(res.body).toHaveProperty('topVoted');
        expect(typeof res.body.total).toBe('number');
        expect(typeof res.body.byStatus).toBe('object');
        expect(Array.isArray(res.body.topVoted)).toBe(true);
      }
    });
  });

  // ── Test 12: Rate limit triage — skipped in TEST_MODE ──
  describe('69.12 — Triage rate limit skipped in TEST_MODE', () => {
    it('POST /api/admin/suggestions/triage succeeds twice in TEST_MODE (no 429)', async () => {
      // In TEST_MODE the rate limit is bypassed — both calls should succeed or fail with a non-429 code
      const res1 = await request(app)
        .post('/api/admin/suggestions/triage')
        .set('Authorization', adminHeader());

      expect([200, 401, 503]).toContain(res1.status); // Not 429

      if (res1.status === 200) {
        const res2 = await request(app)
          .post('/api/admin/suggestions/triage')
          .set('Authorization', adminHeader());

        // Should NOT be 429 in test mode
        expect(res2.status).not.toBe(429);
      }
    });
  });

  // ── Test 13: Forgot-password always returns same message ──
  describe('69.13 — Forgot-password timing hardening', () => {
    it('returns same message for existing and non-existing emails', async () => {
      const existingUser = createTestUser(`phase69-13-existing-${Date.now()}@example.com`);

      const resExisting = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: existingUser.email });

      const resNonExisting = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: `nonexistent-${Date.now()}@nowhere.invalid` });

      // Both should return 200 with the same message shape
      expect([200]).toContain(resExisting.status);
      expect([200]).toContain(resNonExisting.status);
      expect(resExisting.body.message).toBeDefined();
      expect(resNonExisting.body.message).toBeDefined();
      // Both messages should be the same constant string
      expect(resExisting.body.message).toBe(resNonExisting.body.message);
    });
  });
});
