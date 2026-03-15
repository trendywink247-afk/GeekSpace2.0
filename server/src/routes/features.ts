import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validateBody, featuresUpdateSchema } from '../middleware/validate.js';
import { db } from '../db/index.js';

export const featuresRouter = Router();

featuresRouter.get('/', requireAuth, (req: AuthRequest, res) => {
  let features = db.prepare('SELECT * FROM features WHERE user_id = ?').get(req.userId!) as Record<string, unknown> | undefined;
  if (!features) {
    db.prepare('INSERT OR IGNORE INTO features (user_id) VALUES (?)').run(req.userId);
    features = db.prepare('SELECT * FROM features WHERE user_id = ?').get(req.userId!) as Record<string, unknown>;
  }

  // System-wide feature flags (not per-user, always on for now)
  const systemFlags = {
    globalSearch: true,         // Phase 103: Ctrl+K command palette
    telegramCommands: true,     // Phase 104: /remind, /note, /focus, etc.
    smartReminders: true,       // Phase 107: RRULE recurrence, snooze detection
    createMemory: true,         // BLOCKER-006 fix: explicit memory storage
    fileAttachments: false,     // Phase 106: not yet implemented
    videoGeneration: false,     // Requires FAL_KEY
    graphMemory: false,         // V6: D3 knowledge graph
    langfuseTracing: false,     // V6: LLM observability
  };

  res.json({
    socialDiscovery: !!features!.social_discovery,
    portfolioChat: !!features!.portfolio_chat,
    automationBuilder: !!features!.automation_builder,
    websiteBuilder: !!features!.website_builder,
    n8nIntegration: !!features!.n8n_integration,
    manyChatIntegration: !!features!.manychat_integration,
    ...systemFlags,
  });
});

featuresRouter.patch('/', requireAuth, validateBody(featuresUpdateSchema), (req: AuthRequest, res) => {
  const updates = req.body;
  const fields: string[] = [];
  const values: unknown[] = [];

  const map: Record<string, string> = {
    socialDiscovery: 'social_discovery', portfolioChat: 'portfolio_chat',
    automationBuilder: 'automation_builder', websiteBuilder: 'website_builder',
    n8nIntegration: 'n8n_integration', manyChatIntegration: 'manychat_integration',
  };

  for (const [key, col] of Object.entries(map)) {
    if (updates[key] !== undefined) { fields.push(`${col} = ?`); values.push(updates[key] ? 1 : 0); }
  }

  if (fields.length) { values.push(req.userId); db.prepare(`UPDATE features SET ${fields.join(', ')} WHERE user_id = ?`).run(...values); }

  const features = db.prepare('SELECT * FROM features WHERE user_id = ?').get(req.userId!) as Record<string, unknown>;
  res.json({
    socialDiscovery: !!features.social_discovery,
    portfolioChat: !!features.portfolio_chat,
    automationBuilder: !!features.automation_builder,
    websiteBuilder: !!features.website_builder,
    n8nIntegration: !!features.n8n_integration,
    manyChatIntegration: !!features.manychat_integration,
  });
});
