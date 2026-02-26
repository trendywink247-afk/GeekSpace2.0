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
import { cacheGet, cacheSet, cacheDel } from '../services/cache.js';

export const automationsRouter = Router();

automationsRouter.get('/', requireAuth, async (req: AuthRequest, res) => {
  // 53.5: Redis cache per-user automations list (30s TTL)
  const cacheKey = `automations:${req.userId}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    res.set('X-Cache', 'HIT').json(JSON.parse(cached));
    return;
  }
  const rows = db.prepare('SELECT * FROM automations WHERE user_id = ? ORDER BY created_at DESC').all(req.userId!) as Array<Record<string, unknown>>;
  // 48.1: Normalize enabled to boolean (SQLite returns 0/1 which confuses React toggle state)
  const automations = rows.map(a => ({ ...a, enabled: Boolean(a.enabled) }));
  await cacheSet(cacheKey, JSON.stringify(automations), 30);
  res.set('X-Cache', 'MISS').json(automations);
});

automationsRouter.post('/', requireAuth, validateBody(automationCreateSchema), async (req: AuthRequest, res) => {
  const { name, description, triggerType, triggerConfig, actionType, actionConfig } = req.body;

  const id = uuid();
  db.prepare('INSERT INTO automations (id, user_id, name, description, trigger_type, trigger_config, action_type, action_config) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    id, req.userId, name, description || '', triggerType || 'manual', JSON.stringify(triggerConfig || {}), actionType || '', JSON.stringify(actionConfig || {})
  );

  db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Created automation', ?, 'zap')`).run(uuid(), req.userId, name);

  // Hot-reload engine
  onAutomationChanged(id);

  // 53.5: Bust cache
  await cacheDel(`automations:${req.userId}`);

  const automation = db.prepare('SELECT * FROM automations WHERE id = ?').get(id);
  res.status(201).json(automation);
});

automationsRouter.patch('/:id', requireAuth, validateBody(automationUpdateSchema), async (req: AuthRequest, res) => {
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

  // 53.5: Bust cache on update
  await cacheDel(`automations:${req.userId}`);

  const raw = db.prepare('SELECT * FROM automations WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!raw) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ ...raw, enabled: Boolean(raw.enabled) });
});

automationsRouter.delete('/:id', requireAuth, async (req: AuthRequest, res) => {
  onAutomationChanged(req.params.id); // Unregister before delete
  const result = db.prepare('DELETE FROM automations WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  if (result.changes === 0) { res.status(404).json({ error: 'Not found' }); return; }
  // 53.5: Bust cache on delete
  await cacheDel(`automations:${req.userId}`);
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

// ---- 59.4: Duplicate automation ----
automationsRouter.post('/:id/duplicate', requireAuth, async (req: AuthRequest, res) => {
  const source = db.prepare('SELECT * FROM automations WHERE id = ? AND user_id = ?').get(req.params.id, req.userId) as {
    id: string; user_id: string; name: string; description: string; trigger_type: string; trigger_config: string; action_type: string; action_config: string;
  } | undefined;
  if (!source) { res.status(404).json({ error: 'Automation not found' }); return; }

  const newId = uuid();
  const newName = `Copy of ${source.name}`;
  db.prepare(`INSERT INTO automations (id, user_id, name, description, trigger_type, trigger_config, action_type, action_config, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`)
    .run(newId, req.userId, newName, source.description || '', source.trigger_type, source.trigger_config, source.action_type, source.action_config);

  await cacheDel(`automations:${req.userId}`);

  const created = db.prepare('SELECT * FROM automations WHERE id = ?').get(newId) as Record<string, unknown>;
  res.status(201).json({ ...created, enabled: false });
});

// ---- Execution logs ----

automationsRouter.get('/logs', requireAuth, (req: AuthRequest, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  // 53.7: Pagination support — offset param
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
  const logs = getAutomationLogs(req.userId!, undefined, limit, offset);
  res.json({ logs, limit, offset });
});

automationsRouter.get('/:id/logs', requireAuth, (req: AuthRequest, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  // 53.7: Pagination support — offset param
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
  const logs = getAutomationLogs(req.userId!, req.params.id, limit, offset);
  res.json({ logs, limit, offset });
});

// ---- 46.2: URL validation helper for webhook test-fire ----
function isValidWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

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

  // 46.2: Validate URL format before attempting HTTP request
  if (!isValidWebhookUrl(url)) {
    res.status(400).json({ success: false, statusCode: 0, message: 'Invalid webhook URL' });
    return;
  }

  try {
    const t0 = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true, timestamp: new Date().toISOString(), automation_id: auto.id }),
      signal: AbortSignal.timeout(5000),
    });
    const latencyMs = Date.now() - t0;
    const contentType = response.headers.get('content-type') ?? '';
    let responseBody: string;
    try {
      const text = await response.text();
      // 58.6: Pretty-print JSON if possible, else keep raw
      responseBody = contentType.includes('json')
        ? JSON.stringify(JSON.parse(text), null, 2)
        : text.slice(0, 500);
    } catch {
      responseBody = '';
    }
    res.json({
      success: response.ok,
      statusCode: response.status,
      message: response.ok ? 'Test successful' : `Test failed with status ${response.status}`,
      latencyMs,
      contentType,
      responseBody,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Request failed';
    res.json({ success: false, statusCode: 0, message: `Test failed: ${msg}`, latencyMs: 0, contentType: '', responseBody: '' });
  }
});

