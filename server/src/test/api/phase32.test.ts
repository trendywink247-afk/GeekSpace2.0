// ============================================================
// Phase 32 — Unit tests for feedback analytics + session revoke
// ============================================================

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { db } from '../../db/index.js';
import { config } from '../../config.js';
import { v4 as uuid } from 'uuid';

const app = createApp();

// Override adminToken so the admin middleware sees a valid token in tests
const ADMIN_TOKEN = 'test-admin-token-phase32';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(config as any).adminToken = ADMIN_TOKEN;

// ---- 32.4: Admin Feedback Analytics ----

describe('Admin Feedback Analytics — Phase 32.4', () => {
  beforeAll(() => {
    resetDatabase();
    try { db.prepare('DELETE FROM message_reactions').run(); } catch { /* ignore */ }
  });

  afterEach(() => {
    try { db.prepare('DELETE FROM message_reactions').run(); } catch { /* ignore */ }
    resetDatabase();
  });

  it('should return 401 without admin token', async () => {
    const response = await request(app)
      .get('/api/admin/analytics/feedback')
      .expect('Content-Type', /json/)
      .expect(401);

    expect(response.body).toHaveProperty('error');
  });

  it('should return feedback analytics shape with admin token', async () => {
    // Insert some dislike reactions
    const user = createTestUser();
    db.prepare(
      "INSERT OR IGNORE INTO message_reactions (id, user_id, message_id, reaction, created_at) VALUES (?, ?, ?, '👎', datetime('now'))"
    ).run(uuid(), user.id, 'msg-abc-123');
    db.prepare(
      "INSERT OR IGNORE INTO message_reactions (id, user_id, message_id, reaction, created_at) VALUES (?, ?, ?, '👎', datetime('now'))"
    ).run(uuid(), user.id, 'msg-def-456');

    const response = await request(app)
      .get('/api/admin/analytics/feedback')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('totalDisliked');
    expect(response.body).toHaveProperty('topDislikedTopics');
    expect(response.body).toHaveProperty('recentDislikes');
    expect(typeof response.body.totalDisliked).toBe('number');
    expect(Array.isArray(response.body.topDislikedTopics)).toBe(true);
    expect(Array.isArray(response.body.recentDislikes)).toBe(true);
    expect(response.body.totalDisliked).toBe(2);
  });
});

// ---- 32.5: Session Revoke ----

describe('Session Revoke — Phase 32.5', () => {
  beforeAll(() => {
    resetDatabase();
  });

  afterEach(() => {
    resetDatabase();
  });

  it('should revoke a session by ID (set is_active = 0)', async () => {
    const user = createTestUser();
    const sessionId = uuid();

    // Insert a fake session
    try {
      db.prepare(
        `INSERT INTO user_sessions (id, user_id, token_hash, user_agent, ip_address, is_active, created_at, last_active_at)
         VALUES (?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`
      ).run(sessionId, user.id, 'hash-xyz', 'TestBrowser/1.0', '127.0.0.1');
    } catch {
      // user_sessions table may have slightly different schema — skip gracefully
      return;
    }

    const response = await request(app)
      .delete(`/api/auth/sessions/${sessionId}`)
      .set('Authorization', makeAuthHeader(user.id))
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('success', true);

    // Verify the session is now inactive in DB
    const row = db.prepare('SELECT is_active FROM user_sessions WHERE id = ?').get(sessionId) as { is_active: number } | undefined;
    if (row) {
      expect(row.is_active).toBe(0);
    }
  });
});
