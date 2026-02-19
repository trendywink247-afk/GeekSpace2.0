import { useState, useEffect } from 'react';
import { CreditCard, Check, ArrowUpRight, Calendar, Zap, TrendingUp, Sparkles, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageProgress } from '@/components/ui/page-progress';
import { MobileTable } from '@/components/ui/mobile-table';
import { useMobileDetect } from '@/hooks/useMobileDetect';
import { billingService } from '@/services/api';
import type { Subscription, PlanDefinition, DailyUsage } from '@/types';

// Plan display metadata for sale styling
const PLAN_DISPLAY: Record<string, { oldPrice: number; badge: string; badgeColor?: string; agentSlots: number; tokenBudget: string; hasKimi: boolean }> = {
  free: { oldPrice: 99, badge: '', agentSlots: 1, tokenBudget: '50K', hasKimi: false },
  intro: { oldPrice: 1499, badge: 'Most Popular', badgeColor: '#7B61FF', agentSlots: 2, tokenBudget: '300K', hasKimi: true },
  monthly: { oldPrice: 1499, badge: 'Popular', badgeColor: '#FFD761', agentSlots: 2, tokenBudget: '300K', hasKimi: true },
  halfyear: { oldPrice: 5999, badge: '', agentSlots: 3, tokenBudget: '750K', hasKimi: true },
  yearly: { oldPrice: 9999, badge: 'Best Value', badgeColor: '#61FF7B', agentSlots: 3, tokenBudget: '1M', hasKimi: true },
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
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<PlanDefinition[]>([]);
  const [usage, setUsage] = useState<DailyUsage[]>([]);
  const [currency, setCurrency] = useState<'USD' | 'INR'>('USD');
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    Promise.all([
      billingService.getPlan().then(r => r.data),
      billingService.getPlans().then(r => r.data),
      billingService.getUsage().then(r => r.data),
    ]).then(([sub, planList, usageData]) => {
      setSubscription(sub);
      setPlans(planList);
      setUsage(usageData);
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

  const price = (plan: PlanDefinition) =>
    currency === 'INR' ? `₹${plan.priceInr.toLocaleString()}` : `$${plan.priceUsd}`;

  const oldPrice = (plan: PlanDefinition) => {
    const display = PLAN_DISPLAY[plan.id];
    if (!display || display.oldPrice === 0) return null;
    return currency === 'INR' ? `₹${display.oldPrice.toLocaleString()}` : `$${Math.round(display.oldPrice / 83)}`;
  };

  if (loading) {
    return (
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
            <div key={i} className="p-6 rounded-xl border border-[#7B61FF]/10 space-y-4">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const usedPercent = subscription
    ? Math.min((subscription.credits_used_this_cycle / subscription.monthly_credits) * 100, 100)
    : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl border text-sm font-medium transition-all animate-in slide-in-from-top-2 ${
          toast.type === 'success'
            ? 'bg-[#61FF7B]/10 border-[#61FF7B]/30 text-[#61FF7B]'
            : 'bg-[#FF6161]/10 border-[#FF6161]/30 text-[#FF6161]'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Billing
          </h1>
          <p className="text-[#A7ACB8]">Manage your plan and credits</p>
        </div>

        {/* Currency toggle */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0B0B10] border border-[#7B61FF]/20">
          {(['USD', 'INR'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                currency === c
                  ? 'bg-[#7B61FF] text-white'
                  : 'text-[#A7ACB8] hover:text-[#F4F6FF]'
              }`}
            >
              {c === 'USD' ? '$ USD' : '₹ INR'}
            </button>
          ))}
        </div>
      </div>

      {/* Current Plan Card */}
      {subscription && (
        <Card className="bg-[#0B0B10] border-[#7B61FF]/20 overflow-hidden">
          <div className="p-6 bg-gradient-to-br from-[#7B61FF]/20 to-[#0B0B10] border-b border-[#7B61FF]/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#7B61FF]/20 flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-[#7B61FF]" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#F4F6FF] capitalize">{subscription.plan} Plan</h2>
                  <p className="text-sm text-[#A7ACB8]">
                    {subscription.price_usd > 0
                      ? `${currency === 'INR' ? `₹${subscription.price_inr.toLocaleString()}` : `$${subscription.price_usd}`} / ${plans.find(p => p.id === subscription.plan)?.intervalLabel || 'cycle'}`
                      : 'Free forever'}
                  </p>
                </div>
              </div>
              <Badge className={subscription.status === 'active' ? 'bg-[#61FF7B]/20 text-[#61FF7B] border-[#61FF7B]/30' : 'bg-[#FFD761]/20 text-[#FFD761] border-[#FFD761]/30'}>
                {subscription.status}
              </Badge>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-[#05050A]/80 border border-[#7B61FF]/10">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-[#7B61FF]" />
                  <span className="text-xs text-[#A7ACB8]">Credits Remaining</span>
                </div>
                <div className="text-2xl font-bold text-[#F4F6FF] font-mono">
                  {formatCredits(subscription.credits_remaining)}
                </div>
                <div className="text-xs text-[#A7ACB8]">of {formatCredits(subscription.monthly_credits)}</div>
              </div>
              <div className="p-4 rounded-xl bg-[#05050A]/80 border border-[#7B61FF]/10">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-[#FFD761]" />
                  <span className="text-xs text-[#A7ACB8]">Credits Used</span>
                </div>
                <div className="text-2xl font-bold text-[#F4F6FF] font-mono">
                  {formatCredits(subscription.credits_used_this_cycle)}
                </div>
                <div className="text-xs text-[#A7ACB8]">this cycle</div>
              </div>
              <div className="p-4 rounded-xl bg-[#05050A]/80 border border-[#7B61FF]/10">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-[#61FF7B]" />
                  <span className="text-xs text-[#A7ACB8]">Cycle Ends</span>
                </div>
                <div className="text-2xl font-bold text-[#F4F6FF]">
                  {formatDate(subscription.billing_cycle_end)}
                </div>
                <div className="text-xs text-[#A7ACB8]">{subscription.billing_interval_days} day cycle</div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-[#A7ACB8]">Credit usage</span>
                <span className="text-xs text-[#A7ACB8] font-mono">{usedPercent.toFixed(1)}%</span>
              </div>
              <div className="h-3 sm:h-2 bg-[#05050A] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    usedPercent > 90 ? 'bg-[#FF6161]' : usedPercent > 70 ? 'bg-[#FFD761]' : 'bg-gradient-to-r from-[#7B61FF] to-[#61FF7B]'
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
        <h2 className="text-xl font-bold text-[#F4F6FF] mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          Available Plans
        </h2>
        {isMobile ? (
          <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory -mx-4 px-4">
            {plans.map((plan) => {
              const isCurrent = subscription?.plan === plan.id;
              const isFree = plan.priceUsd === 0;
              const display = PLAN_DISPLAY[plan.id] || { oldPrice: 0, badge: '', agentSlots: 1, tokenBudget: '50K', hasKimi: false };
              return (
                <div key={plan.id} className="min-w-[280px] snap-center flex-shrink-0">
                  <Card
                    className={`bg-[#0B0B10] transition-all h-full relative overflow-hidden ${
                      isCurrent
                        ? 'border-[#7B61FF] ring-1 ring-[#7B61FF]/30'
                        : 'border-[#7B61FF]/20 hover:border-[#7B61FF]/40'
                    } ${isFree && !isCurrent ? 'opacity-60' : ''}`}
                  >
                    {/* Badge */}
                    {display.badge && (
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
                    <CardHeader className="pb-3 pt-6">
                      <div className="flex items-center justify-between">
                        <CardTitle className="capitalize text-[#F4F6FF]">{plan.id}</CardTitle>
                        {isCurrent && (
                          <Badge className="bg-[#7B61FF]/20 text-[#7B61FF] border-[#7B61FF]/30">
                            Current
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Price with slashed old price */}
                      <div className="flex items-baseline flex-wrap gap-2">
                        <span className="text-4xl font-bold text-[#F4F6FF]">{price(plan)}</span>
                        {display.oldPrice > 0 && (
                          <span className="text-lg text-[#A7ACB8] line-through">{oldPrice(plan)}</span>
                        )}
                        {plan.priceUsd > 0 && (
                          <span className="text-sm text-[#A7ACB8]">/ {plan.intervalLabel}</span>
                        )}
                      </div>
                      <div className="text-sm text-[#A7ACB8]">{plan.description}</div>

                      {/* Features */}
                      <div className="space-y-2 py-2 border-t border-[#7B61FF]/10">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[#A7ACB8]">Agent Slots</span>
                          <span className="text-[#F4F6FF] font-medium">{display.agentSlots}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[#A7ACB8]">Token Budget</span>
                          <span className="text-[#F4F6FF] font-medium">{display.tokenBudget}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[#A7ACB8]">Kimi Access</span>
                          {display.hasKimi ? (
                            <CheckCircle2 className="w-4 h-4 text-[#61FF7B]" />
                          ) : (
                            <span className="text-[#A7ACB8]">—</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-[#F4F6FF]">
                        <Zap className="w-4 h-4 text-[#7B61FF]" />
                        {formatCredits(plan.credits)} credits
                      </div>
                      {isCurrent ? (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-[#7B61FF]/10 text-sm text-[#7B61FF]">
                          <Check className="w-4 h-4" />
                          Active plan
                        </div>
                      ) : (
                        <Button
                          onClick={() => handleUpgrade(plan.id)}
                          disabled={upgrading === plan.id || isFree}
                          className="w-full bg-[#7B61FF] hover:bg-[#6B51EF] disabled:opacity-50 min-h-[44px]"
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
                          className="w-full mt-2 py-2 px-3 rounded-lg border border-[#7B61FF]/30 text-[#7B61FF] text-xs hover:bg-[#7B61FF]/10 transition-colors min-h-[44px]"
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
              const isCurrent = subscription?.plan === plan.id;
              const isFree = plan.priceUsd === 0;
              const display = PLAN_DISPLAY[plan.id] || { oldPrice: 0, badge: '', agentSlots: 1, tokenBudget: '50K', hasKimi: false };
              return (
                <Card
                  key={plan.id}
                  className={`bg-[#0B0B10] transition-all relative overflow-hidden ${
                    isCurrent
                      ? 'border-[#7B61FF] ring-1 ring-[#7B61FF]/30'
                      : 'border-[#7B61FF]/20 hover:border-[#7B61FF]/40'
                  } ${isFree && !isCurrent ? 'opacity-60' : ''}`}
                >
                  {/* Badge */}
                  {display.badge && (
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
                  <CardHeader className="pb-3 pt-6">
                    <div className="flex items-center justify-between">
                      <CardTitle className="capitalize text-[#F4F6FF]">{plan.id}</CardTitle>
                      {isCurrent && (
                        <Badge className="bg-[#7B61FF]/20 text-[#7B61FF] border-[#7B61FF]/30">
                          Current
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Price with slashed old price */}
                    <div className="flex items-baseline flex-wrap gap-2">
                      <span className="text-3xl font-bold text-[#F4F6FF]">{price(plan)}</span>
                      {display.oldPrice > 0 && (
                        <span className="text-sm text-[#A7ACB8] line-through">{oldPrice(plan)}</span>
                      )}
                      {plan.priceUsd > 0 && (
                        <span className="text-sm text-[#A7ACB8]">/ {plan.intervalLabel}</span>
                      )}
                    </div>
                    <div className="text-sm text-[#A7ACB8]">{plan.description}</div>

                    {/* Features */}
                    <div className="space-y-2 py-2 border-t border-[#7B61FF]/10">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[#A7ACB8]">Agent Slots</span>
                        <span className="text-[#F4F6FF] font-medium">{display.agentSlots}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[#A7ACB8]">Token Budget</span>
                        <span className="text-[#F4F6FF] font-medium">{display.tokenBudget}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[#A7ACB8]">Kimi Access</span>
                        {display.hasKimi ? (
                          <CheckCircle2 className="w-4 h-4 text-[#61FF7B]" />
                        ) : (
                          <span className="text-[#A7ACB8]">—</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-[#F4F6FF]">
                      <Zap className="w-4 h-4 text-[#7B61FF]" />
                      {formatCredits(plan.credits)} credits
                    </div>
                    {isCurrent ? (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-[#7B61FF]/10 text-sm text-[#7B61FF]">
                        <Check className="w-4 h-4" />
                        Active plan
                      </div>
                    ) : (
                      <Button
                        onClick={() => handleUpgrade(plan.id)}
                        disabled={upgrading === plan.id || isFree}
                        className="w-full bg-[#7B61FF] hover:bg-[#6B51EF] disabled:opacity-50"
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
                        className="w-full mt-2 py-1.5 px-3 rounded-lg border border-[#7B61FF]/30 text-[#7B61FF] text-xs hover:bg-[#7B61FF]/10 transition-colors"
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
      <Card className="bg-[#0B0B10] border-[#7B61FF]/20">
        <CardHeader>
          <CardTitle className="text-[#F4F6FF] flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#FFD761]" />
            Plan Comparison
          </CardTitle>
          <p className="text-sm text-[#A7ACB8]">Compare features across all plans</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-[#7B61FF]/20">
                  <th className="text-left py-3 px-2 text-sm font-medium text-[#A7ACB8]">Feature</th>
                  {plans.map((plan) => {
                    const display = PLAN_DISPLAY[plan.id];
                    return (
                      <th key={plan.id} className="text-center py-3 px-2 text-sm font-medium">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[#F4F6FF] capitalize">{plan.id}</span>
                          {display?.badge && (
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded"
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
                <tr className="border-b border-[#7B61FF]/10">
                  <td className="py-3 px-2 text-sm text-[#A7ACB8]">Agent Slots</td>
                  {plans.map((plan) => {
                    const display = PLAN_DISPLAY[plan.id];
                    return (
                      <td key={plan.id} className="text-center py-3 px-2 text-sm text-[#F4F6FF]">
                        {display?.agentSlots || 1}
                      </td>
                    );
                  })}
                </tr>
                <tr className="border-b border-[#7B61FF]/10">
                  <td className="py-3 px-2 text-sm text-[#A7ACB8]">Token Budget</td>
                  {plans.map((plan) => {
                    const display = PLAN_DISPLAY[plan.id];
                    return (
                      <td key={plan.id} className="text-center py-3 px-2 text-sm text-[#F4F6FF]">
                        {display?.tokenBudget || '50K'}
                      </td>
                    );
                  })}
                </tr>
                <tr className="border-b border-[#7B61FF]/10">
                  <td className="py-3 px-2 text-sm text-[#A7ACB8]">Kimi Access</td>
                  {plans.map((plan) => {
                    const display = PLAN_DISPLAY[plan.id];
                    return (
                      <td key={plan.id} className="text-center py-3 px-2">
                        {display?.hasKimi ? (
                          <CheckCircle2 className="w-5 h-5 text-[#61FF7B] mx-auto" />
                        ) : (
                          <span className="text-[#A7ACB8]">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
                <tr className="border-b border-[#7B61FF]/10">
                  <td className="py-3 px-2 text-sm text-[#A7ACB8]">Credits / Cycle</td>
                  {plans.map((plan) => (
                    <td key={plan.id} className="text-center py-3 px-2 text-sm text-[#F4F6FF]">
                      {formatCredits(plan.credits)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-3 px-2 text-sm text-[#A7ACB8]">Price</td>
                  {plans.map((plan) => {
                    const display = PLAN_DISPLAY[plan.id];
                    return (
                      <td key={plan.id} className="text-center py-3 px-2">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm font-bold text-[#F4F6FF]">{price(plan)}</span>
                          {display?.oldPrice > 0 && (
                            <span className="text-xs text-[#A7ACB8] line-through">{oldPrice(plan)}</span>
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
      <Card className="bg-[#0B0B10] border-[#7B61FF]/20">
        <CardHeader>
          <CardTitle className="text-[#F4F6FF]">Usage History</CardTitle>
          <p className="text-sm text-[#A7ACB8]">Last 30 days of daily usage</p>
        </CardHeader>
        <CardContent>
          {usage.length === 0 ? (
            <div className="text-center py-8">
              <TrendingUp className="w-10 h-10 text-[#7B61FF]/30 mx-auto mb-3" />
              <p className="text-[#A7ACB8]">No usage data yet</p>
              <p className="text-sm text-[#A7ACB8]">Start chatting and usage will appear here</p>
            </div>
          ) : (
            <MobileTable<DailyUsage>
              columns={[
                { key: 'day', label: 'Date', primary: true, render: (row) => <span className="text-[#F4F6FF]">{formatDate(row.day)}</span> },
                { key: 'calls', label: 'Calls', render: (row) => <span className="text-[#A7ACB8] font-mono">{row.calls}</span> },
                { key: 'tokens', label: 'Tokens', render: (row) => <span className="text-[#A7ACB8] font-mono">{(row.total_tokens ?? 0).toLocaleString()}</span> },
                { key: 'cost', label: 'Cost', render: (row) => <span className="text-[#F4F6FF] font-mono">${(row.total_cost ?? 0).toFixed(4)}</span> },
              ]}
              data={usage}
              keyExtractor={(row) => row.day}
              emptyMessage="No usage data yet"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
