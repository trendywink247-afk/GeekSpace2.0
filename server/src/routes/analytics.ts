// Analytics Routes -- Phase 102 + GAP-7 AI Insights
import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import {
  getDailySnapshots,
  getWeeklySummary,
  getActivityHeatmap,
  getAgentUsage,
  getTopics,
} from '../services/analytics.js';
import { cacheGet, cacheSet } from '../services/cache.js';
import { routeChat } from '../services/llm.js';
import { db } from '../db/index.js';
import { logger } from '../logger.js';

export const analyticsRouter = Router();

analyticsRouter.use(requireAuth);

// GET /api/analytics/snapshot -- last 30 days of DailySnapshot
analyticsRouter.get('/snapshot', async (req, res) => {
  const userId = (req as AuthRequest).userId!;
  const days = Math.max(1, Math.min(parseInt((req.query.days as string) || '30', 10), 365));
  try {
    const snapshots = await getDailySnapshots(userId, days);
    res.json({ snapshots });
  } catch (err) {
    logger.error({ err, userId }, 'Analytics snapshot failed');
    res.status(500).json({ error: 'Failed to fetch snapshots' });
  }
});

// GET /api/analytics/weekly -- current week summary with AI insight
analyticsRouter.get('/weekly', async (req, res) => {
  const userId = (req as AuthRequest).userId!;
  try {
    const summary = await getWeeklySummary(userId);
    res.json({ summary });
  } catch (err) {
    logger.error({ err, userId }, 'Analytics weekly summary failed');
    res.status(500).json({ error: 'Failed to fetch weekly summary' });
  }
});

// GET /api/analytics/heatmap -- last 365 days activity heatmap
analyticsRouter.get('/heatmap', async (req, res) => {
  const userId = (req as AuthRequest).userId!;
  try {
    const heatmap = await getActivityHeatmap(userId);
    res.json({ heatmap });
  } catch (err) {
    logger.error({ err, userId }, 'Analytics heatmap failed');
    res.status(500).json({ error: 'Failed to fetch heatmap' });
  }
});

// GET /api/analytics/agents -- agent usage last 30 days
analyticsRouter.get('/agents', async (req, res) => {
  const userId = (req as AuthRequest).userId!;
  const days = Math.max(1, Math.min(parseInt((req.query.days as string) || '30', 10), 365));
  try {
    const agents = await getAgentUsage(userId, days);
    res.json({ agents });
  } catch (err) {
    logger.error({ err, userId }, 'Analytics agent usage failed');
    res.status(500).json({ error: 'Failed to fetch agent usage' });
  }
});

// GET /api/analytics/topics -- top topics from memories + notes
analyticsRouter.get('/topics', async (req, res) => {
  const userId = (req as AuthRequest).userId!;
  try {
    const topics = await getTopics(userId);
    res.json({ topics });
  } catch (err) {
    logger.error({ err, userId }, 'Analytics topics failed');
    res.status(500).json({ error: 'Failed to fetch topics' });
  }
});

// ── GAP-7: AI-Generated Insights ─────────────────────────────

interface InsightItem {
  icon: string;
  text: string;
  type: 'positive' | 'warning' | 'tip' | 'achievement';
}

function safeCount(sql: string, ...params: unknown[]): number {
  try {
    const row = db.prepare(sql).get(...(params as [])) as { c: number } | undefined;
    return row?.c ?? 0;
  } catch {
    return 0;
  }
}

function generateFallbackInsights(data: {
  messagesThisWeek: number;
  habitsCompletionRate: number;
  remindersCompletionRate: number;
  mostActiveHour: number;
  focusMinutes: number;
  longestStreak: number;
}): InsightItem[] {
  const insights: InsightItem[] = [];
  const fmtHour = (h: number) => {
    if (h === 0) return '12am';
    if (h === 12) return '12pm';
    return h < 12 ? `${h}am` : `${h - 12}pm`;
  };

  if (data.messagesThisWeek > 20) {
    insights.push({ icon: '\u{1F4AC}', text: `${data.messagesThisWeek} conversations this week -- power user!`, type: 'achievement' });
  } else if (data.messagesThisWeek > 0) {
    insights.push({ icon: '\u{1F4AC}', text: `${data.messagesThisWeek} conversations this week`, type: 'positive' });
  } else {
    insights.push({ icon: '\u{1F4A1}', text: 'Start chatting more to unlock deeper insights', type: 'tip' });
  }

  if (data.habitsCompletionRate >= 80) {
    insights.push({ icon: '\u{1F525}', text: `${data.habitsCompletionRate}% habit completion -- outstanding consistency`, type: 'achievement' });
  } else if (data.habitsCompletionRate >= 40) {
    insights.push({ icon: '\u{2705}', text: `${data.habitsCompletionRate}% habit completion -- building momentum`, type: 'positive' });
  } else {
    insights.push({ icon: '\u{26A0}\uFE0F', text: 'Habit completion is low -- try smaller daily goals', type: 'warning' });
  }

  if (data.focusMinutes > 0) {
    const hours = Math.round(data.focusMinutes / 60 * 10) / 10;
    insights.push({ icon: '\u{1F3AF}', text: `${hours}h of deep focus this week`, type: 'positive' });
  } else {
    insights.push({ icon: '\u{1F4A1}', text: 'Try a 25-minute focus session today', type: 'tip' });
  }

  if (data.mostActiveHour >= 0) {
    insights.push({ icon: '\u{23F0}', text: `You're most active around ${fmtHour(data.mostActiveHour)}`, type: 'tip' });
  } else if (data.longestStreak > 0) {
    insights.push({ icon: '\u{1F3C6}', text: `Longest habit streak: ${data.longestStreak} days`, type: 'achievement' });
  } else {
    insights.push({ icon: '\u{1F680}', text: 'Set up habits and reminders to unlock streaks', type: 'tip' });
  }

  return insights.slice(0, 4);
}

