import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createTestUser, cleanupTestUser, resetDatabase, makeAuthHeader } from '../setup.js';
import { db } from '../../db/index.js';
import { v4 as uuid } from 'uuid';

const app = createApp();

describe('Portfolio Stats Endpoints', () => {
  beforeAll(() => {
    resetDatabase();
  });

  afterEach(() => {
    resetDatabase();
  });

  describe('GET /api/portfolio/stats', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/portfolio/stats')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should return correct shape for authenticated user', async () => {
      const user = createTestUser();

      const response = await request(app)
        .get('/api/portfolio/stats')
        .set('Authorization', makeAuthHeader(user.id))
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('totalViews');
      expect(response.body).toHaveProperty('recentViews');
      expect(response.body).toHaveProperty('dailyBreakdown');
      expect(Array.isArray(response.body.dailyBreakdown)).toBe(true);
      expect(typeof response.body.totalViews).toBe('number');
      expect(typeof response.body.recentViews).toBe('number');

      cleanupTestUser(user.id);
    });

    it('should return zeros for a new user with no visits', async () => {
      const user = createTestUser();

      const response = await request(app)
        .get('/api/portfolio/stats')
        .set('Authorization', makeAuthHeader(user.id))
        .expect(200);

      expect(response.body.totalViews).toBe(0);
      expect(response.body.recentViews).toBe(0);
      expect(response.body.dailyBreakdown).toHaveLength(0);

      cleanupTestUser(user.id);
    });

    it('should count portfolio visits correctly', async () => {
      const user = createTestUser();
      const otherId = uuid();

      // Insert 3 visits for the test user and 1 for someone else
      db.prepare(`INSERT INTO portfolio_visits (user_id, visited_at, visitor_ip) VALUES (?, datetime('now'), '1.1.1.1')`).run(user.id);
      db.prepare(`INSERT INTO portfolio_visits (user_id, visited_at, visitor_ip) VALUES (?, datetime('now'), '1.1.1.2')`).run(user.id);
      db.prepare(`INSERT INTO portfolio_visits (user_id, visited_at, visitor_ip) VALUES (?, datetime('now', '-10 days'), '1.1.1.3')`).run(user.id);
      db.prepare(`INSERT INTO portfolio_visits (user_id, visited_at, visitor_ip) VALUES (?, datetime('now'), '2.2.2.2')`).run(otherId);

      const response = await request(app)
        .get('/api/portfolio/stats')
        .set('Authorization', makeAuthHeader(user.id))
        .expect(200);

      // totalViews counts ALL visits for this user (3), not the other user's (1)
      expect(response.body.totalViews).toBe(3);
      // recentViews counts only last 7 days: 2 recent visits
      expect(response.body.recentViews).toBe(2);
      // dailyBreakdown should have entries
      expect(response.body.dailyBreakdown.length).toBeGreaterThan(0);
      // Each entry has date (string) and count (number)
      const entry = response.body.dailyBreakdown[0] as { date: string; count: number };
      expect(typeof entry.date).toBe('string');
      expect(typeof entry.count).toBe('number');

      cleanupTestUser(user.id);
    });
  });
});
