// ============================================================
// Billing module types
// ============================================================

export type PlanTier = 'free' | 'starter' | 'pro' | 'enterprise';

export interface Plan {
  id: string;
  name: string;
  tier: PlanTier;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  features: string[];
  creditsPerMonth: number;
}

export interface Subscription {
  id: string;
  userId: string;
  plan: PlanTier;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  stripeSubscriptionId: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreditBalance {
  userId: string;
  remaining: number;
  total: number;
  resetDate: string;
}

export interface DayPass {
  id: string;
  userId: string;
  purchasedAt: string;
  expiresAt: string;
  creditsGranted: number;
  stripePaymentId: string | null;
}

export interface UsageEvent {
  id: string;
  userId: string;
  type: 'api_call' | 'model_inference' | 'storage' | 'integration';
  credits: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}
