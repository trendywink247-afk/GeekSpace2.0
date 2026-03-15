import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validateBody, workflowCreateSchema, workflowUpdateSchema } from '../middleware/validate.js';
import { db } from '../db/index.js';
import {
  runUserWorkflow,
  getUserWorkflowList,
  getUserWorkflowById,
  getWorkflowRuns,
  getWorkflowRun,
  seedWorkflowTemplates,
  type WorkflowStepDef,
} from '../services/workflow-runner.js';
import { logger } from '../logger.js';

export const workflowsRouter = Router();

// ---- GET /api/workflows ---- list user workflows (seeding on first access)
workflowsRouter.get('/', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  seedWorkflowTemplates(userId);
  const workflows = getUserWorkflowList(userId);
  res.json(workflows);
});

// ---- POST /api/workflows ---- create workflow
workflowsRouter.post('/', requireAuth, validateBody(workflowCreateSchema), (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { name, description, steps, trigger } = req.body;

  const triggerValue = trigger || 'manual';

  const result = db.prepare(`
    INSERT INTO user_workflows (user_id, name, description, steps, trigger, enabled, created_at)
    VALUES (?, ?, ?, ?, ?, 1, ?)
  `).run(userId, name.trim(), description || '', JSON.stringify(steps), triggerValue, Date.now());

  const created = db.prepare('SELECT * FROM user_workflows WHERE id = ?').get(result.lastInsertRowid) as Record<string, unknown>;
  res.status(201).json(parseWorkflowRow(created));
});

// ---- GET /api/workflows/runs/:runId ---- get single run (must be before /:id)
workflowsRouter.get('/runs/:runId', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const runId = parseInt(req.params.runId, 10);
  if (isNaN(runId)) { res.status(400).json({ error: 'Invalid run ID' }); return; }

  const run = getWorkflowRun(runId, userId);
  if (!run) { res.status(404).json({ error: 'Run not found' }); return; }
  res.json(run);
});

// ---- GET /api/workflows/:id ---- get single workflow
workflowsRouter.get('/:id', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid workflow ID' }); return; }

  const workflow = getUserWorkflowById(id, userId);
  if (!workflow) { res.status(404).json({ error: 'Workflow not found' }); return; }
  res.json(workflow);
});

// ---- PATCH /api/workflows/:id ---- update workflow
workflowsRouter.patch('/:id', requireAuth, validateBody(workflowUpdateSchema), (req: AuthRequest, res) => {
  const userId = req.userId!;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid workflow ID' }); return; }

  const existing = getUserWorkflowById(id, userId);
  if (!existing) { res.status(404).json({ error: 'Workflow not found' }); return; }

  const { name, description, steps, trigger, enabled } = req.body;
  const fields: string[] = [];
  const values: unknown[] = [];

  if (name !== undefined) { fields.push('name = ?'); values.push(name.trim()); }
  if (description !== undefined) { fields.push('description = ?'); values.push(description); }
  if (steps !== undefined) { fields.push('steps = ?'); values.push(JSON.stringify(steps)); }
  if (trigger !== undefined) { fields.push('trigger = ?'); values.push(trigger); }
  if (enabled !== undefined) { fields.push('enabled = ?'); values.push(enabled ? 1 : 0); }

  if (fields.length === 0) { res.status(400).json({ error: 'No fields to update' }); return; }

  values.push(id, userId);
  db.prepare(`UPDATE user_workflows SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`).run(...values);

  const updated = getUserWorkflowById(id, userId);
  res.json(updated);
});

// ---- DELETE /api/workflows/:id ---- delete workflow
workflowsRouter.delete('/:id', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid workflow ID' }); return; }

  const existing = getUserWorkflowById(id, userId);
  if (!existing) { res.status(404).json({ error: 'Workflow not found' }); return; }

  db.prepare('DELETE FROM user_workflows WHERE id = ? AND user_id = ?').run(id, userId);
  res.json({ success: true });
});

// ---- POST /api/workflows/:id/run ---- trigger a workflow run
workflowsRouter.post('/:id/run', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid workflow ID' }); return; }

  const userInput = (req.body?.input as string) || '';

  try {
    const run = await runUserWorkflow(id, userId, userInput);
    res.json(run);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Workflow execution failed';
    logger.error({ err, workflowId: id, userId }, 'Workflow run error');
    res.status(400).json({ error: message });
  }
});

// ---- GET /api/workflows/:id/runs ---- list recent runs for a workflow
workflowsRouter.get('/:id/runs', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid workflow ID' }); return; }

  const runs = getWorkflowRuns(id, userId, 10);
  res.json(runs);
});

// ---- Helpers ----

function parseWorkflowRow(row: Record<string, unknown>) {
  let steps: WorkflowStepDef[] = [];
  try { steps = JSON.parse(row.steps as string || '[]'); } catch { /* ignore */ }
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    description: row.description || '',
    steps,
    trigger: row.trigger || 'manual',
    enabled: Boolean(row.enabled),
    last_run: row.last_run || null,
    created_at: row.created_at,
  };
}
