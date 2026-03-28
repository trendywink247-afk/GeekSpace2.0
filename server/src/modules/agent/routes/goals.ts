// ============================================================
// Goal Routes — REST API for the Agentic Goal System
//
// Mounted at /api/agent/goals
// ============================================================

import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../../../middleware/auth.js';
import { logger } from '../../../logger.js';
import {
  createGoal, getGoal, getGoalWithSteps, getUserGoals, updateGoal, deleteGoal,
  addStep, getGoalSteps, updateStepStatus, getGoalEvents,
  planGoal, executeNextStep, getGoalStats, getActionableGoals,
  createWorkspaceArtifact, getWorkspaceArtifacts, updateWorkspaceArtifact, deleteWorkspaceArtifact,
} from '../services/goal-service.js';
import type { GoalStatus, StepStatus, CreateGoalRequest, UpdateGoalRequest, CreateStepRequest } from '../types/goals.js';

const router = Router();

// ── Goals CRUD ──────────────────────────────────────────────

// GET /goals — list user's goals
router.get('/goals', requireAuth, (req, res) => {
  const authReq = req as AuthRequest;
  const status = req.query.status as GoalStatus | undefined;
  const limit = Math.max(1, Math.min(Number(req.query.limit) || 50, 100));
  const goals = getUserGoals(authReq.userId!, status, limit);
  res.json({ goals });
});

// GET /goals/stats — goal statistics
router.get('/goals/stats', requireAuth, (req, res) => {
  const authReq = req as AuthRequest;
  const stats = getGoalStats(authReq.userId!);
  res.json(stats);
});

// GET /goals/actionable — goals with executable next steps
router.get('/goals/actionable', requireAuth, (req, res) => {
  const authReq = req as AuthRequest;
  const actionable = getActionableGoals(authReq.userId!);
  res.json({ actionable });
});

// POST /goals — create a new goal
router.post('/goals', requireAuth, (req, res) => {
  const authReq = req as AuthRequest;
  const body = req.body as CreateGoalRequest;

  if (!body.title || body.title.trim().length === 0) {
    res.status(400).json({ error: 'Title is required' });
    return;
  }

  const goal = createGoal(authReq.userId!, {
    title: body.title.trim(),
    description: body.description?.trim(),
    category: body.category,
    target_date: body.target_date,
    priority: body.priority,
    parent_goal_id: body.parent_goal_id,
  });

  res.status(201).json({ goal });
});

// GET /goals/:id — get goal with steps
router.get('/goals/:id', requireAuth, (req, res) => {
  const authReq = req as AuthRequest;
  const goal = getGoalWithSteps(req.params.id);

  if (!goal || goal.user_id !== authReq.userId!) {
    res.status(404).json({ error: 'Goal not found' });
    return;
  }

  res.json({ goal });
});

// PATCH /goals/:id — update a goal
router.patch('/goals/:id', requireAuth, (req, res) => {
  const authReq = req as AuthRequest;
  const updates = req.body as UpdateGoalRequest;
  const goal = updateGoal(req.params.id, authReq.userId!, updates);

  if (!goal) {
    res.status(404).json({ error: 'Goal not found' });
    return;
  }

  res.json({ goal });
});

// DELETE /goals/:id — delete a goal
router.delete('/goals/:id', requireAuth, (req, res) => {
  const authReq = req as AuthRequest;
  const deleted = deleteGoal(req.params.id, authReq.userId!);

  if (!deleted) {
    res.status(404).json({ error: 'Goal not found' });
    return;
  }

  res.json({ success: true });
});

// ── Goal Planning (AI) ─────────────────────────────────────

// POST /goals/:id/plan — AI decomposes goal into steps
router.post('/goals/:id/plan', requireAuth, async (req, res) => {
  const authReq = req as AuthRequest;
  try {
    const plan = await planGoal(req.params.id, authReq.userId!);
    if (!plan) {
      res.status(404).json({ error: 'Goal not found or planning failed' });
      return;
    }
    res.json({ plan });
  } catch (err) {
    logger.error({ err }, 'goal:plan route error');
    res.status(500).json({ error: 'Planning failed' });
  }
});

// POST /goals/:id/execute — execute next available step
router.post('/goals/:id/execute', requireAuth, async (req, res) => {
  const authReq = req as AuthRequest;
  try {
    const step = await executeNextStep(req.params.id, authReq.userId!);
    if (!step) {
      res.status(404).json({ error: 'No actionable step found' });
      return;
    }
    res.json({ step });
  } catch (err) {
    logger.error({ err }, 'goal:execute route error');
    res.status(500).json({ error: 'Execution failed' });
  }
});

// ── Goal Steps ──────────────────────────────────────────────

