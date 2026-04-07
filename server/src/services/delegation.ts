// ============================================================
// Delegation Service — Auto-delegation routing + tier enforcement
//
// Weebo automatically routes user messages to specialist agents
// based on intent detection. Delegation counts are tracked per
// user per day, enforced by subscription tier.
//
// Agents:
//   weebo  → default orchestrator / general
//   cal    → calendar, scheduling, reminders, meetings
//   echo   → memory, recall, "what did I say about", notes
//   forge  → code, build, technical, debugging
//   aria   → creative, writing, brainstorming, design
//   pulse  → analytics, data, metrics, tracking
//   nova   → research, learning, explain, compare
//   jarvis → tasks, productivity, workflow, planning
//   edith  → deep reasoning, complex analysis, premium
// ============================================================

import { db } from '../db/index.js';
import { logger } from '../logger.js';

// ── Tier limits (delegations per day) ────────────────────────

export const DELEGATION_LIMITS: Record<string, number> = {
  free:     10,
  intro:    50,
  pilot:    50,
  monthly: 200,
  halfyear: 200,
  yearly:  200,
  pro:     500,
  team:   9999,  // effectively unlimited
};

// ── Intent → Agent routing map ───────────────────────────────

interface DelegationRoute {
  agent: string;
  reason: string;
}

