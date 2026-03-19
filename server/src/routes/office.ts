// Dedicated Office API — single endpoint returns ALL data the Office page needs
import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { getAgentTasks, getTaskBoard, getAgentTaskStats } from '../services/agent-task-queue.js';
import { getRecentComms, getCommStats } from '../services/agent-comms.js';
import { getAllAgentStates } from '../services/agent-state-bus.js';

export const officeRouter = Router();

// GET /api/office/state — everything the Office page needs in ONE call
officeRouter.get('/state', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;

  // Agent states
  const agentStates = getAllAgentStates(userId);

  // Tasks
  const taskBoard = getTaskBoard(userId);
  const taskStats = getAgentTaskStats(userId);

  // Comms
  const comms = getRecentComms(userId, 30);
  const commStats = getCommStats(userId);

  // Recent activity (for timeline)
  const timeline = db.prepare(`
    SELECT action, details, icon, created_at
    FROM activity_log
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(userId) as Array<{ action: string; details: string; icon: string; created_at: string }>;

  res.json({
    agentStates,
    taskBoard,
    taskStats,
    comms,
    commStats,
    timeline,
  });
});
