// ============================================================
// Models API — Public endpoints for free model discovery
// ============================================================

import { Router } from 'express';
import { db } from '../db/index.js';

export const modelsRouter = Router();

// GET /api/models/free — All active/new free models
modelsRouter.get('/free', (_req, res) => {
  const rows = db.prepare(`
    SELECT id, display_name, provider, summary, context_length, parameters, status, curated, first_seen
    FROM free_models
    WHERE status IN ('active', 'new')
    ORDER BY curated DESC, context_length DESC
  `).all() as Array<{
    id: string; display_name: string; provider: string; summary: string;
    context_length: number; parameters: string | null; status: string; curated: number; first_seen: string;
  }>;

  const lastChecked = db.prepare('SELECT MAX(last_checked) as t FROM free_models').get() as { t: string | null } | undefined;

  res.json({
    models: rows.map(r => ({
      id: r.id,
      displayName: r.display_name,
      provider: r.provider,
      summary: r.summary,
      contextLength: r.context_length,
      parameters: r.parameters,
      status: r.status,
      curated: r.curated === 1,
      isNew: r.status === 'new',
    })),
    lastUpdated: lastChecked?.t || null,
  });
});

// GET /api/models/changelog — Last 30 days of model changes
modelsRouter.get('/changelog', (_req, res) => {
  const rows = db.prepare(`
    SELECT mc.model_id, mc.event, mc.timestamp, fm.display_name
    FROM model_changelog mc
    LEFT JOIN free_models fm ON mc.model_id = fm.id
    WHERE mc.timestamp > datetime('now', '-30 days')
    ORDER BY mc.timestamp DESC
    LIMIT 100
  `).all() as Array<{
    model_id: string; event: string; timestamp: string; display_name: string | null;
  }>;

  res.json({
    entries: rows.map(r => ({
      modelId: r.model_id,
      displayName: r.display_name || r.model_id,
      event: r.event,
      timestamp: r.timestamp,
    })),
  });
});
