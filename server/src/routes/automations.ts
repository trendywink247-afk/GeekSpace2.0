import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { requireAuth } from '../middleware/auth.js';

export const automationsRouter = Router();

const automations: Record<string, unknown>[] = [];

automationsRouter.get('/', requireAuth, (_req, res) => {
  res.json(automations);
});

automationsRouter.post('/', requireAuth, (req, res) => {
  const automation = { id: uuid(), userId: 'demo-1', runCount: 0, createdAt: new Date().toISOString(), ...req.body };
  automations.push(automation);
  res.status(201).json(automation);
});

automationsRouter.patch('/:id', requireAuth, (req, res) => {
  const automation = automations.find((a: Record<string, unknown>) => a.id === req.params.id) as Record<string, unknown> | undefined;
  if (!automation) { res.status(404).json({ error: 'Not found' }); return; }
  Object.assign(automation, req.body);
  res.json(automation);
});

automationsRouter.delete('/:id', requireAuth, (req, res) => {
  const index = automations.findIndex((a: Record<string, unknown>) => a.id === req.params.id);
  if (index === -1) { res.status(404).json({ error: 'Not found' }); return; }
  automations.splice(index, 1);
  res.json({ success: true });
});

automationsRouter.post('/:id/trigger', requireAuth, (_req, res) => {
  res.json({ success: true });
});
