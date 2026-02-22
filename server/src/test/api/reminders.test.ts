import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, cleanupTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { db } from '../../db/index.js';
import { v4 as uuid } from 'uuid';

// Create the real app (same as production)
const app = createApp();

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
      db.prepare(`
        INSERT INTO reminders (id, user_id, text, datetime, channel, category, completed, created_by)
        VALUES (?, ?, ?, datetime('now'), 'push', 'test', 0, 'test')
      `).run(uuid(), user.id, 'Test reminder');

      const response = await request(app)
        .get('/api/reminders')
        .set('Authorization', makeAuthHeader(user.id))
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
        .set('Authorization', makeAuthHeader(user.id))
        .send({
          text: 'Take out the trash',
          datetime: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
          channel: 'push',
          category: 'personal',
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
        .set('Authorization', makeAuthHeader(user.id))
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
      const reminderId = uuid();
      db.prepare(`
        INSERT INTO reminders (id, user_id, text, datetime, channel, category, completed, created_by)
        VALUES (?, ?, ?, datetime('now'), 'push', 'test', 0, 'test')
      `).run(reminderId, user.id, 'Reminder to delete');

      const response = await request(app)
        .delete(`/api/reminders/${reminderId}`)
        .set('Authorization', makeAuthHeader(user.id))
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
