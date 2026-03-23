import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { config } from '../../config.js';

// Create the real app (same as production)
const app = createApp();

describe('Health Endpoints', () => {
  beforeAll(() => {
    // Ensure we're in test mode
    expect(config.isTestMode).toBe(true);
  });

  describe('GET /api/health', () => {
    it('should return minimal health status without architecture details', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('ok');
      // H-3: public endpoint must NOT leak architecture details
      expect(response.body).not.toHaveProperty('components');
      expect(response.body).not.toHaveProperty('metrics');
      expect(response.body).not.toHaveProperty('system');
      expect(response.body).not.toHaveProperty('db');
      expect(response.body).not.toHaveProperty('version');
      expect(response.body).not.toHaveProperty('build');
      expect(response.body).not.toHaveProperty('serviceHealth');
    });
  });

  describe('Configuration', () => {
    it('should be in test mode', () => {
      expect(config.isTestMode).toBe(true);
    });

    it('should have valid JWT secret', () => {
      expect(config.jwtSecret).toBeDefined();
      expect(config.jwtSecret.length).toBeGreaterThan(0);
    });

    it('should have database path configured', () => {
      expect(config.dbPath).toBeDefined();
    });
  });

  describe('Test Mode', () => {
    it('should have test mode enabled in config', () => {
      expect(config.isTestMode).toBe(true);
    });

    it('should have environment set to test', () => {
      expect(process.env.TEST_MODE).toBe('true');
    });
  });
});
