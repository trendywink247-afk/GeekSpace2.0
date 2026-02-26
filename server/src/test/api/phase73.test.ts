/**
 * Phase 73 Tests
 * Vote counts in GET /:id, HTML sanitization, create response with votes,
 * DB index existence, compound index on suggestions.
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { db } from '../../db/index.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { v4 as uuid } from 'uuid';
import { config } from '../../config.js';

// Patch config for test isolation
const ADMIN_TOKEN = 'test-admin-token-phase73';
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
    overrides.title ?? `Phase73 Suggestion ${id.slice(0, 8)}`,
    overrides.body ?? 'A detailed description of the suggestion for testing in phase 73.',
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

describe('Phase 73', () => {
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

  // ── 73.5: GET /suggestions/:id returns vote counts ────────────────────────

  it('73.5 — GET /suggestions/:id returns upvotes and downvotes', async () => {
    const sugId = insertSuggestion(userId, { title: 'Vote Count Detail' });
    insertVote(sugId, userId2, 1);

    const res = await request(app)
      .get(`/api/suggestions/${sugId}`)
      .set('Authorization', makeAuthHeader(userId))
      .expect(200);

    expect(res.body).toHaveProperty('upvotes');
    expect(res.body).toHaveProperty('downvotes');
    expect(res.body.upvotes).toBe(1);
    expect(res.body.downvotes).toBe(0);
  });

  it('73.5b — GET /suggestions/:id returns 0 votes when none exist', async () => {
    const sugId = insertSuggestion(userId, { title: 'No Votes Detail' });

    const res = await request(app)
      .get(`/api/suggestions/${sugId}`)
      .set('Authorization', makeAuthHeader(userId))
      .expect(200);

    expect(res.body.upvotes).toBe(0);
    expect(res.body.downvotes).toBe(0);
  });

  // ── 73.8: HTML sanitization on create ─────────────────────────────────────

  it('73.8 — POST /suggestions escapes HTML in title and body', async () => {
    const res = await request(app)
      .post('/api/suggestions')
      .set('Authorization', makeAuthHeader(userId))
      .send({
        title: '<script>alert("xss")</script>',
        body: 'This body has <img onerror="hack()"> embedded HTML that should be escaped properly',
        tags: [],
      })
      .expect(201);

    expect(res.body.title).not.toContain('<script>');
    expect(res.body.title).toContain('&lt;script&gt;');

    // Verify stored in DB escaped
    const row = db.prepare(`SELECT title, body FROM suggestions WHERE id = ?`).get(res.body.id) as { title: string; body: string };
    expect(row.title).toContain('&lt;script&gt;');
    expect(row.body).toContain('&lt;img');
    expect(row.body).not.toContain('<img');
  });

  // ── 73.10: POST /suggestions returns upvotes/downvotes ────────────────────

  it('73.10 — POST /suggestions response includes upvotes: 0, downvotes: 0', async () => {
    const res = await request(app)
      .post('/api/suggestions')
      .set('Authorization', makeAuthHeader(userId))
      .send({
        title: 'New Suggestion With Votes',
        body: 'A brand new suggestion that should have zero votes initially in response',
        tags: ['test'],
      })
      .expect(201);

    expect(res.body.upvotes).toBe(0);
    expect(res.body.downvotes).toBe(0);
  });

  // ── 73.6: activity_log(action) index exists ───────────────────────────────

  it('73.6 — idx_activity_log_action index exists', () => {
    const indexes = db.prepare(
      `SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'activity_log' AND name = 'idx_activity_log_action'`
    ).all() as Array<{ name: string }>;

    expect(indexes.length).toBe(1);
  });

  // ── 73.9: suggestions(user_id, deleted_at) compound index exists ──────────

  it('73.9 — idx_suggestions_user_deleted compound index exists', () => {
    const indexes = db.prepare(
      `SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'suggestions' AND name = 'idx_suggestions_user_deleted'`
    ).all() as Array<{ name: string }>;

    expect(indexes.length).toBe(1);
  });

  // ── 73.8b: PATCH also escapes HTML ────────────────────────────────────────

  it('73.8b — PATCH /suggestions/:id escapes HTML in title and body', async () => {
    const sugId = insertSuggestion(userId, { title: 'Editable', body: 'Original body text that is long enough for validation rules' });

    const res = await request(app)
      .patch(`/api/suggestions/${sugId}`)
      .set('Authorization', makeAuthHeader(userId))
      .send({
        title: 'Updated <b>bold</b> title',
        body: 'Updated body with <a href="javascript:void">link</a> that must be escaped properly',
      })
      .expect(200);

    expect(res.body.title).toContain('&lt;b&gt;');
    expect(res.body.title).not.toContain('<b>');
    expect(res.body.body).toContain('&lt;a');
    expect(res.body.body).not.toContain('<a');
  });
});
