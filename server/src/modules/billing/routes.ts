import { Router } from 'express';
import express from 'express';
import crypto from 'crypto';
import { requireAuth, type AuthRequest } from '../../middleware/auth.js';
import { createCheckoutSession, createDayPassCheckoutSession, handleWebhook, getStatus, hasActiveDayPass } from './services/stripe.js';
import { createRazorpayOrder, verifyRazorpaySignature, razorpayEnabled } from './services/razorpay.js';
import { config } from '../../config.js';
import { validateBody, billingUpgradeSchema } from '../../middleware/validate.js';
import { db } from '../../db/index.js';
import { PLAN_DEFINITIONS } from '../../db/index.js';
import { v4 as uuid } from 'uuid';
import { cacheGet, cacheSet } from '../../services/cache.js';
import { logger } from '../../logger.js';
import { withAgentinError } from '../../middleware/error-handler.js';
import { ValidationError, ServiceUnavailableError } from '../../errors/index.js';

export const billingRouter = Router();

// GET /api/billing/plans — list all available plans
// FIX P1-4: Removed hidden filter for 'monthly' — all plans visible so monthly users see their plan
billingRouter.get('/plans', async (_req, res) => {
  const cacheKey = 'billing:plans';
  const cached = await cacheGet(cacheKey);
  if (cached) { res.json(JSON.parse(cached)); return; }

  const plans = Object.entries(PLAN_DEFINITIONS)
    .map(([id, plan]) => ({ id, ...plan }));
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

// POST /api/billing/upgrade — change plan
// FIX P1-3: If Stripe is configured, require going through /checkout (not this bypass stub).
// In dev/test mode (no Stripe), allow direct plan switching for testing.
billingRouter.post('/upgrade', requireAuth, validateBody(billingUpgradeSchema), (req: AuthRequest, res) => {
  // Block free upgrades when Stripe is configured — use /checkout instead
  if (config.stripeEnabled) {
    res.status(403).json({
      error: 'Payment required. Use /api/billing/checkout to upgrade your plan.',
      checkoutEndpoint: '/api/billing/checkout',
    });
    return;
  }

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

// POST /api/billing/day-pass — 24hr access for free users
// When Stripe is configured, create a Checkout Session for $2.99; dev-only free grant otherwise.
billingRouter.post('/day-pass', requireAuth, withAgentinError(async (req: AuthRequest, res) => {
  const sub = db.prepare('SELECT plan FROM subscriptions WHERE user_id = ?').get(req.userId!) as { plan: string } | undefined;
  if (sub?.plan !== 'free') {
    throw new ValidationError('Day pass is only available on the free plan. Upgrade for full access.');
  }

  // Block duplicate purchases while a pass is already active
  if (hasActiveDayPass(req.userId!)) {
    throw new ValidationError('You already have an active day pass.');
  }

  // When Stripe is configured, redirect through a real Checkout Session.
  // Skipped in TEST_MODE to avoid the Stripe SDK hanging on a dummy key.
  // If the live SDK call fails (network, misconfigured key), fall through
  // to the dev/demo grant below so local offline mode stays working.
  if (config.stripeEnabled && process.env.TEST_MODE !== 'true') {
    try {
      const url = await createDayPassCheckoutSession(req.userId!);
      res.json({ checkoutUrl: url });
      return;
    } catch (err) {
      logger.error({ err, userId: req.userId }, 'Stripe day pass checkout session creation failed');
    }
  }

  // Dev/demo mode — grant the pass directly without payment
  const id = uuid();
  db.prepare(`
    INSERT INTO day_passes (id, user_id, expires_at, credits_granted)
    VALUES (?, ?, datetime('now', '+1 day'), 2000)
  `).run(id, req.userId);

  // Grant 2000 bonus credits
  db.prepare(
    'UPDATE subscriptions SET credits_remaining = credits_remaining + 2000 WHERE user_id = ?'
  ).run(req.userId!);

  const inserted = db.prepare('SELECT expires_at FROM day_passes WHERE id = ?').get(id) as { expires_at: string };
  res.json({ message: 'Day pass activated! You have 24 hours of Weebo access.', expiresAt: inserted.expires_at });
}));

// GET /api/billing/day-pass — check if user has active day pass
billingRouter.get('/day-pass', requireAuth, (req: AuthRequest, res) => {
  const pass = db.prepare(
    "SELECT expires_at FROM day_passes WHERE user_id = ? AND expires_at > datetime('now') ORDER BY expires_at DESC LIMIT 1"
  ).get(req.userId!) as { expires_at: string } | undefined;
  res.json({ active: !!pass, expiresAt: pass?.expires_at || null });
});


// GET /api/billing/events — last 20 usage events for credit history table
billingRouter.get('/events', requireAuth, (req: AuthRequest, res) => {
  const events = db.prepare(`
    SELECT id, provider, model, tokens_in, tokens_out, cost_usd, channel, tool, created_at
    FROM usage_events
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 20
  `).all(req.userId!);
  res.json(events);
});

// POST /api/billing/checkout — create Stripe Checkout session
billingRouter.post('/checkout', requireAuth, withAgentinError(async (req: AuthRequest, res) => {
  const { plan } = req.body as { plan?: string };
  const PAID_PLANS = ['pilot', 'intro', 'halfyear', 'yearly'];
  if (!plan || !PAID_PLANS.includes(plan)) {
    throw new ValidationError(`Plan must be one of: ${PAID_PLANS.join(', ')}`);
  }
  if (!config.stripeEnabled) {
    throw new ServiceUnavailableError('Stripe billing is not configured on this server.');
  }
  const url = await createCheckoutSession(req.userId!, plan);
  res.json({ url });
}));

// POST /api/billing/webhook — Stripe webhook (raw body for signature verification)
billingRouter.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    if (!sig || typeof sig !== 'string') {
      res.status(400).json({ error: 'Missing Stripe-Signature header' });
      return;
    }
    try {
      await handleWebhook(req.body as Buffer, sig);
      res.json({ received: true });
    } catch {
      res.status(400).json({ error: 'Webhook processing failed' });
    }
  },
);

// GET /api/billing/status — current Stripe subscription plan + expiry
billingRouter.get('/status', requireAuth, (req: AuthRequest, res) => {
  const status = getStatus(req.userId!);
  res.json(status);
});

// ============================================================
// Razorpay Routes — INR payments for Indian users
// ============================================================

const RAZORPAY_PAID_PLANS = ['pilot', 'intro', 'halfyear', 'yearly'];

// POST /api/billing/razorpay/order — create a Razorpay order for a plan
billingRouter.post('/razorpay/order', requireAuth, async (req: AuthRequest, res) => {
  if (!razorpayEnabled) {
    res.status(503).json({ error: 'Razorpay billing is not configured on this server.' });
    return;
  }

  const { plan } = req.body as { plan?: string };
  if (!plan || !RAZORPAY_PAID_PLANS.includes(plan)) {
    res.status(400).json({ error: `Plan must be one of: ${RAZORPAY_PAID_PLANS.join(', ')}` });
    return;
  }

  const planInfo = PLAN_DEFINITIONS[plan];
  if (!planInfo || planInfo.priceInr <= 0) {
    res.status(400).json({ error: 'This plan is not available for INR payment.' });
    return;
  }

  try {
    const order = await createRazorpayOrder(planInfo.priceInr, req.userId!, plan);
    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: 'INR',
      keyId: config.razorpayKeyId,
    });
  } catch (err) {
    logger.error({ err, plan, userId: req.userId }, 'Razorpay order creation failed');
    res.status(500).json({ error: 'Failed to create Razorpay order' });
  }
});

