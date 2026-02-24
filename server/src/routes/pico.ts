// ============================================================
// PicoClaw Fleet — REST API
//
// Endpoints for managing Pico agents (slot-based, max 6) and
// tasks (plan via Kimi, list, cancel).
// ============================================================

import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import {
  validateBody,
  validateQuery,
  picoAgentCreateSchema,
  picoAgentUpdateSchema,
  picoTaskPlanSchema,
  picoTaskQuerySchema,
  picoCronJobCreateSchema,
  picoCronJobUpdateSchema,
} from '../middleware/validate.js';
import {
  getUserAgents,
  createAgent,
  updateAgent,
  deleteAgent,
  getUserTasks,
  getTaskWithLogs,
  cancelTask,
  planTasks,
  planWithKimi,
  queueTasks,
  getUserCronJobs,
  createCronJob,
  updateCronJob,
  deleteCronJob,
} from '../services/pico-fleet.js';
import { db } from '../db/index.js';

// ---- Helpers ----

function db_getSub(userId: string) {
  return db.prepare('SELECT credits_remaining FROM subscriptions WHERE user_id = ?')
    .get(userId) as { credits_remaining: number } | undefined;
}

function db_getPlan(userId: string): string {
  const row = db.prepare('SELECT plan FROM subscriptions WHERE user_id = ?')
    .get(userId) as { plan: string } | undefined;
  return row?.plan || 'free';
}

export const picoRouter = Router();

// ---- Agents ----

picoRouter.get('/agents', requireAuth, (req: AuthRequest, res) => {
  const agents = getUserAgents(req.userId!);
  res.json(agents);
});

picoRouter.post('/agents', requireAuth, validateBody(picoAgentCreateSchema), (req: AuthRequest, res) => {
  try {
    const agent = createAgent(req.userId!, req.body.name, req.body.personality);
    res.status(201).json(agent);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create agent';
    res.status(400).json({ error: msg });
  }
});

picoRouter.patch('/agents/:id', requireAuth, validateBody(picoAgentUpdateSchema), (req: AuthRequest, res) => {
  try {
    const agent = updateAgent(req.params.id, req.userId!, req.body);
    res.json(agent);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update agent';
    const status = msg.includes('not found') ? 404 : 400;
    res.status(status).json({ error: msg });
  }
});

picoRouter.delete('/agents/:id', requireAuth, (req: AuthRequest, res) => {
  try {
    deleteAgent(req.params.id, req.userId!);
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to delete agent';
    const status = msg.includes('not found') ? 404 : 400;
    res.status(status).json({ error: msg });
  }
});

// ---- Tasks ----

picoRouter.get('/tasks', requireAuth, validateQuery(picoTaskQuerySchema), (req: AuthRequest, res) => {
  const query = req.query as { status?: string; slot?: string; limit?: string };
  const tasks = getUserTasks(req.userId!, {
    status: query.status,
    slot: query.slot ? parseInt(query.slot, 10) : undefined,
    limit: query.limit ? parseInt(query.limit, 10) : undefined,
  });
  res.json(tasks);
});

picoRouter.post('/tasks/plan', requireAuth, validateBody(picoTaskPlanSchema), async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { request } = req.body as { request: string };

  try {
    // Check credits
    const sub = db_getSub(userId);
    const userPlan = db_getPlan(userId);

    if (sub && sub.credits_remaining < 10) {
      res.status(402).json({ error: 'Not enough credits for task planning (minimum 10 required)' });
      return;
    }

    // Plan — routes based on complexity and plan tier
    const { tasks, creditCost } = await planTasks(userId, request, userPlan);

    if (tasks.length === 0) {
      res.json({ planned: [], queued: 0, credits_used: creditCost, message: 'No actionable tasks could be planned from your request.' });
      return;
    }

    // Queue tasks
    const taskIds = queueTasks(userId, tasks, creditCost === 0 ? 'weebo' : 'kimi');

    const updatedSub = db_getSub(userId);

    res.json({
      tasks: tasks.map((t, i) => ({ id: taskIds[i], task_type: t.task_type, description: t.description, agent_slot: t.agent_slot })),
      creditCost: creditCost,
      queued: taskIds.length,
      task_ids: taskIds,
      credits_remaining: updatedSub?.credits_remaining ?? 0,
    });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'ESCALATE_TO_PREMIUM') {
      res.json({
        escalate: true,
        message: "This task looks complex. Want Edith (Kimi) to handle it? It costs ~10 credits but gets better results.",
        request,
      });
      return;
    }
    const msg = err instanceof Error ? err.message : 'Failed to plan tasks';
    res.status(500).json({ error: msg });
  }
});

// POST /tasks/plan-premium — user confirmed they want Kimi for a complex task
picoRouter.post('/tasks/plan-premium', requireAuth, validateBody(picoTaskPlanSchema), async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { request } = req.body as { request: string };

  try {
    const sub = db_getSub(userId);
    if (sub && sub.credits_remaining < 10) {
      res.status(402).json({ error: 'Not enough credits for task planning (minimum 10 required)' });
      return;
    }

    const { tasks, creditCost } = await planWithKimi(userId, request);

    if (tasks.length === 0) {
      res.json({ planned: [], queued: 0, credits_used: creditCost, message: 'No actionable tasks could be planned from your request.' });
      return;
    }

    const taskIds = queueTasks(userId, tasks, 'kimi');
    const updatedSub = db_getSub(userId);

    res.json({
      tasks: tasks.map((t, i) => ({ id: taskIds[i], task_type: t.task_type, description: t.description, agent_slot: t.agent_slot })),
      creditCost: creditCost,
      queued: taskIds.length,
      task_ids: taskIds,
      credits_remaining: updatedSub?.credits_remaining ?? 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to plan tasks with Kimi';
    res.status(500).json({ error: msg });
  }
});

picoRouter.get('/tasks/:id', requireAuth, (req: AuthRequest, res) => {
  const result = getTaskWithLogs(req.params.id, req.userId!);
  if (!result) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  res.json(result);
});

picoRouter.delete('/tasks/:id', requireAuth, (req: AuthRequest, res) => {
  try {
    cancelTask(req.params.id, req.userId!);
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to cancel task';
    const status = msg.includes('not found') ? 404 : 400;
    res.status(status).json({ error: msg });
  }
});

// ---- Cron Jobs ----

picoRouter.get('/cron-jobs', requireAuth, (req: AuthRequest, res) => {
  const jobs = getUserCronJobs(req.userId!);
  res.json(jobs);
});

picoRouter.post('/cron-jobs', requireAuth, validateBody(picoCronJobCreateSchema), (req: AuthRequest, res) => {
  try {
    const job = createCronJob(req.userId!, req.body);
    res.status(201).json(job);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create cron job';
    res.status(400).json({ error: msg });
  }
});

picoRouter.patch('/cron-jobs/:id', requireAuth, validateBody(picoCronJobUpdateSchema), (req: AuthRequest, res) => {
  try {
    const job = updateCronJob(req.params.id, req.userId!, req.body);
    res.json(job);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update cron job';
    res.status(400).json({ error: msg });
  }
});

picoRouter.delete('/cron-jobs/:id', requireAuth, (req: AuthRequest, res) => {
  try {
    deleteCronJob(req.params.id, req.userId!);
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to delete cron job';
    res.status(400).json({ error: msg });
  }
});
