// ============================================================
// Test Routes — ONLY available in TEST_MODE
// Provides endpoints for E2E test orchestration and state inspection
// ============================================================

import { Router } from 'express';
import { logger } from '../logger.js';
import { db } from '../db/index.js';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';
import {
  getTestState,
  resetTestState,
  isTestMode,
  recordAgentStatus,
} from '../services/test-mode.js';
import { signToken } from '../middleware/auth.js';

const router = Router();

// Guard middleware - only allow in test mode
router.use((req, res, next) => {
  if (!isTestMode()) {
    logger.warn({ ip: req.ip }, 'Attempt to access test routes outside TEST_MODE');
    return res.status(503).json({ error: 'Test routes only available in TEST_MODE' });
  }
  next();
});

/**
 * GET /test/state
 * Get current test state including reminders, agent status, LLM calls
 */
router.get('/state', (req, res) => {
  const state = getTestState();

  // Also get current database counts
  const dbStats = {
    users: db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number },
    reminders: db.prepare('SELECT COUNT(*) as count FROM reminders').get() as { count: number },
    remindersPending: db.prepare("SELECT COUNT(*) as count FROM reminders WHERE completed = 0").get() as { count: number },
    agents: db.prepare('SELECT COUNT(*) as count FROM agent_configs').get() as { count: number },
  };

  res.json({
    testMode: true,
    state,
    dbStats: {
      users: dbStats.users.count,
      reminders: dbStats.reminders.count,
      remindersPending: dbStats.remindersPending.count,
      agents: dbStats.agents.count,
    },
    serverTime: new Date().toISOString(),
  });
});

/**
 * POST /test/reset
 * Clear test state and optionally clean up test data
 */
router.post('/reset', (req, res) => {
  const { fullCleanup = false } = req.body as { fullCleanup?: boolean };

  // Reset in-memory test state
  resetTestState();

  // Optionally do full database cleanup
  if (fullCleanup) {
    try {
      // Disable foreign keys for cleanup
      db.pragma('foreign_keys = OFF');

      // Clean up test users (identified by email pattern)
      db.prepare("DELETE FROM users WHERE email LIKE 'test-%@example.com' OR email LIKE '%@test.com'").run();

      // Clean up test reminders without valid users
      db.prepare(`DELETE FROM reminders WHERE user_id NOT IN (SELECT id FROM users)`).run();

      // Re-enable foreign keys
      db.pragma('foreign_keys = ON');

      logger.info('Full test cleanup completed');
    } catch (err) {
      logger.error({ err }, 'Error during full test cleanup');
      return res.status(500).json({ error: 'Cleanup failed', details: String(err) });
    }
  }

  res.json({ success: true, fullCleanup });
});

/**
 * POST /test/seed
 * Create test user and agent configuration
 */