// GET /goals/:id/steps — list steps for a goal
router.get('/goals/:id/steps', requireAuth, (req, res) => {
  const authReq = req as AuthRequest;
  const goal = getGoal(req.params.id);
  if (!goal || goal.user_id !== authReq.userId!) {
    res.status(404).json({ error: 'Goal not found' });
    return;
  }
  const steps = getGoalSteps(req.params.id);
  res.json({ steps });
});

// POST /goals/:id/steps — add a step manually
router.post('/goals/:id/steps', requireAuth, (req, res) => {
  const authReq = req as AuthRequest;
  const body = req.body as CreateStepRequest;

  if (!body.title || body.title.trim().length === 0) {
    res.status(400).json({ error: 'Step title is required' });
    return;
  }

  const step = addStep(req.params.id, authReq.userId!, {
    title: body.title.trim(),
    description: body.description?.trim(),
    assigned_agent: body.assigned_agent,
    effort: body.effort,
    depends_on: body.depends_on,
  });

  if (!step) {
    res.status(404).json({ error: 'Goal not found' });
    return;
  }

  res.status(201).json({ step });
});

// PATCH /goals/:goalId/steps/:stepId — update step status
router.patch('/goals/:goalId/steps/:stepId', requireAuth, (req, res) => {
  const authReq = req as AuthRequest;
  const { status, result } = req.body as { status: StepStatus; result?: string };

  if (!status) {
    res.status(400).json({ error: 'Status is required' });
    return;
  }

  // Validate step belongs to the specified goal
  const existingStep = getGoalSteps(req.params.goalId).find(s => s.id === req.params.stepId);
  if (!existingStep) {
    res.status(404).json({ error: 'Step not found for this goal' });
    return;
  }

  const step = updateStepStatus(req.params.stepId, authReq.userId!, status, result);
  if (!step) {
    res.status(404).json({ error: 'Step not found' });
    return;
  }

  res.json({ step });
});

// ── Goal Events (Timeline) ─────────────────────────────────

// GET /goals/:id/events — goal event timeline
router.get('/goals/:id/events', requireAuth, (req, res) => {
  const authReq = req as AuthRequest;
  const goal = getGoal(req.params.id);
  if (!goal || goal.user_id !== authReq.userId!) {
    res.status(404).json({ error: 'Goal not found' });
    return;
  }
  const limit = Math.max(1, Math.min(Number(req.query.limit) || 50, 200));
  const events = getGoalEvents(req.params.id, limit);
  res.json({ events });
});

// ── Workspace Artifacts ─────────────────────────────────────

// GET /workspace — list user's workspace artifacts
router.get('/workspace', requireAuth, (req, res) => {
  const authReq = req as AuthRequest;
  const goalId = req.query.goal_id as string | undefined;
  const limit = Math.max(1, Math.min(Number(req.query.limit) || 30, 100));
  const artifacts = getWorkspaceArtifacts(authReq.userId!, goalId, limit);
  res.json({ artifacts });
});

// POST /workspace — create an artifact
router.post('/workspace', requireAuth, (req, res) => {
  const authReq = req as AuthRequest;
  const { title, content, artifact_type, goal_id } = req.body as {
    title: string; content: string; artifact_type?: string; goal_id?: string;
  };

  if (!title || !content) {
    res.status(400).json({ error: 'Title and content are required' });
    return;
  }

  // Verify goal ownership if goal_id provided
  if (goal_id) {
    const goal = getGoal(goal_id);
    if (!goal || goal.user_id !== authReq.userId!) {
      res.status(404).json({ error: 'Goal not found' });
      return;
    }
  }

  const artifact = createWorkspaceArtifact(
    authReq.userId!, goal_id || null, title.trim(), content,
    (artifact_type as any) || 'note',
  );
  res.status(201).json({ artifact });
});

// PATCH /workspace/:id — update an artifact
router.patch('/workspace/:id', requireAuth, (req, res) => {
  const authReq = req as AuthRequest;
  const { content, title } = req.body as { content: string; title?: string };

  if (!content) {
    res.status(400).json({ error: 'Content is required' });
    return;
  }

  const artifact = updateWorkspaceArtifact(req.params.id, authReq.userId!, content, title);
  if (!artifact) {
    res.status(404).json({ error: 'Artifact not found' });
    return;
  }
  res.json({ artifact });
});

// DELETE /workspace/:id — delete an artifact
router.delete('/workspace/:id', requireAuth, (req, res) => {
  const authReq = req as AuthRequest;
  const deleted = deleteWorkspaceArtifact(req.params.id, authReq.userId!);
  if (!deleted) {
    res.status(404).json({ error: 'Artifact not found' });
    return;
  }
  res.json({ success: true });
});

export default router;
