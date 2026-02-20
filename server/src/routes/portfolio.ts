import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validateBody, portfolioUpdateSchema, portfolioAiEditSchema } from '../middleware/validate.js';
import { db } from '../db/index.js';
import { cacheGet, cacheSet, cacheDel } from '../services/cache.js';

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

portfolioRouter.patch('/me', requireAuth, validateBody(portfolioUpdateSchema), async (req: AuthRequest, res) => {
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

  // Invalidate public portfolio cache so visitors see fresh data
  if (portfolio?.username) {
    await cacheDel(`portfolio:${portfolio.username}`);
  }
  // Also invalidate by users.username in case portfolios.username is stale/null
  const userRow = db.prepare('SELECT username FROM users WHERE id = ?').get(req.userId) as { username: string } | undefined;
  if (userRow?.username) {
    await cacheDel(`portfolio:${userRow.username}`);
  }

  res.json(parsePortfolio(portfolio));
});

portfolioRouter.post('/ai-edit', requireAuth, validateBody(portfolioAiEditSchema), async (req: AuthRequest, res) => {
  const { prompt } = req.body;
  const portfolio = db.prepare('SELECT * FROM portfolios WHERE user_id = ?').get(req.userId!) as Record<string, unknown>;
  if (!portfolio) { res.status(404).json({ error: 'Portfolio not found' }); return; }

  const currentAbout = portfolio.about as string || '';
  const enhanced = `${currentAbout}\n\n[Enhanced by AI: ${prompt}]`;
  db.prepare('UPDATE portfolios SET about = ? WHERE user_id = ?').run(enhanced, req.userId);

  db.prepare(`INSERT INTO usage_events (id, user_id, provider, model, tokens_in, tokens_out, cost_usd, channel, tool) VALUES (?, ?, 'geekspace', 'built-in', ?, ?, 0, 'web', 'portfolio.update')`).run(uuid(), req.userId, prompt.length, enhanced.length);

  // Invalidate portfolio cache after AI edit
  const userRow2 = db.prepare('SELECT username FROM users WHERE id = ?').get(req.userId) as { username: string } | undefined;
  if (userRow2?.username) {
    await cacheDel(`portfolio:${userRow2.username}`);
  }

  const updated = db.prepare('SELECT * FROM portfolios WHERE user_id = ?').get(req.userId!) as Record<string, unknown>;
  res.json(parsePortfolio(updated));
});

// Task 5: Portfolio Magic Generate - STATIC routes must come BEFORE parameterized routes
portfolioRouter.post('/generate/:field', requireAuth, async (req: AuthRequest, res) => {
  const { field } = req.params;
  const { context } = req.body;

  const validFields = ['headline', 'about', 'skills', 'project'];
  if (!validFields.includes(field)) {
    res.status(400).json({ error: 'Invalid field' });
    return;
  }

  // Check credits
  const sub = db.prepare('SELECT credits_remaining FROM subscriptions WHERE user_id = ?').get(req.userId!) as { credits_remaining: number } | undefined;
  if (!sub || sub.credits_remaining < 5) {
    res.status(402).json({ error: 'Insufficient credits' });
    return;
  }

  // Route to cheap model
  const { routeChat } = await import('../services/llm.js');
  const prompt = `Generate a professional ${field} for a developer portfolio based on: ${context}`;

  const result = await routeChat([{ role: 'user', content: prompt }], {
    systemPrompt: 'You are a professional copywriter for developer portfolios. Be concise and impactful.',
    userCredits: sub.credits_remaining,
  });

  // Deduct credits (5 for cheap generation)
  db.prepare('UPDATE subscriptions SET credits_remaining = credits_remaining - 5 WHERE user_id = ?').run(req.userId!);

  res.json({
    generated: result.reply,
    creditsUsed: 5,
    creditsRemaining: sub.credits_remaining - 5,
  });
});

// Task 6: Portfolio Suggestions - STATIC routes before parameterized
portfolioRouter.get('/suggestions', requireAuth, async (req: AuthRequest, res) => {
  const { generatePortfolioSuggestions } = await import('../services/portfolio-suggestions.js');
  const suggestions = generatePortfolioSuggestions(req.userId!);
  res.json(suggestions);
});

portfolioRouter.post('/suggestions/:id/apply', requireAuth, async (req: AuthRequest, res) => {
  const { applySuggestion } = await import('../services/portfolio-suggestions.js');
  const success = applySuggestion(req.userId!, req.params.id);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Suggestion not found' });
  }
});

// Task 7: Agent Chat - STATIC routes before parameterized
portfolioRouter.get('/agent-messages', requireAuth, async (req: AuthRequest, res) => {
  const { getAgentMessages } = await import('../services/agent-chat.js');
  const messages = getAgentMessages(req.userId!);
  res.json(messages);
});

// PARAMETERIZED routes come AFTER all static routes
portfolioRouter.get('/:username/can-chat', requireAuth, async (req: AuthRequest, res) => {
  const { canChatWithAgent } = await import('../services/agent-chat.js');
  const canChat = canChatWithAgent(req.userId!, req.params.username);
  res.json({ canChat });
});

portfolioRouter.post('/:username/chat', requireAuth, async (req: AuthRequest, res) => {
  const { sendAgentMessage } = await import('../services/agent-chat.js');
  const { message } = req.body;

  const success = sendAgentMessage(req.userId!, req.params.username, message);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(403).json({ error: 'Agent chat not enabled for this user' });
  }
});

// Public portfolio view - MUST be last as it catches any /:username pattern
portfolioRouter.get('/:username', async (req, res) => {
  const cacheKey = `portfolio:${req.params.username}`;
  const cached = await cacheGet(cacheKey);
  if (cached) { res.json(JSON.parse(cached)); return; }

  const portfolio = db.prepare('SELECT * FROM portfolios WHERE username = ?').get(req.params.username) as Record<string, unknown> | undefined;
  if (!portfolio) { res.status(404).json({ error: 'Portfolio not found' }); return; }

  const user = db.prepare('SELECT name, avatar, bio FROM users WHERE id = ?').get(portfolio.user_id as string) as Record<string, unknown> | undefined;
  const agentConfig = db.prepare('SELECT personality FROM agent_configs WHERE user_id = ?').get(portfolio.user_id as string) as Record<string, unknown> | undefined;

  const responseData = {
    userId: portfolio.user_id, username: portfolio.username, headline: portfolio.headline,
    about: portfolio.about, avatar: portfolio.avatar || user?.avatar, name: user?.name,
    location: portfolio.location, role: portfolio.role, company: portfolio.company,
    skills: JSON.parse(portfolio.skills as string || '[]'),
    projects: JSON.parse(portfolio.projects as string || '[]'),
    milestones: JSON.parse(portfolio.milestones as string || '[]'),
    social: JSON.parse(portfolio.social as string || '{}'),
    layout: portfolio.layout, agentEnabled: !!portfolio.agent_enabled,
    visibility: JSON.parse(portfolio.visibility as string || '{}'),
    personality: (agentConfig?.personality as string) || 'jarvis',
    connectionCount: (portfolio.connection_count as number) || 0,
  };

  await cacheSet(cacheKey, JSON.stringify(responseData), 300);
  res.json(responseData);
});
