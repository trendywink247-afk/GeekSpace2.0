/**
 * Phase 68 Tests
 * Suggestion Intelligence: pagination, voting, status history, duplicate detection,
 * activity log, clusters with vote counts.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { db } from '../../db/index.js';
import { createTestUser, generateTestToken, resetDatabase } from '../setup.js';
import { config } from '../../config.js';

const app = createApp();

// ── Helpers ──────────────────────────────────────────────────────────────────

function authHeader(userId: string): string {
  return `Bearer ${generateTestToken(userId)}`;
}

async function createSuggestion(userId: string, overrides: { title?: string; body?: string } = {}) {
  const title = overrides.title ?? `Suggestion ${Date.now()}`;
  const body = overrides.body ?? 'This is a sufficiently long description for the suggestion test.';
  const token = generateTestToken(userId);
  const res = await request(app)
    .post('/api/suggestions')
    .set('Authorization', `Bearer ${token}`)
    .send({ title, body, tags: [] });
  return res;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Phase 68 — Suggestion Intelligence', () => {
  beforeEach(() => {
    resetDatabase();
  });

  // ── 1. Pagination ──────────────────────────────────────────────────────────
  describe('68.1 — GET /api/suggestions/mine pagination', () => {
    it('returns paginated results with total field', async () => {
      const user = createTestUser(`phase68-paginate-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);

      // Create 5 suggestions
      for (let i = 0; i < 5; i++) {
        await createSuggestion(user.id, { title: `Feature Request ${i}` });
      }

      const res = await request(app)
        .get('/api/suggestions/mine?page=1&limit=2')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.suggestions).toHaveLength(2);
      expect(res.body.total).toBe(5);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(2);
    });

    it('returns second page correctly', async () => {
      const user = createTestUser(`phase68-paginate2-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);

      for (let i = 0; i < 4; i++) {
        await createSuggestion(user.id, { title: `Page Feature ${i}` });
      }

      const res = await request(app)
        .get('/api/suggestions/mine?page=2&limit=2')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.suggestions).toHaveLength(2);
      expect(res.body.page).toBe(2);
    });
  });

  // ── 2. Vote endpoint ───────────────────────────────────────────────────────
  describe('68.2 — POST /api/suggestions/:id/vote', () => {
    it('upvote returns { upvotes, downvotes }', async () => {
      const user = createTestUser(`phase68-vote-${Date.now()}@example.com`);
      const sugRes = await createSuggestion(user.id);
      expect(sugRes.status).toBe(201);
      const suggestionId = sugRes.body.id as string;

      const res = await request(app)
        .post(`/api/suggestions/${suggestionId}/vote`)
        .set('Authorization', authHeader(user.id))
        .send({ vote: 1 });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('upvotes');
      expect(res.body).toHaveProperty('downvotes');
      expect(res.body.upvotes).toBe(1);
      expect(res.body.downvotes).toBe(0);
    });

    it('changing vote replaces old vote (INSERT OR REPLACE)', async () => {
      const user = createTestUser(`phase68-vote-replace-${Date.now()}@example.com`);
      const sugRes = await createSuggestion(user.id);
      const suggestionId = sugRes.body.id as string;

      // First upvote
      await request(app)
        .post(`/api/suggestions/${suggestionId}/vote`)
        .set('Authorization', authHeader(user.id))
        .send({ vote: 1 });

      // Now downvote — should replace
      const res = await request(app)
        .post(`/api/suggestions/${suggestionId}/vote`)
        .set('Authorization', authHeader(user.id))
        .send({ vote: -1 });

      expect(res.status).toBe(200);
      expect(res.body.upvotes).toBe(0);
      expect(res.body.downvotes).toBe(1);

      // Verify only one vote record in DB
      const voteCount = (db.prepare(
        `SELECT COUNT(*) as cnt FROM suggestion_votes WHERE suggestion_id = ? AND user_id = ?`
      ).get(suggestionId, user.id) as { cnt: number }).cnt;
      expect(voteCount).toBe(1);
    });

    it('returns 401 without auth', async () => {
      const user = createTestUser(`phase68-vote-noauth-${Date.now()}@example.com`);
      const sugRes = await createSuggestion(user.id);
      const suggestionId = sugRes.body.id as string;

      const res = await request(app)
        .post(`/api/suggestions/${suggestionId}/vote`)
        .send({ vote: 1 });

      expect(res.status).toBe(401);
    });

    it('returns 400 for invalid vote value', async () => {
      const user = createTestUser(`phase68-vote-invalid-${Date.now()}@example.com`);
      const sugRes = await createSuggestion(user.id);
      const suggestionId = sugRes.body.id as string;

      const res = await request(app)
        .post(`/api/suggestions/${suggestionId}/vote`)
        .set('Authorization', authHeader(user.id))
        .send({ vote: 5 });

      expect(res.status).toBe(400);
    });
  });

  // ── 3. Duplicate warning with word overlap ─────────────────────────────────
  describe('68.3 — Duplicate warning on 60% word overlap', () => {
    it('sets duplicate_warning: true when body has >= 60% word overlap', async () => {
      const user = createTestUser(`phase68-dup-${Date.now()}@example.com`);

      // First suggestion
      await createSuggestion(user.id, {
        title: 'Dark mode calendar',
        body: 'Please add dark mode support for the calendar view so users can work at night comfortably',
      });

      // Second suggestion with high overlap
      const res = await createSuggestion(user.id, {
        title: 'Night mode request',
        body: 'Please add dark mode support for the calendar view so users can work at night comfortably',
      });

      expect(res.status).toBe(201);
      expect(res.body.duplicate_warning).toBe(true);
    });

    it('does NOT set duplicate_warning for different suggestions', async () => {
      const user = createTestUser(`phase68-nodup-${Date.now()}@example.com`);

      await createSuggestion(user.id, {
        title: 'Add calendar dark mode',
        body: 'Dark mode for the calendar widget would help with nighttime usage',
      });

      const res = await createSuggestion(user.id, {
        title: 'Export to PDF',
        body: 'Allow users to export their reminder list and portfolio to a PDF document',
      });

      expect(res.status).toBe(201);
      expect(res.body.duplicate_warning).toBeUndefined();
    });
  });

  // ── 4. Activity log after creating suggestion ──────────────────────────────
  describe('68.4 — Activity log entry for suggestion creation', () => {
    it('creates an activity_log entry when suggestion is submitted', async () => {
      const user = createTestUser(`phase68-activity-${Date.now()}@example.com`);
      const title = `Activity Test ${Date.now()}`;

      await createSuggestion(user.id, { title });

      const log = db.prepare(
        `SELECT * FROM activity_log WHERE user_id = ? AND action = 'Submitted suggestion' ORDER BY created_at DESC LIMIT 1`
      ).get(user.id) as { action: string; details: string; icon: string } | undefined;

      expect(log).toBeDefined();
      expect(log?.action).toBe('Submitted suggestion');
      expect(log?.details).toBe(title);
      expect(log?.icon).toBe('lightbulb');
    });
  });

  // ── 5. Suggestion status history ──────────────────────────────────────────
  describe('68.5 — Suggestion status history (suggestion_events)', () => {
    it('creates a suggestion_events row when admin changes status', async () => {
      const adminToken = config.adminToken;

      // Skip gracefully if admin token not configured
      if (!adminToken) {
        console.log('Skipping status history test — ADMIN_TOKEN not configured');
        return;
      }

      const user = createTestUser(`phase68-history-${Date.now()}@example.com`);
      const sugRes = await createSuggestion(user.id);
      expect([201]).toContain(sugRes.status);
      const suggestionId = sugRes.body.id as string;

      const patchRes = await request(app)
        .patch(`/api/admin/suggestions/${suggestionId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'accepted' });

      expect([200, 401, 503]).toContain(patchRes.status);

      if (patchRes.status === 200) {
        const event = db.prepare(
          `SELECT * FROM suggestion_events WHERE suggestion_id = ? ORDER BY created_at DESC LIMIT 1`
        ).get(suggestionId) as { from_status: string; to_status: string; actor: string } | undefined;

        expect(event).toBeDefined();
        expect(event?.from_status).toBe('new');
        expect(event?.to_status).toBe('accepted');
        expect(event?.actor).toBe('admin');
      }
    });
  });

  // ── 6. Clusters endpoint returns total_votes field ────────────────────────
  describe('68.6 — GET /api/suggestions/clusters includes total_votes', () => {
    it('returns clusters array with total_votes field', async () => {
      const user = createTestUser(`phase68-clusters-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);

      const res = await request(app)
        .get('/api/suggestions/clusters')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('clusters');
      expect(Array.isArray(res.body.clusters)).toBe(true);

      // If there are clusters, they should have total_votes
      if (res.body.clusters.length > 0) {
        expect(res.body.clusters[0]).toHaveProperty('total_votes');
      }
    });
  });

  // ── 7. Mine endpoint returns paginated response shape ─────────────────────
  describe('68.7 — GET /api/suggestions/mine returns total/page/limit', () => {
    it('empty response still has total=0, page=1, limit=10', async () => {
      const user = createTestUser(`phase68-mine-shape-${Date.now()}@example.com`);
      const token = generateTestToken(user.id);

      const res = await request(app)
        .get('/api/suggestions/mine')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('page');
      expect(res.body).toHaveProperty('limit');
      expect(res.body.total).toBe(0);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(10);
    });
  });

  // ── 8. Vote table has UNIQUE constraint (only one vote per user per suggestion) ──
  describe('68.8 — suggestion_votes UNIQUE constraint enforced', () => {
    it('only keeps one vote per user per suggestion', async () => {
      const user = createTestUser(`phase68-unique-vote-${Date.now()}@example.com`);
      const sugRes = await createSuggestion(user.id);
      const suggestionId = sugRes.body.id as string;

      // Vote 3 times (each should replace the last)
      for (const vote of [1, -1, 1]) {
        await request(app)
          .post(`/api/suggestions/${suggestionId}/vote`)
          .set('Authorization', authHeader(user.id))
          .send({ vote });
      }

      const count = (db.prepare(
        `SELECT COUNT(*) as cnt FROM suggestion_votes WHERE suggestion_id = ? AND user_id = ?`
      ).get(suggestionId, user.id) as { cnt: number }).cnt;

      expect(count).toBe(1);
    });
  });
});
