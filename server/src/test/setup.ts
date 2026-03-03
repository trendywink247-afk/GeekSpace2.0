/**
 * Test Setup
 * Configures the test environment and provides shared utilities
 */

// Set test mode BEFORE any imports
process.env.TEST_MODE = 'true';

// Use a dedicated test database path
import path from 'path';
import os from 'os';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';

const TEST_DB_PATH = process.env.TEST_DB_PATH || path.join(os.tmpdir(), `geekspace-test-${process.pid}.db`);
process.env.DB_PATH = TEST_DB_PATH;

// Now import the rest
import { config } from '../config.js';
import { logger } from '../logger.js';
import { signToken } from '../middleware/auth.js';

// Suppress logging during tests unless explicitly enabled
if (!process.env.DEBUG_TESTS) {
  logger.level = 'silent';
}

// Import db after setting DB_PATH
import { db } from '../db/index.js';

/**
 * Reset database for tests
 * Properly handles foreign keys by disabling during cleanup
 */
export function resetDatabase(): void {
  if (!config.isTestMode) {
    throw new Error('Cannot reset database outside of test mode');
  }

  // Disable foreign key constraints during cleanup
  db.pragma('foreign_keys = OFF');

  try {
    // Clean up test data in reverse dependency order
    const tables = [
      'activity_log',
      'security_events',
      'usage_events',
      'reminders',
      'pico_tasks',
      'agent_memory',
      'conversation_log',
      'channel_links',
      'link_codes',
      'pico_agents',
      'agent_configs',
      'subscriptions',
      'features',
      'portfolios',
      'integrations',
      'api_keys',
      'automations',
      'dev_audit_log',
      'snooze_log',
      'portfolio_contacts',
      'webhook_dead_letters',
      'suggestion_events',
      'suggestion_votes',
      'suggestion_rewards',
      'suggestion_scores',
      'suggestion_clusters',
      'suggestions',
      'users',
    ];

    for (const table of tables) {
      try {
        db.prepare(`DELETE FROM ${table}`).run();
      } catch (err) {
        // Table might not exist, ignore
        logger.debug({ table, err }, 'Could not clean table');
      }
    }
  } finally {
    // Re-enable foreign keys
    db.pragma('foreign_keys = ON');
  }
}

/**
 * Create a test user and return credentials
 */
export function createTestUser(emailOrOpts: string | { prefix?: string } = {}): {
  id: string;
  email: string;
  username: string;
  password: string;
} {
  const prefix = typeof emailOrOpts === 'string' ? emailOrOpts : (emailOrOpts.prefix ?? `test-${Date.now()}`);
  const email = typeof emailOrOpts === 'string' ? emailOrOpts : `${prefix}-${Date.now()}@example.com`;
  const id = uuid();
  const username = `test_${Date.now()}`;
  const password = 'test-password-123';
  const passwordHash = bcrypt.hashSync(password, 10);

  db.prepare(`
    INSERT INTO users (id, email, username, password_hash, name, plan, credits)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, email, username, passwordHash, 'Test User', 'premium', 50000);

  // Create subscription with correct column names
  db.prepare(`
    INSERT INTO subscriptions (id, user_id, plan, credits_remaining, billing_cycle_start, billing_cycle_end)
    VALUES (?, ?, ?, ?, datetime('now'), datetime('now', '+30 days'))
  `).run(uuid(), id, 'premium', 50000);

  // Create agent config for the user (many endpoints expect this)
  db.prepare(`
    INSERT INTO agent_configs (id, user_id, name, mode, status)
    VALUES (?, ?, ?, ?, ?)
  `).run(uuid(), id, 'TestAgent', 'builder', 'online');

  return { id, email, username, password };
}

/**
 * Generate JWT token for test user using the same method as production
 */
export function generateTestToken(userId: string): string {
  return signToken(userId);
}

/**
 * Create test agent config
 */
export function createTestAgent(userId: string, isActive = true): string {
  const id = uuid();

  db.prepare(`
    INSERT INTO agent_configs (id, user_id, name, mode, status)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, userId, 'TestAgent', 'builder', isActive ? 'online' : 'offline');

  return id;
}

/**
 * Clean up test data for a specific user
 */
export function cleanupTestUser(userId: string): void {
  // Disable foreign keys during cleanup
  db.pragma('foreign_keys = OFF');

  try {
    const tables = [
      'activity_log',
      'security_events',
      'usage_events',
      'reminders',
      'pico_tasks',
      'agent_memory',
      'conversation_log',
      'channel_links',
      'link_codes',
      'pico_agents',
      'agent_configs',
      'subscriptions',
      'features',
      'portfolios',
      'integrations',
      'api_keys',
      'automations',
    ];

    for (const table of tables) {
      try {
        db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(userId);
      } catch {
        // Table might not exist, ignore
      }
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

/**
 * Make Authorization header for Supertest
 */
export function makeAuthHeader(userId: string): string {
  return `Bearer ${generateTestToken(userId)}`;
}
