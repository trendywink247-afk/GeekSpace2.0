import { useState, useEffect } from 'react';
import { PageShell } from '@/components/agentin';
import { CreditCard, Check, ArrowUpRight, Calendar, Zap, TrendingUp, Sparkles, CheckCircle2, Lock, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageProgress } from '@/components/ui/page-progress';
import { MobileTable } from '@/components/ui/mobile-table';
import { useMobileDetect } from '@/hooks/useMobileDetect';
import { billingService } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import type { Subscription, PlanDefinition, DailyUsage, UsageEvent } from '@/types';

// Plan display metadata for sale styling
const PLAN_DISPLAY: Record<string, { oldPrice: number; badge: string; badgeColor?: string; agentSlots: number; tokenBudget: string; hasKimi: boolean; highlighted?: boolean }> = {
  free: { oldPrice: 99, badge: '', agentSlots: 1, tokenBudget: '50K', hasKimi: false },
  intro: { oldPrice: 1499, badge: 'Most Popular', badgeColor: '#00F0FF', agentSlots: 2, tokenBudget: '300K', hasKimi: true, highlighted: true },
  monthly: { oldPrice: 1499, badge: 'Popular', badgeColor: '#FFB800', agentSlots: 2, tokenBudget: '300K', hasKimi: true },
  halfyear: { oldPrice: 5999, badge: '', agentSlots: 3, tokenBudget: '750K', hasKimi: true },
  yearly: { oldPrice: 9999, badge: 'Best Value', badgeColor: '#00FF88', agentSlots: 3, tokenBudget: '1M', hasKimi: true },
};

// Colored pill for current plan badge
const PLAN_PILL: Record<string, { bg: string; text: string; border: string }> = {
  free: { bg: 'rgba(156,163,175,0.15)', text: '#9CA3AF', border: 'rgba(156,163,175,0.3)' },
  intro: { bg: 'rgba(0,240,255,0.15)', text: '#00F0FF', border: 'rgba(0,240,255,0.3)' },
  monthly: { bg: 'rgba(0,240,255,0.15)', text: '#00F0FF', border: 'rgba(0,240,255,0.3)' },
  halfyear: { bg: 'rgba(191,95,255,0.15)', text: '#BF5FFF', border: 'rgba(191,95,255,0.3)' },
  yearly: { bg: 'rgba(191,95,255,0.15)', text: '#BF5FFF', border: 'rgba(191,95,255,0.3)' },
};