// ── 37.4: Webhook dead-letter log ─────────────────────────────────────────────
automationsRouter.get('/dead-letters', requireAuth, (req: AuthRequest, res) => {
  const entries = db.prepare(
    'SELECT id, automation_id, url, error, payload, failed_at, retry_count, last_error FROM webhook_dead_letters WHERE user_id = ? ORDER BY failed_at DESC LIMIT 20'
  ).all(req.userId!) as Array<{ id: string; automation_id: string; url: string; error: string; payload: string | null; failed_at: number; retry_count: number; last_error: string | null }>;
  res.json(entries);
});

// ── 55.6: Dead-letter retry ────────────────────────────────────────────────────
// Re-fires the failed webhook and removes the dead-letter record on success.
automationsRouter.post('/dead-letters/:id/retry', requireAuth, async (req: AuthRequest, res) => {
  const entry = db.prepare(
    'SELECT id, automation_id, url, payload, user_id FROM webhook_dead_letters WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.userId!) as { id: string; automation_id: string; url: string; payload: string | null; user_id: string } | undefined;

  if (!entry) {
    res.status(404).json({ error: 'Dead-letter entry not found' });
    return;
  }

  const payload = entry.payload ? JSON.parse(entry.payload) as Record<string, unknown> : {};
  const result = await executeWebhookTrigger(entry.automation_id, payload);

  if (result.success) {
    db.prepare('DELETE FROM webhook_dead_letters WHERE id = ?').run(entry.id);
    res.json({ retried: true, removed: true, result });
  } else {
    // 57.10: Track retry count + last error on failure
    db.prepare(
      'UPDATE webhook_dead_letters SET retry_count = retry_count + 1, last_error = ? WHERE id = ?'
    ).run(result.output ?? 'retry failed', entry.id);
    res.json({ retried: true, removed: false, result });
  }
});

// ---- Webhook endpoint (no auth — triggered by external services) ----

automationsRouter.post('/webhook/:id', async (req, res) => {
  // 47.6: Reject non-object payloads (arrays, strings, null, numbers)
  const body = req.body;
  if (body === null || body === undefined || typeof body !== 'object' || Array.isArray(body)) {
    res.status(400).json({ error: 'Webhook payload must be a JSON object' });
    return;
  }
  const result = await executeWebhookTrigger(req.params.id, body);
  if (!result.success && result.output.includes('not found')) {
    res.status(404).json(result);
  } else {
    res.json(result);
  }
});