const DELEGATION_PATTERNS: Array<{ pattern: RegExp; agent: string; reason: string }> = [
  // Calendar / scheduling
  { pattern: /\b(?:schedule|calendar|meeting|appointment|book|reschedule|cancel\s+(?:my\s+)?meeting|free\s+(?:time|slot)|when\s+am\s+i|availability|what'?s?\s+(?:on\s+)?(?:my\s+)?(?:calendar|schedule))\b/i, agent: 'cal', reason: 'calendar & scheduling' },
  { pattern: /\b(?:remind\s+me|set\s+(?:a\s+)?reminder|don'?t?\s+let\s+me\s+forget|alarm)\b/i, agent: 'cal', reason: 'reminders' },

  // Memory / recall
  { pattern: /\b(?:remember\s+(?:when|what|that)|what\s+did\s+(?:i|we)\s+(?:say|talk|discuss)|recall|look\s+up\s+(?:my|our)\s+(?:conversation|chat|note)|search\s+(?:my\s+)?memory|find\s+(?:my\s+)?note)\b/i, agent: 'echo', reason: 'memory recall' },
  { pattern: /\b(?:save\s+this|note\s+(?:this|that)|store\s+(?:this|that)|keep\s+(?:this|that)\s+in\s+mind)\b/i, agent: 'echo', reason: 'memory storage' },

  // Code / technical
  { pattern: /\b(?:write\s+(?:a\s+)?(?:function|code|script|program|class|component|api)|debug|fix\s+(?:this|the)\s+(?:code|bug|error)|refactor|implement|coding|compile|syntax|algorithm|regex|sql\s+query)\b/i, agent: 'forge', reason: 'code & technical' },
  { pattern: /\b(?:html|css|javascript|typescript|python|react|node|docker|git|npm|api\s+(?:call|endpoint|request))\b/i, agent: 'forge', reason: 'programming' },

  // Creative / writing
  { pattern: /\b(?:write\s+(?:a\s+)?(?:story|poem|essay|blog|article|copy|caption|script|song|email)|creative|brainstorm|ideas?\s+for|come\s+up\s+with|rewrite|rephrase|tone|draft)\b/i, agent: 'aria', reason: 'creative writing' },
  { pattern: /\b(?:design|aesthetic|color\s+(?:scheme|palette)|ui|ux|layout|visual|brand|logo)\b/i, agent: 'aria', reason: 'design & aesthetics' },

  // Analytics / data
  { pattern: /\b(?:analyz|metric|dashboard|chart|graph|trend|data|statistic|report|kpi|roi|conversion|tracking|forecast)\b/i, agent: 'pulse', reason: 'analytics & data' },
  { pattern: /\b(?:how\s+(?:much|many)|count|average|total|percentage|compare\s+(?:the\s+)?numbers)\b/i, agent: 'pulse', reason: 'data analysis' },

  // Research / learning
  { pattern: /\b(?:research|explain|what\s+is|how\s+does|compare|difference\s+between|pros\s+and\s+cons|learn\s+about|teach\s+me|summarize|overview\s+of)\b/i, agent: 'nova', reason: 'research & learning' },
  { pattern: /\b(?:news|latest|update\s+(?:on|about)|what'?s?\s+happening)\b/i, agent: 'nova', reason: 'news & updates' },

  // Tasks / productivity
  { pattern: /\b(?:plan\s+(?:my|the|a)|prioritize|todo|to-do|task\s+(?:list|manager)|organize|workflow|project\s+(?:plan|management)|deadline|sprint)\b/i, agent: 'jarvis', reason: 'productivity & planning' },

  // Travel & trips
  { pattern: /\b(?:travel|trip|vacation|holiday|flight|hotel|itinerary|book\s+(?:a\s+)?(?:flight|hotel|ticket|stay)|go\s+(?:to|on)\s+(?:a\s+)?(?:trip|vacation)|visit\s+[A-Z]|destination)\b/i, agent: 'cal', reason: 'travel planning' },
  { pattern: /\b(?:las\s+vegas|new\s+york|paris|tokyo|london|europe|asia|beach|mountains|city\s+break)\b/i, agent: 'cal', reason: 'destination research' },

  // Entertainment, movies, food, shopping (lifestyle)
  { pattern: /\b(?:movie|film|watch|stream|netflix|series|tv\s+show|anime|show\s+me\s+movies|recommend\s+(?:a\s+)?(?:movie|show|series))\b/i, agent: 'nova', reason: 'entertainment recommendations' },
  { pattern: /\b(?:restaurant|food|recipe|cook|eat|meal|dinner|lunch|breakfast|cuisine|menu|order\s+food)\b/i, agent: 'nova', reason: 'food & dining' },
  { pattern: /\b(?:shop|buy|purchase|order\s+(?:a|some)|gift\s+for|product\s+recommendation|price\s+check|deal)\b/i, agent: 'nova', reason: 'shopping' },
  { pattern: /\b(?:game|play|steam|xbox|playstation|nintendo|rpg|fps)\b/i, agent: 'nova', reason: 'gaming' },
  { pattern: /\b(?:music|song|playlist|spotify|album|artist|listen\s+to|concert|tickets?\s+for)\b/i, agent: 'aria', reason: 'music & audio' },

  // Health & wellness
  { pattern: /\b(?:workout|exercise|fitness|gym|run|yoga|meditation|sleep|diet|nutrition|calories|weight\s+loss|health|wellness|hydrat)\b/i, agent: 'pulse', reason: 'health & wellness' },

  // Finance (basic)
  { pattern: /\b(?:budget|expense|savings?|invest|stock|crypto|bitcoin|portfolio|finance|tax|bank|loan|mortgage)\b/i, agent: 'pulse', reason: 'finance & money' },

  // Image / visual generation
  { pattern: /\b(?:generate\s+(?:an?\s+)?image|make\s+(?:an?\s+)?(?:image|picture|art)|draw|illustration|photo\s+of|create\s+(?:an?\s+)?(?:image|picture)|midjourney|dall[e\-]|stable\s+diffusion)\b/i, agent: 'aria', reason: 'image generation' },

  // Video generation / editing
  { pattern: /\b(?:make\s+(?:a\s+)?video|generate\s+(?:a\s+)?video|edit\s+(?:a\s+)?video|runway|sora)\b/i, agent: 'forge', reason: 'video generation' },
];

// ── Core functions ───────────────────────────────────────────

/**
 * Detect which specialist agent should handle this message.
 * Returns null if Weebo should handle it directly (no delegation needed).
 */
export function detectDelegationTarget(message: string): DelegationRoute | null {
  const lower = message.toLowerCase();

  // Single-word messages → Weebo handles directly (but allow 2+ word intents like "schedule meeting")
  if (lower.split(/\s+/).length <= 1) return null;

  for (const { pattern, agent, reason } of DELEGATION_PATTERNS) {
    if (pattern.test(lower)) {
      return { agent, reason };
    }
  }

  return null; // No clear specialist → Weebo handles
}

/**
 * Get today's delegation count for a user.
 */
export function getDelegationCount(userId: string): number {
  const today = new Date().toISOString().slice(0, 10);
  const row = db.prepare(
    'SELECT count FROM delegation_counts WHERE user_id = ? AND date = ?'
  ).get(userId, today) as { count: number } | undefined;
  return row?.count ?? 0;
}

/**
 * Get the delegation limit for a user's plan.
 */
export function getDelegationLimit(userPlan: string): number {
  return DELEGATION_LIMITS[userPlan] ?? DELEGATION_LIMITS.free;
}

/**
 * Increment the delegation counter. Returns the new count.
 */
export function incrementDelegation(userId: string): number {
  const today = new Date().toISOString().slice(0, 10);
  db.prepare(`
    INSERT INTO delegation_counts (user_id, date, count) VALUES (?, ?, 1)
    ON CONFLICT(user_id, date) DO UPDATE SET count = count + 1
  `).run(userId, today);

  const row = db.prepare(
    'SELECT count FROM delegation_counts WHERE user_id = ? AND date = ?'
  ).get(userId, today) as { count: number };
  return row.count;
}

/**
 * Check if a user can delegate (hasn't hit their daily limit).
 */
export function canDelegate(userId: string, userPlan: string): { allowed: boolean; used: number; limit: number; remaining: number } {
  const used = getDelegationCount(userId);
  const limit = getDelegationLimit(userPlan);
  const remaining = Math.max(0, limit - used);
  return { allowed: remaining > 0, used, limit, remaining };
}

/**
 * Atomically decrement delegation counter (for rollback on bridge failure).
 */
export function decrementDelegation(userId: string): void {
  const today = new Date().toISOString().slice(0, 10);
  db.prepare(
    'UPDATE delegation_counts SET count = MAX(0, count - 1) WHERE user_id = ? AND date = ?'
  ).run(userId, today);
}

/**
 * Full delegation check + routing (atomic increment).
 * Returns the target agent + delegation status, or null if Weebo handles directly.
 */
export function routeDelegation(
  userId: string,
  userPlan: string,
  message: string,
): { agent: string; reason: string; delegationCount: number; delegationLimit: number; remaining: number } | null {
  const target = detectDelegationTarget(message);
  if (!target) return null;

  const limit = getDelegationLimit(userPlan);
  const today = new Date().toISOString().slice(0, 10);

  // Atomic check-and-increment: only increment if under limit
  const result = db.prepare(`
    INSERT INTO delegation_counts (user_id, date, count) VALUES (?, ?, 1)
    ON CONFLICT(user_id, date) DO UPDATE SET count = count + 1
    WHERE delegation_counts.count < ?
  `).run(userId, today, limit);

  if (result.changes === 0) {
    logger.info({ userId, userPlan, limit, targetAgent: target.agent },
      'Delegation limit reached — Weebo handling directly');
    return null;
  }

  const row = db.prepare(
    'SELECT count FROM delegation_counts WHERE user_id = ? AND date = ?'
  ).get(userId, today) as { count: number };
  const newCount = row.count;

  logger.info({ userId, targetAgent: target.agent, reason: target.reason, count: newCount, limit },
    'Auto-delegating to specialist agent');

  return {
    agent: target.agent,
    reason: target.reason,
    delegationCount: newCount,
    delegationLimit: limit,
    remaining: limit - newCount,
  };
}
