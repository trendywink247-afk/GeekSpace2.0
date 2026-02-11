import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { requireAuth } from '../middleware/auth.js';

export const remindersRouter = Router();

const reminders = [
  { id: '1', userId: 'demo-1', text: 'Call mom', datetime: '2026-02-12T09:00', channel: 'telegram', category: 'personal', completed: false, createdBy: 'user', createdAt: '2026-02-10T00:00:00Z' },
  { id: '2', userId: 'demo-1', text: 'Submit project report', datetime: '2026-02-12T17:00', channel: 'email', recurring: 'weekly', category: 'work', completed: false, createdBy: 'user', createdAt: '2026-02-10T00:00:00Z' },
  { id: '3', userId: 'demo-1', text: 'Team standup', datetime: '2026-02-12T10:00', channel: 'push', recurring: 'daily', category: 'work', completed: true, createdBy: 'agent', createdAt: '2026-02-10T00:00:00Z' },
  { id: '4', userId: 'demo-1', text: 'Pay rent', datetime: '2026-02-15T09:00', channel: 'telegram', recurring: 'monthly', category: 'personal', completed: false, createdBy: 'user', createdAt: '2026-02-10T00:00:00Z' },
  { id: '5', userId: 'demo-1', text: 'Gym workout', datetime: '2026-02-12T07:00', channel: 'push', category: 'health', completed: false, createdBy: 'automation', createdAt: '2026-02-10T00:00:00Z' },
  { id: '6', userId: 'demo-1', text: 'Review pull requests', datetime: '2026-02-12T14:00', channel: 'email', category: 'work', completed: false, createdBy: 'user', createdAt: '2026-02-10T00:00:00Z' },
];

remindersRouter.get('/', requireAuth, (_req, res) => {
  res.json(reminders);
});

remindersRouter.post('/', requireAuth, (req, res) => {
  const reminder = { id: uuid(), userId: 'demo-1', createdBy: 'user', createdAt: new Date().toISOString(), ...req.body };
  reminders.push(reminder);
  res.status(201).json(reminder);
});

remindersRouter.patch('/:id', requireAuth, (req, res) => {
  const reminder = reminders.find((r) => r.id === req.params.id);
  if (!reminder) { res.status(404).json({ error: 'Not found' }); return; }
  Object.assign(reminder, req.body);
  res.json(reminder);
});

remindersRouter.delete('/:id', requireAuth, (req, res) => {
  const index = reminders.findIndex((r) => r.id === req.params.id);
  if (index === -1) { res.status(404).json({ error: 'Not found' }); return; }
  reminders.splice(index, 1);
  res.json({ success: true });
});
