// ============================================================
// Skills Routes — Skill marketplace, install/uninstall, config
// ============================================================

import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { logger } from '../logger.js';
import type { SkillRow, UserSkillRow } from '../skills/types.js';

export const skillsRouter = Router();

// Plans that unlock 'pro' tier skills
const PRO_PLANS = new Set(['intro', 'pilot', 'pro', 'monthly', 'halfyear', 'yearly', 'team', 'teams']);

// Valid agent IDs — prevent arbitrary keys in agent_overrides
const VALID_AGENT_IDS = new Set(['weebo', 'edith', 'jarvis', 'aria', 'forge', 'pulse', 'echo', 'cal', 'nova']);

// Skill ID format: alphanumeric + hyphens only (prevents SQL oddities and path traversal)
const SKILL_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

// Max installed skills per user (bounds prompt size + query cost)
const MAX_INSTALLED_SKILLS = 20;

// Helper: get user plan
function getUserPlan(userId: string): string {
  const row = db.prepare('SELECT plan FROM users WHERE id = ?').get(userId) as { plan: string } | undefined;
  return row?.plan || 'free';
}

// GET /api/skills/catalog — full skill catalog (marketplace)
skillsRouter.get('/catalog', requireAuth, (req: AuthRequest, res) => {
  try {
    const rows = db.prepare('SELECT * FROM skills WHERE is_active = 1 ORDER BY category, name').all() as SkillRow[];
    const skills = rows.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      type: r.type,
      tier: r.tier,
      category: r.category,
      compatibleAgents: JSON.parse(r.compatible_agents),
      icon: r.icon,
      tags: JSON.parse(r.tags),
      createdAt: r.created_at,
    }));
    res.json(skills);
  } catch (err) {
    logger.error({ err }, 'Failed to fetch skill catalog');
    res.status(500).json({ error: 'Failed to fetch skill catalog' });
  }
});

// GET /api/skills/user — user's installed skills
skillsRouter.get('/user', requireAuth, (req: AuthRequest, res) => {
  try {
    const rows = db.prepare(`
      SELECT us.*, s.name, s.description, s.type, s.tier, s.category, s.compatible_agents, s.icon, s.tags
      FROM user_skills us
      JOIN skills s ON us.skill_id = s.id
      WHERE us.user_id = ?
      ORDER BY us.installed_at DESC
    `).all(req.userId!) as (UserSkillRow & SkillRow)[];

    const skills = rows.map(r => ({
      skillId: r.skill_id,
      name: r.name,
      description: r.description,
      type: r.type,
      tier: r.tier,
      category: r.category,
      compatibleAgents: JSON.parse(r.compatible_agents),
      icon: r.icon,
      tags: JSON.parse(r.tags),
      enabled: r.enabled === 1,
      agentOverrides: JSON.parse(r.agent_overrides || '{}'),
      config: JSON.parse(r.config || '{}'),
      installedAt: r.installed_at,
      lastUsedAt: r.last_used_at,
    }));
    res.json(skills);
  } catch (err) {
    logger.error({ err }, 'Failed to fetch user skills');
    res.status(500).json({ error: 'Failed to fetch user skills' });
  }
});

// POST /api/skills/install — install a skill
skillsRouter.post('/install', requireAuth, (req: AuthRequest, res) => {
  const { skillId } = req.body as { skillId?: string };
  if (!skillId || typeof skillId !== 'string') {
    res.status(400).json({ error: 'skillId is required' });
    return;
  }
  if (!SKILL_ID_RE.test(skillId)) {
    res.status(400).json({ error: 'Invalid skillId format' });
    return;
  }

  try {
    // Check skill exists and is active
    const skill = db.prepare('SELECT id, tier FROM skills WHERE id = ? AND is_active = 1').get(skillId) as { id: string; tier: string } | undefined;
    if (!skill) {
      res.status(404).json({ error: 'Skill not found' });
      return;
    }

    // Tier check
    const userPlan = getUserPlan(req.userId!);
    if (skill.tier !== 'free' && !PRO_PLANS.has(userPlan)) {
      res.status(403).json({ error: `Upgrade to a paid plan to install ${skill.tier}-tier skills` });
      return;
    }

    // Cap maximum installed skills per user
    const count = db.prepare('SELECT COUNT(*) as cnt FROM user_skills WHERE user_id = ?').get(req.userId!) as { cnt: number };
    if (count.cnt >= MAX_INSTALLED_SKILLS) {
      res.status(409).json({ error: `Maximum of ${MAX_INSTALLED_SKILLS} skills allowed. Uninstall one first.` });
      return;
    }

    // Check if already installed
    const existing = db.prepare('SELECT 1 FROM user_skills WHERE user_id = ? AND skill_id = ?').get(req.userId!, skillId);
    if (existing) {
      res.status(409).json({ error: 'Skill already installed' });
      return;
    }

    db.prepare(`
      INSERT INTO user_skills (user_id, skill_id, enabled, agent_overrides, config, installed_at)
      VALUES (?, ?, 1, '{}', '{}', datetime('now'))
    `).run(req.userId!, skillId);

    logger.info({ userId: req.userId, skillId }, 'Skill installed');
    res.json({ success: true, skillId });
  } catch (err) {
    logger.error({ err, skillId }, 'Failed to install skill');
    res.status(500).json({ error: 'Failed to install skill' });
  }
});

