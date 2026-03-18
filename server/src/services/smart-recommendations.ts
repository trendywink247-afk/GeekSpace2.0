// ============================================================
// Smart Recommendations — Personalized feature suggestions
//
// Analyzes user behavior patterns and generates contextual
// recommendations for underused features. Feeds the "Discover"
// section on the Overview page and the onboarding flow.
// ============================================================

import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { cacheGet, cacheSet } from './cache.js';

export interface Recommendation {
  feature: string;
  reason: string;
  cta: string;
  ctaPath: string;
  score: number;
  icon: string;
}

// ── Feature definitions ─────────────────────────────────────

interface FeatureCheck {
  feature: string;
  icon: string;
  ctaPath: string;
  check: (userId: string) => { used: boolean; count: number };
  reason: (count: number) => string;
  cta: string;
}

const FEATURE_CHECKS: FeatureCheck[] = [
  {
    feature: 'automations',
    icon: 'Zap',
    ctaPath: '/dashboard/automations',
    check: (userId) => {
      const row = db.prepare('SELECT COUNT(*) as count FROM automations WHERE user_id = ?').get(userId) as { count: number };
      return { used: row.count > 0, count: row.count };
    },
    reason: (count) => count === 0
      ? 'You haven\'t set up any automations yet. Automate your morning routine!'
      : `You have ${count} automation${count === 1 ? '' : 's'}. Create more to save time!`,
    cta: 'Set up your first automation',
  },
  {
    feature: 'social-media',
    icon: 'Share2',
    ctaPath: '/dashboard/social-media',
    check: (userId) => {
      const row = db.prepare("SELECT COUNT(*) as count FROM activity_log WHERE user_id = ? AND action LIKE '%social%'").get(userId) as { count: number };
      return { used: row.count > 0, count: row.count };
    },
    reason: () => 'Schedule and manage your social media posts with AI assistance.',
    cta: 'Try Social Media Manager',
  },
  {
    feature: 'portfolio',
    icon: 'User',
    ctaPath: '/dashboard/portfolio',
    check: (userId) => {
      const row = db.prepare('SELECT COUNT(*) as count FROM portfolios WHERE user_id = ? AND about != \'\'').get(userId) as { count: number };
      return { used: row.count > 0, count: row.count };
    },
    reason: (count) => count === 0
      ? 'Create your public portfolio to showcase your work and connect with others.'
      : 'Your portfolio is live! Add more projects to make it shine.',
    cta: 'Build your portfolio',
  },
  {
    feature: 'voice-chat',
    icon: 'Mic',
    ctaPath: '/dashboard/voice',
    check: (userId) => {
      const row = db.prepare("SELECT COUNT(*) as count FROM activity_log WHERE user_id = ? AND action LIKE '%voice%'").get(userId) as { count: number };
      return { used: row.count > 0, count: row.count };
    },
    reason: () => 'Talk to your agents instead of typing. Voice chat is faster!',
    cta: 'Try Voice Chat',
  },
  {
    feature: 'calendar',
    icon: 'Calendar',
    ctaPath: '/dashboard/calendar',
    check: (userId) => {
      const row = db.prepare("SELECT google_calendar_token FROM users WHERE id = ?").get(userId) as { google_calendar_token: string | null } | undefined;
      return { used: !!row?.google_calendar_token, count: row?.google_calendar_token ? 1 : 0 };
    },
    reason: (count) => count === 0
      ? 'Connect Google Calendar to let your agents manage your schedule.'
      : 'Calendar connected! Ask Jarvis to find free slots or schedule meetings.',
    cta: 'Connect Calendar',
  },
  {
    feature: 'gmail',
    icon: 'Mail',
    ctaPath: '/dashboard/gmail',
    check: (userId) => {
      const row = db.prepare("SELECT google_gmail_token FROM users WHERE id = ?").get(userId) as { google_gmail_token: string | null } | undefined;
      return { used: !!row?.google_gmail_token, count: row?.google_gmail_token ? 1 : 0 };
    },
    reason: (count) => count === 0
      ? 'Connect Gmail for AI-powered email triage, smart replies, and follow-up reminders.'
      : 'Gmail connected! Try asking for a summary of unread emails.',
    cta: 'Connect Gmail',
  },
  {
    feature: 'habits',
    icon: 'Target',
    ctaPath: '/dashboard/focus',
    check: (userId) => {
      const row = db.prepare("SELECT COUNT(*) as count FROM activity_log WHERE user_id = ? AND action LIKE '%habit%'").get(userId) as { count: number };
      return { used: row.count > 0, count: row.count };
    },
    reason: (count) => count === 0
      ? 'Start tracking daily habits and build streaks with AI coaching.'
      : `You've logged ${count} habit entries. Keep the streak going!`,
    cta: 'Start a Habit',
  },
  {
    feature: 'website-builder',
    icon: 'Globe',
    ctaPath: '/dashboard/website-builder',
    check: (userId) => {
      const row = db.prepare('SELECT COUNT(*) as count FROM generated_artifacts WHERE user_id = ?').get(userId) as { count: number };
      return { used: row.count > 0, count: row.count };
    },
    reason: (count) => count === 0
      ? 'Build a website by just describing what you want. No code needed!'
      : `You've created ${count} site${count === 1 ? '' : 's'}. Deploy it with one click!`,
    cta: 'Build a Website',
  },
  {
    feature: 'docs',
    icon: 'FileText',
    ctaPath: '/dashboard/docs',
    check: (userId) => {
      const row = db.prepare("SELECT COUNT(*) as count FROM docs WHERE user_id = ?").get(userId) as { count: number };
      return { used: row.count > 0, count: row.count };
    },
    reason: (count) => count === 0
      ? 'Create documents with AI-powered writing assistance.'
      : `You have ${count} doc${count === 1 ? '' : 's'}. Try the AI writing toolbar!`,
    cta: 'Create a Document',
  },
  {
    feature: 'workflows',
    icon: 'Workflow',
    ctaPath: '/dashboard/workflows',
    check: (userId) => {
      const row = db.prepare('SELECT COUNT(*) as count FROM workflows WHERE user_id = ?').get(userId) as { count: number };
      return { used: row.count > 0, count: row.count };
    },
    reason: (count) => count === 0
      ? 'Create multi-step agent workflows: research → write → design → publish.'
      : `You have ${count} workflow${count === 1 ? '' : 's'}. Try chaining agents together!`,
    cta: 'Create a Workflow',
  },
];

