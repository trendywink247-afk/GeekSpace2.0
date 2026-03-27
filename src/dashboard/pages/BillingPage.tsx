// ============================================================
// BillingPage — Plan management, credits, usage history
// Owner agent: nova (#EC4899)
// Revamped: design tokens, PageShell + PageHeader + SectionCard,
//   useAgentCanvas, Stripe + Razorpay locale gate, mobile QA (44px), nova dot
// ============================================================

import { useState, useEffect } from 'react';
import {
  CreditCard, Check, ArrowUpRight, Calendar, Zap,
  TrendingUp, CheckCircle2, Lock, Star,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageProgress } from '@/components/ui/page-progress';
import { MobileTable } from '@/components/ui/mobile-table';
import { useMobileDetect } from '@/hooks/useMobileDetect';
import { billingService } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import { PageShell, PageHeader, SectionCard } from '@/components/agentin';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';
import type { Subscription, PlanDefinition, DailyUsage, UsageEvent } from '@/types';

// ---- constants -----------------------------------------------------------

const NOVA = '#EC4899';

// Plan display metadata for sale styling
const PLAN_DISPLAY: Record<string, { oldPrice: number; badge: string; badgeColor?: string; agentSlots: number; tokenBudget: string; hasKimi: boolean; highlighted?: boolean }> = {
  free: { oldPrice: 99, badge: '', agentSlots: 1, tokenBudget: '50K', hasKimi: false },
  intro: { oldPrice: 1499, badge: 'Most Popular', badgeColor: NOVA, agentSlots: 2, tokenBudget: '300K', hasKimi: true, highlighted: true },
  monthly: { oldPrice: 1499, badge: 'Popular', badgeColor: '#FFB800', agentSlots: 2, tokenBudget: '300K', hasKimi: true },
  halfyear: { oldPrice: 5999, badge: '', agentSlots: 3, tokenBudget: '750K', hasKimi: true },
  yearly: { oldPrice: 9999, badge: 'Best Value', badgeColor: '#10B981', agentSlots: 3, tokenBudget: '1M', hasKimi: true },
};

const PLAN_PILL: Record<string, { bg: string; text: string; border: string }> = {
  free: { bg: 'rgba(156,163,175,0.15)', text: '#9CA3AF', border: 'rgba(156,163,175,0.3)' },
  intro: { bg: `${NOVA}26`, text: NOVA, border: `${NOVA}4D` },
  monthly: { bg: `${NOVA}26`, text: NOVA, border: `${NOVA}4D` },
  halfyear: { bg: 'rgba(139,92,246,0.15)', text: '#8B5CF6', border: 'rgba(139,92,246,0.3)' },
  yearly: { bg: 'rgba(139,92,246,0.15)', text: '#8B5CF6', border: 'rgba(139,92,246,0.3)' },
};

// ---- helpers -------------------------------------------------------------

function formatCredits(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '\u2014';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Detect whether user locale suggests INR / India */
function detectIndianLocale(): boolean {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz.startsWith('Asia/Kolkata') || tz.startsWith('Asia/Calcutta')) return true;
    const lang = navigator.language || '';
    if (lang.startsWith('hi') || lang.endsWith('-IN')) return true;
  } catch { /* fallback */ }
  return false;
}

// ---- shimmer skeleton ----------------------------------------------------

