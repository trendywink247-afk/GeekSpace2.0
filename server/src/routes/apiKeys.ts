import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { requireAuth } from '../middleware/auth.js';

export const apiKeysRouter = Router();

const keys: Record<string, unknown>[] = [];

apiKeysRouter.get('/', requireAuth, (_req, res) => {
  res.json(keys);
});

apiKeysRouter.post('/', requireAuth, (req, res) => {
  const { provider, label, key } = req.body;
  const masked = key.slice(0, 3) + '...' + key.slice(-4);
  const apiKey = { id: uuid(), userId: 'demo-1', provider, label, maskedKey: masked, isDefault: keys.length === 0, createdAt: new Date().toISOString() };
  keys.push(apiKey);
  res.status(201).json(apiKey);
});

apiKeysRouter.delete('/:id', requireAuth, (req, res) => {
  const index = keys.findIndex((k: Record<string, unknown>) => k.id === req.params.id);
  if (index === -1) { res.status(404).json({ error: 'Not found' }); return; }
  keys.splice(index, 1);
  res.json({ success: true });
});

apiKeysRouter.patch('/:id/default', requireAuth, (req, res) => {
  keys.forEach((k: Record<string, unknown>) => { k.isDefault = k.id === req.params.id; });
  res.json(keys.find((k: Record<string, unknown>) => k.id === req.params.id));
});
