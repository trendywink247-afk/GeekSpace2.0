import { describe, it, expect, beforeAll } from 'vitest';
import { config } from '../../config.js';

describe('Health Endpoints', () => {
  beforeAll(() => {
    // Ensure we're in test mode
    expect(config.isTestMode).toBe(true);
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
