// Dedicated Office API — single endpoint returns ALL data the Office page needs
import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { getAgentTasks, getTaskBoard, getAgentTaskStats } from '../services/agent-task-queue.js';
import { getRecentComms, getCommStats } from '../services/agent-comms.js';
import { getAllAgentStates, getRecentEvents } from '../services/agent-state-bus.js';
import { canDelegate } from '../services/delegation.js';

export const officeRouter = Router();

// GET /api/office/state — everything the Office page needs in ONE call
officeRouter.get('/state', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;

  // Agent states
  const agentStates = getAllAgentStates(userId);

  // Tasks
  const taskBoard = getTaskBoard(userId);
  const taskStats = getAgentTaskStats(userId);

  // Comms — append Z to timestamps so browser parses as UTC
  const comms = getRecentComms(userId, 30).map(c => ({
    ...c,
    created_at: c.created_at.endsWith('Z') ? c.created_at : c.created_at + 'Z',
  }));
  const commStats = getCommStats(userId);

  // Timeline: merge activity log + recent conversation (user messages + agent replies)
  const activityRows = (db.prepare(`
    SELECT action, details, icon, created_at
    FROM activity_log
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 30
  `).all(userId) as Array<{ action: string; details: string; icon: string; created_at: string }>)
    .map(t => ({
      ...t,
      type: 'activity' as const,
      created_at: t.created_at.endsWith('Z') ? t.created_at : t.created_at + 'Z',
    }));

  // User messages + agent replies for full conversation flow
  const chatRows = (db.prepare(`
    SELECT role, substr(content, 1, 120) as content, provider, created_at
    FROM conversation_log
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 30
  `).all(userId) as Array<{ role: string; content: string; provider: string; created_at: string }>)
    .map(r => ({
      action: r.role === 'user' ? 'User message' : 'Agent reply',
      details: r.content,
      icon: r.role === 'user' ? 'user' : 'bot',
      type: 'chat' as const,
      created_at: r.created_at.endsWith('Z') ? r.created_at : r.created_at + 'Z',
    }));

  // Merge, dedup, and sort by time
  // activity_log "X replied" entries are redundant when conversation_log has the actual content.
  // Drop any activity entry whose action matches a reply/message pattern — conversation_log
  // always has the richer data (actual message content vs just "Weebo replied").
  const replyPattern = /replied|agent reply|user message/i;
  const dedupedActivity = activityRows.filter(a => !replyPattern.test(a.action));
  const timeline = [...dedupedActivity, ...chatRows]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 50);

  // Tasks — fix timestamps
  const fixTaskDates = (tasks: Record<string, unknown[]>) => {
    const fixed: Record<string, unknown[]> = {};
    for (const [k, v] of Object.entries(tasks)) {
      fixed[k] = (v as Array<Record<string, unknown>>).map(t => ({
        ...t,
        created_at: typeof t.created_at === 'string' && !t.created_at.endsWith('Z') ? t.created_at + 'Z' : t.created_at,
        started_at: typeof t.started_at === 'string' && !t.started_at.endsWith('Z') ? t.started_at + 'Z' : t.started_at,
      }));
    }
    return fixed;
  };

  // Recent SSE events (last 30s) for canvas animations
  const sinceParam = req.query.since ? Number(req.query.since) : Date.now() - 30000;
  const recentEvents = getRecentEvents(userId, sinceParam);

  // Daily usage metrics — fail gracefully if tables are missing or empty
  const metricsData = (() => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const creditsUsed = db.prepare(
        `SELECT COALESCE(SUM(cost_usd), 0) as total FROM usage_events WHERE user_id = ? AND created_at LIKE ?`
      ).get(userId, `${today}%`) as { total: number } | undefined;
      const messagesToday = db.prepare(
        `SELECT COUNT(*) as c FROM conversation_log WHERE user_id = ? AND role = 'user' AND created_at LIKE ?`
      ).get(userId, `${today}%`) as { c: number } | undefined;
      const toolCallsRow = db.prepare(
        `SELECT COUNT(*) as c FROM usage_events WHERE user_id = ? AND tool != '' AND created_at LIKE ?`
      ).get(userId, `${today}%`) as { c: number } | undefined;
      const providerRows = db.prepare(
        `SELECT provider, COUNT(*) as c FROM usage_events WHERE user_id = ? AND created_at LIKE ? GROUP BY provider`
      ).all(userId, `${today}%`) as Array<{ provider: string; c: number }>;

      return {
        creditsUsedToday: creditsUsed?.total ?? 0,
        messagesToday: messagesToday?.c ?? 0,
        toolCallsToday: toolCallsRow?.c ?? taskStats.completedToday ?? 0,
        providerBreakdown: Object.fromEntries(providerRows.map(r => [r.provider, r.c])),
      };
    } catch {
      return { creditsUsedToday: 0, messagesToday: 0, toolCallsToday: 0, providerBreakdown: {} };
    }
  })();

  // Delegation status for the metrics panel
  const sub = db.prepare('SELECT plan FROM subscriptions WHERE user_id = ?').get(userId) as { plan: string } | undefined;
  const userPlan = sub?.plan || 'free';
  const delegationStatus = { ...canDelegate(userId, userPlan), plan: userPlan };

  res.json({
    recentEvents,
    agentStates,
    taskBoard: fixTaskDates(taskBoard),
    taskStats,
    comms,
    commStats,
    timeline,
    metrics: metricsData,
    delegationStatus,
  });
});
