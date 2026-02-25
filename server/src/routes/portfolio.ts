import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validateBody, portfolioUpdateSchema, portfolioAiEditSchema } from '../middleware/validate.js';
import { db } from '../db/index.js';
import { cacheGet, cacheSet, cacheDel } from '../services/cache.js';
import { firePortfolioVisitAutomations } from '../services/automations-engine.js';

export const portfolioRouter = Router();

// In-memory view dedup: prevents same IP from inflating view_count within 1h
const recentViewers = new Map<string, number>(); // `${ip}:${username}` → expires_at
const VIEW_DEDUP_MS = 60 * 60 * 1000; // 1 hour

function isDuplicateView(ip: string, username: string): boolean {
  const key = `${ip}:${username}`;
  const expires = recentViewers.get(key);
  if (expires && expires > Date.now()) return true;
  // Record this view
  recentViewers.set(key, Date.now() + VIEW_DEDUP_MS);
  // Evict stale entries when Map grows large
  if (recentViewers.size > 2000) {
    const now = Date.now();
    for (const [k, exp] of recentViewers.entries()) {
      if (exp < now) recentViewers.delete(k);
    }
  }
  return false;
}

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

// 42.4: GET /me/stats — view_count, contact_count, project_count, last_viewed_at
portfolioRouter.get('/me/stats', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const portfolio = db.prepare('SELECT * FROM portfolios WHERE user_id = ?').get(userId) as Record<string, unknown> | undefined;
  if (!portfolio) { res.status(404).json({ error: 'Portfolio not found' }); return; }

  const viewCount = (portfolio.view_count as number) ?? 0;

  // contact_count from portfolio_contacts table
  const contactRow = db.prepare('SELECT COUNT(*) as cnt FROM portfolio_contacts WHERE user_id = ?').get(userId) as { cnt: number };
  const contactCount = contactRow.cnt;

  // project_count from JSON array
  let projectCount = 0;
  try {
    const projects = JSON.parse(portfolio.projects as string || '[]');
    projectCount = Array.isArray(projects) ? projects.length : 0;
  } catch { projectCount = 0; }

  // last_viewed_at — use last_viewed_at column if it exists; fall back to null
  const hasLastViewed = portfolio.last_viewed_at !== undefined;
  const lastViewedAt = hasLastViewed ? (portfolio.last_viewed_at as string | null) : null;

  res.json({ view_count: viewCount, contact_count: contactCount, project_count: projectCount, last_viewed_at: lastViewedAt });
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

// Agent status endpoint for portfolio view - returns Active/Inactive status
portfolioRouter.get('/:username/agent-status', async (req, res) => {
  const { username } = req.params;

  // Get user and portfolio info
  const user = db.prepare('SELECT id, username FROM users WHERE username = ?').get(username) as { id: string; username: string } | undefined;
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const portfolio = db.prepare('SELECT agent_enabled FROM portfolios WHERE user_id = ?').get(user.id) as { agent_enabled: number } | undefined;

  // Agent is disabled at portfolio level
  if (!portfolio || !portfolio.agent_enabled) {
    res.json({
      status: 'inactive',
      reason: 'Agent chat is disabled for this portfolio',
      enabled: false,
      lastActive: null,
    });
    return;
  }

  // Check agent config for last_active timestamp
  const agentConfig = db.prepare('SELECT last_active FROM agent_configs WHERE user_id = ?').get(user.id) as { last_active: number } | undefined;

  // Define "active" as having activity within last 30 minutes, or if no last_active recorded, assume active
  const now = Date.now();
  const thirtyMinutes = 30 * 60 * 1000;
  const lastActive = agentConfig?.last_active || now;
  const isRecentlyActive = (now - lastActive) < thirtyMinutes;

  // Status logic: Active if agent_enabled AND (has recent activity OR no last_active recorded yet)
  const isActive = portfolio.agent_enabled && (isRecentlyActive || !agentConfig?.last_active);

  res.json({
    status: isActive ? 'active' : 'inactive',
    enabled: true,
    lastActive,
    inactiveSince: isActive ? null : lastActive,
    reason: isActive ? undefined : 'Agent has been inactive for more than 30 minutes',
  });
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

  const success = await sendAgentMessage(req.userId!, req.params.username, message);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(403).json({ error: 'Agent chat not enabled for this user' });
  }
});

