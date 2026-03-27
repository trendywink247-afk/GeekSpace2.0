// ============================================================
// Agent Task Queue Routes — Per-agent task management
// ============================================================

import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../../../middleware/auth.js';
import {
  createAgentTask,
  getAgentTasks,
  getTaskBoard,
  getAgentTaskStats,
  startTask,
  completeTask,
  failTask,
  reassignTask,
  cancelTask,
  type AgentId,
  type TaskStatus,
} from '../services/agent-task-queue.js';

export const agentTasksRouter = Router();

// GET /api/agent-tasks — list tasks with optional filters
agentTasksRouter.get('/', requireAuth, (req: AuthRequest, res) => {
  const agentId = req.query.agent_id as AgentId | undefined;
  const status = req.query.status as TaskStatus | undefined;
  const limit = parseInt(req.query.limit as string) || 50;
  const tasks = getAgentTasks(req.userId!, agentId, status, limit);
  res.json(tasks);
});

// GET /api/agent-tasks/board — kanban-style task board
agentTasksRouter.get('/board', requireAuth, (req: AuthRequest, res) => {
  const board = getTaskBoard(req.userId!);
  res.json(board);
});

// GET /api/agent-tasks/stats — task statistics
agentTasksRouter.get('/stats', requireAuth, (req: AuthRequest, res) => {
  const agentId = req.query.agent_id as AgentId | undefined;
  const stats = getAgentTaskStats(req.userId!, agentId);
  res.json(stats);
});

// POST /api/agent-tasks — create a new task
agentTasksRouter.post('/', requireAuth, (req: AuthRequest, res) => {
  const { agent_id, title, description, priority } = req.body as {
    agent_id: AgentId;
    title: string;
    description?: string;
    priority?: number;
  };

  if (!agent_id || !title) {
    res.status(400).json({ error: 'agent_id and title are required' });
    return;
  }

  if (!['weebo', 'edith', 'jarvis'].includes(agent_id)) {
    res.status(400).json({ error: 'agent_id must be weebo, edith, or jarvis' });
    return;
  }

  const task = createAgentTask(req.userId!, agent_id, title, description, priority);
  res.status(201).json(task);
});

// PATCH /api/agent-tasks/:id — update task status
agentTasksRouter.patch('/:id', requireAuth, (req: AuthRequest, res) => {
  const { id } = req.params;
  const { action, result, error, new_agent_id } = req.body as {
    action: 'start' | 'complete' | 'fail' | 'cancel' | 'reassign';
    result?: string;
    error?: string;
    new_agent_id?: AgentId;
  };

  let success = false;
  switch (action) {
    case 'start': success = startTask(id); break;
    case 'complete': success = completeTask(id, result); break;
    case 'fail': success = failTask(id, error || 'Unknown error'); break;
    case 'cancel': success = cancelTask(id); break;
    case 'reassign':
      if (!new_agent_id) { res.status(400).json({ error: 'new_agent_id required for reassign' }); return; }
      success = reassignTask(id, new_agent_id);
      break;
    default:
      res.status(400).json({ error: 'action must be start, complete, fail, cancel, or reassign' });
      return;
  }

  if (!success) {
    res.status(404).json({ error: 'Task not found or invalid state transition' });
    return;
  }

  res.json({ success: true });
});
