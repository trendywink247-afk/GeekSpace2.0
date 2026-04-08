// ============================================================
// Billing & Usage services — extracted from api.ts
// ============================================================

import api from './api-client.js';
import type {
  ApiKey, ApiKeyCreateInput, UsageSummary, BillingInfo,
  ChartDataPoint, ProviderBreakdown, HourlyActivity,
  Subscription, PlanDefinition, DailyUsage, UsageEvent,
} from '@/types';

// ----- API Keys ----------------------------------------------

export const apiKeyService = {
  list: () => api.get<ApiKey[]>('/api-keys'),

  create: (data: ApiKeyCreateInput) =>
    api.post<ApiKey>('/api-keys', data),

  delete: (id: string) => api.delete(`/api-keys/${id}`),

  setDefault: (id: string) =>
    api.patch<ApiKey>(`/api-keys/${id}/default`),

  rotate: (id: string, key: string) =>
    api.post<{ success: boolean; maskedKey: string }>(`/api-keys/${id}/rotate`, { key }),
};

// ----- Usage & Billing ---------------------------------------

export const usageService = {
  summary: (range: 'day' | 'week' | 'month' = 'month') =>
    api.get<UsageSummary>(`/usage/summary?range=${range}`),

  billing: () => api.get<BillingInfo>('/usage/billing'),

  events: (page = 1, limit = 50) =>
    api.get<{ events: UsageEvent[]; total: number }>(
      `/usage/events?offset=${(page - 1) * limit}&limit=${limit}`,
    ),

  chart: (range: '7d' | '14d' | '30d' = '7d') =>
    api.get<ChartDataPoint[]>(`/usage/chart?range=${range}`),

  providers: (days = 30) =>
    api.get<ProviderBreakdown[]>(`/usage/providers?days=${days}`),

  latency: () => api.get<HourlyActivity[]>('/usage/latency'),

  daily: (days = 7) =>
    api.get<Array<{ day: string; label: string; messages: number; credits: number }>>(`/usage/daily?days=${days}`),

  today: () =>
    api.get<{
      plan: string;
      tokenBudget: number;
      tokenUsed: number;
      tokenPercentage: number;
      messages: { used: number; limit: number; percentage: number };
      voice: { used: number; limit: number; percentage: number };
      images: { used: number; limit: number; percentage: number };
    }>('/usage/today'),
};

// ----- Billing -----------------------------------------------

export const billingService = {
  getPlans: () => api.get<PlanDefinition[]>('/billing/plans'),

  getPlan: () => api.get<Subscription>('/billing/plan'),

  upgrade: (plan: string, currency: string) =>
    api.post<Subscription>('/billing/upgrade', { plan, currency }),

  getUsage: () => api.get<DailyUsage[]>('/billing/usage'),

  activateDayPass: () => api.post<{ message: string; expiresAt: string }>('/billing/day-pass'),

  getEvents: () => api.get<UsageEvent[]>('/billing/events'),

  // Stripe billing (Phase 89)
  getStripeStatus: () =>
    api.get<{ plan: string; status: string; expiresAt: number | null; label: string; isPaid: boolean }>('/billing/status'),

  createCheckout: (plan: 'basic' | 'pro') =>
    api.post<{ url: string }>('/billing/checkout', { plan }),

  // Razorpay billing (Indian payments)
  createRazorpayOrder: (plan: string) =>
    api.post<{ orderId: string; amount: number; keyId: string }>('/billing/razorpay/order', { plan }),

  verifyRazorpayPayment: (data: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    plan: string;
  }) =>
    api.post<{ success: boolean; message: string }>('/billing/razorpay/verify', data),
};
