// Extracted from agent.ts — Sprint 3 decomposition
import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { requireAuth, type AuthRequest } from '../../../middleware/auth.js';
import { validateBody, agentConfigUpdateSchema } from '../../../middleware/validate.js';
import { db } from '../../../db/index.js';
import { logger } from '../../../logger.js';
import { config } from '../../../config.js';
import { getPersonality, PERSONALITIES } from '../../../prompts/personalities.js';
import { cacheGet, cacheSet } from '../../../services/cache.js';

const router = Router();

// ---- Rate Limit Status tracker (GeekOS upgrade) ----
// Redis-backed — survives Docker restarts
const RL_WINDOW_S = 15 * 60;
const RL_LIMIT = 60;

/**
 * Returns the current rate-limit status for a user from the Redis-backed counter.
 * Falls back to full quota (60 remaining) if Redis is unavailable.
 * @param userId - Numeric user ID (used as cache key `chat:rl:<userId>`).
 * @returns Object with `remaining` requests left, `limit` (60), and `windowMinutes` (15).
 */
async function getRateLimitStatus(userId: number): Promise<{ remaining: number; limit: number; windowMinutes: number }> {
  const key = `chat:rl:${userId}`;
  try {
    const raw = await cacheGet(key);
    const count = raw ? parseInt(raw, 10) : 0;
    return { remaining: Math.max(0, RL_LIMIT - count), limit: RL_LIMIT, windowMinutes: 15 };
  } catch {
    return { remaining: RL_LIMIT, limit: RL_LIMIT, windowMinutes: 15 };
  }
}

// ---- Agent Config CRUD ----

/**
 * GET /api/agent/config
 * Returns the full agent configuration row for the authenticated user.
 * @returns 200 AgentConfigRow | 404 if not yet created.
 */
router.get('/config', requireAuth, (req: AuthRequest, res) => {
  const config = db.prepare('SELECT * FROM agent_configs WHERE user_id = ?').get(req.userId!) as Record<string, unknown> | undefined;
  if (!config) { res.status(404).json({ error: 'Agent config not found' }); return; }
  res.json(config);
});

/**
 * PATCH /api/agent/config
 * Partially updates the authenticated user's agent configuration.
 * Only fields present in the request body are modified.
 * Accepts camelCase keys; maps them to snake_case DB columns via `allowedFields`.
 * @body Partial AgentConfigRow fields in camelCase (validated by `agentConfigUpdateSchema`).
 * @returns 200 { success: true } | 400 on invalid fields | 404 if config missing.
 */
router.patch('/config', requireAuth, validateBody(agentConfigUpdateSchema), (req: AuthRequest, res) => {
  const updates = req.body;
  const fields: string[] = [];
  const values: unknown[] = [];

  const allowedFields: Record<string, string> = {
    name: 'name', displayName: 'display_name', mode: 'mode', voice: 'voice',
    systemPrompt: 'system_prompt', primaryModel: 'primary_model', fallbackModel: 'fallback_model',
    creativity: 'creativity', formality: 'formality', verbosity: 'verbosity',
    humor: 'humor', empathy: 'empathy', responseSpeed: 'response_speed',
    monthlyBudgetUSD: 'monthly_budget_usd', avatarEmoji: 'avatar_emoji',
    accentColor: 'accent_color', bubbleStyle: 'bubble_style', status: 'status',
    personality: 'personality', model_preference: 'model_preference',
    preferred_free_model: 'preferred_free_model',
    preferred_image_model: 'preferred_image_model',
    preferred_video_model: 'preferred_video_model',
    briefing_time: 'briefing_time',
    notif_reminders: 'notif_reminders',
    notif_escalations: 'notif_escalations',
    notif_agents: 'notif_agents',
    notif_daily_briefing: 'notif_daily_briefing',
    notif_connections: 'notif_connections',
    greeting: 'greeting',
    snooze_presets: 'snooze_presets',
    use_case: 'use_case',
  };

  for (const [key, col] of Object.entries(allowedFields)) {
    if (updates[key] !== undefined) { fields.push(`${col} = ?`); values.push(updates[key]); }
  }

  if (fields.length) { values.push(req.userId); db.prepare(`UPDATE agent_configs SET ${fields.join(', ')} WHERE user_id = ?`).run(...values); }

  db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Updated agent config', ?, 'bot')`).run(uuid(), req.userId, `Changed: ${Object.keys(updates).join(', ')}`);

  const config = db.prepare('SELECT * FROM agent_configs WHERE user_id = ?').get(req.userId!);
  res.json(config);
});

// ---- Personalities ----

router.get('/personalities', async (_req, res) => {
  const cached = await cacheGet('agent:personalities');
  if (cached) { res.json(JSON.parse(cached)); return; }
  await cacheSet('agent:personalities', JSON.stringify(PERSONALITIES), 3600);
  res.json(PERSONALITIES);
});

// ---- Agent Status Endpoints (for testing and UI state management) ----

router.get('/status', requireAuth, (req: AuthRequest, res) => {
  const agent = db.prepare('SELECT * FROM agent_configs WHERE user_id = ?').get(req.userId!) as {
    status: string;
    name: string;
    mode: string;
    personality: string;
  } | undefined;

  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  const isActive = agent.status === 'online';

  res.json({
    status: isActive ? 'active' : 'inactive',
    agent: {
      name: agent.name,
      mode: agent.mode,
      personality: agent.personality || 'jarvis',
      isActive,
    },
  });
});

router.post('/activate', requireAuth, (req: AuthRequest, res) => {
  db.prepare('UPDATE agent_configs SET status = ? WHERE user_id = ?').run('online', req.userId!);

  // Log activity
  db.prepare(`
    INSERT INTO activity_log (id, user_id, action, details, icon)
    VALUES (?, ?, 'Agent activated', 'Agent is now online', 'power')
  `).run(uuid(), req.userId!);

  res.json({ success: true, status: 'active' });
});

router.post('/deactivate', requireAuth, (req: AuthRequest, res) => {
  db.prepare('UPDATE agent_configs SET status = ? WHERE user_id = ?').run('offline', req.userId!);

  // Log activity
  db.prepare(`
    INSERT INTO activity_log (id, user_id, action, details, icon)
    VALUES (?, ?, 'Agent deactivated', 'Agent is now offline', 'power-off')
  `).run(uuid(), req.userId!);

  res.json({ success: true, status: 'inactive' });
});

router.get('/rate-limit-status', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId! as unknown as number;
  const status = await getRateLimitStatus(userId);
  res.json({
    ...status,
    resetAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  });
});

// ── Morning Briefing: manual trigger ─────────────────────────────────
router.post('/morning-briefing', requireAuth, async (req: AuthRequest, res) => {
  const { deliverMorningBriefing } = await import('../../../services/morning-operator.js');
  await deliverMorningBriefing(String(req.userId));
  res.json({ ok: true, message: 'Morning briefing triggered' });
});

export default router;
