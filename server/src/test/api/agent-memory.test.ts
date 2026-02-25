import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, cleanupTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { db } from '../../db/index.js';
import { v4 as uuid } from 'uuid';

const app = createApp();

describe('Agent Memory Delete Endpoint', () => {
  beforeAll(() => {
    resetDatabase();
  });

  afterEach(() => {
    resetDatabase();
  });

  describe('DELETE /api/agent/memory/:id', () => {
    it('should return 401 without authentication token', async () => {
      const response = await request(app)
        .delete('/api/agent/memory/some-id')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 404 for non-existent memory key', async () => {
      const user = createTestUser();

      const response = await request(app)
        .delete(`/api/agent/memory/${uuid()}`)
        .set('Authorization', makeAuthHeader(user.id))
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/not found/i);

      cleanupTestUser(user.id);
    });

    it('should delete an existing memory entry and return success', async () => {
      const user = createTestUser();
      const memId = uuid();

      // Insert a memory directly into the DB
      db.prepare(`
        INSERT INTO agent_memory (id, user_id, category, key, value, confidence, source)
        VALUES (?, ?, 'test', 'my-key', 'my-value', 0.9, 'manual')
      `).run(memId, user.id);

      // Confirm it exists
      const before = db.prepare('SELECT * FROM agent_memory WHERE id = ?').get(memId);
      expect(before).toBeTruthy();

      const response = await request(app)
        .delete(`/api/agent/memory/${memId}`)
        .set('Authorization', makeAuthHeader(user.id))
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);

      // Confirm it's gone
      const after = db.prepare('SELECT * FROM agent_memory WHERE id = ?').get(memId);
      expect(after).toBeUndefined();

      cleanupTestUser(user.id);
    });

    it('should not allow deleting another user\'s memory', async () => {
      const userA = createTestUser();
      const userB = createTestUser(`user-b-${Date.now()}@example.com`);
      const memId = uuid();

      // Insert memory owned by userA
      db.prepare(`
        INSERT INTO agent_memory (id, user_id, category, key, value, confidence, source)
        VALUES (?, ?, 'test', 'userA-key', 'userA-value', 0.9, 'manual')
      `).run(memId, userA.id);

      // userB attempts to delete userA's memory
      const response = await request(app)
        .delete(`/api/agent/memory/${memId}`)
        .set('Authorization', makeAuthHeader(userB.id))
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body).toHaveProperty('error');

      // Memory should still exist for userA
      const still = db.prepare('SELECT * FROM agent_memory WHERE id = ?').get(memId);
      expect(still).toBeTruthy();

      cleanupTestUser(userA.id);
      cleanupTestUser(userB.id);
    });
  });
});
