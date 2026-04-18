import { Router } from 'express';
import { randomBytes } from 'crypto';
import { v4 as uuid } from 'uuid';
import { requireAuth, signGuestToken, type AuthRequest } from '../../middleware/auth.js';
import { validateBody, portfolioUpdateSchema, portfolioAiEditSchema } from '../../middleware/validate.js';
import { db } from '../../db/index.js';
import { cacheGet, cacheSet, cacheDel } from '../../services/cache.js';
import { firePortfolioVisitAutomations } from '../../services/automations-engine.js';
import { config } from '../../config.js';
import { logger } from '../../logger.js';

export const portfolioRouter = Router();

/** Encode characters that have special meaning in HTML to prevent XSS and broken markup. */
function htmlEncode(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/** Strip dangerous HTML while preserving basic formatting. */
function stripDangerousHtml(input: unknown): string {
  if (typeof input !== 'string') return String(input ?? '');
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?\/?\s*>/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '')
    .replace(/<(?!\/?(?:b|i|em|strong|p|br|ul|ol|li|a)\b)[^>]+>/gi, '');
}

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

function safeJsonParse<T>(val: unknown, fallback: T): T {
  try { return JSON.parse(val as string || String(fallback)) as T; } catch { return fallback; }
}

const parsePortfolio = (row: Record<string, unknown>) => ({
  ...row,
  skills: safeJsonParse(row.skills, [] as unknown[]),
  projects: safeJsonParse(row.projects, [] as unknown[]),
  milestones: safeJsonParse(row.milestones, [] as unknown[]),
  social: safeJsonParse(row.social, {} as Record<string, unknown>),
  visibility: safeJsonParse(row.visibility, {} as Record<string, unknown>),
  agentEnabled: !!row.agent_enabled,
  isPublic: !!row.is_public,
});

portfolioRouter.get('/me', requireAuth, (req: AuthRequest, res) => {
  const portfolio = db.prepare('SELECT * FROM portfolios WHERE user_id = ?').get(req.userId!) as Record<string, unknown> | undefined;
  if (!portfolio) { res.status(404).json({ error: 'Portfolio not found' }); return; }
  // 52.5: Explicitly no-store for authenticated private data
  res.set('Cache-Control', 'private, no-store');
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

// 65.10: GET /me/analytics/sources — top visitor referrer domains (last 30 days)
portfolioRouter.get('/me/analytics/sources', requireAuth, (req: AuthRequest, res) => {
  const userId = req.userId!;
  const sources = db.prepare(
    `SELECT COALESCE(referer_host, 'Direct') as source, COUNT(*) as visits
     FROM portfolio_visits
     WHERE user_id = ? AND visited_at >= datetime('now', '-30 days')
     GROUP BY referer_host ORDER BY visits DESC LIMIT 10`
  ).all(userId) as Array<{ source: string; visits: number }>;
  res.json({ sources });
});

// 63.2 + 64.7: GET /me/analytics/export — CSV export (rate-limited: 10/5min per user)
portfolioRouter.get('/me/analytics/export', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  // 64.7: Redis-based rate limit (10 exports per 5 min per user)
  const rlKey = `portfolio:analytics-export-rl:${userId}`;
  try {
    const current = await cacheGet(rlKey);
    const count = current ? parseInt(current, 10) : 0;
    if (count >= 10) {
      res.status(429).json({ error: 'Too many export requests. Try again in a few minutes.' });
      return;
    }
    await cacheSet(rlKey, String(count + 1), 300);
  } catch { /* Redis unavailable — allow through */ }

  // 66.3: Optional date-range filter for analytics export
  const fromDate = typeof req.query.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.from) ? req.query.from : null;
  const toDate = typeof req.query.to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.to) ? req.query.to : null;

  let rows: Array<{ day: string; views: number }>;
  if (fromDate && toDate) {
    rows = db.prepare(
      `SELECT date(visited_at) as day, COUNT(*) as views
       FROM portfolio_visits WHERE user_id = ? AND date(visited_at) >= ? AND date(visited_at) <= ?
       GROUP BY day ORDER BY day ASC`
    ).all(userId, fromDate, toDate) as Array<{ day: string; views: number }>;
  } else {
    rows = db.prepare(
      `SELECT date(visited_at) as day, COUNT(*) as views
       FROM portfolio_visits WHERE user_id = ? AND visited_at >= date('now', '-30 days')
       GROUP BY day ORDER BY day ASC`
    ).all(userId) as Array<{ day: string; views: number }>;
  }

  let csv = 'date,views\n';
  for (const r of rows) { csv += `${r.day},${r.views}\n`; }

  res.set('Content-Type', 'text/csv');
  res.set('Content-Disposition', 'attachment; filename="portfolio-analytics.csv"');
  res.send(csv);
});

