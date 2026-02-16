import { useState, useEffect } from 'react';
import { CreditCard, Check, ArrowUpRight, Calendar, Zap, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageProgress } from '@/components/ui/page-progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { billingService } from '@/services/api';
import type { Subscription, PlanDefinition, DailyUsage } from '@/types';

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

  const price = (plan: PlanDefinition) =>
    currency === 'INR' ? `₹${plan.priceInr.toLocaleString()}` : `$${plan.priceUsd}`;

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
              <div className="h-2 bg-[#05050A] rounded-full overflow-hidden">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {plans.map((plan) => {
            const isCurrent = subscription?.plan === plan.id;
            const isFree = plan.priceUsd === 0;
            return (
              <Card
                key={plan.id}
                className={`bg-[#0B0B10] transition-all ${
                  isCurrent
                    ? 'border-[#7B61FF] ring-1 ring-[#7B61FF]/30'
                    : 'border-[#7B61FF]/20 hover:border-[#7B61FF]/40'
                } ${isFree && !isCurrent ? 'opacity-60' : ''}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="capitalize text-[#F4F6FF]">{plan.id}</CardTitle>
                    {plan.badge && (
                      <Badge variant="outline" className="text-[10px] border-[#FFD761]/30 text-[#FFD761]">
                        {plan.badge}
                      </Badge>
                    )}
                    {isCurrent && (
                      <Badge className="bg-[#7B61FF]/20 text-[#7B61FF] border-[#7B61FF]/30">
                        Current
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <span className="text-3xl font-bold text-[#F4F6FF]">{price(plan)}</span>
                    {plan.priceUsd > 0 && (
                      <span className="text-sm text-[#A7ACB8] ml-1">/ {plan.intervalLabel}</span>
                    )}
                  </div>
                  <div className="text-sm text-[#A7ACB8]">{plan.description}</div>
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
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

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
            <Table>
              <TableHeader>
                <TableRow className="border-[#7B61FF]/20">
                  <TableHead className="text-[#A7ACB8]">Date</TableHead>
                  <TableHead className="text-[#A7ACB8]">Calls</TableHead>
                  <TableHead className="text-[#A7ACB8]">Tokens</TableHead>
                  <TableHead className="text-[#A7ACB8] text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usage.map((row) => (
                  <TableRow key={row.day} className="border-[#7B61FF]/10">
                    <TableCell className="text-[#F4F6FF]">{formatDate(row.day)}</TableCell>
                    <TableCell className="text-[#A7ACB8] font-mono">{row.calls}</TableCell>
                    <TableCell className="text-[#A7ACB8] font-mono">{(row.total_tokens ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="text-[#F4F6FF] font-mono text-right">${(row.total_cost ?? 0).toFixed(4)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
