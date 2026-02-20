import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { agentRouter } from '../../routes/agent.js';
import { createTestUser, cleanupTestUser, generateTestToken, resetDatabase, createTestAgent } from '../setup.js';
import { db } from '../../db/index.js';

// Create minimal app for testing
const app = express();
app.use(express.json());

// Mock auth middleware
app.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const jwt = require('jsonwebtoken');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { config } = require('../../config.js');
      const decoded = jwt.verify(token, config.jwtSecret) as { userId: string };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (req as any).userId = decoded.userId;
      return next();
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
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
    const token = generateTestToken(user.id);
    createTestAgent(user.id, agentActive);
    return { ...user, token };
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
