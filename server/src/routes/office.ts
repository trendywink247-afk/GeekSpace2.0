// Dedicated Office API — single endpoint returns ALL data the Office page needs
import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { getAgentTasks, getTaskBoard, getAgentTaskStats } from '../services/agent-task-queue.js';
import { getRecentComms, getCommStats } from '../services/agent-comms.js';
import { getAllAgentStates, getRecentEvents } from '../services/agent-state-bus.js';

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

  // Recent activity (for timeline) — fix UTC timestamps
  const timeline = (db.prepare(`
    SELECT action, details, icon, created_at
    FROM activity_log
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(userId) as Array<{ action: string; details: string; icon: string; created_at: string }>)
    .map(t => ({ ...t, created_at: t.created_at.endsWith('Z') ? t.created_at : t.created_at + 'Z' }));

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

  res.json({
    recentEvents,
    agentStates,
    taskBoard: fixTaskDates(taskBoard),
    taskStats,
    comms,
    commStats,
    timeline,
  });
});
