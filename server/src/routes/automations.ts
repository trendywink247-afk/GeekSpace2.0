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
  if (!result.success && result.output.includes('not found')) {
    res.status(404).json(result);
  } else {
    res.json(result);
  }
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

// ---- 34.5: Webhook test-fire ----
automationsRouter.post('/:id/test', requireAuth, async (req: AuthRequest, res) => {
  const auto = db.prepare('SELECT * FROM automations WHERE id = ? AND user_id = ?').get(req.params.id, req.userId) as {
    id: string; name: string; trigger_type: string; action_config: string; action_type: string;
  } | undefined;

  if (!auto) { res.status(404).json({ error: 'Automation not found' }); return; }

  // Extract webhook URL from action_config
  const actionConfig: Record<string, unknown> = JSON.parse(auto.action_config || '{}');
  const url = (actionConfig.url as string | undefined) || (actionConfig.webhook_url as string | undefined);

  if (!url) {
    res.status(400).json({ success: false, statusCode: 0, message: 'No URL configured on this automation' });
    return;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true, timestamp: new Date().toISOString(), automation_id: auto.id }),
      signal: AbortSignal.timeout(5000),
    });
    res.json({ success: response.ok, statusCode: response.status, message: response.ok ? 'Test successful' : `Test failed with status ${response.status}` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Request failed';
    res.json({ success: false, statusCode: 0, message: `Test failed: ${msg}` });
  }
});

// ── 37.4: Webhook dead-letter log ─────────────────────────────────────────────
automationsRouter.get('/dead-letters', requireAuth, (req: AuthRequest, res) => {
  const entries = db.prepare(
    'SELECT id, automation_id, url, error, payload, failed_at FROM webhook_dead_letters WHERE user_id = ? ORDER BY failed_at DESC LIMIT 20'
  ).all(req.userId!) as Array<{ id: string; automation_id: string; url: string; error: string; payload: string | null; failed_at: number }>;
  res.json(entries);
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
