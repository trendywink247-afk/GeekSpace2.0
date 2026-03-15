import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { config } from '../../config.js';

// Create the real app (same as production)
const app = createApp();

describe('Public Stats Endpoint', () => {
  beforeAll(() => {
    // Ensure we're in test mode
    expect(config.isTestMode).toBe(true);
  });

  describe('GET /api/stats/public', () => {
    it('should return 200 with expected shape', async () => {
      const response = await request(app)
        .get('/api/stats/public')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('conversations');
      expect(response.body).toHaveProperty('messages_today');
      expect(response.body).toHaveProperty('reminders_created');
      expect(response.body).toHaveProperty('automations_active');
      expect(response.body).toHaveProperty('countries');
      expect(response.body).toHaveProperty('uptime_pct');
    });

    it('should contain all required fields', async () => {
      const response = await request(app)
        .get('/api/stats/public')
        .expect(200);

      const requiredFields = [
        'users',
        'conversations',
        'messages_today',
        'reminders_created',
        'automations_active',
        'countries',
        'uptime_pct',
      ];

      for (const field of requiredFields) {
        expect(response.body).toHaveProperty(field);
      }

      // Exactly these fields — no extras leaked
      expect(Object.keys(response.body).sort()).toEqual(requiredFields.sort());
    });

    it('should return numeric values >= 0 for all fields', async () => {
      const response = await request(app)
        .get('/api/stats/public')
        .expect(200);

      expect(typeof response.body.users).toBe('number');
      expect(typeof response.body.conversations).toBe('number');
      expect(typeof response.body.messages_today).toBe('number');
      expect(typeof response.body.reminders_created).toBe('number');
      expect(typeof response.body.automations_active).toBe('number');
      expect(typeof response.body.countries).toBe('number');
      expect(typeof response.body.uptime_pct).toBe('number');

      expect(response.body.users).toBeGreaterThanOrEqual(0);
      expect(response.body.conversations).toBeGreaterThanOrEqual(0);
      expect(response.body.messages_today).toBeGreaterThanOrEqual(0);
      expect(response.body.reminders_created).toBeGreaterThanOrEqual(0);
      expect(response.body.automations_active).toBeGreaterThanOrEqual(0);
      expect(response.body.countries).toBeGreaterThanOrEqual(0);
      expect(response.body.uptime_pct).toBeGreaterThanOrEqual(0);
    });

    it('should be accessible without authentication', async () => {
      // No Authorization header set — endpoint must still return 200
      const response = await request(app)
        .get('/api/stats/public')
        .expect(200);

      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('uptime_pct');
    });

    it('should cache responses (X-Cache: HIT on second request)', async () => {
      // First request — should be a cache MISS (or HIT if a prior test populated it)
      await request(app)
        .get('/api/stats/public')
        .expect(200);

      // Second request — the 5-minute in-memory cache should return HIT
      const cached = await request(app)
        .get('/api/stats/public')
        .expect(200);

      expect(cached.headers['x-cache']).toBe('HIT');
    });
  });
});
