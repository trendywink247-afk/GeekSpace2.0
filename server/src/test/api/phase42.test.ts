// ============================================================
// Phase 42 — Unit tests for:
//   42.4 GET /portfolio/me/stats — returns view_count, contact_count, project_count
// ============================================================

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { db } from '../../db/index.js';
import { v4 as uuid } from 'uuid';

const app = createApp();

// ── 42.4: GET /portfolio/me/stats ──────────────────────────────────────────

describe('Portfolio Me Stats — GET /api/portfolio/me/stats (Phase 42.4)', () => {
  beforeAll(() => { resetDatabase(); });
  afterEach(() => { resetDatabase(); });

  it('returns view_count, contact_count, project_count for portfolio owner', async () => {
    const user = createTestUser();
    // Insert portfolio with 2 projects and a non-zero view_count
    const projects = JSON.stringify([
      { id: 'p1', title: 'Project Alpha', description: 'Alpha', tech: [], url: '', image: '' },
      { id: 'p2', title: 'Project Beta', description: 'Beta', tech: [], url: '', image: '' },
    ]);
    db.prepare(
      'INSERT INTO portfolios (user_id, username, projects, view_count) VALUES (?, ?, ?, ?)'
    ).run(user.id, user.username, projects, 42);

    // Insert 3 contact messages
    for (let i = 0; i < 3; i++) {
      db.prepare(
        'INSERT INTO portfolio_contacts (id, username, user_id, sender_name, message) VALUES (?, ?, ?, ?, ?)'
      ).run(uuid(), user.username, user.id, `Sender ${i}`, `Message ${i}`);
    }

    const res = await request(app)
      .get('/api/portfolio/me/stats')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(res.body.view_count).toBe(42);
    expect(res.body.contact_count).toBe(3);
    expect(res.body.project_count).toBe(2);
    expect('last_viewed_at' in res.body).toBe(true);
  });

  it('returns 0 counts when portfolio has no contacts or projects', async () => {
    const user = createTestUser();
    db.prepare(
      'INSERT INTO portfolios (user_id, username, projects, view_count) VALUES (?, ?, ?, ?)'
    ).run(user.id, user.username, '[]', 0);

    const res = await request(app)
      .get('/api/portfolio/me/stats')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(res.body.view_count).toBe(0);
    expect(res.body.contact_count).toBe(0);
    expect(res.body.project_count).toBe(0);
  });

  it('returns 401 when not authenticated', async () => {
    await request(app)
      .get('/api/portfolio/me/stats')
      .expect(401);
  });

  it('returns 404 when portfolio does not exist for authenticated user', async () => {
    const user = createTestUser();
    // No portfolio inserted — should return 404
    await request(app)
      .get('/api/portfolio/me/stats')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(404);
  });
});
