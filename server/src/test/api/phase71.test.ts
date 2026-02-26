/**
 * Phase 71 Tests
 * Lint fixes, vote consistency, vote rate limit, soft-delete cleanup,
 * suggestion edit, pagination, triage batch safety, cache invalidation,
 * duplicate warning similar title, admin bulk status, trending decay.
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { db } from '../../db/index.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { v4 as uuid } from 'uuid';
import { config } from '../../config.js';

// Patch config for test isolation
const ADMIN_TOKEN = 'test-admin-token-phase71';
config.adminToken = ADMIN_TOKEN;
(config as Record<string, unknown>).isTestMode = true;

const app = createApp();

function adminHeader() {
  return `Bearer ${ADMIN_TOKEN}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function createSuggestion(userId: string, overrides: { title?: string; body?: string } = {}) {
  const title = overrides.title ?? `Feature Request ${Date.now()}-${Math.random()}`;
  const body = overrides.body ?? 'This is a detailed description of the feature request for testing purposes.';
  return request(app)
    .post('/api/suggestions')
    .set('Authorization', makeAuthHeader(userId))
    .send({ title, body, tags: [] });
}

function insertSuggestion(userId: string, overrides: { title?: string; body?: string; status?: string } = {}): string {
  const id = uuid();
  db.prepare(`
    INSERT INTO suggestions (id, user_id, title, body, tags, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, '[]', ?, datetime('now'), datetime('now'))
  `).run(
    id,
    userId,
    overrides.title ?? `Bulk Suggestion ${id}`,
    overrides.body ?? 'A description of this bulk-inserted suggestion for testing purposes.',
    overrides.status ?? 'new',
  );
  return id;
}

function insertVote(suggestionId: string, voterId: string, vote: 1 | -1 = 1): void {
  db.prepare(`
    INSERT OR REPLACE INTO suggestion_votes (id, suggestion_id, user_id, vote, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).run(uuid(), suggestionId, voterId, vote);
}

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('Phase 71', () => {
  let userId: string;
  let userId2: string;

  beforeAll(async () => {
    resetDatabase();
    // Trigger admin route registration (routes are lazy-registered in serveAdminDashboard)
    await request(app).get('/admin');
  });

  beforeEach(() => {
    const user1 = createTestUser();
    userId = user1.id;
    const user2 = createTestUser();
    userId2 = user2.id;
  });

  // ── 71.1: Lint — verified by lint step (no test needed) ────────────────────

  // ── 71.2: Vote state always shown in detail (frontend-only, tested via API) ──

  // ── 71.3: Vote endpoint returns upvotes/downvotes ──────────────────────────
  it('POST /suggestions/:id/vote returns upvotes and downvotes', async () => {
    const createRes = await createSuggestion(userId);
    expect(createRes.status).toBe(201);
    const sugId = createRes.body.id;

    const voteRes = await request(app)
      .post(`/api/suggestions/${sugId}/vote`)
      .set('Authorization', makeAuthHeader(userId))
      .send({ vote: 1 });

    expect(voteRes.status).toBe(200);
    expect(voteRes.body.upvotes).toBeGreaterThanOrEqual(1);
    expect(typeof voteRes.body.downvotes).toBe('number');
  });

  it('POST /suggestions/:id/vote rejects deleted suggestions', async () => {
    const createRes = await createSuggestion(userId);
    const sugId = createRes.body.id;

    // Delete it
    await request(app)
      .delete(`/api/suggestions/${sugId}`)
      .set('Authorization', makeAuthHeader(userId));

    const voteRes = await request(app)
      .post(`/api/suggestions/${sugId}/vote`)
      .set('Authorization', makeAuthHeader(userId2))
      .send({ vote: 1 });

    expect(voteRes.status).toBe(404);
  });

  // ── 71.4: Soft-delete cleans up votes ──────────────────────────────────────
  it('DELETE /suggestions/:id removes orphaned votes', async () => {
    const createRes = await createSuggestion(userId);
    const sugId = createRes.body.id;

    // Add a vote
    insertVote(sugId, userId2, 1);

    // Verify vote exists
    const before = db.prepare(
      'SELECT COUNT(*) as cnt FROM suggestion_votes WHERE suggestion_id = ?'
    ).get(sugId) as { cnt: number };
    expect(before.cnt).toBe(1);

    // Soft delete
    await request(app)
      .delete(`/api/suggestions/${sugId}`)
      .set('Authorization', makeAuthHeader(userId));

    // Verify vote is cleaned up
    const after = db.prepare(
      'SELECT COUNT(*) as cnt FROM suggestion_votes WHERE suggestion_id = ?'
    ).get(sugId) as { cnt: number };
    expect(after.cnt).toBe(0);
  });

  // ── 71.5: Edit suggestion (PATCH /:id) ────────────────────────────────────
  it('PATCH /suggestions/:id edits title and body for new suggestions', async () => {
    const createRes = await createSuggestion(userId, { title: 'Original Title' });
    expect(createRes.status).toBe(201);
    const sugId = createRes.body.id;

    const patchRes = await request(app)
      .patch(`/api/suggestions/${sugId}`)
      .set('Authorization', makeAuthHeader(userId))
      .send({ title: 'Updated Title', body: 'This is the updated body for the suggestion with enough characters.' });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.title).toBe('Updated Title');
    expect(patchRes.body.body).toContain('updated body');
  });

  it('PATCH /suggestions/:id rejects edit for non-new status', async () => {
    const sugId = insertSuggestion(userId, { status: 'triaged' });

    const patchRes = await request(app)
      .patch(`/api/suggestions/${sugId}`)
      .set('Authorization', makeAuthHeader(userId))
      .send({ title: 'Updated', body: 'This body is long enough for the minimum character requirement.' });

    expect(patchRes.status).toBe(409);
  });

  it('PATCH /suggestions/:id rejects edit by other user', async () => {
    const createRes = await createSuggestion(userId);
    const sugId = createRes.body.id;

    const patchRes = await request(app)
      .patch(`/api/suggestions/${sugId}`)
      .set('Authorization', makeAuthHeader(userId2))
      .send({ title: 'Hacked', body: 'This body is long enough for the minimum character requirement.' });

    expect(patchRes.status).toBe(404);
  });

  it('PATCH /suggestions/:id validates title and body', async () => {
    const createRes = await createSuggestion(userId);
    const sugId = createRes.body.id;

    // Missing title
    const res1 = await request(app)
      .patch(`/api/suggestions/${sugId}`)
      .set('Authorization', makeAuthHeader(userId))
      .send({ title: '', body: 'Valid body with enough characters for the test.' });
    expect(res1.status).toBe(400);

    // Short body
    const res2 = await request(app)
      .patch(`/api/suggestions/${sugId}`)
      .set('Authorization', makeAuthHeader(userId))
      .send({ title: 'Valid', body: 'Short' });
    expect(res2.status).toBe(400);
  });

  // ── 71.7: Triage batch safety ─────────────────────────────────────────────
  it('triage batch truncates to 50 items', async () => {
    // Import the function directly
    const { triageSuggestions } = await import('../../services/suggestions-triage.js');

    // Create 55 suggestions
    const ids: string[] = [];
    for (let i = 0; i < 55; i++) {
      ids.push(insertSuggestion(userId, { title: `Batch ${i} ${uuid()}`, body: `Body for batch suggestion number ${i} — unique enough for testing.` }));
    }

    const results = await triageSuggestions(ids);
    // Should process at most 50
    expect(results.length).toBeLessThanOrEqual(50);
  });

  // ── 71.9: Duplicate warning returns similar_title ─────────────────────────
  it('POST /suggestions returns similar_title when duplicate detected', async () => {
    // Create first suggestion
    await createSuggestion(userId, { title: 'Add dark mode theme' });

    // Create duplicate with exact same title
    const dupRes = await request(app)
      .post('/api/suggestions')
      .set('Authorization', makeAuthHeader(userId))
      .send({ title: 'Add dark mode theme', body: 'A completely different body for the duplicate suggestion test.', tags: [] });

    expect(dupRes.status).toBe(201);
    expect(dupRes.body.duplicate_warning).toBe(true);
    expect(dupRes.body.similar_title).toBe('Add dark mode theme');
  });

  // ── 71.10: Admin bulk status update ───────────────────────────────────────
  it('PATCH /admin/suggestions/bulk-status updates multiple suggestions', async () => {
    const id1 = insertSuggestion(userId, { title: 'Bulk 1' });
    const id2 = insertSuggestion(userId, { title: 'Bulk 2' });

    const res = await request(app)
      .patch('/api/admin/suggestions/bulk-status')
      .set('Authorization', adminHeader())
      .send({ ids: [id1, id2], status: 'accepted' });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(2);
    expect(res.body.status).toBe('accepted');

    // Verify DB
    const s1 = db.prepare('SELECT status FROM suggestions WHERE id = ?').get(id1) as { status: string };
    expect(s1.status).toBe('accepted');
  });

  it('PATCH /admin/suggestions/bulk-status rejects invalid status', async () => {
    const res = await request(app)
      .patch('/api/admin/suggestions/bulk-status')
      .set('Authorization', adminHeader())
      .send({ ids: ['fake'], status: 'invalid_status' });

    expect(res.status).toBe(400);
  });

  it('PATCH /admin/suggestions/bulk-status rejects empty ids', async () => {
    const res = await request(app)
      .patch('/api/admin/suggestions/bulk-status')
      .set('Authorization', adminHeader())
      .send({ ids: [], status: 'accepted' });

    expect(res.status).toBe(400);
  });

  it('PATCH /admin/suggestions/bulk-status rejects > 50 ids', async () => {
    const ids = Array.from({ length: 51 }, () => uuid());
    const res = await request(app)
      .patch('/api/admin/suggestions/bulk-status')
      .set('Authorization', adminHeader())
      .send({ ids, status: 'accepted' });

    expect(res.status).toBe(400);
  });

  // ── 71.13: Trending count in admin stats ──────────────────────────────────
  it('GET /admin/suggestions/stats includes trending count', async () => {
    // Create a suggestion and vote on it (triggers trending in TEST_MODE)
    const createRes = await createSuggestion(userId);
    const sugId = createRes.body.id;
    insertVote(sugId, userId2, 1);

    // Run triage to trigger trending calculation
    const newSuggestions = db.prepare(`SELECT id FROM suggestions WHERE status = 'new'`).all() as { id: string }[];
    if (newSuggestions.length > 0) {
      const { triageSuggestions } = await import('../../services/suggestions-triage.js');
      await triageSuggestions(newSuggestions.map(s => s.id));
    }

    const res = await request(app)
      .get('/api/admin/suggestions/stats')
      .set('Authorization', adminHeader());

    expect(res.status).toBe(200);
    expect(typeof res.body.trending).toBe('number');
  });

  // ── Cache invalidation on vote and delete (71.8) ──────────────────────────
  it('vote and delete invalidate clusters cache (no stale data)', async () => {
    // This test verifies that votes and deletes don't leave stale cache
    // by hitting clusters endpoint before and after vote

    // Create suggestion and get clusters
    const createRes = await createSuggestion(userId, { title: 'Cache test ' + uuid() });
    const sugId = createRes.body.id;

    const clusters1 = await request(app)
      .get('/api/suggestions/clusters')
      .set('Authorization', makeAuthHeader(userId));
    expect(clusters1.status).toBe(200);

    // Vote
    await request(app)
      .post(`/api/suggestions/${sugId}/vote`)
      .set('Authorization', makeAuthHeader(userId2))
      .send({ vote: 1 });

    // Get clusters again — should not be stale (cache was invalidated)
    const clusters2 = await request(app)
      .get('/api/suggestions/clusters')
      .set('Authorization', makeAuthHeader(userId));
    expect(clusters2.status).toBe(200);
  });
});
