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
      // 58.3: dailyBreakdown now returns all 30 days filled with zeros (no gaps)
      expect(response.body.dailyBreakdown).toHaveLength(30);
      const allZero = (response.body.dailyBreakdown as { count: number }[]).every(d => d.count === 0);
      expect(allZero).toBe(true);

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

describe('Portfolio Visit Deduplication', () => {
  beforeAll(() => {
    resetDatabase();
  });

  afterEach(() => {
    // Clear portfolio_visits between tests since resetDatabase doesn't cover it
    try { db.prepare('DELETE FROM portfolio_visits').run(); } catch { /* ignore */ }
    resetDatabase();
  });

  it('should deduplicate visits from the same IP within 30 minutes', async () => {
    const user = createTestUser();
    const username = `dedup_test_${Date.now()}`;

    // Create a portfolio for the user
    db.prepare(`
      INSERT INTO portfolios (user_id, username, headline, about, skills, projects, milestones, social, layout, agent_enabled, visibility)
      VALUES (?, ?, 'Test', 'About', '[]', '[]', '[]', '{}', 'classic', 0, '{}')
    `).run(user.id, username);

    const sameIp = '10.0.0.1';

    // Make two requests from the same IP — should only record one visit
    await request(app)
      .get(`/api/portfolio/${username}`)
      .set('x-forwarded-for', sameIp);

    await request(app)
      .get(`/api/portfolio/${username}`)
      .set('x-forwarded-for', sameIp);

    const statsResponse = await request(app)
      .get('/api/portfolio/stats')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(statsResponse.body.totalViews).toBe(1);

    cleanupTestUser(user.id);
  });

  it('should count visits from different IPs as separate views', async () => {
    const user = createTestUser();
    const username = `dedup_test2_${Date.now()}`;

    // Create a portfolio for the user
    db.prepare(`
      INSERT INTO portfolios (user_id, username, headline, about, skills, projects, milestones, social, layout, agent_enabled, visibility)
      VALUES (?, ?, 'Test', 'About', '[]', '[]', '[]', '{}', 'classic', 0, '{}')
    `).run(user.id, username);

    // Make requests from two different IPs
    await request(app)
      .get(`/api/portfolio/${username}`)
      .set('x-forwarded-for', '10.0.0.2');

    await request(app)
      .get(`/api/portfolio/${username}`)
      .set('x-forwarded-for', '10.0.0.3');

    const statsResponse = await request(app)
      .get('/api/portfolio/stats')
      .set('Authorization', makeAuthHeader(user.id))
      .expect(200);

    expect(statsResponse.body.totalViews).toBe(2);

    cleanupTestUser(user.id);
  });
});

describe('Portfolio Stats CSV Export', () => {
  beforeAll(() => {
    resetDatabase();
  });

  afterEach(() => {
    try { db.prepare('DELETE FROM portfolio_visits').run(); } catch { /* ignore */ }
    resetDatabase();
  });

  describe('GET /api/portfolio/stats/export', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/portfolio/stats/export')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should return text/csv content type for authenticated user', async () => {
      const user = createTestUser();

      const response = await request(app)
        .get('/api/portfolio/stats/export')
        .set('Authorization', makeAuthHeader(user.id))
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/csv/);
      expect(response.headers['content-disposition']).toMatch(/attachment/);
      expect(response.headers['content-disposition']).toMatch(/portfolio-visits\.csv/);

      cleanupTestUser(user.id);
    });

    it('should return valid CSV format with header row', async () => {
      const user = createTestUser();

      const response = await request(app)
        .get('/api/portfolio/stats/export')
        .set('Authorization', makeAuthHeader(user.id))
        .expect(200);

      const csv = response.text;
      const lines = csv.split('\n');
      // Must have at least the header line
      expect(lines.length).toBeGreaterThanOrEqual(1);
      expect(lines[0]).toBe('date,visits');

      cleanupTestUser(user.id);
    });

    it('should return CSV rows for existing visits', async () => {
      const user = createTestUser();

      // Insert some visits
      db.prepare(`INSERT INTO portfolio_visits (user_id, visited_at, visitor_ip) VALUES (?, datetime('now'), '1.1.1.1')`).run(user.id);
      db.prepare(`INSERT INTO portfolio_visits (user_id, visited_at, visitor_ip) VALUES (?, datetime('now'), '1.1.1.2')`).run(user.id);

      const response = await request(app)
        .get('/api/portfolio/stats/export')
        .set('Authorization', makeAuthHeader(user.id))
        .expect(200);

      const csv = response.text;
      const lines = csv.split('\n').filter((l) => l.trim().length > 0);
      // Header + at least 1 data row
      expect(lines.length).toBeGreaterThanOrEqual(2);

      // First line is header
      expect(lines[0]).toBe('date,visits');

      // Data rows should match pattern: YYYY-MM-DD,N
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        expect(parts).toHaveLength(2);
        expect(parts[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(Number(parts[1])).toBeGreaterThan(0);
      }

      cleanupTestUser(user.id);
    });

    it('should only return data for the authenticated user', async () => {
      const userA = createTestUser();
      const userB = createTestUser(`csv-user-b-${Date.now()}@example.com`);
      const otherId = uuid();

      // Insert visits for userA and someone else (not userB)
      db.prepare(`INSERT INTO portfolio_visits (user_id, visited_at, visitor_ip) VALUES (?, datetime('now'), '5.5.5.5')`).run(userA.id);
      db.prepare(`INSERT INTO portfolio_visits (user_id, visited_at, visitor_ip) VALUES (?, datetime('now'), '6.6.6.6')`).run(otherId);

      const response = await request(app)
        .get('/api/portfolio/stats/export')
        .set('Authorization', makeAuthHeader(userB.id))
        .expect(200);

      const csv = response.text;
      const lines = csv.split('\n').filter((l) => l.trim().length > 0);
      // userB has no visits — only the header row
      expect(lines).toHaveLength(1);
      expect(lines[0]).toBe('date,visits');

      cleanupTestUser(userA.id);
      cleanupTestUser(userB.id);
    });
  });
});