// GET /api/analytics/insights -- AI-powered personalized insights
analyticsRouter.get('/insights', async (req, res) => {
  const userId = (req as AuthRequest).userId!;
  const refresh = req.query.refresh === 'true';
  const cacheKey = `insights:${userId}`;

  try {
    // Check Redis cache (unless forced refresh)
    if (!refresh) {
      const cached = await cacheGet(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as { insights: InsightItem[]; generatedAt: string };
          res.json(parsed);
          return;
        } catch { /* stale cache -- regenerate */ }
      }
    }

    // Gather user data for the past week
    const weekAgoMs = Date.now() - 7 * 86_400_000;
    const weekAgoSec = weekAgoMs / 1000;

    const messagesThisWeek = safeCount(
      `SELECT COUNT(*) as c FROM conversation_log WHERE user_id = ? AND role = 'user'
       AND datetime(created_at) >= datetime(?, 'unixepoch')`,
      userId, weekAgoSec
    );

    // Habits completion rate: logs this week vs active habits * 7
    let habitsCompletionRate = 0;
    try {
      const activeHabits = safeCount('SELECT COUNT(*) as c FROM habits WHERE user_id = ?', userId);
      const habitLogs = safeCount(
        'SELECT COUNT(*) as c FROM habit_logs WHERE user_id = ? AND logged_at >= ?',
        userId, weekAgoMs
      );
      const expected = activeHabits * 7;
      habitsCompletionRate = expected > 0 ? Math.round((habitLogs / expected) * 100) : 0;
    } catch { /* table may not exist */ }

    // Reminders completion rate this week
    let remindersCompletionRate = 0;
    try {
      const totalReminders = safeCount(
        `SELECT COUNT(*) as c FROM reminders WHERE user_id = ? AND datetime(created_at) >= datetime(?, 'unixepoch')`,
        userId, weekAgoSec
      );
      const completedReminders = safeCount(
        `SELECT COUNT(*) as c FROM reminders WHERE user_id = ? AND completed = 1 AND datetime(created_at) >= datetime(?, 'unixepoch')`,
        userId, weekAgoSec
      );
      remindersCompletionRate = totalReminders > 0 ? Math.round((completedReminders / totalReminders) * 100) : 0;
    } catch { /* ignore */ }

    // Most active hour
    let mostActiveHour = -1;
    try {
      const hourRow = db.prepare(
        `SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour, COUNT(*) as cnt
         FROM conversation_log WHERE user_id = ? AND role = 'user'
         AND datetime(created_at) >= datetime(?, 'unixepoch')
         GROUP BY hour ORDER BY cnt DESC LIMIT 1`
      ).get(userId, weekAgoSec) as { hour: number; cnt: number } | undefined;
      if (hourRow) mostActiveHour = hourRow.hour;
    } catch { /* ignore */ }

    // Focus minutes this week
    let focusMinutes = 0;
    try {
      const focusRow = db.prepare(
        'SELECT COALESCE(SUM(duration_min), 0) as total FROM focus_sessions WHERE user_id = ? AND started_at >= ?'
      ).get(userId, weekAgoMs) as { total: number } | undefined;
      focusMinutes = focusRow?.total ?? 0;
    } catch { /* ignore */ }

    // Longest streak from habits
    let longestStreak = 0;
    try {
      const streakRow = db.prepare(
        'SELECT MAX(longest_streak) as s FROM habits WHERE user_id = ?'
      ).get(userId) as { s: number | null } | undefined;
      longestStreak = streakRow?.s ?? 0;
    } catch { /* ignore */ }

    const userData = {
      messagesThisWeek,
      habitsCompletionRate,
      remindersCompletionRate,
      mostActiveHour,
      focusMinutes,
      longestStreak,
    };

    // Try LLM-generated insights via Groq
    let insights: InsightItem[];
    try {
      const systemPrompt =
        'You are a personal productivity analyst. Return ONLY a valid JSON array of 4 objects, ' +
        'each with icon (emoji), text (max 15 words), and type (positive|warning|tip|achievement). ' +
        'Be specific and data-driven. No markdown, no code fences.';

      const userMessage = `Here is my weekly data:\n${JSON.stringify(userData, null, 2)}\n\nGenerate 4 personalized insights.`;

      const llmResult = await routeChat(
        [{ role: 'user', content: userMessage }],
        { userId, systemPrompt, forceProvider: 'groq' }
      );

      // Parse LLM response -- strip code fences if present
      let cleanReply = llmResult.reply.trim();
      cleanReply = cleanReply.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

      const parsed = JSON.parse(cleanReply) as InsightItem[];
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].text && parsed[0].type) {
        insights = parsed.slice(0, 4);
      } else {
        insights = generateFallbackInsights(userData);
      }
    } catch (llmErr) {
      logger.debug({ err: llmErr, userId }, 'LLM insights generation failed, using fallback');
      insights = generateFallbackInsights(userData);
    }

    const result = { insights, generatedAt: new Date().toISOString() };

    // Cache for 1 hour
    await cacheSet(cacheKey, JSON.stringify(result), 3600);

    res.json(result);
  } catch (err) {
    logger.error({ err, userId }, 'Analytics insights failed');
    res.status(500).json({ error: 'Failed to generate insights' });
  }
});
