import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { db } from '../db/index.js';

export const automationsRouter = Router();

automationsRouter.get('/', requireAuth, (req: AuthRequest, res) => {
  const automations = db.prepare('SELECT * FROM automations WHERE user_id = ? ORDER BY created_at DESC').all(req.userId!);
  res.json(automations);
});

automationsRouter.post('/', requireAuth, (req: AuthRequest, res) => {
  const { name, triggerType, triggerConfig, actionType, actionConfig } = req.body;
  if (!name) { res.status(400).json({ error: 'Name is required' }); return; }

  const id = uuid();
  db.prepare('INSERT INTO automations (id, user_id, name, trigger_type, trigger_config, action_type, action_config) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    id, req.userId, name, triggerType || 'manual', JSON.stringify(triggerConfig || {}), actionType || '', JSON.stringify(actionConfig || {})
  );

  db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Created automation', ?, 'zap')`).run(uuid(), req.userId, name);

  const automation = db.prepare('SELECT * FROM automations WHERE id = ?').get(id);
  res.status(201).json(automation);
});

automationsRouter.patch('/:id', requireAuth, (req: AuthRequest, res) => {
  const existing = db.prepare('SELECT * FROM automations WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  const updates = req.body;
  const fields: string[] = [];
  const values: unknown[] = [];
  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.triggerType !== undefined) { fields.push('trigger_type = ?'); values.push(updates.triggerType); }
  if (updates.triggerConfig !== undefined) { fields.push('trigger_config = ?'); values.push(JSON.stringify(updates.triggerConfig)); }
  if (updates.actionType !== undefined) { fields.push('action_type = ?'); values.push(updates.actionType); }
  if (updates.actionConfig !== undefined) { fields.push('action_config = ?'); values.push(JSON.stringify(updates.actionConfig)); }
  if (updates.enabled !== undefined) { fields.push('enabled = ?'); values.push(updates.enabled ? 1 : 0); }

  if (fields.length) { values.push(req.params.id, req.userId); db.prepare(`UPDATE automations SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`).run(...values); }

  const automation = db.prepare('SELECT * FROM automations WHERE id = ?').get(req.params.id);
  res.json(automation);
});

automationsRouter.delete('/:id', requireAuth, (req: AuthRequest, res) => {
  const result = db.prepare('DELETE FROM automations WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  if (result.changes === 0) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ success: true });
});

automationsRouter.post('/:id/trigger', requireAuth, (req: AuthRequest, res) => {
  const automation = db.prepare('SELECT * FROM automations WHERE id = ? AND user_id = ?').get(req.params.id, req.userId) as Record<string, unknown> | undefined;
  if (!automation) { res.status(404).json({ error: 'Not found' }); return; }

  db.prepare('UPDATE automations SET run_count = run_count + 1, last_run = ? WHERE id = ?').run(new Date().toISOString(), req.params.id);
  db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Triggered automation', ?, 'zap')`).run(uuid(), req.userId, automation.name as string);

  res.json({ success: true, runCount: (automation.run_count as number) + 1 });
});