// ── Generate recommendations ────────────────────────────────

export async function getRecommendations(userId: string, limit = 5): Promise<Recommendation[]> {
  // Check cache first (5 minute TTL)
  const cacheKey = `recs:${userId}`;
  try {
    const cached = await cacheGet(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch { /* cache miss */ }

  const recommendations: Recommendation[] = [];

  for (const check of FEATURE_CHECKS) {
    try {
      const { used, count } = check.check(userId);

      // Score: unused features get higher scores, low-usage features get medium scores
      let score = 0;
      if (!used) {
        score = 0.8; // High priority: feature not used at all
      } else if (count < 3) {
        score = 0.4; // Medium: barely used
      } else {
        score = 0.1; // Low: actively used
      }

      // Only recommend features with score > 0.3 (unused or barely used)
      if (score > 0.3) {
        recommendations.push({
          feature: check.feature,
          reason: check.reason(count),
          cta: check.cta,
          ctaPath: check.ctaPath,
          score,
          icon: check.icon,
        });
      }
    } catch (err) {
      logger.debug({ feature: check.feature, error: (err as Error).message }, 'recommendation check failed');
    }
  }

  // Sort by score descending, take top N
  recommendations.sort((a, b) => b.score - a.score);
  const result = recommendations.slice(0, limit);

  // Cache for 5 minutes
  try {
    await cacheSet(cacheKey, JSON.stringify(result), 300);
  } catch { /* cache failure non-fatal */ }

  return result;
}

// ── Dismiss a recommendation ────────────────────────────────

export function dismissRecommendation(userId: string, feature: string): void {
  try {
    db.prepare(`
      INSERT INTO smart_recommendations (id, user_id, feature, reason, cta, score, dismissed)
      VALUES (?, ?, ?, '', '', 0, 1)
      ON CONFLICT(user_id, feature) DO UPDATE SET dismissed = 1
    `).run(`${userId}:${feature}`, userId, feature);
  } catch (err) {
    logger.debug({ userId, feature, error: (err as Error).message }, 'dismiss recommendation failed');
  }
}

export function isDismissed(userId: string, feature: string): boolean {
  try {
    const row = db.prepare(
      'SELECT dismissed FROM smart_recommendations WHERE user_id = ? AND feature = ?'
    ).get(userId, feature) as { dismissed: number } | undefined;
    return row?.dismissed === 1;
  } catch {
    return false;
  }
}
