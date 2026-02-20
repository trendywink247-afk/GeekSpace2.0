import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { remindersRouter } from '../../routes/reminders.js';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { requireAuth } from '../../middleware/auth.js';
import { createTestUser, cleanupTestUser, generateTestToken, resetDatabase } from '../setup.js';
import { db } from '../../db/index.js';

// Create minimal app for testing with auth middleware
const app = express();
app.use(express.json());

// Mock auth middleware for testing
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

app.use('/api/reminders', remindersRouter);

describe('Reminders Endpoints', () => {
  let testUser: { id: string; email: string; token: string };

  beforeAll(() => {
    resetDatabase();
  });

  afterEach(() => {
    resetDatabase();
  });

  const setupUser = () => {
    const user = createTestUser();
    const token = generateTestToken(user.id);
    testUser = { ...user, token };
    return testUser;
  };

  describe('GET /api/reminders', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/reminders')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should return reminders for authenticated user', async () => {
      const user = setupUser();

      // Create a test reminder
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { v4: uuid } = require('uuid');
      db.prepare(`
        INSERT INTO reminders (id, user_id, text, datetime, channel, category, completed, created_by)
        VALUES (?, ?, ?, datetime('now'), 'push', 'test', 0, 'test')
      `).run(uuid(), user.id, 'Test reminder');

      const response = await request(app)
        .get('/api/reminders')
        .set('Authorization', `Bearer ${user.token}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('reminders');
      expect(Array.isArray(response.body.reminders)).toBe(true);
      expect(response.body.reminders.length).toBeGreaterThan(0);

      cleanupTestUser(user.id);
    });
  });

  describe('POST /api/reminders', () => {
    it('should create a new reminder', async () => {
      const user = setupUser();

      const response = await request(app)
        .post('/api/reminders')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          text: 'Take out the trash',
          datetime: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
          channel: 'push',
          category: 'chores',
        })
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('text', 'Take out the trash');

      cleanupTestUser(user.id);
    });

    it('should reject reminder without text', async () => {
      const user = setupUser();

      const response = await request(app)
        .post('/api/reminders')
        .set('Authorization', `Bearer ${user.token}`)
        .send({
          datetime: new Date().toISOString(),
        })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');

      cleanupTestUser(user.id);
    });
  });

  describe('DELETE /api/reminders/:id', () => {
    it('should delete a reminder', async () => {
      const user = setupUser();

      // Create a test reminder
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { v4: uuid } = require('uuid');
      const reminderId = uuid();
      db.prepare(`
        INSERT INTO reminders (id, user_id, text, datetime, channel, category, completed, created_by)
        VALUES (?, ?, ?, datetime('now'), 'push', 'test', 0, 'test')
      `).run(reminderId, user.id, 'Reminder to delete');

      const response = await request(app)
        .delete(`/api/reminders/${reminderId}`)
        .set('Authorization', `Bearer ${user.token}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);

      // Verify it's deleted
      const reminder = db.prepare('SELECT * FROM reminders WHERE id = ?').get(reminderId);
      expect(reminder).toBeUndefined();

      cleanupTestUser(user.id);
    });
  });
});
