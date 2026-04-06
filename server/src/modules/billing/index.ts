/**
 * Billing Domain — Barrel Export + AppModule registration
 *
 * Re-exports for Stripe, Razorpay, credit management, subscriptions,
 * and plan definitions.
 *
 * @module billing
 * @see docs/MICROSERVICES_ROADMAP.md — Wave 2 extraction candidate
 */

import type { Application } from 'express';
import type { AppModule } from '../../shared/module.js';

// ── Routes ──────────────────────────────────────────────────────────
export { billingRouter } from './routes.js';

// ── Services ────────────────────────────────────────────────────────
export {
  createCheckoutSession,
  handleWebhook,
  getStatus,
  isPaidPlan,
  STRIPE_PLAN_LABELS,
} from './services/stripe.js';

export {
  razorpayEnabled,
  createRazorpayOrder,
  verifyRazorpaySignature,
} from './services/razorpay.js';

export {
  getBalance,
  deduct,
  checkQuota,
  getUsage,
} from './services/credit-service.js';
export type { CreditBalance, UsageReport } from './services/credit-service.js';

// ── Repositories ────────────────────────────────────────────────────
export { SubscriptionRepository } from './repositories/subscription.repository.js';
export type { SubscriptionRow } from './repositories/subscription.repository.js';

// ── Types ──────────────────────────────────────────────────────────
export type { Subscription, Plan, DayPass, UsageEvent } from './types.js';

// ── Module Registration ─────────────────────────────────────────────
import { billingRouter } from './routes.js';

export const billingModule: AppModule = {
  name: 'billing',

  registerRoutes(app: Application) {
    app.use('/api/billing', billingRouter);
  },
};
