// ============================================================
// Skill Injector — Builds skill prompt blocks for agent system prompt
// ============================================================

import { db } from '../db/index.js';
import { logger } from '../logger.js';

// Plans that unlock 'pro' tier skills
const PRO_PLANS = new Set(['intro', 'pilot', 'pro', 'monthly', 'halfyear', 'yearly', 'team', 'teams']);

// Safety cap: max combined skill content injected into any single prompt (~6k tokens).
// 5 large skills at ~5k chars each = ~25k chars. Cap prevents abuse if catalog grows.
const MAX_SKILL_PROMPT_CHARS = 30_000;

// Max skills injected per prompt (defence-in-depth alongside char cap)
const MAX_SKILLS_PER_PROMPT = 10;

interface SkillJoinRow {
  skill_id: string;
  agent_overrides: string;
  skill_content: string;
  type: string;
  tier: string;
  compatible_agents: string;
}

/**
 * Build the skill knowledge block to inject into an agent's system prompt.
 * Only includes skills the user has installed + enabled, that are compatible
 * with the given agent, and that the user's plan tier allows.
 */
export function getSkillPromptForAgent(userId: string, agentId: string, userPlan: string): string {
  try {
    const rows = db.prepare(`
      SELECT us.skill_id, us.agent_overrides, s.skill_content, s.type, s.tier, s.compatible_agents
      FROM user_skills us
      JOIN skills s ON us.skill_id = s.id
      WHERE us.user_id = ? AND us.enabled = 1 AND s.is_active = 1
    `).all(userId) as SkillJoinRow[];

    if (!rows.length) return '';

    const canAccessPro = PRO_PLANS.has(userPlan);
    const blocks: string[] = [];

    for (const row of rows) {
      // Tier check: free users can only use free-tier skills
      if (row.tier !== 'free' && !canAccessPro) continue;

      // Only inject content for knowledge and hybrid skills (tool-only don't add prompt text)
      if (row.type === 'tool') continue;

      // Check agent compatibility
      let compatibleAgents: string[];
      try {
        compatibleAgents = JSON.parse(row.compatible_agents);
      } catch {
        compatibleAgents = [];
      }
      if (!compatibleAgents.includes(agentId)) continue;

      // Check agent overrides (user can disable a skill for specific agents)
      if (row.agent_overrides) {
        try {
          const overrides = JSON.parse(row.agent_overrides) as Record<string, boolean>;
          if (overrides[agentId] === false) continue;
        } catch { /* ignore malformed overrides */ }
      }

      blocks.push(row.skill_content);

      // Defence-in-depth: stop adding skills if we hit the per-prompt cap
      if (blocks.length >= MAX_SKILLS_PER_PROMPT) break;
    }

    // Assemble and enforce character cap to prevent prompt bloat
    let result = blocks.join('\n\n---\n\n');
    if (result.length > MAX_SKILL_PROMPT_CHARS) {
      result = result.slice(0, MAX_SKILL_PROMPT_CHARS);
      logger.warn({ userId, agentId, chars: result.length }, 'Skill prompt truncated — exceeded max chars');
    }

    return result;
  } catch (err) {
    logger.warn({ err, userId, agentId }, 'Skill injection query failed');
    return '';
  }
}

/**
 * Record a skill usage event for analytics.
 */
export function recordSkillUsage(userId: string, skillId: string, agentId: string): void {
  try {
    db.prepare(`
      INSERT INTO skill_usage (user_id, skill_id, agent_id, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(userId, skillId, agentId);

    // Update last_used_at on user_skills
    db.prepare(`
      UPDATE user_skills SET last_used_at = datetime('now')
      WHERE user_id = ? AND skill_id = ?
    `).run(userId, skillId);
  } catch (err) {
    logger.warn({ err, userId, skillId }, 'Failed to record skill usage');
  }
}
