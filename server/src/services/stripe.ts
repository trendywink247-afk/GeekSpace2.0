/**
 * Stripe Billing Service
 *
 * Manages the full Stripe subscription lifecycle: checkout session
 * creation, webhook event processing, and plan/credit reconciliation.
 * Supports Pilot, Intro, Half-year, and Yearly subscription tiers.
 *
 * The Stripe client is lazily initialised on first use so the server
 * can boot without `STRIPE_SECRET_KEY` in development environments.
 *
 * **Webhook flow:** Stripe sends events to `/api/webhooks/stripe`,
 * which passes the raw body + signature to {@link handleWebhook}.
 * The handler verifies the HMAC signature, then updates the user's
 * `subscription_plan`, `subscription_status`, and `subscription_expires_at`
 * columns based on the event type (`checkout.session.completed`,
 * `customer.subscription.updated`, `customer.subscription.deleted`).
 *
 * @module services/stripe
 */

import Stripe from 'stripe';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { logger } from '../logger.js';

// Lazy-initialize Stripe client (only when key is present)
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    if (!config.stripeSecretKey) {
      throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY.');
    }
    _stripe = new Stripe(config.stripeSecretKey, {
      apiVersion: '2025-01-27.acacia' as Stripe.LatestApiVersion,
    });
  }
  return _stripe;
}

// Plan display names for UI
export const STRIPE_PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  pilot: 'Pilot',
  intro: 'Intro',
  monthly: 'Monthly',
  halfyear: 'Half-Year',
  yearly: 'Yearly',
  // Legacy aliases kept for backward compatibility
  basic: 'Basic',
  pro: 'Pro',
};

// ── createCheckoutSession ───────────────────────────────────

/**
 * Create a Stripe Checkout session for a subscription plan.
 *
 * Looks up or creates a Stripe Customer for the user, then opens a
 * hosted checkout session configured for the requested plan. The
 * `userId` and `plan` are attached as Stripe metadata so the webhook
 * handler can reconcile the payment with the correct user.
 *
 * @param userId - Authenticated user ID
 * @param plan   - Plan identifier: `"pilot"`, `"intro"`, `"monthly"`, `"halfyear"`, or `"yearly"`
 * @returns The hosted Stripe Checkout URL to redirect the user to
 * @throws If `STRIPE_SECRET_KEY` is not configured
 * @throws If no Stripe price ID is mapped for the requested plan
 * @throws If the user does not exist in the database
 * @throws If Stripe does not return a checkout URL
 */