// 59.5: Portfolio update rate limit — 10 updates per 5 minutes per user
portfolioRouter.patch('/me', requireAuth, validateBody(portfolioUpdateSchema), async (req: AuthRequest, res) => {
  const rlKey = `portfolio:update-rl:${req.userId}`;
  try {
    const current = await cacheGet(rlKey);
    const count = current ? parseInt(current, 10) : 0;
    if (count >= 10) {
      res.status(429).json({ error: 'Too many portfolio updates. Please wait a few minutes.' });
      return;
    }
    // Increment; set TTL 5min on first call
    const newCount = count + 1;
    await cacheSet(rlKey, String(newCount), 300);
  } catch { /* Redis unavailable — allow request through */ }

  const updates = req.body;
  const fields: string[] = [];
  const values: unknown[] = [];

  // 59.9: Handle metaDescription → meta_description column
  if (updates.metaDescription !== undefined) {
    fields.push('meta_description = ?'); values.push(updates.metaDescription);
  }

  // Sanitize free-text fields before storing
  for (const f of ['headline', 'about', 'avatar', 'location', 'role', 'company', 'layout']) {
    if (updates[f] !== undefined) {
      const sanitized = typeof updates[f] === 'string' ? stripDangerousHtml(updates[f]) : updates[f];
      fields.push(`${f} = ?`); values.push(sanitized);
    }
  }
  for (const [k, col] of Object.entries({ skills: 'skills', projects: 'projects', milestones: 'milestones', social: 'social', visibility: 'visibility' })) {
    if (updates[k] !== undefined) {
      let val = updates[k];
      // Sanitize project name, title (alias), and description fields
      if (k === 'projects' && Array.isArray(val)) {
        val = val.map((proj: Record<string, unknown>) => ({
          ...proj,
          name: typeof proj.name === 'string' ? stripDangerousHtml(proj.name) : proj.name,
          title: typeof proj.title === 'string' ? stripDangerousHtml(proj.title) : proj.title,
          description: typeof proj.description === 'string' ? stripDangerousHtml(proj.description) : proj.description,
        }));
      }
      fields.push(`${col} = ?`); values.push(JSON.stringify(val));
    }
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
  const { routeChat } = await import('../../services/llm.js');
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
  const { generatePortfolioSuggestions } = await import('./services.js');
  const suggestions = generatePortfolioSuggestions(req.userId!);
  res.json(suggestions);
});

portfolioRouter.post('/suggestions/:id/apply', requireAuth, async (req: AuthRequest, res) => {
  const { applySuggestion } = await import('./services.js');
  const success = applySuggestion(req.userId!, req.params.id);
  if (success) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Suggestion not found' });
  }
});

// Task 7: Agent Chat - STATIC routes before parameterized
portfolioRouter.get('/agent-messages', requireAuth, async (req: AuthRequest, res) => {
  const { getAgentMessages } = await import('../../services/agent-chat.js');
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

  // 52.5: Cache agent status for 30s — polled by portfolio view, changes slowly
  res.set('Cache-Control', 'public, max-age=30, s-maxage=30');
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
  const { canChatWithAgent } = await import('../../services/agent-chat.js');
  const canChat = canChatWithAgent(req.userId!, req.params.username);
  res.json({ canChat });
});