// POST /api/billing/razorpay/verify — verify payment and upgrade subscription
billingRouter.post('/razorpay/verify', requireAuth, async (req: AuthRequest, res) => {
  if (!razorpayEnabled) {
    res.status(503).json({ error: 'Razorpay billing is not configured on this server.' });
    return;
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body as {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
    plan?: string;
  };

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    res.status(400).json({ error: 'Missing required Razorpay payment fields.' });
    return;
  }

  if (!plan || !RAZORPAY_PAID_PLANS.includes(plan)) {
    res.status(400).json({ error: `Plan must be one of: ${RAZORPAY_PAID_PLANS.join(', ')}` });
    return;
  }

  const isValid = verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
  if (!isValid) {
    logger.warn({ razorpay_order_id, userId: req.userId }, 'Razorpay signature verification failed');
    res.status(400).json({ error: 'Payment verification failed. Invalid signature.' });
    return;
  }

  // Signature valid — upgrade user subscription
  const planInfo = PLAN_DEFINITIONS[plan];
  if (!planInfo) {
    res.status(400).json({ error: 'Invalid plan' });
    return;
  }

  const cycleEnd = `+${planInfo.intervalDays} days`;

  db.prepare(`
    INSERT INTO subscriptions (id, user_id, plan, monthly_credits, credits_remaining, billing_interval_days, billing_cycle_start, billing_cycle_end, price_usd, price_inr, currency)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now', ?), ?, ?, 'INR')
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
      currency = 'INR'
  `).run(uuid(), req.userId, plan, planInfo.credits, planInfo.credits, planInfo.intervalDays, cycleEnd, planInfo.priceUsd, planInfo.priceInr);

  // Also update users table subscription fields (mirrors Stripe webhook behavior)
  db.prepare(`
    UPDATE users SET
      subscription_plan = ?,
      subscription_status = 'active',
      subscription_expires_at = strftime('%s', datetime('now', ?))
    WHERE id = ?
  `).run(plan, cycleEnd, req.userId);

  logger.info({ userId: req.userId, plan, razorpay_order_id, razorpay_payment_id }, 'Razorpay payment verified — subscription upgraded');
  res.json({ success: true, plan });
});

