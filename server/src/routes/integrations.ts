import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { db } from '../db/index.js';

export const integrationsRouter = Router();

const parseIntegration = (row: Record<string, unknown>) => ({
  ...row,
  features: JSON.parse(row.features as string || '[]'),
  permissions: JSON.parse(row.permissions as string || '[]'),
  config: JSON.parse(row.config as string || '{}'),
});

integrationsRouter.get('/', requireAuth, (req: AuthRequest, res) => {
  const rows = db.prepare('SELECT * FROM integrations WHERE user_id = ?').all(req.userId!) as Record<string, unknown>[];
  res.json(rows.map(parseIntegration));
});

integrationsRouter.post('/:type/connect', requireAuth, (req: AuthRequest, res) => {
  const integration = db.prepare('SELECT * FROM integrations WHERE user_id = ? AND (type = ? OR id = ?)').get(req.userId, req.params.type, req.params.type) as Record<string, unknown> | undefined;
  if (!integration) { res.status(404).json({ error: 'Integration not found' }); return; }

  db.prepare("UPDATE integrations SET status = 'connected', health = 100, last_sync = ? WHERE id = ?").run(new Date().toISOString(), integration.id);
  db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Connected integration', ?, 'link')`).run(uuid(), req.userId, integration.name as string);

  const updated = db.prepare('SELECT * FROM integrations WHERE id = ?').get(integration.id) as Record<string, unknown>;
  res.json(parseIntegration(updated));
});

integrationsRouter.post('/:id/disconnect', requireAuth, (req: AuthRequest, res) => {
  const integration = db.prepare('SELECT * FROM integrations WHERE id = ? AND user_id = ?').get(req.params.id, req.userId) as Record<string, unknown> | undefined;
  if (!integration) { res.status(404).json({ error: 'Integration not found' }); return; }

  db.prepare("UPDATE integrations SET status = 'disconnected', health = 0 WHERE id = ?").run(req.params.id);
  db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Disconnected integration', ?, 'unlink')`).run(uuid(), req.userId, integration.name as string);

  const updated = db.prepare('SELECT * FROM integrations WHERE id = ?').get(req.params.id) as Record<string, unknown>;
  res.json(parseIntegration(updated));
});

integrationsRouter.patch('/:id/permissions', requireAuth, (req: AuthRequest, res) => {
  const integration = db.prepare('SELECT * FROM integrations WHERE id = ? AND user_id = ?').get(req.params.id, req.userId) as Record<string, unknown> | undefined;
  if (!integration) { res.status(404).json({ error: 'Integration not found' }); return; }

  db.prepare('UPDATE integrations SET permissions = ? WHERE id = ?').run(JSON.stringify(req.body.permissions || []), req.params.id);
  const updated = db.prepare('SELECT * FROM integrations WHERE id = ?').get(req.params.id) as Record<string, unknown>;
  res.json(parseIntegration(updated));
});