portfolioRouter.post('/:username/chat', requireAuth, async (req: AuthRequest, res) => {
  const { sendAgentMessage } = await import('../../services/agent-chat.js');
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
  // 58.3: Daily breakdown — all 30 days filled with zeros (no gaps)
  const rawBreakdown = db.prepare(`
    SELECT date(visited_at) as date, COUNT(*) as count
    FROM portfolio_visits
    WHERE user_id = ? AND visited_at >= datetime('now', '-30 days')
    GROUP BY date(visited_at)
    ORDER BY date ASC
  `).all(userId) as { date: string; count: number }[];
  const countMap = new Map(rawBreakdown.map((r) => [r.date, r.count]));
  const dailyBreakdown: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    dailyBreakdown.push({ date: ds, count: countMap.get(ds) ?? 0 });
  }
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

// 49.7: Issue a one-time nonce for the contact form. The nonce prevents replay attacks:
// the frontend fetches a fresh token before every submission, and the server consumes it on first use.
portfolioRouter.get('/:username/contact-nonce', async (req, res) => {
  const { username } = req.params;
  const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: string } | undefined;
  if (!user) { res.status(404).json({ error: 'Not found' }); return; }
  const nonce = randomBytes(16).toString('hex');
  await cacheSet(`portfolio:nonce:${nonce}`, username, 900); // 15-minute TTL
  res.json({ nonce });
});