// POST /api/billing/razorpay/webhook — Razorpay webhook (no auth, signature-verified)
billingRouter.post(
  '/razorpay/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['x-razorpay-signature'] as string | undefined;
    if (!signature) {
      res.status(400).json({ error: 'Missing X-Razorpay-Signature header' });
      return;
    }

    if (!config.razorpayKeySecret) {
      logger.warn('Razorpay webhook secret not configured — ignoring webhook');
      res.status(503).json({ error: 'Razorpay not configured' });
      return;
    }

    // Verify webhook signature
    const rawBody = typeof req.body === 'string' ? req.body : (req.body as Buffer).toString('utf8');
    const expectedSig = crypto
      .createHmac('sha256', config.razorpayKeySecret)
      .update(rawBody)
      .digest('hex');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      logger.warn('Razorpay webhook signature verification failed');
      res.status(400).json({ error: 'Invalid webhook signature' });
      return;
    }

    // Parse event
    let event: { event: string; payload: { payment?: { entity: { id: string; order_id: string; status: string; notes?: { userId?: string; plan?: string } } } } };
    try {
      event = JSON.parse(rawBody);
    } catch {
      res.status(400).json({ error: 'Invalid JSON body' });
      return;
    }

    logger.debug({ type: event.event }, 'Processing Razorpay webhook event');

    switch (event.event) {
      case 'payment.captured': {
        const payment = event.payload.payment?.entity;
        if (!payment) break;

        const userId = payment.notes?.userId;
        const plan = payment.notes?.plan;
        if (!userId || !plan) {
          logger.warn({ paymentId: payment.id }, 'payment.captured missing notes (userId/plan)');
          break;
        }

        const planInfo = PLAN_DEFINITIONS[plan];
        if (!planInfo) {
          logger.warn({ plan }, 'payment.captured references unknown plan');
          break;
        }

        const cycleEnd = `+${planInfo.intervalDays} days`;

        db.prepare(`
          INSERT INTO subscriptions (id, user_id, plan, monthly_credits, credits_remaining, billing_interval_days, billing_cycle_start, billing_cycle_end, price_usd, price_inr, currency)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now', ?), ?, ?, 'INR')
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
            currency = 'INR'
        `).run(uuid(), userId, plan, planInfo.credits, planInfo.credits, planInfo.intervalDays, cycleEnd, planInfo.priceUsd, planInfo.priceInr);

        db.prepare(`
          UPDATE users SET
            subscription_plan = ?,
            subscription_status = 'active',
            subscription_expires_at = strftime('%s', datetime('now', ?))
          WHERE id = ?
        `).run(plan, cycleEnd, userId);

        logger.info({ userId, plan, paymentId: payment.id }, 'Razorpay payment.captured — subscription activated');
        break;
      }

      case 'payment.failed': {
        const payment = event.payload.payment?.entity;
        if (!payment) break;
        const userId = payment.notes?.userId;
        logger.warn({ userId, paymentId: payment.id, orderId: payment.order_id }, 'Razorpay payment failed');
        break;
      }

      default:
        logger.debug({ type: event.event }, 'Unhandled Razorpay webhook event');
    }

    res.json({ received: true });
  },
);