function BillingSkeleton() {
  return (
    <>
      <PageProgress loading />
      {/* Header skeleton */}
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <div className="h-9 w-32 rounded-lg bg-[rgba(139,92,246,0.06)] animate-pulse" />
          <div className="h-4 w-48 rounded bg-[rgba(139,92,246,0.04)] animate-pulse" />
        </div>
        <div className="h-10 w-36 rounded-lg bg-[rgba(139,92,246,0.06)] animate-pulse" />
      </div>
      {/* Current plan card skeleton */}
      <div className="h-64 w-full rounded-xl bg-[rgba(139,92,246,0.04)] animate-pulse" />
      {/* Plan cards grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-6 rounded-xl border border-[rgba(139,92,246,0.08)] bg-[rgba(12,12,30,0.6)] space-y-4 animate-pulse">
            <div className="h-5 w-20 rounded bg-[rgba(139,92,246,0.06)]" />
            <div className="h-8 w-24 rounded bg-[rgba(139,92,246,0.06)]" />
            <div className="h-4 w-full rounded bg-[rgba(139,92,246,0.04)]" />
            <div className="h-9 w-full rounded-md bg-[rgba(139,92,246,0.04)]" />
          </div>
        ))}
      </div>
    </>
  );
}

// ---- page ----------------------------------------------------------------

export function BillingPage() {
  const isMobile = useMobileDetect();
  const user = useAuthStore((s) => s.user);
  const { notifyDone, notifyFail } = useAgentCanvas({ agent: 'nova', page: 'billing' });

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [usage, setUsage] = useState<DailyUsage[]>([]);
  const [currency, setCurrency] = useState<'USD' | 'INR'>('USD');
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [stripeStatus, setStripeStatus] = useState<{ plan: string; status: string; expiresAt: number | null; label: string; isPaid: boolean } | null>(null);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [razorpayLoading, setRazorpayLoading] = useState<string | null>(null);

  // Auto-detect Indian user on mount (don't force — user can toggle)
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const isLikelyIndian =
      navigator.language?.startsWith('hi') ||
      tz.includes('Calcutta') ||
      tz.includes('Kolkata');
    if (isLikelyIndian) setCurrency('INR');
  }, []);

  // Detect locale for default currency + gateway display
  const isIndian = detectIndianLocale();
  const showRazorpay = currency === 'INR';
  const showStripe = currency === 'USD';

  useEffect(() => {
    Promise.all([
      billingService.getPlan().then(r => r.data),
      billingService.getPlans().then(r => r.data),
      billingService.getUsage().then(r => r.data),
      billingService.getEvents().then(r => r.data).catch(() => [] as UsageEvent[]),
      billingService.getStripeStatus().then(r => r.data).catch(() => null),
    ]).then(([sub, planList, usageData, eventsData, stripeData]) => {
      setSubscription(sub);
      setPlans(planList);
      setUsage(usageData);
      setEvents(eventsData as UsageEvent[]);
      if (stripeData) setStripeStatus(stripeData);
      // Auto-detect currency from subscription or locale
      if (sub.currency === 'INR') setCurrency('INR');
      else if (isIndian) setCurrency('INR');
    }).catch(() => {
      setToast({ message: 'Failed to load billing data', type: 'error' });
    }).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleUpgrade = async (planId: string) => {
    setUpgrading(planId);
    try {
      const { data } = await billingService.upgrade(planId, currency);
      setSubscription(data);
      setToast({ message: `Upgraded to ${planId} plan!`, type: 'success' });
      void notifyDone(`Plan upgraded to ${planId}`);
    } catch {
      setToast({ message: 'Upgrade failed. Please try again.', type: 'error' });
      void notifyFail('Plan upgrade failed');
    } finally {
      setUpgrading(null);
    }
  };

  const handleDayPass = async () => {
    try {
      const { data } = await billingService.activateDayPass();
      setToast({ message: data.message, type: 'success' });
      const { data: sub } = await billingService.getPlan();
      setSubscription(sub);
      void notifyDone('Day pass activated');
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Day pass failed';
      setToast({ message, type: 'error' });
      void notifyFail('Day pass activation failed');
    }
  };

  const handleCheckout = async (plan: 'basic' | 'pro') => {
    setCheckingOut(plan);
    try {
      const { data } = await billingService.createCheckout(plan);
      window.location.href = data.url;
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Checkout failed';
      setToast({ message, type: 'error' });
      setCheckingOut(null);
      void notifyFail('Checkout failed');
    }
  };

  const loadRazorpaySdk = (): Promise<void> =>
    new Promise((resolve, reject) => {
      if (document.getElementById('razorpay-sdk')) return resolve();
      const script = document.createElement('script');
      script.id = 'razorpay-sdk';
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
      document.body.appendChild(script);
    });

  const handleRazorpayCheckout = async (plan: string, planName: string, _displayAmount?: number) => {
    setRazorpayLoading(plan);
    try {
      await loadRazorpaySdk();
      const { data } = await billingService.createRazorpayOrder(plan);

      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: 'INR',
        name: 'Agentin',
        description: `${planName} Plan`,
        order_id: data.orderId,
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            await billingService.verifyRazorpayPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan,
            });
            setToast({ message: `Payment successful! Upgraded to ${planName} plan.`, type: 'success' });
            const { data: sub } = await billingService.getPlan();
            setSubscription(sub);
            const { data: stripeData } = await billingService.getStripeStatus();
            if (stripeData) setStripeStatus(stripeData);
          } catch {
            setToast({ message: 'Payment verification failed. Please contact support.', type: 'error' });
          }
        },
        prefill: {
          email: user?.email || '',
          name: user?.name || '',
        },
        theme: { color: '#00F0FF' },
      };

      const rzp = new (window as unknown as Record<string, unknown> & { Razorpay: new (opts: typeof options) => { open: () => void } }).Razorpay(options);
      rzp.open();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Razorpay checkout failed';
      setToast({ message, type: 'error' });
    } finally {
      setRazorpayLoading(null);
    }
  };

  const formatExpiry = (ts: number | null) => {
    if (!ts) return null;
    return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const price = (plan: PlanDefinition) =>
    currency === 'INR' ? `\u20B9${plan.priceInr.toLocaleString()}` : `$${plan.priceUsd}`;

  const oldPrice = (plan: PlanDefinition) => {
    const display = PLAN_DISPLAY[plan.id];
    if (!display || display.oldPrice === 0) return null;
    return currency === 'INR' ? `\u20B9${display.oldPrice.toLocaleString()}` : `$${Math.round(display.oldPrice / 83)}`;
  };

  // ---- loading state (inside PageShell) ----
  if (loading) {
    return (
      <PageShell maxWidth="6xl">
        <BillingSkeleton />
      </PageShell>
    );
  }

  const usedPercent = subscription
    ? Math.min((subscription.credits_used_this_cycle / subscription.monthly_credits) * 100, 100)
    : 0;

  // ---- plan card (reusable for mobile + desktop) ----
  const renderPlanCard = (plan: PlanDefinition, extraClass = '') => {
    const isCurrent = subscription?.plan?.toLowerCase() === plan.id?.toLowerCase();
    const isFree = plan.priceUsd === 0;
    const display = PLAN_DISPLAY[plan.id] || { oldPrice: 0, badge: '', agentSlots: 1, tokenBudget: '50K', hasKimi: false };
    const isHighlighted = display.highlighted && !isCurrent;

    return (
      <div
        key={plan.id}
        className={`relative overflow-hidden rounded-xl border bg-[rgba(12,12,30,0.6)] backdrop-blur-xl transition-all ${
          isCurrent
            ? 'border-[#8B5CF6] ring-1 ring-[#8B5CF6]/30'
            : isHighlighted
              ? `border-[${NOVA}] ring-1 ring-[${NOVA}]/20 shadow-[0_0_20px_rgba(236,72,153,0.15)] hover:shadow-[0_0_30px_rgba(236,72,153,0.25)]`
              : 'border-[rgba(139,92,246,0.08)] hover:border-[rgba(139,92,246,0.15)]'
        } ${isFree && !isCurrent ? 'opacity-60' : ''} ${extraClass}`}
      >
        {/* Badge */}
        {display.badge && !isCurrent && (
          <div
            className="absolute top-0 right-0 px-3 py-1 text-xs font-bold rounded-bl-lg"
            style={{
              backgroundColor: `${display.badgeColor}20`,
              color: display.badgeColor,
              borderBottom: `1px solid ${display.badgeColor}40`,
              borderLeft: `1px solid ${display.badgeColor}40`,
            }}
          >
            {display.badge}
          </div>
        )}
        {isCurrent && (
          <div
            className="absolute top-0 left-0 right-0 px-3 py-1 text-xs font-bold text-center"
            style={{
              backgroundColor: 'rgba(139,92,246,0.15)',
              color: '#8B5CF6',
              borderBottom: '1px solid rgba(139,92,246,0.3)',
            }}
          >
            Your Current Plan
          </div>
        )}
        <div className="pb-3 pt-6 px-5">
          <div className="flex items-center justify-between">
            <span className="capitalize text-[#F4F6FF] font-semibold">{plan.id}</span>
            {isCurrent && (
              <Badge className="bg-[#8B5CF6]/20 text-[#8B5CF6] border-[#8B5CF6]/30">
                Current
              </Badge>
            )}
          </div>
        </div>
        <div className="px-5 pb-5 space-y-4">
          {/* Price with slashed old price */}
          <div className="flex items-baseline flex-wrap gap-2">
            <span className={`${isMobile ? 'text-4xl' : 'text-3xl'} font-bold text-[#F4F6FF]`}>{price(plan)}</span>
            {display.oldPrice > 0 && (
              <span className="text-sm text-[#9CA3AF] line-through">{oldPrice(plan)}</span>
            )}
            {plan.priceUsd > 0 && (
              <span className="text-sm text-[#9CA3AF]">/ {plan.intervalLabel}</span>
            )}
          </div>
          <div className="text-sm text-[#9CA3AF]">{plan.description}</div>

          {/* Features */}
          <div className="space-y-2 py-2 border-t border-[rgba(139,92,246,0.08)]">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#9CA3AF]">Agent Slots</span>
              <span className="text-[#F4F6FF] font-medium">{display.agentSlots}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#9CA3AF]">Token Budget</span>
              <span className="text-[#F4F6FF] font-medium">{display.tokenBudget}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#9CA3AF]">Kimi Access</span>
              {display.hasKimi ? (
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
              ) : (
                <span className="text-[#9CA3AF]">{'\u2014'}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-[#F4F6FF]">
            <Zap className="w-4 h-4 text-[#8B5CF6]" />
            {formatCredits(plan.credits)} credits
          </div>
          {isCurrent ? (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-[#8B5CF6]/10 text-sm text-[#8B5CF6]">
              <Check className="w-4 h-4" />
              Active plan
            </div>
          ) : currency === 'INR' && !isFree ? (
            <div>
              <Button
                onClick={() => handleRazorpayCheckout(plan.id, plan.id, plan.priceInr)}
                disabled={razorpayLoading === plan.id}
                className="w-full bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-50 min-h-[44px] transition-shadow hover:shadow-[0_0_16px_rgba(139,92,246,0.4)]"
              >
                {razorpayLoading === plan.id ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                ) : (
                  <ArrowUpRight className="w-4 h-4 mr-2" />
                )}
                Pay &#8377;{plan.priceInr.toLocaleString()} with Razorpay
              </Button>
              <p className="text-xs text-[#9CA3AF] text-center mt-1.5">UPI, Cards, Net Banking accepted</p>
            </div>
          ) : (
            <Button
              onClick={() => handleUpgrade(plan.id)}
              disabled={upgrading === plan.id || isFree}
              className="w-full bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-50 min-h-[44px] transition-shadow hover:shadow-[0_0_16px_rgba(139,92,246,0.4)]"
            >
              {upgrading === plan.id ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
              ) : (
                <ArrowUpRight className="w-4 h-4 mr-2" />
              )}
              {isFree ? 'Free tier' : 'Upgrade'}
            </Button>
          )}
          {subscription?.plan === 'free' && plan.id === 'free' && (
            <button
              onClick={handleDayPass}
              className="w-full mt-2 py-2 px-3 rounded-lg border border-[rgba(139,92,246,0.15)] text-[#8B5CF6] text-xs hover:bg-[#8B5CF6]/10 transition-colors min-h-[44px]"
            >
              Try Weebo for $1/day {'\u2192'}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <PageShell maxWidth="6xl">
    <div data-testid="billing-page" className="space-y-6 animate-in fade-in duration-500 pb-24 md:pb-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl border text-sm font-medium transition-all animate-in slide-in-from-top-2 ${
          toast.type === 'success'
            ? 'bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981]'
            : 'bg-[#FF6161]/10 border-[#FF6161]/30 text-[#FF6161]'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header with nova dot */}
      <PageHeader
        icon={CreditCard}
        title="Billing"
        subtitle="Manage your plan and credits"
        badge={
          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-[#EC4899]/10 border border-[#EC4899]/30 text-[#EC4899]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#EC4899] opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#EC4899]" />
            </span>
            nova
          </span>
        }
        actions={
          /* Currency toggle */
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[rgba(12,12,30,0.6)] backdrop-blur-xl border border-[rgba(139,92,246,0.08)]">
            {(['USD', 'INR'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all min-h-[44px] ${
                  currency === c
                    ? 'bg-[#8B5CF6] text-white'
                    : 'text-[#9CA3AF] hover:text-[#F4F6FF]'
                }`}
              >
                {c === 'USD' ? '$ USD' : '\u20B9 INR'}
              </button>
            ))}
          </div>
        }
      />

      {/* Payment Gateway Section — Stripe (USD) or Razorpay (INR) based on currency */}
      <SectionCard>
        <div className="flex items-center gap-3 mb-4">
          <Star className="w-5 h-5 text-[#8B5CF6]" />
          <div className="flex-1">
            <h2 className="text-base font-semibold text-[#F4F6FF]">Premium Subscription</h2>
            <p className="text-sm text-[#9CA3AF]">
              {showStripe && 'Basic ($1.19/mo) and Pro ($3.59/mo) via Stripe'}
              {showRazorpay && 'Basic (\u20B999/mo) and Pro (\u20B9299/mo) via Razorpay'}
            </p>
          </div>
          {stripeStatus?.isPaid && (
            <Badge className="bg-[#8B5CF6]/20 text-[#8B5CF6] border-[#8B5CF6]/30 ml-auto">{stripeStatus.label} Active</Badge>
          )}
        </div>

        {/* Gateway indicator */}
        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-[rgba(139,92,246,0.05)] border border-[rgba(139,92,246,0.08)] text-xs text-[#9CA3AF]">
          <Lock className="w-3.5 h-3.5 text-[#8B5CF6] flex-shrink-0" />
          <span>
            Payments processed securely via{' '}
            <span className="text-[#F4F6FF] font-medium">
              {showStripe ? 'Stripe' : 'Razorpay'}
            </span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="p-5 rounded-xl border border-[#BF5FFF]/20 hover:border-[#BF5FFF]/40 transition-all">
              <div className="font-bold text-[var(--ag-text-primary)] mb-1">Basic</div>
              <div className="text-3xl font-bold text-[var(--ag-text-primary)] mb-3">{currency === 'INR' ? '\u20B999' : '$1.19'}<span className="text-sm font-normal text-[var(--ag-text-muted)]">/month</span></div>
              <ul className="text-sm text-[var(--ag-text-muted)] space-y-1 mb-4">
                <li className="flex items-center gap-2"><Check className="w-3 h-3 text-[#00FF88]" /> Image generation</li>
                <li className="flex items-center gap-2"><Check className="w-3 h-3 text-[#00FF88]" /> Voice transcription</li>
                <li className="flex items-center gap-2"><Check className="w-3 h-3 text-[#00FF88]" /> 30 voice calls/day</li>
              </ul>
              {stripeStatus?.plan === 'basic' && stripeStatus.isPaid ? (
                <p className="text-xs text-[var(--ag-text-muted)]">{stripeStatus.expiresAt ? 'Renews ' + formatExpiry(stripeStatus.expiresAt) : 'Active'}</p>
              ) : currency === 'INR' ? (
                <div>
                  <Button onClick={() => handleRazorpayCheckout('basic', 'Basic', 99)} disabled={razorpayLoading !== null} className="w-full bg-[#BF5FFF] hover:bg-[#A040FF] disabled:opacity-50 min-h-[44px] transition-shadow hover:shadow-[0_0_16px_rgba(191,95,255,0.4)]" data-testid="upgrade-basic-btn">
                    {razorpayLoading === 'basic' ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" /> : <ArrowUpRight className="w-4 h-4 mr-2" />}Pay &#8377;99 with Razorpay
                  </Button>
                  <p className="text-xs text-[var(--ag-text-muted)] text-center mt-1.5">UPI, Cards, Net Banking accepted</p>
                </div>
              ) : (
                <Button onClick={() => handleCheckout('basic')} disabled={checkingOut !== null} className="w-full bg-[#BF5FFF] hover:bg-[#A040FF] disabled:opacity-50 min-h-[44px] transition-shadow hover:shadow-[0_0_16px_rgba(191,95,255,0.4)]" data-testid="upgrade-basic-btn">
                  {checkingOut === 'basic' ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" /> : <ArrowUpRight className="w-4 h-4 mr-2" />}Upgrade to Basic
                </Button>
              )}
            </div>
            <div className="p-5 rounded-xl border border-[#BF5FFF]/20 hover:border-[#BF5FFF]/40 transition-all">
              <div className="font-bold text-[var(--ag-text-primary)] mb-1">Pro</div>
              <div className="text-3xl font-bold text-[var(--ag-text-primary)] mb-3">{currency === 'INR' ? '\u20B9299' : '$3.59'}<span className="text-sm font-normal text-[var(--ag-text-muted)]">/month</span></div>
              <ul className="text-sm text-[var(--ag-text-muted)] space-y-1 mb-4">
                <li className="flex items-center gap-2"><Check className="w-3 h-3 text-[#00FF88]" /> Everything in Basic</li>
                <li className="flex items-center gap-2"><Check className="w-3 h-3 text-[#00FF88]" /> 100 voice calls/day</li>
                <li className="flex items-center gap-2"><Check className="w-3 h-3 text-[#00FF88]" /> Priority support</li>
              </ul>
              {stripeStatus?.plan === 'pro' && stripeStatus.isPaid ? (
                <p className="text-xs text-[var(--ag-text-muted)]">{stripeStatus.expiresAt ? 'Renews ' + formatExpiry(stripeStatus.expiresAt) : 'Active'}</p>
              ) : currency === 'INR' ? (
                <div>
                  <Button onClick={() => handleRazorpayCheckout('pro', 'Pro', 299)} disabled={razorpayLoading !== null} className="w-full bg-[#BF5FFF] hover:bg-[#A040FF] disabled:opacity-50 min-h-[44px] transition-shadow hover:shadow-[0_0_16px_rgba(191,95,255,0.4)]" data-testid="upgrade-pro-btn">
                    {razorpayLoading === 'pro' ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" /> : <ArrowUpRight className="w-4 h-4 mr-2" />}Pay &#8377;299 with Razorpay
                  </Button>
                  <p className="text-xs text-[var(--ag-text-muted)] text-center mt-1.5">UPI, Cards, Net Banking accepted</p>
                </div>
              ) : (
                <Button onClick={() => handleCheckout('pro')} disabled={checkingOut !== null} className="w-full bg-[#BF5FFF] hover:bg-[#A040FF] disabled:opacity-50 min-h-[44px] transition-shadow hover:shadow-[0_0_16px_rgba(191,95,255,0.4)]" data-testid="upgrade-pro-btn">
                  {checkingOut === 'pro' ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" /> : <ArrowUpRight className="w-4 h-4 mr-2" />}Upgrade to Pro
                </Button>
              )}
            </div>
          </div>

        {!stripeStatus?.isPaid && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-[#8B5CF6]/5 border border-[rgba(139,92,246,0.15)] text-sm text-[#9CA3AF]" data-testid="upgrade-to-unlock">
            <Lock className="w-4 h-4 text-[#8B5CF6] flex-shrink-0" />
            <span>Upgrade to Basic or Pro to unlock image and voice generation</span>
          </div>
        )}
      </SectionCard>

      {/* Current Plan Card */}
      {subscription && (
        <SectionCard padding="lg">
          <div className="p-4 -m-6 mb-4 bg-gradient-to-br from-[#8B5CF6]/15 to-transparent border-b border-[rgba(139,92,246,0.15)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 p-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#8B5CF6]/20 flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-[#8B5CF6]" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#F4F6FF] capitalize">{subscription.plan} Plan</h2>
                  <p className="text-sm text-[#9CA3AF]">
                    {subscription.price_usd > 0
                      ? `${currency === 'INR' ? `\u20B9${subscription.price_inr.toLocaleString()}` : `$${subscription.price_usd}`} / ${plans.find(p => p.id === subscription.plan)?.intervalLabel || 'cycle'}`
                      : 'Free forever'}
                  </p>
                </div>
              </div>
              {(() => {
                const pill = PLAN_PILL[subscription.plan] || PLAN_PILL.free;
                return (
                  <Badge
                    style={{ backgroundColor: pill.bg, color: pill.text, borderColor: pill.border }}
                    className="border capitalize"
                  >
                    {subscription.plan === 'intro' ? 'Pro' : subscription.plan}
                  </Badge>
                );
              })()}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-2">
              <div className="p-4 rounded-xl bg-[rgba(12,12,30,0.6)] border border-[rgba(139,92,246,0.08)]">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-[#8B5CF6]" />
                  <span className="text-xs text-[#9CA3AF]">Credits Remaining</span>
                </div>
                <div className="text-2xl font-bold text-[#F4F6FF] font-mono">
                  {formatCredits(subscription.credits_remaining)}
                </div>
                <div className="text-xs text-[#9CA3AF]">of {formatCredits(subscription.monthly_credits)}</div>
              </div>
              <div className="p-4 rounded-xl bg-[rgba(12,12,30,0.6)] border border-[rgba(139,92,246,0.08)]">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-[#FFB800]" />
                  <span className="text-xs text-[#9CA3AF]">Credits Used</span>
                </div>
                <div className="text-2xl font-bold text-[#F4F6FF] font-mono">
                  {formatCredits(subscription.credits_used_this_cycle)}
                </div>
                <div className="text-xs text-[#9CA3AF]">this cycle</div>
              </div>
              <div className="p-4 rounded-xl bg-[rgba(12,12,30,0.6)] border border-[rgba(139,92,246,0.08)]">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-[#10B981]" />
                  <span className="text-xs text-[#9CA3AF]">Cycle Ends</span>
                </div>
                <div className="text-2xl font-bold text-[#F4F6FF]">
                  {formatDate(subscription.billing_cycle_end)}
                </div>
                <div className="text-xs text-[#9CA3AF]">{subscription.billing_interval_days} day cycle</div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-6 px-2 pb-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[#9CA3AF]">Credit usage</span>
                <span className="text-xs text-[#9CA3AF] font-mono">{usedPercent.toFixed(1)}%</span>
              </div>
              <div className="h-3 sm:h-2 rounded-full bg-[rgba(139,92,246,0.08)] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    usedPercent > 90 ? 'bg-[#FF6161]' : usedPercent > 70 ? 'bg-[#FFB800]' : 'bg-gradient-to-r from-[#8B5CF6] to-[#EC4899]'
                  }`}
                  style={{ width: `${usedPercent}%` }}
                />
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {/* Plan Cards Grid */}
      <div>
        <h2 className="text-xl font-bold text-[#F4F6FF] mb-4 font-heading">
          Available Plans
        </h2>
        {isMobile ? (
          <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory -mx-4 px-4">
            {plans.map((plan) => (
              <div key={plan.id} className="min-w-[280px] snap-center flex-shrink-0">
                {renderPlanCard(plan, 'h-full')}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {plans.map((plan) => renderPlanCard(plan))}
          </div>
        )}
      </div>

      {/* Plan Comparison Table */}
      <SectionCard title="Plan Comparison" subtitle="Compare features across all plans">
        <div className="overflow-x-auto -mx-4 px-4 md:-mx-5 md:px-5">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="border-b border-[rgba(139,92,246,0.15)]">
                <th className="text-left py-3 px-2 text-sm font-medium text-[#9CA3AF]">Feature</th>
                {plans.map((plan) => {
                  const display = PLAN_DISPLAY[plan.id];
                  return (
                    <th key={plan.id} className="text-center py-3 px-2 text-sm font-medium">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[#F4F6FF] capitalize">{plan.id}</span>
                        {display?.badge && (
                          <span
                            className="text-xs px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: `${display.badgeColor}20`,
                              color: display.badgeColor,
                            }}
                          >
                            {display.badge}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[rgba(139,92,246,0.08)] bg-[rgba(12,12,30,0.3)]">
                <td className="py-3 px-2 text-sm text-[#9CA3AF]">Agent Slots</td>
                {plans.map((plan) => {
                  const display = PLAN_DISPLAY[plan.id];
                  return (
                    <td key={plan.id} className="text-center py-3 px-2 text-sm text-[#F4F6FF]">
                      {display?.agentSlots || 1}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b border-[rgba(139,92,246,0.08)]">
                <td className="py-3 px-2 text-sm text-[#9CA3AF]">Token Budget</td>
                {plans.map((plan) => {
                  const display = PLAN_DISPLAY[plan.id];
                  return (
                    <td key={plan.id} className="text-center py-3 px-2 text-sm text-[#F4F6FF]">
                      {display?.tokenBudget || '50K'}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b border-[rgba(139,92,246,0.08)] bg-[rgba(12,12,30,0.3)]">
                <td className="py-3 px-2 text-sm text-[#9CA3AF]">Kimi Access</td>
                {plans.map((plan) => {
                  const display = PLAN_DISPLAY[plan.id];
                  return (
                    <td key={plan.id} className="text-center py-3 px-2">
                      {display?.hasKimi ? (
                        <CheckCircle2 className="w-5 h-5 text-[#10B981] mx-auto" />
                      ) : (
                        <span className="text-[#9CA3AF]">{'\u2014'}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b border-[rgba(139,92,246,0.08)]">
                <td className="py-3 px-2 text-sm text-[#9CA3AF]">Credits / Cycle</td>
                {plans.map((plan) => (
                  <td key={plan.id} className="text-center py-3 px-2 text-sm text-[#F4F6FF]">
                    {formatCredits(plan.credits)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-3 px-2 text-sm text-[#9CA3AF]">Price</td>
                {plans.map((plan) => {
                  const display = PLAN_DISPLAY[plan.id];
                  return (
                    <td key={plan.id} className="text-center py-3 px-2">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-sm font-bold text-[#F4F6FF]">{price(plan)}</span>
                        {display?.oldPrice > 0 && (
                          <span className="text-xs text-[#9CA3AF] line-through">{oldPrice(plan)}</span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Usage History Table */}
      <SectionCard title="Usage History" subtitle="Last 30 days of daily usage">
        {usage.length === 0 ? (
          <div className="text-center py-8">
            <TrendingUp className="w-10 h-10 text-[#8B5CF6]/30 mx-auto mb-3" />
            <p className="text-[#9CA3AF]">No usage data yet</p>
            <p className="text-sm text-[#9CA3AF]">Start chatting and usage will appear here</p>
          </div>
        ) : (
          <MobileTable<DailyUsage>
            columns={[
              { key: 'day', label: 'Date', primary: true, render: (row) => <span className="text-[#F4F6FF]">{formatDate(row.day)}</span> },
              { key: 'calls', label: 'Calls', render: (row) => <span className="text-[#9CA3AF] font-mono">{row.calls}</span> },
              { key: 'tokens', label: 'Tokens', render: (row) => <span className="text-[#9CA3AF] font-mono">{(row.total_tokens ?? 0).toLocaleString()}</span> },
              { key: 'cost', label: 'Cost', render: (row) => <span className="text-[#F4F6FF] font-mono">${(row.total_cost ?? 0).toFixed(4)}</span> },
            ]}
            data={usage}
            keyExtractor={(row) => row.day}
            emptyMessage="No usage data yet"
            striped
          />
        )}
      </SectionCard>

      {/* Credit History -- per-event detail */}
      <SectionCard title="Credit History" subtitle="Last 20 AI requests with cost breakdown">
        {events.length === 0 ? (
          <div className="text-center py-8">
            <Zap className="w-10 h-10 text-[#8B5CF6]/30 mx-auto mb-3" />
            <p className="text-[#9CA3AF]">No credit events yet</p>
            <p className="text-sm text-[#9CA3AF]">Credit usage will appear here after your first AI request</p>
          </div>
        ) : (
          <MobileTable<UsageEvent>
            columns={[
              {
                key: 'created_at',
                label: 'Date',
                primary: true,
                render: (row) => (
                  <span className="text-[#F4F6FF] text-xs whitespace-nowrap">
                    {formatDate((row as unknown as Record<string, string>).created_at || row.createdAt)}
                  </span>
                ),
              },
              {
                key: 'channel',
                label: 'Channel',
                render: (row) => <span className="text-[#9CA3AF] capitalize">{row.channel || '\u2014'}</span>,
              },
              {
                key: 'model',
                label: 'Model',
                render: (row) => (
                  <span className="text-[#9CA3AF] font-mono text-xs truncate max-w-[100px] block">
                    {row.model || row.provider || '\u2014'}
                  </span>
                ),
              },
              {
                key: 'tokens_in',
                label: 'Tokens',
                render: (row) => {
                  const tokensIn = (row as unknown as Record<string, number>).tokens_in ?? row.tokensIn ?? 0;
                  const tokensOut = (row as unknown as Record<string, number>).tokens_out ?? row.tokensOut ?? 0;
                  return <span className="text-[#9CA3AF] font-mono">{(tokensIn + tokensOut).toLocaleString()}</span>;
                },
              },
              {
                key: 'cost_usd',
                label: 'Cost',
                render: (row) => {
                  const cost = (row as unknown as Record<string, number>).cost_usd ?? row.costUSD ?? 0;
                  return <span className="text-[#F4F6FF] font-mono">${cost.toFixed(4)}</span>;
                },
              },
            ]}
            data={events}
            keyExtractor={(row) => row.id}
            emptyMessage="No credit events yet"
            striped
          />
        )}
      </SectionCard>
    </div>
    </PageShell>
  );
}
