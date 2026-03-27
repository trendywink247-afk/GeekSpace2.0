/**
 * Billing Domain — Barrel Export
 *
 * Re-exports for Stripe, Razorpay, credit management, subscriptions,
 * and plan definitions.
 *
 * @module billing
 * @see docs/MICROSERVICES_ROADMAP.md — Wave 2 extraction candidate
 */

// ── Routes ──────────────────────────────────────────────────────────
export { billingRouter } from '../../routes/billing.js';

// ── Services ────────────────────────────────────────────────────────
export {
  createCheckoutSession,
  handleWebhook,
  getStatus,
  isPaidPlan,
  STRIPE_PLAN_LABELS,
} from '../../services/stripe.js';

export {
  razorpayEnabled,
  createRazorpayOrder,
  verifyRazorpaySignature,
} from '../../services/razorpay.js';

export {
  getBalance,
  deduct,
  checkQuota,
  getUsage,
} from '../../services/credit-service.js';
export type { CreditBalance, UsageReport } from '../../services/credit-service.js';

// ── Repositories ────────────────────────────────────────────────────
export { SubscriptionRepository } from '../../repositories/SubscriptionRepository.js';
export type { SubscriptionRow } from '../../repositories/SubscriptionRepository.js';