// ── Portfolio Visit Stats ─────────────────────────────────────
portfolioRouter.get('/stats', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const totalViews = (db.prepare('SELECT COUNT(*) as cnt FROM portfolio_visits WHERE user_id = ?').get(userId) as { cnt: number }).cnt;
  const recentViews = (db.prepare(
    "SELECT COUNT(*) as cnt FROM portfolio_visits WHERE user_id = ? AND visited_at >= datetime('now', '-7 days')"
  ).get(userId) as { cnt: number }).cnt;
  // Daily breakdown for the last 30 days
  const dailyBreakdown = db.prepare(`
    SELECT date(visited_at) as date, COUNT(*) as count
    FROM portfolio_visits
    WHERE user_id = ? AND visited_at >= datetime('now', '-30 days')
    GROUP BY date(visited_at)
    ORDER BY date ASC
  `).all(userId) as { date: string; count: number }[];
  res.json({ totalViews, recentViews, dailyBreakdown });
});

// ── Portfolio Stats CSV Export ────────────────────────────────
portfolioRouter.get('/stats/export', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const dailyBreakdown = db.prepare(`
    SELECT date(visited_at) as date, COUNT(*) as count
    FROM portfolio_visits
    WHERE user_id = ? AND visited_at >= datetime('now', '-90 days')
    GROUP BY date(visited_at)
    ORDER BY date ASC
  `).all(userId) as { date: string; count: number }[];

  const lines: string[] = ['date,visits'];
  for (const row of dailyBreakdown) {
    lines.push(`${row.date},${row.count}`);
  }
  const csv = lines.join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="portfolio-visits.csv"');
  res.send(csv);
});

// ── 37.1: Portfolio contact form (public, rate-limited) ──────────────────────
const contactRateLimit = new Map<string, { count: number; windowStart: number }>();

portfolioRouter.post('/:username/contact', async (req, res) => {
  const { username } = req.params;
  const { senderName, senderEmail, message, honeypot } = req.body as { senderName?: string; senderEmail?: string; message?: string; honeypot?: string };

  // 40.2: Honeypot — bots fill hidden fields; silently accept and discard
  if (honeypot) {
    res.json({ success: true });
    return;
  }

  if (!senderName?.trim() || !message?.trim()) {
    res.status(400).json({ error: 'Name and message are required' });
    return;
  }
  if (message.length > 1000) {
    res.status(400).json({ error: 'Message too long (max 1000 characters)' });
    return;
  }

  // IP-based rate limit: max 3 requests per hour per IP
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
  const now = Date.now();
  const rlEntry = contactRateLimit.get(ip);
  if (rlEntry && now - rlEntry.windowStart < 3600000) {
    if (rlEntry.count >= 3) {
      res.status(429).json({ error: 'Too many requests, please try again later' });
      return;
    }
    rlEntry.count++;
  } else {
    contactRateLimit.set(ip, { count: 1, windowStart: now });
  }

  const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: string } | undefined;
  if (!user) { res.status(404).json({ error: 'Not found' }); return; }

  const portfolio = db.prepare('SELECT is_public FROM portfolios WHERE user_id = ?').get(user.id) as { is_public: number } | undefined;
  if (!portfolio?.is_public) { res.status(404).json({ error: 'Not found' }); return; }

  const id = uuid();
  db.prepare(
    'INSERT INTO portfolio_contacts (id, username, user_id, sender_name, sender_email, message) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, username, user.id, senderName.trim(), senderEmail?.trim() || null, message.trim());

  // Notify owner via Telegram if linked
  const link = db.prepare(
    "SELECT external_id FROM channel_links WHERE user_id = ? AND channel = 'telegram' AND is_verified = 1"
  ).get(user.id) as { external_id: string } | undefined;
  if (link) {
    const { sendTelegramMessage } = await import('../services/telegram.js');
    sendTelegramMessage(
      link.external_id,
      `📩 Portfolio message from ${senderName.trim()}: "${message.slice(0, 200)}${message.length > 200 ? '…' : ''}"`
    ).catch(() => {});
  }

  res.json({ success: true });
});

