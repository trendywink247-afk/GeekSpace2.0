/**
 * Test Setup
 * Configures the test environment and provides shared utilities
 */

// Set test mode BEFORE importing config
process.env.TEST_MODE = 'true';

import { config } from '../config.js';
import { db } from '../db/index.js';
import { logger } from '../logger.js';

// Suppress logging during tests unless explicitly enabled
if (!process.env.DEBUG_TESTS) {
  logger.level = 'silent';
}

/**
 * Reset database for tests
 * WARNING: Only works in test mode
 */
export function resetDatabase(): void {
  if (!config.isTestMode) {
    throw new Error('Cannot reset database outside of test mode');
  }

  // Clean up test data
  const tables = [
    'reminders',
    'pico_tasks',
    'agent_memory',
    'conversation_log',
    'channel_links',
    'pico_agents',
    'agent_configs',
    'subscriptions',
    'usage_events',
    'users',
  ];

  for (const table of tables) {
    try {
      db.prepare(`DELETE FROM ${table}`).run();
    } catch {
      // Table might not exist, ignore
    }
  }
}

/**
 * Create a test user and return credentials
 */
export function createTestUser(email = `test-${Date.now()}@example.com`): {
  id: string;
  email: string;
  username: string;
  password: string;
} {
  const { v4: uuid } = require('uuid');
  const bcrypt = require('bcryptjs');

  const id = uuid();
  const username = `test_${Date.now()}`;
  const password = 'test-password-123';
  const passwordHash = bcrypt.hashSync(password, 10);

  db.prepare(`
    INSERT INTO users (id, email, username, password_hash, name, plan, credits)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, email, username, passwordHash, 'Test User', 'premium', 50000);

  // Create subscription
  db.prepare(`
    INSERT INTO subscriptions (id, user_id, plan, credits_remaining, billing_cycle_start, billing_cycle_end)
    VALUES (?, ?, ?, ?, datetime('now'), datetime('now', '+30 days'))
  `).run(uuid(), id, 'premium', 50000);

  return { id, email, username, password };
}

/**
 * Generate JWT token for test user
 */
export function generateTestToken(userId: string): string {
  const jwt = require('jsonwebtoken');
  return jwt.sign({ userId }, config.jwtSecret, { expiresIn: '1h' });
}

/**
 * Create test agent config
 */
export function createTestAgent(userId: string, isActive = true): string {
  const { v4: uuid } = require('uuid');
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
  const tables = [
    'reminders',
    'pico_tasks',
    'agent_memory',
    'conversation_log',
    'channel_links',
    'pico_agents',
    'agent_configs',
    'subscriptions',
    'usage_events',
  ];

  for (const table of tables) {
    try {
      db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(userId);
    } catch {
      // Table might not exist, ignore
    }
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
}
