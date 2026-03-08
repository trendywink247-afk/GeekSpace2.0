import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { logger } from '../logger.js';
import {
  startFocus, endFocus, getActiveFocus, getFocusHistory, getFocusSummary,
  getDeferredMessages, getNotificationSettings, updateNotificationSettings,
} from '../services/focus.js';
import { createHabit, logHabit, getHabits, getHabitStats, deleteHabit } from '../services/habits.js';

export const focusRouter = Router();
export const habitsRouter = Router();

// ---- Focus sessions -- mounted at /api/focus ----

focusRouter.get('/active', requireAuth, (req: AuthRequest, res) => {
  const session = getActiveFocus(req.userId!);
  res.json({ session });
});

focusRouter.post('/start', requireAuth, (req: AuthRequest, res) => {
  const { goal, durationMin } = req.body as { goal?: string; durationMin?: number };
  const session = startFocus(req.userId!, goal ?? undefined, durationMin);
  res.status(201).json({ session });
});

focusRouter.post('/end', requireAuth, (req: AuthRequest, res) => {
  const { completed } = req.body as { completed?: boolean };
  const session = endFocus(req.userId!, completed !== false);
  if (!session) { res.status(404).json({ error: 'No active focus session' }); return; }
  res.json({ session });
});

focusRouter.get('/history', requireAuth, (req: AuthRequest, res) => {
  const limit = Math.max(1, Math.min(Number(req.query.limit) || 10, 50));
  const sessions = getFocusHistory(req.userId!, limit);
  res.json({ sessions });
});

focusRouter.get('/summary', requireAuth, (req: AuthRequest, res) => {
  const summary = getFocusSummary(req.userId!);
  res.json({ summary });
});

focusRouter.get('/deferred', requireAuth, (req: AuthRequest, res) => {
  const messages = getDeferredMessages(req.userId!);
  res.json({ messages, count: messages.length });
});

focusRouter.get('/settings', requireAuth, (req: AuthRequest, res) => {
  const settings = getNotificationSettings(req.userId!);
  res.json({ settings });
});

focusRouter.patch('/settings', requireAuth, (req: AuthRequest, res) => {
  const allowed = ['dnd_start', 'dnd_end', 'urgent_bypass', 'batch_interval_min', 'focus_mode_active'];
  const updates: Record<string, unknown> = {};
  for (const k of allowed) {
    if (req.body[k] !== undefined) updates[k] = req.body[k];
  }
  const settings = updateNotificationSettings(req.userId!, updates);
  res.json({ settings });
});

// ---- Habits -- mounted at /api/habits ----

habitsRouter.get('/', requireAuth, (req: AuthRequest, res) => {
  const habits = getHabits(req.userId!);
  res.json({ habits });
});

habitsRouter.post('/', requireAuth, (req: AuthRequest, res) => {
  const { name, description, frequency, targetTime, icon } = req.body as { name?: string; description?: string; frequency?: string; targetTime?: string; icon?: string };
  if (!name) { res.status(400).json({ error: 'name is required' }); return; }
  const habit = createHabit(req.userId!, { name, description, frequency, targetTime, icon });
  res.status(201).json({ habit });
});

habitsRouter.delete('/:id', requireAuth, (req: AuthRequest, res) => {
  const habitId = Number(req.params.id);
  if (!habitId) { res.status(400).json({ error: 'invalid id' }); return; }
  const deleted = deleteHabit(req.userId!, habitId);
  if (!deleted) { res.status(404).json({ error: 'Habit not found' }); return; }
  res.json({ success: true });
});

habitsRouter.post('/:id/log', requireAuth, (req: AuthRequest, res) => {
  const habitId = Number(req.params.id);
  if (!habitId) { res.status(400).json({ error: 'invalid id' }); return; }
  const { note } = req.body as { note?: string };
  try {
    const log = logHabit(req.userId!, habitId, note);
    const habits = getHabits(req.userId!);
    const habit = habits.find(h => h.id === habitId);
    res.status(201).json({ log, streak: habit?.current_streak ?? 0 });
  } catch (err) {
    logger.warn({ err, habitId }, 'Log habit failed');
    res.status(400).json({ error: 'Failed to log habit' });
  }
});

habitsRouter.get('/:id/stats', requireAuth, (req: AuthRequest, res) => {
  const habitId = Number(req.params.id);
  if (!habitId) { res.status(400).json({ error: 'invalid id' }); return; }
  try {
    const stats = getHabitStats(req.userId!, habitId);
    res.json({ stats });
  } catch {
    res.status(404).json({ error: 'Habit not found' });
  }
});