router.post('/seed', async (req, res) => {
  const {
    email = `test-${Date.now()}@example.com`,
    name = 'Test User',
    plan = 'free',
    credits = 1000,
    agentActive = true,
    agentPersonality = 'jarvis',
    onboardingCompleted = false,
  } = req.body as {
    email?: string;
    name?: string;
    plan?: string;
    credits?: number;
    agentActive?: boolean;
    agentPersonality?: string;
    onboardingCompleted?: boolean;
  };

  try {
    // Check if user already exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: string } | undefined;
    if (existing) {
      return res.status(409).json({ error: 'User already exists', userId: existing.id });
    }

    // Create user
    const userId = uuid();
    const username = `test_${Date.now()}`;
    const passwordHash = await bcrypt.hash('test-password-123', 10);

    db.prepare(`
      INSERT INTO users (id, email, username, password_hash, name, plan, credits, onboarding_completed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, email, username, passwordHash, name, plan, credits, onboardingCompleted ? 1 : 0);

    // Create agent config
    const agentId = uuid();
    db.prepare(`
      INSERT INTO agent_configs (id, user_id, name, mode, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(agentId, userId, 'TestAgent', 'builder', agentActive ? 'online' : 'offline');

    // Create subscription with correct column names
    const subscriptionId = uuid();
    db.prepare(`
      INSERT INTO subscriptions (id, user_id, plan, credits_remaining, credits_used_this_cycle, billing_cycle_start, billing_cycle_end)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now', '+30 days'))
    `).run(subscriptionId, userId, plan, credits, 0);

    // Record agent status
    recordAgentStatus(userId, agentActive ? 'active' : 'inactive');

    logger.info({ userId, email }, 'Test user seeded');

    res.json({
      success: true,
      user: {
        id: userId,
        email,
        name,
        plan,
        credits,
      },
      agent: {
        id: agentId,
        name: 'TestAgent',
        personality: agentPersonality,
        isActive: agentActive,
      },
      credentials: {
        email,
        password: 'test-password-123', // Only exposed in test mode
      },
    });
  } catch (err) {
    logger.error({ err }, 'Error seeding test data');
    res.status(500).json({ error: 'Seeding failed', details: String(err) });
  }
});

/**
 * POST /test/reminder/execute
 * Manually trigger a pending reminder (for testing reminder execution)
 */
router.post('/reminder/execute', async (req, res) => {
  const { reminderId } = req.body as { reminderId?: string };

  try {
    let reminder;

    if (reminderId) {
      reminder = db.prepare('SELECT * FROM reminders WHERE id = ?').get(reminderId) as
        | { id: string; user_id: string; text: string; completed: number; datetime: string }
        | undefined;
    } else {
      // Get oldest pending reminder (completed = 0)
      reminder = db.prepare("SELECT * FROM reminders WHERE completed = 0 ORDER BY datetime ASC LIMIT 1").get() as
        | { id: string; user_id: string; text: string; completed: number; datetime: string }
        | undefined;
    }

    if (!reminder) {
      return res.status(404).json({ error: 'No pending reminder found' });
    }

    // Mark as completed
    db.prepare(`
      UPDATE reminders
      SET completed = 1
      WHERE id = ?
    `).run(reminder.id);

    res.json({
      success: true,
      reminder: {
        id: reminder.id,
        text: reminder.text,
        completed: true,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Error executing reminder');
    res.status(500).json({ error: 'Execution failed', details: String(err) });
  }
});

/**
 * GET /test/reminders
 * List reminders for inspection
 */
router.get('/reminders', (req, res) => {
  const { userId, status } = req.query;

  let query = 'SELECT * FROM reminders WHERE 1=1';
  const params: (string | number)[] = [];

  if (userId) {
    query += ' AND user_id = ?';
    params.push(userId as string);
  }

  if (status) {
    if (status === 'pending') {
      query += ' AND completed = 0';
    } else if (status === 'completed') {
      query += ' AND completed = 1';
    }
  }

  query += ' ORDER BY created_at DESC LIMIT 100';

  const reminders = db.prepare(query).all(...params) as unknown[];

  res.json({ reminders });
});

/**
 * POST /test/agent/status
 * Set agent status for testing
 */
router.post('/agent/status', (req, res) => {
  const { userId, active } = req.body as { userId: string; active: boolean };

  try {
    // Use status column (online/offline) not is_active
    db.prepare('UPDATE agent_configs SET status = ? WHERE user_id = ?').run(active ? 'online' : 'offline', userId);

    recordAgentStatus(userId, active ? 'active' : 'inactive');

    res.json({
      success: true,
      userId,
      status: active ? 'active' : 'inactive',
    });
  } catch (err) {
    logger.error({ err }, 'Error updating agent status');
    res.status(500).json({ error: 'Status update failed', details: String(err) });
  }
});

/**
 * POST /test/auth/token
 * Generate a valid JWT token for a test user (for E2E test authentication)
 */
router.post('/auth/token', async (req, res) => {
  const { userId, email } = req.body as { userId?: string; email?: string };

  try {
    let user;

    if (userId) {
      user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(userId) as
        | { id: string; email: string }
        | undefined;
    } else if (email) {
      user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email) as
        | { id: string; email: string }
        | undefined;
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate a valid JWT token
    const token = signToken(user.id);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Error generating test auth token');
    res.status(500).json({ error: 'Token generation failed', details: String(err) });
  }
});

export default router;