export async function createCheckoutSession(
  userId: string,
  plan: string,
): Promise<string> {
  const stripe = getStripe();

  const priceId = ['pilot', 'intro', 'monthly'].includes(plan) ? config.stripeBasicPriceId : config.stripeProPriceId;
  if (!priceId) {
    throw new Error(`No Stripe price ID configured for plan: ${plan}`);
  }

  // Fetch user info
  const user = db.prepare(
    'SELECT email, name, stripe_customer_id FROM users WHERE id = ?',
  ).get(userId) as { email: string; name: string; stripe_customer_id: string | null } | undefined;
  if (!user) throw new Error('User not found');

  // Get or create Stripe customer
  let customerId = user.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name || user.email,
      metadata: { userId },
    });
    customerId = customer.id;
    db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run(customerId, userId);
    logger.info({ userId, customerId }, 'Stripe customer created');
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${config.publicUrl}/dashboard?billing=success&plan=${plan}`,
    cancel_url: `${config.publicUrl}/dashboard?billing=cancelled`,
    metadata: { userId, plan },
    subscription_data: {
      metadata: { userId, plan },
    },
  });

  if (!session.url) throw new Error('Stripe did not return a checkout URL');
  logger.info({ userId, plan, sessionId: session.id }, 'Stripe checkout session created');
  return session.url;
}

// ── handleWebhook ───────────────────────────────────────────

/**
 * Verify and process an incoming Stripe webhook event.
 *
 * Validates the request signature using `STRIPE_WEBHOOK_SECRET`, then
 * dispatches on event type:
 *
 * - `checkout.session.completed` -- activates the subscription and
 *   updates the user's plan/status/expiry in the database.
 * - `customer.subscription.updated` -- syncs plan changes or renewals.
 * - `customer.subscription.deleted` -- downgrades the user to the free plan.
 *
 * If `STRIPE_WEBHOOK_SECRET` is not set, the handler logs a warning and
 * returns without processing (safe for local development).
 *
 * @param rawBody - Raw request body buffer (required for signature verification)
 * @param sig     - Value of the `stripe-signature` request header
 * @throws If signature verification fails (invalid or tampered payload)
 *
 * @see https://docs.stripe.com/webhooks/signatures
 */
export async function handleWebhook(rawBody: Buffer, sig: string): Promise<void> {
  if (!config.stripeWebhookSecret) {
    logger.warn('Stripe webhook secret not configured — skipping verification');
    return;
  }

  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, config.stripeWebhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ msg }, 'Stripe webhook signature verification failed');
    throw new Error(`Webhook signature verification failed: ${msg}`);
  }

  logger.debug({ type: event.type }, 'Processing Stripe webhook event');

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const plan = session.metadata?.plan;
      if (!userId || !plan) {
        logger.warn({ sessionId: session.id }, 'checkout.session.completed missing metadata');
        break;
      }

      // Fetch subscription expiry
      let expiresAt: number | null = null;
      if (session.subscription) {
        try {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          // Stripe v20 removed current_period_end; use billing_cycle_anchor as approximate expiry
          expiresAt = (sub as unknown as { billing_cycle_anchor?: number }).billing_cycle_anchor ?? null;
        } catch { /* non-fatal */ }
      }

      db.prepare(`
        UPDATE users SET
          subscription_plan = ?,
          subscription_status = 'active',
          subscription_expires_at = ?
        WHERE id = ?
      `).run(plan, expiresAt, userId);

      logger.info({ userId, plan, expiresAt }, 'Stripe subscription activated');
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
      const status = sub.status === 'active' ? 'active' : 'inactive';
      // Stripe v20 removed current_period_end; use billing_cycle_anchor as approximate expiry
      const expiresAt = (sub as unknown as { billing_cycle_anchor?: number }).billing_cycle_anchor ?? null;

      db.prepare(`
        UPDATE users SET
          subscription_status = ?,
          subscription_expires_at = ?
        WHERE stripe_customer_id = ?
      `).run(status, expiresAt, customerId);

      logger.info({ customerId, status, expiresAt }, 'Stripe subscription updated');
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

      db.prepare(`
        UPDATE users SET
          subscription_plan = 'free',
          subscription_status = 'inactive',
          subscription_expires_at = NULL
        WHERE stripe_customer_id = ?
      `).run(customerId);

      logger.info({ customerId }, 'Stripe subscription cancelled — reverted to free');
      break;
    }

    default:
      logger.debug({ type: event.type }, 'Unhandled Stripe webhook event');
  }
}

// ── getStatus ───────────────────────────────────────────────

/**
 * Get the current Stripe subscription status for a user.
 */
export function getStatus(userId: string): {
  plan: string;
  status: string;
  expiresAt: number | null;
  label: string;
  isPaid: boolean;
} {
  const user = db.prepare(
    'SELECT subscription_plan, subscription_status, subscription_expires_at FROM users WHERE id = ?',
  ).get(userId) as {
    subscription_plan: string;
    subscription_status: string;
    subscription_expires_at: number | null;
  } | undefined;

  const plan = user?.subscription_plan || 'free';
  const status = user?.subscription_status || 'inactive';
  const expiresAt = user?.subscription_expires_at || null;

  return {
    plan,
    status,
    expiresAt,
    label: STRIPE_PLAN_LABELS[plan] || plan,
    isPaid: plan !== 'free' && status === 'active',
  };
}

// ── isPaidPlan ──────────────────────────────────────────────

/**
 * Check if a user has an active paid subscription (basic or pro).
 * Used for feature gating (image/voice generation).
 */
export function isPaidPlan(userId: string): boolean {
  const user = db.prepare(
    'SELECT subscription_plan, subscription_status FROM users WHERE id = ?',
  ).get(userId) as { subscription_plan: string; subscription_status: string } | undefined;

  if (!user) return false;
  const plan = user.subscription_plan;
  const status = user.subscription_status;
  return plan !== 'free' && status === 'active';
}
