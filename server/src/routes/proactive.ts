import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { getProactiveLog } from '../services/proactive-engine.js';
import { db } from '../db/index.js';
import { logger } from '../logger.js';
import { v4 as uuid } from 'uuid';

export const proactiveRouter = Router();

// GET /api/proactive/log — returns last 20 proactive messages sent to user
proactiveRouter.get('/log', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const log = getProactiveLog(userId, limit);
  res.json({ log });
});

// GET /api/proactive/settings — get proactive toggle state + autonomy/quiet hours
proactiveRouter.get('/settings', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const user = db.prepare('SELECT proactive_enabled FROM users WHERE id = ?').get(userId) as { proactive_enabled: number } | undefined;
  let autonomy_level = 'proactive';
  let quiet_start = '22:00';
  let quiet_end = '07:00';
  try {
    const config = db.prepare(
      'SELECT autonomy_level, quiet_start, quiet_end FROM agent_configs WHERE user_id = ?'
    ).get(userId) as { autonomy_level: string | null; quiet_start: string | null; quiet_end: string | null } | undefined;
    if (config) {
      autonomy_level = config.autonomy_level || 'proactive';
      quiet_start = config.quiet_start || '22:00';
      quiet_end = config.quiet_end || '07:00';
    }
  } catch { /* columns may not exist yet */ }
  res.json({
    enabled: user?.proactive_enabled !== 0,
    autonomy_level,
    quiet_start,
    quiet_end,
  });
});

// PATCH /api/proactive/toggle — enable or disable proactive messages
proactiveRouter.patch('/toggle', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { enabled } = req.body as { enabled?: boolean };
  if (typeof enabled !== 'boolean') {
    res.status(400).json({ error: 'enabled must be a boolean' });
    return;
  }
  try {
    db.prepare('UPDATE users SET proactive_enabled = ? WHERE id = ?').run(enabled ? 1 : 0, userId);
    logger.info({ userId, enabled }, 'Proactive messages toggle updated');
    res.json({ enabled });
  } catch (err) {
    logger.error({ err, userId }, 'Failed to update proactive toggle');
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

// PATCH /api/proactive/settings — update autonomy level and quiet hours
const proactiveSettingsSchema = z.object({
  autonomy_level: z.enum(['manual', 'assisted', 'proactive', 'autonomous']).optional(),
  quiet_start: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM format').optional(),
  quiet_end: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM format').optional(),
});

proactiveRouter.patch('/settings', requireAuth, validateBody(proactiveSettingsSchema), (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { autonomy_level, quiet_start, quiet_end } = req.body as z.infer<typeof proactiveSettingsSchema>;
  try {
    // Upsert: check if agent_configs row exists for this user
    const existing = db.prepare('SELECT id FROM agent_configs WHERE user_id = ?').get(userId) as { id: string } | undefined;
    if (!existing) {
      db.prepare(
        `INSERT INTO agent_configs (id, user_id, autonomy_level, quiet_start, quiet_end) VALUES (?, ?, ?, ?, ?)`
      ).run(uuid(), userId, autonomy_level ?? 'proactive', quiet_start ?? '22:00', quiet_end ?? '07:00');
    } else {
      const setClauses: string[] = [];
      const params: unknown[] = [];
      if (autonomy_level !== undefined) { setClauses.push('autonomy_level = ?'); params.push(autonomy_level); }
      if (quiet_start !== undefined) { setClauses.push('quiet_start = ?'); params.push(quiet_start); }
      if (quiet_end !== undefined) { setClauses.push('quiet_end = ?'); params.push(quiet_end); }
      if (setClauses.length > 0) {
        params.push(userId);
        db.prepare(`UPDATE agent_configs SET ${setClauses.join(', ')} WHERE user_id = ?`).run(...params);
      }
    }
    logger.info({ userId, autonomy_level, quiet_start, quiet_end }, 'Proactive settings updated');
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err, userId }, 'Failed to update proactive settings');
    res.status(500).json({ error: 'Failed to update proactive settings' });
  }
});