// GET portfolio contacts (authenticated — owner only)
portfolioRouter.get('/contacts', requireAuth, (req: AuthRequest, res) => {
  const contacts = db.prepare(
    'SELECT id, sender_name, sender_email, message, created_at FROM portfolio_contacts WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).all(req.userId!) as Array<{ id: string; sender_name: string; sender_email: string | null; message: string; created_at: string }>;
  res.json(contacts);
});

// ── 34.3: Public view counter (no auth — fire-and-forget on portfolio page load) ──
portfolioRouter.post('/:username/view', (req, res) => {
  const { username } = req.params;
  const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: string } | undefined;
  if (!user) { res.status(404).json({ error: 'Not found' }); return; }
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
  if (!isDuplicateView(ip, username)) {
    db.prepare('UPDATE portfolios SET view_count = view_count + 1 WHERE user_id = ?').run(user.id);
  }
  res.json({ ok: true });
});

// Public portfolio view - MUST be last as it catches any /:username pattern
// 27.2: Detect crawlers/bots for social preview meta tags
function isCrawler(userAgent: string): boolean {
  return /bot|spider|crawler|slack|discord|telegram|whatsapp|facebook|twitter|linkedinbot|preview|unfurl/i.test(userAgent);
}

portfolioRouter.get('/:username', async (req, res) => {
  // 27.2: Return OG HTML for social crawlers instead of JSON
  const ua = req.headers['user-agent'] || '';
  if (isCrawler(ua)) {
    const username = req.params.username;
    const row = db.prepare(
      'SELECT p.headline, p.about, p.avatar, u.name FROM portfolios p JOIN users u ON u.id = p.user_id WHERE p.username = ?'
    ).get(username) as { headline: string; about: string; avatar: string; name: string } | undefined;
    if (!row) { res.status(404).send('<html><body>Portfolio not found</body></html>'); return; }
    const title = `${row.name || username} — GeekSpace Portfolio`;
    const description = row.headline || row.about?.slice(0, 160) || 'View this portfolio on GeekSpace.';
    const imageUrl = row.avatar && !row.avatar.match(/^[A-Z]{1,2}$/)
      ? row.avatar
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(row.name || username)}&background=00F0FF&color=05050A&size=256`;
    const pageUrl = `https://ai.geekspace.space/p/${username}`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:type" content="profile" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${imageUrl}" />
</head>
<body>
  <h1>${title}</h1>
  <p>${description}</p>
</body>
</html>`);
    return;
  }

  const cacheKey = `portfolio:${req.params.username}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    // Record visit even for cached responses
    try {
      const cachedData = JSON.parse(cached) as { userId?: string };
      if (cachedData.userId) {
        const visitorIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || null;
        const recentVisit = db.prepare(
          "SELECT id FROM portfolio_visits WHERE user_id = ? AND visitor_ip = ? AND visited_at >= datetime('now', '-30 minutes')"
        ).get(cachedData.userId, visitorIp);
        if (!recentVisit) {
          db.prepare('INSERT INTO portfolio_visits (user_id, visitor_ip) VALUES (?, ?)').run(cachedData.userId, visitorIp);
          firePortfolioVisitAutomations(cachedData.userId, visitorIp);
        }
      }
    } catch { /* non-fatal */ }
    res.json(JSON.parse(cached));
    return;
  }

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
    viewCount: (portfolio.view_count as number) || 0,
  };

  // Record visit (deduplicated: same IP within 30 minutes counts as one visit)
  try {
    const visitorIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || null;
    const recentVisit = db.prepare(
      "SELECT id FROM portfolio_visits WHERE user_id = ? AND visitor_ip = ? AND visited_at >= datetime('now', '-30 minutes')"
    ).get(portfolio.user_id, visitorIp);
    if (!recentVisit) {
      db.prepare('INSERT INTO portfolio_visits (user_id, visitor_ip) VALUES (?, ?)').run(portfolio.user_id, visitorIp);
      firePortfolioVisitAutomations(portfolio.user_id as string, visitorIp);
    }
  } catch { /* non-fatal */ }

  await cacheSet(cacheKey, JSON.stringify(responseData), 300);
  res.json(responseData);
});
