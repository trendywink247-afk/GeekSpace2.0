// ============================================================
// Phase 27.4 — Unit tests for agent quality metrics + version API
// ============================================================

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, cleanupTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { db } from '../../db/index.js';
import { APP_VERSION } from '../../app.js';

const app = createApp();

// ---- GET /api/agent/quality ----

describe('Agent Quality Metrics — Phase 27.4', () => {
  beforeAll(() => {
    resetDatabase();
  });

  afterEach(() => {
    resetDatabase();
  });

  describe('GET /api/agent/quality — auth', () => {
    it('should require authentication (401)', async () => {
      const response = await request(app)
        .get('/api/agent/quality')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/agent/quality — shape', () => {
    it('should return quality fields for authenticated user', async () => {
      const user = createTestUser();

      const response = await request(app)
        .get('/api/agent/quality')
        .set('Authorization', makeAuthHeader(user.id))
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('totalMessages');
      expect(response.body).toHaveProperty('satisfactionRate');
      expect(response.body).toHaveProperty('hasEnoughData');
      expect(response.body).toHaveProperty('trend');

      cleanupTestUser(user.id);
    });

    it('should return hasEnoughData: false for new user with no reactions', async () => {
      const user = createTestUser();

      const response = await request(app)
        .get('/api/agent/quality')
        .set('Authorization', makeAuthHeader(user.id))
        .expect(200);

      expect(response.body.hasEnoughData).toBe(false);
      expect(response.body.satisfactionRate).toBeNull();

      cleanupTestUser(user.id);
    });

    it('should return correct totalMessages count', async () => {
      const user = createTestUser();

      // Insert some conversation log entries
      db.prepare(
        "INSERT INTO conversation_log (id, user_id, role, content, provider, created_at) VALUES (?, ?, 'user', 'hello', 'test', datetime('now'))"
      ).run('msg-q-1', user.id);
      db.prepare(
        "INSERT INTO conversation_log (id, user_id, role, content, provider, created_at) VALUES (?, ?, 'assistant', 'hi', 'test', datetime('now'))"
      ).run('msg-q-2', user.id);

      const response = await request(app)
        .get('/api/agent/quality')
        .set('Authorization', makeAuthHeader(user.id))
        .expect(200);

      expect(response.body.totalMessages).toBe(2);

      cleanupTestUser(user.id);
    });

    it('should return satisfactionRate when reactions exist', async () => {
      const user = createTestUser();

      // Insert a message to react to
      db.prepare(
        "INSERT INTO conversation_log (id, user_id, role, content, provider, created_at) VALUES (?, ?, 'assistant', 'test reply', 'test', datetime('now'))"
      ).run('msg-q-react-1', user.id);

      // Insert 4 positive + 1 negative reaction (5 total, satisfactionRate = 80)
      const reactions = [
        ['rq1', user.id, 'msg-q-react-1', '👍'],
        ['rq2', user.id, 'msg-q-react-1', '👍'],
        ['rq3', user.id, 'msg-q-react-1', '❤️'],
        ['rq4', user.id, 'msg-q-react-1', '🔥'],
        ['rq5', user.id, 'msg-q-react-1', '👎'],
      ];
      for (const [id, uid, mid, reaction] of reactions) {
        db.prepare(
          "INSERT OR IGNORE INTO message_reactions (id, user_id, message_id, reaction, created_at) VALUES (?, ?, ?, ?, datetime('now'))"
        ).run(id, uid, mid, reaction);
      }

      const response = await request(app)
        .get('/api/agent/quality')
        .set('Authorization', makeAuthHeader(user.id))
        .expect(200);

      expect(response.body.satisfactionRate).toBe(80);
      expect(response.body.hasEnoughData).toBe(true);
      expect(['up', 'down', 'neutral']).toContain(response.body.trend);

      cleanupTestUser(user.id);
    });
  });
});

// ---- GET /api/version ----

describe('Version Endpoint — Phase 27.4', () => {
  describe('GET /api/version', () => {
    it('should return version, buildTime, and nodeVersion', async () => {
      const response = await request(app)
        .get('/api/version')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('buildTime');
      expect(response.body).toHaveProperty('nodeVersion');
    });

    it('should match APP_VERSION constant from app.ts', async () => {
      const response = await request(app)
        .get('/api/version')
        .expect(200);

      expect(response.body.version).toBe(APP_VERSION);
    });

    it('should return valid nodeVersion string', async () => {
      const response = await request(app)
        .get('/api/version')
        .expect(200);

      expect(typeof response.body.nodeVersion).toBe('string');
      expect(response.body.nodeVersion.length).toBeGreaterThan(0);
    });
  });
});