// POST /api/skills/uninstall — uninstall a skill
skillsRouter.post('/uninstall', requireAuth, (req: AuthRequest, res) => {
  const { skillId } = req.body as { skillId?: string };
  if (!skillId || typeof skillId !== 'string') {
    res.status(400).json({ error: 'skillId is required' });
    return;
  }
  if (!SKILL_ID_RE.test(skillId)) {
    res.status(400).json({ error: 'Invalid skillId format' });
    return;
  }

  try {
    const result = db.prepare('DELETE FROM user_skills WHERE user_id = ? AND skill_id = ?').run(req.userId!, skillId);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Skill not installed' });
      return;
    }

    logger.info({ userId: req.userId, skillId }, 'Skill uninstalled');
    res.json({ success: true, skillId });
  } catch (err) {
    logger.error({ err, skillId }, 'Failed to uninstall skill');
    res.status(500).json({ error: 'Failed to uninstall skill' });
  }
});

// PATCH /api/skills/:skillId/toggle — enable/disable a skill
skillsRouter.patch('/:skillId/toggle', requireAuth, (req: AuthRequest, res) => {
  const { skillId } = req.params;
  if (!SKILL_ID_RE.test(skillId)) {
    res.status(400).json({ error: 'Invalid skillId format' });
    return;
  }
  const { enabled } = req.body as { enabled?: boolean };
  if (typeof enabled !== 'boolean') {
    res.status(400).json({ error: 'enabled (boolean) is required' });
    return;
  }

  try {
    const result = db.prepare('UPDATE user_skills SET enabled = ? WHERE user_id = ? AND skill_id = ?')
      .run(enabled ? 1 : 0, req.userId!, skillId);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Skill not installed' });
      return;
    }

    res.json({ success: true, skillId, enabled });
  } catch (err) {
    logger.error({ err, skillId }, 'Failed to toggle skill');
    res.status(500).json({ error: 'Failed to toggle skill' });
  }
});

// PATCH /api/skills/:skillId/agents — update agent overrides
skillsRouter.patch('/:skillId/agents', requireAuth, (req: AuthRequest, res) => {
  const { skillId } = req.params;
  if (!SKILL_ID_RE.test(skillId)) {
    res.status(400).json({ error: 'Invalid skillId format' });
    return;
  }

  const { agentOverrides } = req.body as { agentOverrides?: Record<string, boolean> };
  if (!agentOverrides || typeof agentOverrides !== 'object' || Array.isArray(agentOverrides)) {
    res.status(400).json({ error: 'agentOverrides (object) is required' });
    return;
  }

  // Validate: keys must be known agent IDs, values must be booleans
  const entries = Object.entries(agentOverrides);
  if (entries.length > VALID_AGENT_IDS.size) {
    res.status(400).json({ error: 'Too many agent overrides' });
    return;
  }
  for (const [key, val] of entries) {
    if (!VALID_AGENT_IDS.has(key)) {
      res.status(400).json({ error: `Unknown agent: ${key}` });
      return;
    }
    if (typeof val !== 'boolean') {
      res.status(400).json({ error: `agentOverrides values must be booleans` });
      return;
    }
  }

  try {
    const result = db.prepare('UPDATE user_skills SET agent_overrides = ? WHERE user_id = ? AND skill_id = ?')
      .run(JSON.stringify(agentOverrides), req.userId!, skillId);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Skill not installed' });
      return;
    }

    res.json({ success: true, skillId, agentOverrides });
  } catch (err) {
    logger.error({ err, skillId }, 'Failed to update agent overrides');
    res.status(500).json({ error: 'Failed to update agent overrides' });
  }
});

// GET /api/skills/stats — usage stats for the user
skillsRouter.get('/stats', requireAuth, (req: AuthRequest, res) => {
  try {
    const rows = db.prepare(`
      SELECT skill_id, agent_id, COUNT(*) as usage_count, MAX(created_at) as last_used
      FROM skill_usage
      WHERE user_id = ?
      GROUP BY skill_id, agent_id
      ORDER BY usage_count DESC
    `).all(req.userId!) as Array<{ skill_id: string; agent_id: string; usage_count: number; last_used: string }>;

    res.json(rows.map(r => ({
      skillId: r.skill_id,
      agentId: r.agent_id,
      usageCount: r.usage_count,
      lastUsed: r.last_used,
    })));
  } catch (err) {
    logger.error({ err }, 'Failed to fetch skill stats');
    res.status(500).json({ error: 'Failed to fetch skill stats' });
  }
});
