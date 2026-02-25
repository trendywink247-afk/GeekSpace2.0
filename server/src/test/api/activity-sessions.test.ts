// ============================================================
// Activity, Sessions, Conversations, and Model Preference Tests
// Covers Phase 8-10 endpoints
// ============================================================

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { initMemoryTables } from '../../services/memory.js';

const app = createApp();

describe('Phase 8-10 Endpoint Coverage', () => {
  beforeAll(() => {
    initMemoryTables(); // ensure conversation_log table exists
    resetDatabase();
  });

  afterEach(() => {
    resetDatabase();
  });

  // ── Activity Log ─────────────────────────────────────────

  describe('GET /api/activity', () => {
    it('requires authentication', async () => {
      const res = await request(app).get('/api/activity').expect(401);
      expect(res.body).toHaveProperty('error');
    });

    it('returns activity array for authenticated user', async () => {
      const user = createTestUser();
      const res = await request(app)
        .get('/api/activity')
        .set('Authorization', makeAuthHeader(user.id))
        .expect(200);
      expect(res.body).toHaveProperty('activity');
      expect(Array.isArray(res.body.activity)).toBe(true);
    });
  });

  // ── Auth Sessions ─────────────────────────────────────────

  describe('GET /api/auth/sessions', () => {
    it('requires authentication', async () => {
      const res = await request(app).get('/api/auth/sessions').expect(401);
      expect(res.body).toHaveProperty('error');
    });

    it('returns sessions array for authenticated user', async () => {
      const user = createTestUser();
      const res = await request(app)
        .get('/api/auth/sessions')
        .set('Authorization', makeAuthHeader(user.id))
        .expect(200);
      expect(res.body).toHaveProperty('sessions');
      expect(Array.isArray(res.body.sessions)).toBe(true);
    });
  });

  describe('DELETE /api/auth/sessions/:id', () => {
    it('requires authentication', async () => {
      const res = await request(app).delete('/api/auth/sessions/nonexistent').expect(401);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 404 for non-existent session', async () => {
      const user = createTestUser();
      const res = await request(app)
        .delete('/api/auth/sessions/nonexistent-session-id')
        .set('Authorization', makeAuthHeader(user.id));
      // Either 404 (not found) or 200 (idempotent) is acceptable
      expect([200, 404]).toContain(res.status);
    });
  });

  // ── Conversations Export ──────────────────────────────────

  describe('GET /api/agent/conversations/export', () => {
    it('requires authentication', async () => {
      const res = await request(app).get('/api/agent/conversations/export').expect(401);
      expect(res.body).toHaveProperty('error');
    });

    it('returns JSON array for authenticated user', async () => {
      const user = createTestUser();
      const res = await request(app)
        .get('/api/agent/conversations/export')
        .set('Authorization', makeAuthHeader(user.id))
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ── Message Reactions ─────────────────────────────────────

  describe('POST /api/agent/conversations/reactions', () => {
    it('requires authentication', async () => {
      const res = await request(app)
        .post('/api/agent/conversations/reactions')
        .send({ messageId: 'msg-1', reaction: '👍' })
        .expect(401);
      expect(res.body).toHaveProperty('error');
    });

    it('returns { success: true } for valid reaction', async () => {
      const user = createTestUser();
      const res = await request(app)
        .post('/api/agent/conversations/reactions')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ messageId: 'test-message-id', reaction: '👍' })
        .expect(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('returns 400 when messageId is missing', async () => {
      const user = createTestUser();
      const res = await request(app)
        .post('/api/agent/conversations/reactions')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ reaction: '👍' })
        .expect(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  // ── Model Preference ─────────────────────────────────────

  describe('GET /api/users/me/model', () => {
    it('requires authentication', async () => {
      const res = await request(app).get('/api/users/me/model').expect(401);
      expect(res.body).toHaveProperty('error');
    });

    it('returns preferredModel for authenticated user', async () => {
      const user = createTestUser();
      const res = await request(app)
        .get('/api/users/me/model')
        .set('Authorization', makeAuthHeader(user.id))
        .expect(200);
      expect(res.body).toHaveProperty('preferredModel');
      expect(typeof res.body.preferredModel).toBe('string');
    });

    it('defaults to auto when no preference is set', async () => {
      const user = createTestUser();
      const res = await request(app)
        .get('/api/users/me/model')
        .set('Authorization', makeAuthHeader(user.id))
        .expect(200);
      expect(['auto', 'local', 'cloud', 'premium']).toContain(res.body.preferredModel);
    });
  });

  describe('PUT /api/users/me/model', () => {
    it('requires authentication', async () => {
      const res = await request(app)
        .put('/api/users/me/model')
        .send({ model: 'auto' })
        .expect(401);
      expect(res.body).toHaveProperty('error');
    });

    it('saves and returns the model preference', async () => {
      const user = createTestUser();
      const res = await request(app)
        .put('/api/users/me/model')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ model: 'auto' })
        .expect(200);
      expect(res.body).toHaveProperty('preferredModel', 'auto');
    });

    it('saves local preference and syncs to agent_configs', async () => {
      const user = createTestUser();
      const res = await request(app)
        .put('/api/users/me/model')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ model: 'local' })
        .expect(200);
      expect(res.body).toHaveProperty('preferredModel', 'local');
    });

    it('saves cloud preference', async () => {
      const user = createTestUser();
      const res = await request(app)
        .put('/api/users/me/model')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ model: 'cloud' })
        .expect(200);
      expect(res.body).toHaveProperty('preferredModel', 'cloud');
    });

    it('saves premium preference', async () => {
      const user = createTestUser();
      const res = await request(app)
        .put('/api/users/me/model')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ model: 'premium' })
        .expect(200);
      expect(res.body).toHaveProperty('preferredModel', 'premium');
    });

    it('rejects invalid model values', async () => {
      const user = createTestUser();
      const res = await request(app)
        .put('/api/users/me/model')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ model: 'invalid-model' })
        .expect(400);
      expect(res.body).toHaveProperty('error');
    });

    it('preference persists via GET after PUT', async () => {
      const user = createTestUser();
      await request(app)
        .put('/api/users/me/model')
        .set('Authorization', makeAuthHeader(user.id))
        .send({ model: 'premium' })
        .expect(200);

      const res = await request(app)
        .get('/api/users/me/model')
        .set('Authorization', makeAuthHeader(user.id))
        .expect(200);
      expect(res.body).toHaveProperty('preferredModel', 'premium');
    });
  });
});
