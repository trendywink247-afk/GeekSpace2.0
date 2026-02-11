import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { db } from '../db/index.js';

export const portfolioRouter = Router();

const parsePortfolio = (row: Record<string, unknown>) => ({
  ...row,
  skills: JSON.parse(row.skills as string || '[]'),
  projects: JSON.parse(row.projects as string || '[]'),
  milestones: JSON.parse(row.milestones as string || '[]'),
  social: JSON.parse(row.social as string || '{}'),
  visibility: JSON.parse(row.visibility as string || '{}'),
  agentEnabled: !!row.agent_enabled,
  isPublic: !!row.is_public,
});

portfolioRouter.get('/me', requireAuth, (req: AuthRequest, res) => {
  const portfolio = db.prepare('SELECT * FROM portfolios WHERE user_id = ?').get(req.userId!) as Record<string, unknown> | undefined;
  if (!portfolio) { res.status(404).json({ error: 'Portfolio not found' }); return; }
  res.json(parsePortfolio(portfolio));
});

portfolioRouter.patch('/me', requireAuth, (req: AuthRequest, res) => {
  const updates = req.body;
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const f of ['headline', 'about', 'avatar', 'location', 'role', 'company', 'layout']) {
    if (updates[f] !== undefined) { fields.push(`${f} = ?`); values.push(updates[f]); }
  }
  for (const [k, col] of Object.entries({ skills: 'skills', projects: 'projects', milestones: 'milestones', social: 'social', visibility: 'visibility' })) {
    if (updates[k] !== undefined) { fields.push(`${col} = ?`); values.push(JSON.stringify(updates[k])); }
  }
  if (updates.agentEnabled !== undefined) { fields.push('agent_enabled = ?'); values.push(updates.agentEnabled ? 1 : 0); }
  if (updates.isPublic !== undefined) { fields.push('is_public = ?'); values.push(updates.isPublic ? 1 : 0); }

  if (fields.length) { values.push(req.userId); db.prepare(`UPDATE portfolios SET ${fields.join(', ')} WHERE user_id = ?`).run(...values); }

  db.prepare(`INSERT INTO activity_log (id, user_id, action, details, icon) VALUES (?, ?, 'Updated portfolio', ?, 'layout')`).run(uuid(), req.userId, `Changed: ${Object.keys(updates).join(', ')}`);

  const portfolio = db.prepare('SELECT * FROM portfolios WHERE user_id = ?').get(req.userId!) as Record<string, unknown>;
  res.json(parsePortfolio(portfolio));
});

portfolioRouter.get('/:username', (req, res) => {
  const portfolio = db.prepare('SELECT * FROM portfolios WHERE username = ?').get(req.params.username) as Record<string, unknown> | undefined;
  if (!portfolio) { res.status(404).json({ error: 'Portfolio not found' }); return; }

  const user = db.prepare('SELECT name, avatar, bio FROM users WHERE id = ?').get(portfolio.user_id as string) as Record<string, unknown> | undefined;

  res.json({
    userId: portfolio.user_id, username: portfolio.username, headline: portfolio.headline,
    about: portfolio.about, avatar: portfolio.avatar || user?.avatar, name: user?.name,
    location: portfolio.location, role: portfolio.role, company: portfolio.company,
    skills: JSON.parse(portfolio.skills as string || '[]'),
    projects: JSON.parse(portfolio.projects as string || '[]'),
    milestones: JSON.parse(portfolio.milestones as string || '[]'),
    social: JSON.parse(portfolio.social as string || '{}'),
    layout: portfolio.layout, agentEnabled: !!portfolio.agent_enabled,
    visibility: JSON.parse(portfolio.visibility as string || '{}'),
  });
});

portfolioRouter.post('/ai-edit', requireAuth, (req: AuthRequest, res) => {
  const { prompt } = req.body;
  const portfolio = db.prepare('SELECT * FROM portfolios WHERE user_id = ?').get(req.userId!) as Record<string, unknown>;
  if (!portfolio) { res.status(404).json({ error: 'Portfolio not found' }); return; }

  const currentAbout = portfolio.about as string || '';
  const enhanced = `${currentAbout}\n\n[Enhanced by AI: ${prompt}]`;
  db.prepare('UPDATE portfolios SET about = ? WHERE user_id = ?').run(enhanced, req.userId);

  db.prepare(`INSERT INTO usage_events (id, user_id, provider, model, tokens_in, tokens_out, cost_usd, channel, tool) VALUES (?, ?, 'geekspace', 'built-in', ?, ?, 0, 'web', 'portfolio.update')`).run(uuid(), req.userId, prompt.length, enhanced.length);

  const updated = db.prepare('SELECT * FROM portfolios WHERE user_id = ?').get(req.userId!) as Record<string, unknown>;
  res.json(parsePortfolio(updated));
});
