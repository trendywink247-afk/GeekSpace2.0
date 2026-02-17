import { Router } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validateBody, billingUpgradeSchema } from '../middleware/validate.js';
import { db } from '../db/index.js';
import { PLAN_DEFINITIONS } from '../db/index.js';
import { v4 as uuid } from 'uuid';
import { cacheGet, cacheSet } from '../services/cache.js';

export const billingRouter = Router();

// GET /api/billing/plans — list all available plans
billingRouter.get('/plans', async (_req, res) => {
  const cacheKey = 'billing:plans';
  const cached = await cacheGet(cacheKey);
  if (cached) { res.json(JSON.parse(cached)); return; }

  const plans = Object.entries(PLAN_DEFINITIONS).map(([id, plan]) => ({
    id,
    ...plan,
  }));
  await cacheSet(cacheKey, JSON.stringify(plans), 3600);
  res.json(plans);
});

// GET /api/billing/plan — current plan and credits
billingRouter.get('/plan', requireAuth, (req: AuthRequest, res) => {
  const sub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(req.userId!);
  if (!sub) {
    // Create default free subscription
    const id = uuid();
    db.prepare(`INSERT INTO subscriptions (id, user_id) VALUES (?, ?)`).run(id, req.userId);
    const created = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(id);
    res.json(created);
    return;
  }
  res.json(sub);
});

// POST /api/billing/upgrade — change plan (stub — no real payment yet)
billingRouter.post('/upgrade', requireAuth, validateBody(billingUpgradeSchema), (req: AuthRequest, res) => {
  const { plan, currency } = req.body;
  const planInfo = PLAN_DEFINITIONS[plan];
  if (!planInfo) { res.status(400).json({ error: 'Invalid plan' }); return; }

  const cur = currency === 'INR' ? 'INR' : 'USD';
  const cycleEnd = `+${planInfo.intervalDays} days`;

  db.prepare(`
    INSERT INTO subscriptions (id, user_id, plan, monthly_credits, credits_remaining, billing_interval_days, billing_cycle_start, billing_cycle_end, price_usd, price_inr, currency)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now', ?), ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      plan = excluded.plan,
      monthly_credits = excluded.monthly_credits,
      credits_remaining = excluded.credits_remaining,
      credits_used_this_cycle = 0,
      billing_interval_days = excluded.billing_interval_days,
      billing_cycle_start = excluded.billing_cycle_start,
      billing_cycle_end = excluded.billing_cycle_end,
      price_usd = excluded.price_usd,
      price_inr = excluded.price_inr,
      currency = excluded.currency
  `).run(uuid(), req.userId, plan, planInfo.credits, planInfo.credits, planInfo.intervalDays, cycleEnd, planInfo.priceUsd, planInfo.priceInr, cur);

  const updated = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(req.userId!);
  res.json(updated);
});

// GET /api/billing/usage — daily usage for current cycle
billingRouter.get('/usage', requireAuth, (req: AuthRequest, res) => {
  const usage = db.prepare(`
    SELECT date(created_at) as day, SUM(cost_usd) as total_cost, COUNT(*) as calls, SUM(tokens_in + tokens_out) as total_tokens
    FROM usage_events
    WHERE user_id = ? AND created_at >= datetime('now', '-30 days')
    GROUP BY date(created_at)
    ORDER BY day DESC
  `).all(req.userId!);
  res.json(usage);
});

// POST /api/billing/day-pass — $1 for 24hr PicoClaw access (free users only)
billingRouter.post('/day-pass', requireAuth, async (req: AuthRequest, res) => {
  const sub = db.prepare('SELECT plan FROM subscriptions WHERE user_id = ?').get(req.userId!) as { plan: string } | undefined;
  if (sub?.plan !== 'free') {
    res.status(400).json({ error: 'Day pass is only available on the free plan. Upgrade for full access.' });
    return;
  }

  // Check for active day pass
  const activePas = db.prepare(
    "SELECT id FROM day_passes WHERE user_id = ? AND expires_at > datetime('now')"
  ).get(req.userId!) as { id: string } | undefined;
  if (activePas) {
    res.status(400).json({ error: 'You already have an active day pass.' });
    return;
  }

  // Grant the pass (payment hook to be added later)
  const id = uuid();
  db.prepare(`
    INSERT INTO day_passes (id, user_id, expires_at, credits_granted)
    VALUES (?, ?, datetime('now', '+1 day'), 2000)
  `).run(id, req.userId);

  // Grant 2000 bonus credits
  db.prepare(
    'UPDATE subscriptions SET credits_remaining = credits_remaining + 2000 WHERE user_id = ?'
  ).run(req.userId!);

  res.json({ message: 'Day pass activated! You have 24 hours of PicoClaw access.', expiresAt: new Date(Date.now() + 86400000).toISOString() });
});

// GET /api/billing/day-pass — check if user has active day pass
billingRouter.get('/day-pass', requireAuth, (req: AuthRequest, res) => {
  const pass = db.prepare(
    "SELECT expires_at FROM day_passes WHERE user_id = ? AND expires_at > datetime('now') ORDER BY expires_at DESC LIMIT 1"
  ).get(req.userId!) as { expires_at: string } | undefined;
  res.json({ active: !!pass, expiresAt: pass?.expires_at || null });
});