portfolioRouter.post('/:username/contact', async (req, res) => {
  const { username } = req.params;
  const { senderName, senderEmail, message, honeypot, nonce } = req.body as { senderName?: string; senderEmail?: string; message?: string; honeypot?: string; nonce?: string };

  // 48.6: Origin validation — reject requests from disallowed origins
  // Requests with no Origin (e.g., server-side curl) are allowed through.
  const requestOrigin = req.headers.origin;
  if (requestOrigin) {
    const allowedOrigins = config.corsOrigins;
    if (!allowedOrigins.includes(requestOrigin)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
  }

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
  // 46.6: Validate email format when provided
  if (senderEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail.trim())) {
    res.status(400).json({ error: 'Invalid email address' });
    return;
  }

  // Sanitize user-supplied fields to prevent XSS in stored content
  const sanitizedSenderName = stripDangerousHtml(senderName);
  const sanitizedMessage = stripDangerousHtml(message);

  // 49.6: IP-based rate limit using Redis (shared across PM2 workers; max 3 req/hr per IP)
  // Falls back to allow-through if Redis is unavailable.
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
  const rlKey = `portfolio:contact:rl:${ip}`;
  try {
    const rlRaw = await cacheGet(rlKey);
    const rlCount = rlRaw ? parseInt(rlRaw, 10) : 0;
    if (rlCount >= 3) {
      // 51.9: Log rate-limit block event
      logger.warn({ event: 'portfolio_contact_blocked', username, ip, reason: 'rate_limit' }, 'Portfolio contact rate-limited');
      res.status(429).json({ error: 'Too many requests, please try again later' });
      return;
    }
    await cacheSet(rlKey, String(rlCount + 1), 3600); // TTL = 1 hour
  } catch { /* Redis unavailable — allow through (non-fatal) */ }

  // 49.7: Validate one-time nonce if provided (silently skip validation when Redis is unavailable)
  if (nonce) {
    try {
      const nonceOwner = await cacheGet(`portfolio:nonce:${nonce}`);
      if (!nonceOwner || nonceOwner !== username) {
        // 51.9: Log nonce failure event
        logger.warn({ event: 'portfolio_contact_blocked', username, ip, reason: 'nonce_invalid' }, 'Portfolio contact nonce invalid or expired');
        res.status(422).json({ error: 'Invalid or expired form token. Please reload and try again.' });
        return;
      }
      await cacheDel(`portfolio:nonce:${nonce}`); // One-time use: consume immediately
    } catch { /* Redis unavailable — allow through */ }
  }

  const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: string } | undefined;
  if (!user) { res.status(404).json({ error: 'Not found' }); return; }

  const portfolio = db.prepare('SELECT is_public FROM portfolios WHERE user_id = ?').get(user.id) as { is_public: number } | undefined;
  if (!portfolio?.is_public) { res.status(404).json({ error: 'Not found' }); return; }

  const id = uuid();
  db.prepare(
    'INSERT INTO portfolio_contacts (id, username, user_id, sender_name, sender_email, message) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, username, user.id, sanitizedSenderName.trim(), senderEmail?.trim() || null, sanitizedMessage.trim());

  // 51.9: Log successful contact submission
  logger.info({ event: 'portfolio_contact_success', username, ip, hasEmail: !!senderEmail }, 'Portfolio contact message received');

  // Notify owner via Telegram if linked
  const link = db.prepare(
    "SELECT external_id FROM channel_links WHERE user_id = ? AND channel = 'telegram' AND is_verified = 1"
  ).get(user.id) as { external_id: string } | undefined;
  if (link) {
    const { sendTelegramMessage } = await import('../../services/telegram.js');
    sendTelegramMessage(
      link.external_id,
      `📩 Portfolio message from ${sanitizedSenderName.trim()}: "${sanitizedMessage.slice(0, 200)}${sanitizedMessage.length > 200 ? '…' : ''}"`
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

// 66.3: DELETE /contacts/:id — delete a single contact message (owner only)
portfolioRouter.delete('/contacts/:id', requireAuth, (req: AuthRequest, res) => {
  const result = db.prepare('DELETE FROM portfolio_contacts WHERE id = ? AND user_id = ?').run(req.params.id, req.userId!);
  if (result.changes === 0) { res.status(404).json({ error: 'Contact not found' }); return; }
  res.json({ success: true });
});

// 66.3: DELETE /contacts — clear all contact messages (owner only)
portfolioRouter.delete('/contacts', requireAuth, (req: AuthRequest, res) => {
  const result = db.prepare('DELETE FROM portfolio_contacts WHERE user_id = ?').run(req.userId!);
  res.json({ deleted: result.changes });
});

// ── Visitor guest token — issues a short-lived JWT so visitors can chat without signing up ──
// IP rate limit: 5 tokens/hour per IP (prevents token farming).
// The returned token is stored in localStorage by the frontend and sent as Bearer on each chat message.
portfolioRouter.post('/:username/visitor-token', async (req, res) => {
  const { username } = req.params;

  const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: string } | undefined;
  if (!user) { res.status(404).json({ error: 'Not found' }); return; }

  const portfolio = db.prepare('SELECT is_public FROM portfolios WHERE user_id = ?').get(user.id) as { is_public: number } | undefined;
  if (!portfolio?.is_public) { res.status(404).json({ error: 'Not found' }); return; }

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
  const rlKey = `portfolio:guest:token:rl:${ip}`;
  try {
    const rlRaw = await cacheGet(rlKey);
    const count = rlRaw ? parseInt(rlRaw, 10) : 0;
    if (count >= 5) {
      res.status(429).json({ error: 'Too many requests. Please try again later.' });
      return;
    }
    await cacheSet(rlKey, String(count + 1), 3600);
  } catch { /* Redis unavailable — allow through */ }

  const token = signGuestToken(username);
  logger.info({ event: 'guest_token_issued', username, ip }, 'Guest visitor token issued');
  res.json({ token, expiresIn: 3600 });
});

// ── Visitor intent ping — fires when visitor spends 60s+ from a professional source ──
// No auth required. Responds immediately; Telegram alert sent async (non-blocking).
portfolioRouter.post('/:username/ping', async (req, res) => {
  res.json({ ok: true }); // respond immediately — don't block client

  try {
    const { username } = req.params;
    const { duration_seconds, referrer } = req.body as { duration_seconds?: number; referrer?: string };

    if (!duration_seconds || duration_seconds < 60) return;

    const professionalSources = ['linkedin.com', 'github.com', 'google.com', 'twitter.com', 'x.com'];
    const ref = referrer || '';
    const matchedSource = professionalSources.find(s => ref.includes(s));
    if (!matchedSource) return;

    // portfolios table is keyed by user_id — look up via username → user_id
    const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: string } | undefined;
    if (!user) return;

    // Verify portfolio exists and is public
    const portfolio = db.prepare('SELECT is_public FROM portfolios WHERE user_id = ?').get(user.id) as { is_public: number } | undefined;
    if (!portfolio?.is_public) return;

    // Get owner's verified Telegram chat id
    const link = db.prepare(
      "SELECT external_id FROM channel_links WHERE user_id = ? AND channel = 'telegram' AND is_verified = 1"
    ).get(user.id) as { external_id: string } | undefined;
    if (!link) return;

    const sourceName = matchedSource.replace('.com', '');
    const secs = Math.round(duration_seconds);
    const msg = `👤 Portfolio Alert: Someone spent ${secs}s reading your portfolio (via ${sourceName}). Looks like a serious lead! 🎯`;

    const { sendTelegramMessage } = await import('../../services/telegram.js');
    await sendTelegramMessage(link.external_id, msg);

    logger.info({ event: 'portfolio_intent_ping', username, sourceName, duration_seconds: secs }, 'Portfolio intent alert sent');
  } catch {
    // Non-fatal — never let this affect the response
  }
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
      'SELECT p.headline, p.about, p.avatar, p.meta_description, u.name FROM portfolios p JOIN users u ON u.id = p.user_id WHERE p.username = ?'
    ).get(username) as { headline: string; about: string; avatar: string; meta_description: string | null; name: string } | undefined;
    if (!row) { res.status(404).send('<html><body>Portfolio not found</body></html>'); return; }
    const title = `${row.name || username} — Agentin Portfolio`;
    // 59.9: Prefer explicit meta_description over auto-generated fallback
    const description = row.meta_description || row.headline || row.about?.slice(0, 160) || 'View this portfolio on Agentin.';
    const imageUrl = row.avatar && !row.avatar.match(/^[A-Z]{1,2}$/)
      ? row.avatar
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(row.name || username)}&background=00F0FF&color=05050A&size=256`;
    const pageUrl = `${config.publicUrl}/p/${username}`;
    const safeTitle = htmlEncode(title);
    const safeDescription = htmlEncode(description);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${safeTitle}</title>
  <meta name="description" content="${safeDescription}" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDescription}" />
  <meta property="og:image" content="${htmlEncode(imageUrl)}" />
  <meta property="og:url" content="${htmlEncode(pageUrl)}" />
  <meta property="og:type" content="profile" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDescription}" />
  <meta name="twitter:image" content="${htmlEncode(imageUrl)}" />
</head>
<body>
  <h1>${safeTitle}</h1>
  <p>${safeDescription}</p>
</body>
</html>`);
    return;
  }

  const cacheKey = `portfolio:${req.params.username}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    // Record visit even for cached responses
    try {
      const cachedData = JSON.parse(cached) as { userId?: string; viewCount?: number };
      if (cachedData.userId) {
        const visitorIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || null;
        const recentVisit = db.prepare(
          "SELECT id FROM portfolio_visits WHERE user_id = ? AND visitor_ip = ? AND visited_at >= datetime('now', '-30 minutes')"
        ).get(cachedData.userId, visitorIp);
        if (!recentVisit) {
          // 65.10: Capture referer host for visitor source analytics
          const refererHost = (() => { try { return req.headers.referer ? new URL(req.headers.referer).hostname : null; } catch { return null; } })();
          db.prepare('INSERT INTO portfolio_visits (user_id, visitor_ip, referer_host) VALUES (?, ?, ?)').run(cachedData.userId, visitorIp, refererHost);
          firePortfolioVisitAutomations(cachedData.userId, visitorIp);
        }
      }

      // 45.8: ETag + Cache-Control for cached responses
      const etag = `"${Buffer.from(JSON.stringify({ id: cachedData.userId, vc: cachedData.viewCount ?? 0 })).toString('base64')}"`;
      res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
      res.set('ETag', etag);
      if (req.headers['if-none-match'] === etag) {
        res.status(304).end();
        return;
      }
    } catch { /* non-fatal */ }
    try {
      res.json(JSON.parse(cached));
      return;
    } catch { /* corrupted cache — fall through to DB */ }
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
      // 65.10: Capture referer host
      const refererHost2 = (() => { try { return req.headers.referer ? new URL(req.headers.referer).hostname : null; } catch { return null; } })();
      db.prepare('INSERT INTO portfolio_visits (user_id, visitor_ip, referer_host) VALUES (?, ?, ?)').run(portfolio.user_id, visitorIp, refererHost2);
      firePortfolioVisitAutomations(portfolio.user_id as string, visitorIp);
    }
  } catch { /* non-fatal */ }

  await cacheSet(cacheKey, JSON.stringify(responseData), 300);

  // 45.8: ETag + Cache-Control for fresh responses
  const etag = `"${Buffer.from(JSON.stringify({ id: responseData.userId, vc: responseData.viewCount })).toString('base64')}"`;
  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
  res.set('ETag', etag);
  if (req.headers['if-none-match'] === etag) {
    res.status(304).end();
    return;
  }

  res.json(responseData);
});
