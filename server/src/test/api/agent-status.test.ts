import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, cleanupTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { db } from '../../db/index.js';

// Create the real app (same as production)
const app = createApp();

describe('Agent Status Endpoints', () => {
  beforeAll(() => {
    resetDatabase();
  });

  afterEach(() => {
    resetDatabase();
  });

  const setupUserWithAgent = (agentActive = true) => {
    const user = createTestUser();
    // Set agent status based on active parameter
    // createTestUser already creates an agent config with status 'online'
    if (!agentActive) {
      db.prepare('UPDATE agent_configs SET status = ? WHERE user_id = ?').run('offline', user.id);
    }
    return { ...user, token: makeAuthHeader(user.id) };
  };

  describe('GET /api/agent/status', () => {
    it('should return agent status for active agent', async () => {
      const user = setupUserWithAgent(true);

      const response = await request(app)
        .get('/api/agent/status')
        .set('Authorization', user.token)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('agent');
      expect(response.body.status).toBe('active');

      cleanupTestUser(user.id);
    });

    it('should return inactive status when agent is disabled', async () => {
      const user = setupUserWithAgent(false);

      const response = await request(app)
        .get('/api/agent/status')
        .set('Authorization', user.token)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.status).toBe('inactive');

      cleanupTestUser(user.id);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/agent/status')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/agent/activate', () => {
    it('should activate agent', async () => {
      const user = setupUserWithAgent(false);

      const response = await request(app)
        .post('/api/agent/activate')
        .set('Authorization', user.token)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);

      // Verify in database
      const agent = db.prepare('SELECT status FROM agent_configs WHERE user_id = ?').get(user.id) as { status: string } | undefined;
      expect(agent?.status).toBe('online');

      cleanupTestUser(user.id);
    });
  });

  describe('POST /api/agent/deactivate', () => {
    it('should deactivate agent', async () => {
      const user = setupUserWithAgent(true);

      const response = await request(app)
        .post('/api/agent/deactivate')
        .set('Authorization', user.token)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);

      // Verify in database
      const agent = db.prepare('SELECT status FROM agent_configs WHERE user_id = ?').get(user.id) as { status: string } | undefined;
      expect(agent?.status).toBe('offline');

      cleanupTestUser(user.id);
    });
  });
});
