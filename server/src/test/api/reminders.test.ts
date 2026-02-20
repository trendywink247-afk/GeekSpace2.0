import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { remindersRouter } from '../../routes/reminders.js';
import { createTestUser, cleanupTestUser, resetDatabase } from '../setup.js';
import { db } from '../../db/index.js';

// Create minimal app for testing - mount router directly
// Note: The reminders router has requireAuth middleware that will reject requests
// without proper auth. For unit tests, we verify the middleware works correctly.
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

app.use('/api/reminders', remindersRouter);

describe('Reminders Endpoints', () => {
  beforeAll(() => {
    resetDatabase();
  });

  afterEach(() => {
    resetDatabase();
  });

  describe('GET /api/reminders', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/reminders')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should return reminders for authenticated user', async () => {
      const user = createTestUser();

      // Create a test reminder
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { v4: uuid } = require('uuid');
      db.prepare(`
        INSERT INTO reminders (id, user_id, text, datetime, channel, category, completed, created_by)
        VALUES (?, ?, ?, datetime('now'), 'push', 'test', 0, 'test')
      `).run(uuid(), user.id, 'Test reminder');

      const response = await request(app)
        .get('/api/reminders')
        .set('Authorization', `Bearer test-${user.id}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);

      cleanupTestUser(user.id);
    });
  });

  describe('POST /api/reminders', () => {
    it('should create a new reminder', async () => {
      const user = createTestUser();

      const response = await request(app)
        .post('/api/reminders')
        .set('Authorization', `Bearer test-${user.id}`)
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
      const user = createTestUser();

      const response = await request(app)
        .post('/api/reminders')
        .set('Authorization', `Bearer test-${user.id}`)
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
      const user = createTestUser();

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
        .set('Authorization', `Bearer test-${user.id}`)
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
