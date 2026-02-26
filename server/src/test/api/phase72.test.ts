/**
 * Phase 72 Tests
 * Suggestion status notifications, events endpoint, trending threshold,
 * cluster merge logging, vote error recovery.
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { db } from '../../db/index.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { v4 as uuid } from 'uuid';
import { config } from '../../config.js';

// Patch config for test isolation
const ADMIN_TOKEN = 'test-admin-token-phase72';
config.adminToken = ADMIN_TOKEN;
(config as Record<string, unknown>).isTestMode = true;

const app = createApp();

function adminHeader() {
  return `Bearer ${ADMIN_TOKEN}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function insertSuggestion(userId: string, overrides: { title?: string; body?: string; status?: string } = {}): string {
  const id = uuid();
  db.prepare(`
    INSERT INTO suggestions (id, user_id, title, body, tags, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, '[]', ?, datetime('now'), datetime('now'))
  `).run(
    id,
    userId,
    overrides.title ?? `Phase72 Suggestion ${id.slice(0, 8)}`,
    overrides.body ?? 'A detailed description of the suggestion for testing in phase 72.',
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

describe('Phase 72', () => {
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

  // ── 72.2: Admin status change creates activity_log notification ──────────

  it('72.2 — admin status change creates activity_log for suggestion owner', async () => {
    const sugId = insertSuggestion(userId, { title: 'Notify Me Please' });
    await request(app)
      .patch(`/api/admin/suggestions/${sugId}/status`)
      .set('Authorization', adminHeader())
      .send({ status: 'accepted' })
      .expect(200);

    const entry = db.prepare(
      `SELECT * FROM activity_log WHERE user_id = ? AND action = 'suggestion_status_changed' ORDER BY created_at DESC LIMIT 1`
    ).get(userId) as { details: string; icon: string } | undefined;

    expect(entry).toBeTruthy();
    expect(entry!.details).toContain('accepted');
    expect(entry!.details).toContain('Notify Me Please');
    expect(entry!.icon).toBe('lightbulb');
  });

  it('72.2b — bulk status change creates activity_log entries for each owner', async () => {
    const sugId1 = insertSuggestion(userId, { title: 'Bulk Notify 1' });
    const sugId2 = insertSuggestion(userId2, { title: 'Bulk Notify 2' });

    await request(app)
      .patch('/api/admin/suggestions/bulk-status')
      .set('Authorization', adminHeader())
      .send({ ids: [sugId1, sugId2], status: 'triaged' })
      .expect(200);

    const entry1 = db.prepare(
      `SELECT details FROM activity_log WHERE user_id = ? AND action = 'suggestion_status_changed' AND details LIKE '%Bulk Notify 1%'`
    ).get(userId) as { details: string } | undefined;
    const entry2 = db.prepare(
      `SELECT details FROM activity_log WHERE user_id = ? AND action = 'suggestion_status_changed' AND details LIKE '%Bulk Notify 2%'`
    ).get(userId2) as { details: string } | undefined;

    expect(entry1).toBeTruthy();
    expect(entry2).toBeTruthy();
    expect(entry1!.details).toContain('triaged');
  });

  // ── 72.3: Events endpoint returns status history ─────────────────────────

  it('72.3 — GET /suggestions/:id/events returns status timeline', async () => {
    const sugId = insertSuggestion(userId, { title: 'Timeline Test' });

    // Admin changes status twice
    await request(app)
      .patch(`/api/admin/suggestions/${sugId}/status`)
      .set('Authorization', adminHeader())
      .send({ status: 'triaged' })
      .expect(200);
    await request(app)
      .patch(`/api/admin/suggestions/${sugId}/status`)
      .set('Authorization', adminHeader())
      .send({ status: 'accepted' })
      .expect(200);

    const res = await request(app)
      .get(`/api/suggestions/${sugId}/events`)
      .set('Authorization', makeAuthHeader(userId))
      .expect(200);

    expect(res.body.events).toHaveLength(2);
    // Events ordered by created_at ASC — both may share same second, so check by content
    const statuses = res.body.events.map((e: { oldStatus: string; newStatus: string }) => `${e.oldStatus}->${e.newStatus}`);
    expect(statuses).toContain('new->triaged');
    expect(statuses).toContain('triaged->accepted');
  });

  it('72.3b — events endpoint returns 404 for other users', async () => {
    const sugId = insertSuggestion(userId, { title: 'Private Events' });
    await request(app)
      .get(`/api/suggestions/${sugId}/events`)
      .set('Authorization', makeAuthHeader(userId2))
      .expect(404);
  });

  // ── 72.8: Trending with threshold constant ───────────────────────────────

  it('72.8 — trending marks suggestions with upvotes (TEST_MODE)', async () => {
    const sugId = insertSuggestion(userId, { title: 'Trending Threshold Test' });
    insertVote(sugId, userId2, 1);

    // Trigger triage which runs trending update
    await request(app)
      .post('/api/admin/suggestions/triage')
      .set('Authorization', adminHeader())
      .expect(200);

    const row = db.prepare(
      `SELECT trending FROM suggestions WHERE id = ?`
    ).get(sugId) as { trending: number } | undefined;

    // In TEST_MODE, 1+ upvote = trending
    expect(row?.trending).toBe(1);
  });

  // ── 72.9: Cluster data integrity ─────────────────────────────────────────

  it('72.9 — triage creates cluster and scores for new suggestion', async () => {
    const sugId = insertSuggestion(userId, { title: 'Unique Cluster Feature 72' });

    await request(app)
      .post('/api/admin/suggestions/triage')
      .set('Authorization', adminHeader())
      .expect(200);

    // Verify cluster was created
    const cluster = db.prepare(
      `SELECT id, suggestion_ids FROM suggestion_clusters WHERE canonical_summary = 'Unique Cluster Feature 72'`
    ).get() as { id: string; suggestion_ids: string } | undefined;

    expect(cluster).toBeTruthy();
    const ids = JSON.parse(cluster!.suggestion_ids) as string[];
    expect(ids).toContain(sugId);

    // Verify score exists
    const score = db.prepare(
      `SELECT overall_score FROM suggestion_scores WHERE cluster_id = ?`
    ).get(cluster!.id) as { overall_score: number } | undefined;
    expect(score).toBeTruthy();
    expect(score!.overall_score).toBeGreaterThan(0);
  });

  // ── API contract: suggestion service endpoints ───────────────────────────

  it('72.x — GET /suggestions/mine returns paginated results with vote counts', async () => {
    insertSuggestion(userId, { title: 'Pagination Test A' });
    insertSuggestion(userId, { title: 'Pagination Test B' });

    const res = await request(app)
      .get('/api/suggestions/mine?page=1&limit=10')
      .set('Authorization', makeAuthHeader(userId))
      .expect(200);

    expect(res.body.suggestions.length).toBeGreaterThanOrEqual(2);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('limit');
    // Each suggestion should have upvotes/downvotes fields
    expect(res.body.suggestions[0]).toHaveProperty('upvotes');
    expect(res.body.suggestions[0]).toHaveProperty('downvotes');
  });
});
