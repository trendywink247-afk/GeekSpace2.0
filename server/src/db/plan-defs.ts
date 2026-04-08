/**
 * Subscription plan definitions — pure data, no DB dependency.
 */

export interface PlanDefinition {
  credits: number;
  tokensBudget: number;       // monthly token budget
  priceUsd: number;
  priceInr: number;
  originalPriceInr?: number;  // shown as slashed price in UI
  intervalDays: number;
  intervalLabel: string;
  description: string;
  badge?: string;
  picoSlots: number;          // max Pico agents for this plan
}

export const PLAN_DEFINITIONS: Record<string, PlanDefinition> = {
  free: {
    credits: 5000, tokensBudget: 50000, priceUsd: 0, priceInr: 0,
    intervalDays: 30, intervalLabel: 'month',
    description: 'Local Engine only — try PicoClaw for $1/day',
    picoSlots: 0,
  },
  pilot: {
    credits: 100000, tokensBudget: 300000, priceUsd: 4, priceInr: 299,
    intervalDays: 30, intervalLabel: 'month',
    description: 'Dual PicoClaw agents + all engines',
    badge: 'New',
    picoSlots: 2,
  },
  intro: {
    credits: 100000, tokensBudget: 300000, priceUsd: 12, priceInr: 999, originalPriceInr: 1999,
    intervalDays: 60, intervalLabel: '2 months',
    description: 'All engines + personalities — best to start',
    badge: 'Best to start',
    picoSlots: 2,
  },
  halfyear: {
    credits: 700000, tokensBudget: 750000, priceUsd: 35, priceInr: 2999, originalPriceInr: 3999,
    intervalDays: 180, intervalLabel: '6 months',
    description: 'Everything + priority support',
    badge: 'Most popular',
    picoSlots: 3,
  },
  yearly: {
    credits: 1500000, tokensBudget: 1000000, priceUsd: 60, priceInr: 4999, originalPriceInr: 5999,
    intervalDays: 365, intervalLabel: 'year',
    description: 'Everything + Kimi reasoning included',
    badge: 'Best value',
    picoSlots: 3,
  },
};
// Alias: 'monthly' maps to 'pilot' for existing users
PLAN_DEFINITIONS['monthly'] = { ...PLAN_DEFINITIONS['pilot'], badge: undefined };
