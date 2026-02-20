import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { agentRouter } from '../../routes/agent.js';
import { createTestUser, cleanupTestUser, resetDatabase, createTestAgent } from '../setup.js';
import { db } from '../../db/index.js';

// Create minimal app for testing
const app = express();
app.use(express.json());

// Simple mock auth that sets userId directly
app.use((req, res, next) => {
  // Check if this is a test request with Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer test-')) {
    // Extract userId from token format: test-{userId}
    const userId = authHeader.slice(12); // Remove 'Bearer test-'
    // Use type assertion to add userId to request
    Object.defineProperty(req, 'userId', { value: userId, writable: true });
  }
  next();
});

app.use('/api/agent', agentRouter);

describe('Agent Status Endpoints', () => {
  beforeAll(() => {
    resetDatabase();
  });

  afterEach(() => {
    resetDatabase();
  });

  const setupUserWithAgent = (agentActive = true) => {
    const user = createTestUser();
    createTestAgent(user.id, agentActive);
    return { ...user, token: `test-${user.id}` };
  };

  describe('GET /api/agent/status', () => {
    it('should return agent status for active agent', async () => {
      const user = setupUserWithAgent(true);

      const response = await request(app)
        .get('/api/agent/status')
        .set('Authorization', `Bearer ${user.token}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('agent');

      cleanupTestUser(user.id);
    });

    it('should return inactive status when agent is disabled', async () => {
      const user = setupUserWithAgent(false);

      const response = await request(app)
        .get('/api/agent/status')
        .set('Authorization', `Bearer ${user.token}`)
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
        .set('Authorization', `Bearer ${user.token}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);

      // Verify in database
      const agent = db.prepare('SELECT is_active FROM agent_configs WHERE user_id = ?').get(user.id) as { is_active: number } | undefined;
      expect(agent?.is_active).toBe(1);

      cleanupTestUser(user.id);
    });
  });

  describe('POST /api/agent/deactivate', () => {
    it('should deactivate agent', async () => {
      const user = setupUserWithAgent(true);

      const response = await request(app)
        .post('/api/agent/deactivate')
        .set('Authorization', `Bearer ${user.token}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);

      // Verify in database
      const agent = db.prepare('SELECT is_active FROM agent_configs WHERE user_id = ?').get(user.id) as { is_active: number } | undefined;
      expect(agent?.is_active).toBe(0);

      cleanupTestUser(user.id);
    });
  });
});