function formatCredits(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function BillingPage() {
  const isMobile = useMobileDetect();
  const user = useAuthStore((s) => s.user);
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
      if (sub.currency === 'INR') setCurrency('INR');
    }).catch(() => {
      setToast({ message: 'Failed to load billing data', type: 'error' });
    }).finally(() => setLoading(false));
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
    } catch {
      setToast({ message: 'Upgrade failed. Please try again.', type: 'error' });
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
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Day pass failed';
      setToast({ message, type: 'error' });
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
    currency === 'INR' ? `₹${plan.priceInr.toLocaleString()}` : `$${plan.priceUsd}`;

  const oldPrice = (plan: PlanDefinition) => {
    const display = PLAN_DISPLAY[plan.id];
    if (!display || display.oldPrice === 0) return null;
    return currency === 'INR' ? `₹${display.oldPrice.toLocaleString()}` : `$${Math.round(display.oldPrice / 83)}`;
  };

  if (loading) {
    return (
      <PageShell>
      <div className="space-y-6">
        <PageProgress loading />
        {/* Header skeleton */}
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-10 w-36 rounded-lg" />
        </div>
        {/* Current plan card skeleton */}
        <Skeleton className="h-64 w-full rounded-xl" />
        {/* Plan cards grid skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-6 rounded-xl border border-[#00F0FF]/10 space-y-4">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          ))}
        </div>
      </div>
      </PageShell>
    );
  }

  const usedPercent = subscription
    ? Math.min((subscription.credits_used_this_cycle / subscription.monthly_credits) * 100, 100)
    : 0;

  return (
    <PageShell>
    <div data-testid="billing-page" className="space-y-6 animate-in fade-in duration-500 pb-24 md:pb-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl border text-sm font-medium transition-all animate-in slide-in-from-top-2 ${
          toast.type === 'success'
            ? 'bg-[#00FF88]/10 border-[#00FF88]/30 text-[#00FF88]'
            : 'bg-[#FF6161]/10 border-[#FF6161]/30 text-[#FF6161]'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
            Billing
          </h1>
          <p className="text-[var(--ag-text-muted)]">Manage your plan and credits</p>
        </div>

        {/* Currency toggle */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--ag-bg-surface)] border border-[#00F0FF]/20">
          {(['USD', 'INR'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all min-h-[44px] ${
                currency === c
                  ? 'bg-[#00F0FF] text-white'
                  : 'text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)]'
              }`}
            >
              {c === 'USD' ? '$ USD' : '₹ INR'}
            </button>
          ))}
        </div>
      </div>


      <Card className="border-[#BF5FFF]/30" data-testid="stripe-plans">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Star className="w-5 h-5 text-[#BF5FFF]" />
            <div>
              <CardTitle className="text-[var(--ag-text-primary)]">Premium Subscription</CardTitle>
              <p className="text-sm text-[var(--ag-text-muted)]">Basic (Rs 99/mo) and Pro (Rs 299/mo) via Stripe</p>
            </div>
            {stripeStatus?.isPaid && (
              <Badge className="bg-[#BF5FFF]/20 text-[#BF5FFF] border-[#BF5FFF]/30 ml-auto">{stripeStatus.label} Active</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="p-5 rounded-xl border border-[#BF5FFF]/20 hover:border-[#BF5FFF]/40 transition-all">
              <div className="font-bold text-[var(--ag-text-primary)] mb-1">Basic</div>
              <div className="text-3xl font-bold text-[var(--ag-text-primary)] mb-3">{currency === 'INR' ? '₹99' : '$1.19'}<span className="text-sm font-normal text-[var(--ag-text-muted)]">/month</span></div>
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
              <div className="text-3xl font-bold text-[var(--ag-text-primary)] mb-3">{currency === 'INR' ? '₹299' : '$3.59'}<span className="text-sm font-normal text-[var(--ag-text-muted)]">/month</span></div>
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
            <div className="flex items-center gap-2 p-3 rounded-lg bg-[#BF5FFF]/5 border border-[#BF5FFF]/20 text-sm text-[var(--ag-text-muted)]" data-testid="upgrade-to-unlock">
              <Lock className="w-4 h-4 text-[#BF5FFF] flex-shrink-0" />
              <span>Upgrade to Basic or Pro to unlock image and voice generation</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Plan Card */}
      {subscription && (
        <Card className="border-[#00F0FF]/20 overflow-hidden">
          <div className="p-6 bg-gradient-to-br from-[#00F0FF]/20 to-[#0C0C18] border-b border-[#00F0FF]/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#00F0FF]/20 flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-[var(--ag-cyan)]" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[var(--ag-text-primary)] capitalize">{subscription.plan} Plan</h2>
                  <p className="text-sm text-[var(--ag-text-muted)]">
                    {subscription.price_usd > 0
                      ? `${currency === 'INR' ? `₹${subscription.price_inr.toLocaleString()}` : `$${subscription.price_usd}`} / ${plans.find(p => p.id === subscription.plan)?.intervalLabel || 'cycle'}`
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl /80 border border-[#00F0FF]/10">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-[var(--ag-cyan)]" />
                  <span className="text-xs text-[var(--ag-text-muted)]">Credits Remaining</span>
                </div>
                <div className="text-2xl font-bold text-[var(--ag-text-primary)] font-mono">
                  {formatCredits(subscription.credits_remaining)}
                </div>
                <div className="text-xs text-[var(--ag-text-muted)]">of {formatCredits(subscription.monthly_credits)}</div>
              </div>
              <div className="p-4 rounded-xl /80 border border-[#00F0FF]/10">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-[#FFB800]" />
                  <span className="text-xs text-[var(--ag-text-muted)]">Credits Used</span>
                </div>
                <div className="text-2xl font-bold text-[var(--ag-text-primary)] font-mono">
                  {formatCredits(subscription.credits_used_this_cycle)}
                </div>
                <div className="text-xs text-[var(--ag-text-muted)]">this cycle</div>
              </div>
              <div className="p-4 rounded-xl /80 border border-[#00F0FF]/10">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-[#00FF88]" />
                  <span className="text-xs text-[var(--ag-text-muted)]">Cycle Ends</span>
                </div>
                <div className="text-2xl font-bold text-[var(--ag-text-primary)]">
                  {formatDate(subscription.billing_cycle_end)}
                </div>
                <div className="text-xs text-[var(--ag-text-muted)]">{subscription.billing_interval_days} day cycle</div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[var(--ag-text-muted)]">Credit usage</span>
                <span className="text-xs text-[var(--ag-text-muted)] font-mono">{usedPercent.toFixed(1)}%</span>
              </div>
              <div className="h-3 sm:h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    usedPercent > 90 ? 'bg-[#FF6161]' : usedPercent > 70 ? 'bg-[#FFB800]' : 'bg-gradient-to-r from-[#00F0FF] to-[#00FF88]'
                  }`}
                  style={{ width: `${usedPercent}%` }}
                />
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Plan Cards Grid */}
      <div>
        <h2 className="text-xl font-bold text-[var(--ag-text-primary)] mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
          Available Plans
        </h2>
        {isMobile ? (
          <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory -mx-4 px-4">
            {plans.map((plan) => {
              const isCurrent = subscription?.plan?.toLowerCase() === plan.id?.toLowerCase();
              const isFree = plan.priceUsd === 0;
              const display = PLAN_DISPLAY[plan.id] || { oldPrice: 0, badge: '', agentSlots: 1, tokenBudget: '50K', hasKimi: false };
              const isHighlighted = display.highlighted && !isCurrent;
              return (
                <div key={plan.id} className="min-w-[280px] snap-center flex-shrink-0">
                  <Card
                    className={`bg-[var(--ag-bg-surface)] transition-all h-full relative overflow-hidden ${
                      isCurrent
                        ? 'border-[#00F0FF] ring-1 ring-[#00F0FF]/30'
                        : isHighlighted
                          ? 'border-[#00F0FF] ring-1 ring-[#00F0FF]/20 shadow-[0_0_20px_rgba(0,240,255,0.15)]'
                          : 'border-[#00F0FF]/20 hover:border-[#00F0FF]/40'
                    } ${isFree && !isCurrent ? 'opacity-60' : ''}`}
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
                          backgroundColor: 'rgba(0,240,255,0.15)',
                          color: '#00F0FF',
                          borderBottom: '1px solid rgba(0,240,255,0.3)',
                        }}
                      >
                        Your Current Plan
                      </div>
                    )}
                    <CardHeader className="pb-3 pt-6">
                      <div className="flex items-center justify-between">
                        <CardTitle className="capitalize text-[var(--ag-text-primary)]">{plan.id}</CardTitle>
                        {isCurrent && (
                          <Badge className="bg-[#00F0FF]/20 text-[var(--ag-cyan)] border-[#00F0FF]/30">
                            Current
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Price with slashed old price */}
                      <div className="flex items-baseline flex-wrap gap-2">
                        <span className="text-4xl font-bold text-[var(--ag-text-primary)]">{price(plan)}</span>
                        {display.oldPrice > 0 && (
                          <span className="text-lg text-[var(--ag-text-muted)] line-through">{oldPrice(plan)}</span>
                        )}
                        {plan.priceUsd > 0 && (
                          <span className="text-sm text-[var(--ag-text-muted)]">/ {plan.intervalLabel}</span>
                        )}
                      </div>
                      <div className="text-sm text-[var(--ag-text-muted)]">{plan.description}</div>

                      {/* Features */}
                      <div className="space-y-2 py-2 border-t border-[#00F0FF]/10">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[var(--ag-text-muted)]">Agent Slots</span>
                          <span className="text-[var(--ag-text-primary)] font-medium">{display.agentSlots}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[var(--ag-text-muted)]">Token Budget</span>
                          <span className="text-[var(--ag-text-primary)] font-medium">{display.tokenBudget}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[var(--ag-text-muted)]">Kimi Access</span>
                          {display.hasKimi ? (
                            <CheckCircle2 className="w-4 h-4 text-[#00FF88]" />
                          ) : (
                            <span className="text-[var(--ag-text-muted)]">—</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-[var(--ag-text-primary)]">
                        <Zap className="w-4 h-4 text-[var(--ag-cyan)]" />
                        {formatCredits(plan.credits)} credits
                      </div>
                      {isCurrent ? (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-[#00F0FF]/10 text-sm text-[var(--ag-cyan)]">
                          <Check className="w-4 h-4" />
                          Active plan
                        </div>
                      ) : currency === 'INR' && !isFree ? (
                        <div>
                          <Button
                            onClick={() => handleRazorpayCheckout(plan.id, plan.id, plan.priceInr)}
                            disabled={razorpayLoading === plan.id}
                            className="w-full bg-[#00F0FF] hover:bg-[#00D4B0] disabled:opacity-50 min-h-[44px] transition-shadow hover:shadow-[0_0_16px_rgba(0,240,255,0.4)]"
                          >
                            {razorpayLoading === plan.id ? (
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                            ) : (
                              <ArrowUpRight className="w-4 h-4 mr-2" />
                            )}
                            Pay &#8377;{plan.priceInr.toLocaleString()} with Razorpay
                          </Button>
                          <p className="text-xs text-[var(--ag-text-muted)] text-center mt-1.5">UPI, Cards, Net Banking accepted</p>
                        </div>
                      ) : (
                        <Button
                          onClick={() => handleUpgrade(plan.id)}
                          disabled={upgrading === plan.id || isFree}
                          className="w-full bg-[#00F0FF] hover:bg-[#00D4B0] disabled:opacity-50 min-h-[44px] transition-shadow hover:shadow-[0_0_16px_rgba(0,240,255,0.4)]"
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
                          className="w-full mt-2 py-2 px-3 rounded-lg border border-[#00F0FF]/30 text-[var(--ag-cyan)] text-xs hover:bg-[#00F0FF]/10 transition-colors min-h-[44px]"
                        >
                          Try Weebo for $1/day →
                        </button>
                      )}
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {plans.map((plan) => {
              const isCurrent = subscription?.plan?.toLowerCase() === plan.id?.toLowerCase();
              const isFree = plan.priceUsd === 0;
              const display = PLAN_DISPLAY[plan.id] || { oldPrice: 0, badge: '', agentSlots: 1, tokenBudget: '50K', hasKimi: false };
              const isHighlighted = display.highlighted && !isCurrent;
              return (
                <Card
                  key={plan.id}
                  className={`bg-[var(--ag-bg-surface)] transition-all relative overflow-hidden ${
                    isCurrent
                      ? 'border-[#00F0FF] ring-1 ring-[#00F0FF]/30'
                      : isHighlighted
                        ? 'border-[#00F0FF] ring-1 ring-[#00F0FF]/20 shadow-[0_0_20px_rgba(0,240,255,0.15)] hover:shadow-[0_0_30px_rgba(0,240,255,0.25)]'
                        : 'border-[#00F0FF]/20 hover:border-[#00F0FF]/40'
                  } ${isFree && !isCurrent ? 'opacity-60' : ''}`}
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
                        backgroundColor: 'rgba(0,240,255,0.15)',
                        color: '#00F0FF',
                        borderBottom: '1px solid rgba(0,240,255,0.3)',
                      }}
                    >
                      Your Current Plan
                    </div>
                  )}
                  <CardHeader className="pb-3 pt-6">
                    <div className="flex items-center justify-between">
                      <CardTitle className="capitalize text-[var(--ag-text-primary)]">{plan.id}</CardTitle>
                      {isCurrent && (
                        <Badge className="bg-[#00F0FF]/20 text-[var(--ag-cyan)] border-[#00F0FF]/30">
                          Current
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Price with slashed old price */}
                    <div className="flex items-baseline flex-wrap gap-2">
                      <span className="text-3xl font-bold text-[var(--ag-text-primary)]">{price(plan)}</span>
                      {display.oldPrice > 0 && (
                        <span className="text-sm text-[var(--ag-text-muted)] line-through">{oldPrice(plan)}</span>
                      )}
                      {plan.priceUsd > 0 && (
                        <span className="text-sm text-[var(--ag-text-muted)]">/ {plan.intervalLabel}</span>
                      )}
                    </div>
                    <div className="text-sm text-[var(--ag-text-muted)]">{plan.description}</div>

                    {/* Features */}
                    <div className="space-y-2 py-2 border-t border-[#00F0FF]/10">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[var(--ag-text-muted)]">Agent Slots</span>
                        <span className="text-[var(--ag-text-primary)] font-medium">{display.agentSlots}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[var(--ag-text-muted)]">Token Budget</span>
                        <span className="text-[var(--ag-text-primary)] font-medium">{display.tokenBudget}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[var(--ag-text-muted)]">Kimi Access</span>
                        {display.hasKimi ? (
                          <CheckCircle2 className="w-4 h-4 text-[#00FF88]" />
                        ) : (
                          <span className="text-[var(--ag-text-muted)]">—</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-[var(--ag-text-primary)]">
                      <Zap className="w-4 h-4 text-[var(--ag-cyan)]" />
                      {formatCredits(plan.credits)} credits
                    </div>
                    {isCurrent ? (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-[#00F0FF]/10 text-sm text-[var(--ag-cyan)]">
                        <Check className="w-4 h-4" />
                        Active plan
                      </div>
                    ) : currency === 'INR' && !isFree ? (
                      <div>
                        <Button
                          onClick={() => handleRazorpayCheckout(plan.id, plan.id, plan.priceInr)}
                          disabled={razorpayLoading === plan.id}
                          className="w-full bg-[#00F0FF] hover:bg-[#00D4B0] disabled:opacity-50 transition-shadow hover:shadow-[0_0_16px_rgba(0,240,255,0.4)]"
                        >
                          {razorpayLoading === plan.id ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4 mr-2" />
                          )}
                          Pay &#8377;{plan.priceInr.toLocaleString()} with Razorpay
                        </Button>
                        <p className="text-xs text-[var(--ag-text-muted)] text-center mt-1.5">UPI, Cards, Net Banking accepted</p>
                      </div>
                    ) : (
                      <Button
                        onClick={() => handleUpgrade(plan.id)}
                        disabled={upgrading === plan.id || isFree}
                        className="w-full bg-[#00F0FF] hover:bg-[#00D4B0] disabled:opacity-50 transition-shadow hover:shadow-[0_0_16px_rgba(0,240,255,0.4)]"
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
                        className="w-full mt-2 py-1.5 px-3 rounded-lg border border-[#00F0FF]/30 text-[var(--ag-cyan)] text-xs hover:bg-[#00F0FF]/10 transition-colors"
                      >
                        Try Weebo for $1/day →
                      </button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Plan Comparison Table */}
      <Card className="border-[#00F0FF]/20">
        <CardHeader>
          <CardTitle className="text-[var(--ag-text-primary)] flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#FFB800]" />
            Plan Comparison
          </CardTitle>
          <p className="text-sm text-[var(--ag-text-muted)]">Compare features across all plans</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-[#00F0FF]/20">
                  <th className="text-left py-3 px-2 text-sm font-medium text-[var(--ag-text-muted)]">Feature</th>
                  {plans.map((plan) => {
                    const display = PLAN_DISPLAY[plan.id];
                    return (
                      <th key={plan.id} className="text-center py-3 px-2 text-sm font-medium">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[var(--ag-text-primary)] capitalize">{plan.id}</span>
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
                <tr className="border-b border-[#00F0FF]/10 bg-[var(--ag-bg-surface)]/40">
                  <td className="py-3 px-2 text-sm text-[var(--ag-text-muted)]">Agent Slots</td>
                  {plans.map((plan) => {
                    const display = PLAN_DISPLAY[plan.id];
                    return (
                      <td key={plan.id} className="text-center py-3 px-2 text-sm text-[var(--ag-text-primary)]">
                        {display?.agentSlots || 1}
                      </td>
                    );
                  })}
                </tr>
                <tr className="border-b border-[#00F0FF]/10">
                  <td className="py-3 px-2 text-sm text-[var(--ag-text-muted)]">Token Budget</td>
                  {plans.map((plan) => {
                    const display = PLAN_DISPLAY[plan.id];
                    return (
                      <td key={plan.id} className="text-center py-3 px-2 text-sm text-[var(--ag-text-primary)]">
                        {display?.tokenBudget || '50K'}
                      </td>
                    );
                  })}
                </tr>
                <tr className="border-b border-[#00F0FF]/10 bg-[var(--ag-bg-surface)]/40">
                  <td className="py-3 px-2 text-sm text-[var(--ag-text-muted)]">Kimi Access</td>
                  {plans.map((plan) => {
                    const display = PLAN_DISPLAY[plan.id];
                    return (
                      <td key={plan.id} className="text-center py-3 px-2">
                        {display?.hasKimi ? (
                          <CheckCircle2 className="w-5 h-5 text-[#00FF88] mx-auto" />
                        ) : (
                          <span className="text-[var(--ag-text-muted)]">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
                <tr className="border-b border-[#00F0FF]/10">
                  <td className="py-3 px-2 text-sm text-[var(--ag-text-muted)]">Credits / Cycle</td>
                  {plans.map((plan) => (
                    <td key={plan.id} className="text-center py-3 px-2 text-sm text-[var(--ag-text-primary)]">
                      {formatCredits(plan.credits)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-2 text-sm text-[var(--ag-text-muted)]">Price</td>
                  {plans.map((plan) => {
                    const display = PLAN_DISPLAY[plan.id];
                    return (
                      <td key={plan.id} className="text-center py-3 px-2">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm font-bold text-[var(--ag-text-primary)]">{price(plan)}</span>
                          {display?.oldPrice > 0 && (
                            <span className="text-xs text-[var(--ag-text-muted)] line-through">{oldPrice(plan)}</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Usage History Table */}
      <Card className="border-[#00F0FF]/20">
        <CardHeader>
          <CardTitle className="text-[var(--ag-text-primary)]">Usage History</CardTitle>
          <p className="text-sm text-[var(--ag-text-muted)]">Last 30 days of daily usage</p>
        </CardHeader>
        <CardContent>
          {usage.length === 0 ? (
            <div className="text-center py-8">
              <TrendingUp className="w-10 h-10 text-[var(--ag-cyan)]/30 mx-auto mb-3" />
              <p className="text-[var(--ag-text-muted)]">No usage data yet</p>
              <p className="text-sm text-[var(--ag-text-muted)]">Start chatting and usage will appear here</p>
            </div>
          ) : (
            <MobileTable<DailyUsage>
              columns={[
                { key: 'day', label: 'Date', primary: true, render: (row) => <span className="text-[var(--ag-text-primary)]">{formatDate(row.day)}</span> },
                { key: 'calls', label: 'Calls', render: (row) => <span className="text-[var(--ag-text-muted)] font-mono">{row.calls}</span> },
                { key: 'tokens', label: 'Tokens', render: (row) => <span className="text-[var(--ag-text-muted)] font-mono">{(row.total_tokens ?? 0).toLocaleString()}</span> },
                { key: 'cost', label: 'Cost', render: (row) => <span className="text-[var(--ag-text-primary)] font-mono">${(row.total_cost ?? 0).toFixed(4)}</span> },
              ]}
              data={usage}
              keyExtractor={(row) => row.day}
              emptyMessage="No usage data yet"
              striped
            />
          )}
        </CardContent>
      </Card>

      {/* Credit History — per-event detail */}
      <Card className="border-[#00F0FF]/20">
        <CardHeader>
          <CardTitle className="text-[var(--ag-text-primary)]">Credit History</CardTitle>
          <p className="text-sm text-[var(--ag-text-muted)]">Last 20 AI requests with cost breakdown</p>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center py-8">
              <Zap className="w-10 h-10 text-[var(--ag-cyan)]/30 mx-auto mb-3" />
              <p className="text-[var(--ag-text-muted)]">No credit events yet</p>
              <p className="text-sm text-[var(--ag-text-muted)]">Credit usage will appear here after your first AI request</p>
            </div>
          ) : (
            <MobileTable<UsageEvent>
              columns={[
                {
                  key: 'created_at',
                  label: 'Date',
                  primary: true,
                  render: (row) => (
                    <span className="text-[var(--ag-text-primary)] text-xs whitespace-nowrap">
                      {formatDate((row as unknown as Record<string, string>).created_at || row.createdAt)}
                    </span>
                  ),
                },
                {
                  key: 'channel',
                  label: 'Channel',
                  render: (row) => <span className="text-[var(--ag-text-muted)] capitalize">{row.channel || '—'}</span>,
                },
                {
                  key: 'model',
                  label: 'Model',
                  render: (row) => (
                    <span className="text-[var(--ag-text-muted)] font-mono text-xs truncate max-w-[100px] block">
                      {row.model || row.provider || '—'}
                    </span>
                  ),
                },
                {
                  key: 'tokens_in',
                  label: 'Tokens',
                  render: (row) => {
                    const tokensIn = (row as unknown as Record<string, number>).tokens_in ?? row.tokensIn ?? 0;
                    const tokensOut = (row as unknown as Record<string, number>).tokens_out ?? row.tokensOut ?? 0;
                    return <span className="text-[var(--ag-text-muted)] font-mono">{(tokensIn + tokensOut).toLocaleString()}</span>;
                  },
                },
                {
                  key: 'cost_usd',
                  label: 'Cost',
                  render: (row) => {
                    const cost = (row as unknown as Record<string, number>).cost_usd ?? row.costUSD ?? 0;
                    return <span className="text-[var(--ag-text-primary)] font-mono">${cost.toFixed(4)}</span>;
                  },
                },
              ]}
              data={events}
              keyExtractor={(row) => row.id}
              emptyMessage="No credit events yet"
              striped
            />
          )}
        </CardContent>
      </Card>
    </div>
    </PageShell>
  );
}
