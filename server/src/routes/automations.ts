import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validateBody, automationCreateSchema, automationUpdateSchema } from '../middleware/validate.js';
import { db } from '../db/index.js';
import {
  executeManualTrigger,
  executeWebhookTrigger,
  onAutomationChanged,
  getAutomationLogs,
} from '../services/automations-engine.js';

export const automationsRouter = Router();

automationsRouter.get('/', requireAuth, (req: AuthRequest, res) => {
  const automations = db.prepare('SELECT * FROM automations WHERE user_id = ? ORDER BY created_at DESC').all(req.userId!);
  res.json(automations);
});

automationsRouter.post('/', requireAuth, validateBody(automationCreateSchema), (req: AuthRequest, res) => {
  const { name, description, triggerType, triggerConfig, actionType, actionConfig } = req.body;

  const id = uuid();
  db.prepare('INSERT INTO automations (id, user_id, name, description, trigger_type, trigger_config, action_type, action_config) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    id, req.userId, name, description || '', triggerType || 'manual', JSON.stringify(triggerConfig || {}), actionType || '', JSON.stringify(actionConfig || {})
  );

  db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Created automation', ?, 'zap')`).run(uuid(), req.userId, name);

  // Hot-reload engine
  onAutomationChanged(id);

  const automation = db.prepare('SELECT * FROM automations WHERE id = ?').get(id);
  res.status(201).json(automation);
});

automationsRouter.patch('/:id', requireAuth, validateBody(automationUpdateSchema), (req: AuthRequest, res) => {
  const existing = db.prepare('SELECT * FROM automations WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  const updates = req.body;
  const fields: string[] = [];
  const values: unknown[] = [];
  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
  if (updates.triggerType !== undefined) { fields.push('trigger_type = ?'); values.push(updates.triggerType); }
  if (updates.triggerConfig !== undefined) { fields.push('trigger_config = ?'); values.push(JSON.stringify(updates.triggerConfig)); }
  if (updates.actionType !== undefined) { fields.push('action_type = ?'); values.push(updates.actionType); }
  if (updates.actionConfig !== undefined) { fields.push('action_config = ?'); values.push(JSON.stringify(updates.actionConfig)); }
  if (updates.enabled !== undefined) { fields.push('enabled = ?'); values.push(updates.enabled ? 1 : 0); }

  if (fields.length) { values.push(req.params.id, req.userId); db.prepare(`UPDATE automations SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`).run(...values); }

  // Hot-reload engine
  onAutomationChanged(req.params.id);

  const automation = db.prepare('SELECT * FROM automations WHERE id = ?').get(req.params.id);
  res.json(automation);
});

automationsRouter.delete('/:id', requireAuth, (req: AuthRequest, res) => {
  onAutomationChanged(req.params.id); // Unregister before delete
  const result = db.prepare('DELETE FROM automations WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  if (result.changes === 0) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ success: true });
});

// ---- Manual trigger (now uses real engine) ----

automationsRouter.post('/:id/trigger', requireAuth, async (req: AuthRequest, res) => {
  const result = await executeManualTrigger(req.params.id, req.userId!);
  res.json(result);
});

// ---- Execution logs ----

automationsRouter.get('/logs', requireAuth, (req: AuthRequest, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const logs = getAutomationLogs(req.userId!, undefined, limit);
  res.json(logs);
});

automationsRouter.get('/:id/logs', requireAuth, (req: AuthRequest, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const logs = getAutomationLogs(req.userId!, req.params.id, limit);
  res.json(logs);
});

// ---- Webhook endpoint (no auth — triggered by external services) ----

automationsRouter.post('/webhook/:id', async (req, res) => {
  const result = await executeWebhookTrigger(req.params.id, req.body);
  if (!result.success && result.output.includes('not found')) {
    res.status(404).json(result);
  } else {
    res.json(result);
  }
});
