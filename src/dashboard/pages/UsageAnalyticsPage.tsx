// ============================================================
// UsageAnalyticsPage — Deep-dive into AI costs and activity
// Owner agent: pulse (#10B981)
// Revamped: design tokens, PageShell + PageHeader + SectionCard,
//   useAgentCanvas, partial-failure warning, mobile QA (44px), pulse dot
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageShell, PageHeader, SectionCard } from '@/components/agentin';
import {
  DollarSign,
  MessageSquare,
  Coins,
  Wrench,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  Zap,
  BarChart3,
  Activity,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PullToRefreshWrapper } from '@/components/PullToRefreshWrapper';
import { MobileTable } from '@/components/ui/mobile-table';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { usageService } from '@/services/api';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';
import type {
  UsageSummary,
  UsageEvent,
  ChartDataPoint,
  ProviderBreakdown,
  HourlyActivity,
  BillingInfo,
} from '@/types';

const PROVIDER_COLORS = ['#10B981', '#8B5CF6', '#FFB800', '#FF2D78', '#61D4FF', '#FF9F61'];
const KPI_COLORS = { cost: '#10B981', messages: '#8B5CF6', tokens: '#FFB800', tools: '#FF2D78' };
const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: '#0C0C1E', border: '1px solid rgba(139,92,246,0.15)', borderRadius: '8px' },
  itemStyle: { color: '#F4F6FF' },
};

const PROVIDER_LABELS: Record<string, string> = {
  picoclaw: 'Weebo Engine',
  ollama: 'Local Engine',
  openrouter: 'Cloud Engine',
  'openrouter-free': 'Cloud Engine',
  edith: 'Premium Engine',
  builtin: 'Built-in',
};

const MODEL_LABELS: Record<string, string> = {
  'picoclaw-haiku': 'Weebo Engine',
};

function friendlyProvider(p: string) { return PROVIDER_LABELS[p] || p; }
function friendlyModel(m: string) { return MODEL_LABELS[m] || m; }

type SummaryRange = 'day' | 'week' | 'month';
type ChartRange = '7d' | '14d' | '30d';

/** Circular progress ring for credit usage */
function CreditCircle({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const remaining = total - used;
  const r = 40;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const color = pct > 90 ? '#FF6161' : pct > 70 ? '#FFB800' : '#10B981';
  const fmt = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: 96, height: 96 }}>
      <svg width="96" height="96" viewBox="0 0 96 96" className="transform -rotate-90">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#06061a" strokeWidth="7" />
        <circle
          cx="48" cy="48" r={r} fill="none"
          stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-[#F4F6FF] font-mono">{fmt(remaining)}</span>
        <span className="text-[10px] text-[#9CA3AF]">left</span>
      </div>
    </div>
  );
}

export function UsageAnalyticsPage() {
  const nav = useNavigate();
  const { notifyStart, notifyDone, notifyFail } = useAgentCanvas({ agent: 'pulse', page: 'usage-analytics' });
  const [mounted, setMounted] = useState(false);

  // Data state
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [providers, setProviders] = useState<ProviderBreakdown[]>([]);
  const [hourly, setHourly] = useState<HourlyActivity[]>([]);
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [eventsTotal, setEventsTotal] = useState(0);

  // Today's real-time usage from GET /api/usage/today
  const [todayUsage, setTodayUsage] = useState<{
    plan: string;
    tokenBudget: number;
    tokenUsed: number;
    tokenPercentage: number;
    messages: { used: number; limit: number; percentage: number };
    voice: { used: number; limit: number; percentage: number };
    images: { used: number; limit: number; percentage: number };
  } | null>(null);

  // UI state
  const [summaryRange, setSummaryRange] = useState<SummaryRange>('month');
  const [chartRange, setChartRange] = useState<ChartRange>('7d');
  const [eventsPage, setEventsPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partialFailures, setPartialFailures] = useState<string[]>([]);

  // Recharts SSR guard
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);

  // Initial load — fetch all 7 endpoints
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPartialFailures([]);
    notifyStart('loading-usage-analytics');

    const endpointLabels = ['Summary', 'Chart', 'Providers', 'Hourly Activity', 'Billing', 'Events', 'Today'];

    Promise.allSettled([
      usageService.summary(summaryRange),
      usageService.chart(chartRange),
      usageService.providers(),
      usageService.latency(),
      usageService.billing(),
      usageService.events(1, 50),
      usageService.today(),
    ]).then((results) => {
      if (cancelled) return;
      const failed: string[] = [];

      if (results[0].status === 'fulfilled') setSummary(results[0].value.data);
      else failed.push(endpointLabels[0]);

      if (results[1].status === 'fulfilled') setChartData(results[1].value.data);
      else failed.push(endpointLabels[1]);

      if (results[2].status === 'fulfilled') setProviders(results[2].value.data);
      else failed.push(endpointLabels[2]);

      if (results[3].status === 'fulfilled') setHourly(results[3].value.data);
      else failed.push(endpointLabels[3]);

      if (results[4].status === 'fulfilled') setBilling(results[4].value.data);
      else failed.push(endpointLabels[4]);

      if (results[5].status === 'fulfilled') {
        setEvents(results[5].value.data.events);
        setEventsTotal(results[5].value.data.total);
      } else failed.push(endpointLabels[5]);

      if (results[6].status === 'fulfilled') setTodayUsage(results[6].value.data);
      else failed.push(endpointLabels[6]);

      if (failed.length === 7) {
        setError('Failed to load usage data. Please try again later.');
        notifyFail('all-endpoints-failed');
      } else if (failed.length > 0) {
        setPartialFailures(failed);
        notifyDone(`loaded-with-${failed.length}-failures`);
      } else {
        notifyDone('usage-analytics-loaded');
      }
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch summary when range changes
  const handleSummaryRange = useCallback((range: SummaryRange) => {
    setSummaryRange(range);
    usageService.summary(range).then(r => setSummary(r.data)).catch(() => {
      setPartialFailures(prev => prev.includes('Summary') ? prev : [...prev, 'Summary']);
    });
  }, []);

  // Re-fetch chart when range changes
  const handleChartRange = useCallback((range: ChartRange) => {
    setChartRange(range);
    usageService.chart(range).then(r => setChartData(r.data)).catch(() => {
      setPartialFailures(prev => prev.includes('Chart') ? prev : [...prev, 'Chart']);
    });
  }, []);

  // Re-fetch events when page changes
  const handleEventsPage = useCallback((page: number) => {
    setEventsPage(page);
    usageService.events(page, 50).then((r) => {
      setEvents(r.data.events);
      setEventsTotal(r.data.total);
    }).catch(() => {
      setPartialFailures(prev => prev.includes('Events') ? prev : [...prev, 'Events']);
    });
  }, []);

  // Pull-to-refresh handler
  const handlePullRefresh = async () => {
    setPartialFailures([]);
    const endpointLabels = ['Summary', 'Chart', 'Providers', 'Hourly Activity', 'Billing', 'Events', 'Today'];
    const results = await Promise.allSettled([
      usageService.summary(summaryRange).then(r => setSummary(r.data)),
      usageService.chart(chartRange).then(r => setChartData(r.data)),
      usageService.providers().then(r => setProviders(r.data)),
      usageService.latency().then(r => setHourly(r.data)),
      usageService.billing().then(r => setBilling(r.data)),
      usageService.events(eventsPage, 50).then(r => { setEvents(r.data.events); setEventsTotal(r.data.total); }),
      usageService.today().then(r => setTodayUsage(r.data)),
    ]);
    const failed = results.map((r, i) => r.status === 'rejected' ? endpointLabels[i] : null).filter(Boolean) as string[];
    if (failed.length > 0) setPartialFailures(failed);
  };

  // Derived data
  const toolData = summary?.byTool
    ? Object.entries(summary.byTool)
        .map(([name, cost]) => ({ name, cost }))
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 8)
    : [];

  const hourlyData = hourly.length > 0
    ? hourly.map(d => ({ hour: d.hour.includes(':') ? d.hour : `${d.hour}:00`, requests: d.requests }))
    : [];

  const pieData = providers.map((p, i) => ({
    ...p,
    provider: friendlyProvider(p.provider),
    color: PROVIDER_COLORS[i % PROVIDER_COLORS.length],
  }));

  const totalPages = Math.ceil(eventsTotal / 50);

  // Format helpers
  const fmt = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
  const fmtCost = (n: number) => `$${(n ?? 0).toFixed(4)}`;
  const safeDollar2 = (v: number) => `$${(v ?? 0).toFixed(2)}`;
  const safeDollar4 = (v: number) => [`$${(v ?? 0).toFixed(4)}`, 'Cost'];

  if (error && !summary && !chartData.length) {
    return (
      <PageShell>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <AlertTriangle className="w-10 h-10 text-[#FF6161]" />
          <p className="text-[#9CA3AF]">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-sm font-medium transition-colors min-h-[44px]"
          >
            Retry
          </button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
    <PullToRefreshWrapper onRefresh={handlePullRefresh}>
    <div className="space-y-6 pb-24 md:pb-6 overflow-x-hidden animate-in fade-in duration-500">
      {/* Header with Pulse ownership dot (#10B981) */}
      <PageHeader
        icon={Activity}
        title="Usage Analytics"
        subtitle="Deep-dive into your AI costs and activity"
        badge={
          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#10B981]" />
            </span>
            Pulse
          </span>
        }
        actions={
          <div className="flex gap-1 bg-[rgba(12,12,30,0.6)] border border-[rgba(139,92,246,0.08)] rounded-lg p-1">
            {(['day', 'week', 'month'] as SummaryRange[]).map((r) => (
              <button
                key={r}
                onClick={() => handleSummaryRange(r)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all min-h-[44px] focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50 ${
                  summaryRange === r
                    ? 'bg-[#8B5CF6] text-white'
                    : 'text-[#9CA3AF] hover:text-[#F4F6FF]'
                }`}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        }
      />

      {/* Partial failure warning banner */}
      {partialFailures.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            Some data could not be loaded: {partialFailures.join(', ')}.
            Values shown as $0 or empty may be incomplete.
          </span>
          <button
            onClick={handlePullRefresh}
            className="ml-auto shrink-0 px-3 py-1 rounded-md border border-amber-500/30 hover:bg-amber-500/20 transition-colors text-xs font-medium min-h-[44px]"
          >
            Retry
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <SectionCard key={i} padding="md">
              <div className="space-y-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <Skeleton className="h-7 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
            </SectionCard>
          ))
        ) : (
          <>
            {/* Total Cost */}
            <SectionCard padding="md" className="group">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${KPI_COLORS.cost}15` }}>
                  <DollarSign className="w-5 h-5" style={{ color: KPI_COLORS.cost }} />
                </div>
                {summary?.forecastUSD !== undefined && (
                  <div className="flex items-center gap-1 text-xs font-mono text-[#FFB800]">
                    <TrendingUp className="w-3 h-3" />
                    ~${summary.forecastUSD.toFixed(2)}
                  </div>
                )}
              </div>
              <div className="text-xl sm:text-2xl font-bold text-[#F4F6FF] group-hover:text-[#10B981] transition-colors font-mono">
                ${(summary?.totalCostUSD ?? 0).toFixed(2)}
              </div>
              <div className="text-xs sm:text-sm text-[#9CA3AF]">Total Cost</div>
            </SectionCard>

            {/* Messages */}
            <SectionCard padding="md" className="group">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${KPI_COLORS.messages}15` }}>
                  <MessageSquare className="w-5 h-5" style={{ color: KPI_COLORS.messages }} />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-[#F4F6FF] group-hover:text-[#8B5CF6] transition-colors">
                {fmt(summary?.totalMessages ?? 0)}
              </div>
              <div className="text-xs sm:text-sm text-[#9CA3AF]">Messages</div>
            </SectionCard>

            {/* Tokens */}
            <SectionCard padding="md" className="group">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${KPI_COLORS.tokens}15` }}>
                  <Coins className="w-5 h-5" style={{ color: KPI_COLORS.tokens }} />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-[#F4F6FF] group-hover:text-[#FFB800] transition-colors">
                {fmt(summary?.totalTokensIn ?? 0)} / {fmt(summary?.totalTokensOut ?? 0)}
              </div>
              <div className="text-xs sm:text-sm text-[#9CA3AF]">Tokens In / Out</div>
            </SectionCard>

            {/* Tool Calls */}
            <SectionCard padding="md" className="group">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${KPI_COLORS.tools}15` }}>
                  <Wrench className="w-5 h-5" style={{ color: KPI_COLORS.tools }} />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-bold text-[#F4F6FF] group-hover:text-[#FF2D78] transition-colors">
                {fmt(summary?.totalToolCalls ?? 0)}
              </div>
              <div className="text-xs sm:text-sm text-[#9CA3AF]">Tool Calls</div>
            </SectionCard>
          </>
        )}
      </div>

      {/* Today's Real-Time Usage */}
      {!loading && todayUsage && (
        <SectionCard>
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-[#10B981]" />
            <h2 className="text-base font-semibold text-[#F4F6FF]">Today's Usage</h2>
            <Badge variant="outline" className="border-[#10B981]/30 text-[#10B981] text-xs ml-2">
              Live
            </Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Token usage with circle */}
            <div className="flex flex-col items-center gap-2 col-span-2 sm:col-span-1">
              <CreditCircle used={todayUsage.tokenUsed} total={todayUsage.tokenBudget} />
              <div className="text-center">
                <div className="text-xs text-[#9CA3AF]">Token Budget</div>
                <div className="text-xs font-mono text-[#F4F6FF]">
                  {fmt(todayUsage.tokenUsed)} / {fmt(todayUsage.tokenBudget)}
                </div>
              </div>
            </div>
            {/* Messages */}
            <div className="flex flex-col items-center gap-2">
              <CreditCircle used={todayUsage.messages.used} total={todayUsage.messages.limit} />
              <div className="text-center">
                <div className="text-xs text-[#9CA3AF]">Messages</div>
                <div className="text-xs font-mono text-[#F4F6FF]">
                  {todayUsage.messages.used} / {todayUsage.messages.limit}
                </div>
              </div>
            </div>
            {/* Voice */}
            <div className="flex flex-col items-center gap-2">
              <CreditCircle used={todayUsage.voice.used} total={todayUsage.voice.limit} />
              <div className="text-center">
                <div className="text-xs text-[#9CA3AF]">Voice</div>
                <div className="text-xs font-mono text-[#F4F6FF]">
                  {todayUsage.voice.used} / {todayUsage.voice.limit}
                </div>
              </div>
            </div>
            {/* Images */}
            <div className="flex flex-col items-center gap-2">
              <CreditCircle used={todayUsage.images.used} total={todayUsage.images.limit} />
              <div className="text-center">
                <div className="text-xs text-[#9CA3AF]">Images</div>
                <div className="text-xs font-mono text-[#F4F6FF]">
                  {todayUsage.images.used} / {todayUsage.images.limit}
                </div>
              </div>
            </div>
          </div>

          {/* Get more credits CTA when any usage > 80% */}
          {(todayUsage.tokenPercentage > 0.8 ||
            todayUsage.messages.percentage > 0.8 ||
            todayUsage.voice.percentage > 0.8 ||
            todayUsage.images.percentage > 0.8) && (
            <button
              onClick={() => nav('/dashboard/billing')}
              className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[#FFB800]/30 bg-[#FFB800]/10 text-[#FFB800] text-sm font-medium hover:bg-[#FFB800]/20 transition-colors min-h-[44px]"
            >
              <Zap className="w-4 h-4" />
              Running low on credits — upgrade your plan
            </button>
          )}
        </SectionCard>
      )}

      {/* Cost Over Time Chart */}
      <SectionCard>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#10B981]" />
            <h2 className="text-base font-semibold text-[#F4F6FF]">Cost Over Time</h2>
          </div>
          <div className="flex gap-1 bg-[#06061a] border border-[rgba(139,92,246,0.08)] rounded-lg p-0.5">
            {(['7d', '14d', '30d'] as ChartRange[]).map((r) => (
              <button
                key={r}
                onClick={() => handleChartRange(r)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all min-h-[44px] focus-visible:ring-2 focus-visible:ring-[#8B5CF6]/50 ${
                  chartRange === r
                    ? 'bg-[#8B5CF6] text-white'
                    : 'text-[#9CA3AF] hover:text-[#F4F6FF]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-[180px] h-[280px]">
          {loading ? (
            <Skeleton className="w-full h-full rounded-lg" />
          ) : mounted && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.06)" />
                <XAxis dataKey="label" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="#9CA3AF"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={safeDollar2}
                />
                <Tooltip
                  {...TOOLTIP_STYLE}
                  formatter={safeDollar4}
                />
                <Area type="monotone" dataKey="cost" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#costGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </SectionCard>

      {/* Two-column: Provider Breakdown + Hourly Activity */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Provider Breakdown */}
        <SectionCard>
          <h2 className="text-base font-semibold text-[#F4F6FF] mb-4">Provider Breakdown</h2>
          {loading ? (
            <Skeleton className="w-full h-[220px] rounded-lg" />
          ) : pieData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[220px] gap-2">
              <BarChart3 className="w-8 h-8 text-[#10B981]/20" />
              <p className="text-sm text-[#9CA3AF]">No provider data yet</p>
              <p className="text-xs text-[#9CA3AF]/60">Start chatting to see provider breakdown</p>
            </div>
          ) : (
            <>
              <div className="min-h-[180px] h-[220px]">
                {mounted && (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="cost"
                        nameKey="provider"
                      >
                        {pieData.map((entry, i) => (
                          <Cell key={`provider-${i}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        {...TOOLTIP_STYLE}
                        formatter={safeDollar4}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                {pieData.map((p) => (
                  <div key={p.provider} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="text-xs text-[#9CA3AF]">{friendlyProvider(p.provider)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </SectionCard>

        {/* Hourly Activity */}
        <SectionCard>
          <h2 className="text-base font-semibold text-[#F4F6FF] mb-4">Hourly Activity</h2>
          {loading ? (
            <Skeleton className="w-full h-[250px] rounded-lg" />
          ) : hourlyData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[250px] gap-2">
              <Activity className="w-8 h-8 text-[#10B981]/20" />
              <p className="text-sm text-[#9CA3AF]">No activity data yet</p>
              <p className="text-xs text-[#9CA3AF]/60">Your hourly usage patterns will appear here</p>
            </div>
          ) : (
            <div className="min-h-[180px] h-[250px]">
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.06)" vertical={false} />
                    <XAxis dataKey="hour" stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      {...TOOLTIP_STYLE}
                      cursor={{ fill: 'rgba(139,92,246,0.08)' }}
                    />
                    <Bar dataKey="requests" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Three-column: Top Tools + Billing */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Top Tools by Cost */}
        <SectionCard className="lg:col-span-2">
          <h2 className="text-base font-semibold text-[#F4F6FF] mb-4">Top Tools by Cost</h2>
          {loading ? (
            <Skeleton className="w-full h-[200px] rounded-lg" />
          ) : toolData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[200px] gap-2">
              <Wrench className="w-8 h-8 text-[#FF2D78]/20" />
              <p className="text-sm text-[#9CA3AF]">No tool usage yet</p>
              <p className="text-xs text-[#9CA3AF]/60">Tool call costs will appear after your first agent run</p>
            </div>
          ) : (
            <div className="min-h-[180px] h-[200px]">
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={toolData} layout="vertical" margin={{ left: 80 }}>
                    <defs>
                      <linearGradient id="toolBarGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#8B5CF6" />
                        <stop offset="50%" stopColor="#10B981" />
                        <stop offset="100%" stopColor="#FF2D78" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.06)" horizontal={false} />
                    <XAxis
                      type="number"
                      stroke="#9CA3AF"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={safeDollar2}
                    />
                    <YAxis type="category" dataKey="name" stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} width={75} />
                    <Tooltip
                      {...TOOLTIP_STYLE}
                      formatter={safeDollar4}
                    />
                    <Bar dataKey="cost" fill="url(#toolBarGradient)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </SectionCard>

        {/* Billing Summary */}
        <SectionCard>
          <h2 className="text-base font-semibold text-[#F4F6FF] mb-4">Billing</h2>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          ) : !billing ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <DollarSign className="w-8 h-8 text-[#10B981]/20" />
              <p className="text-sm text-[#9CA3AF]">No billing data</p>
              <p className="text-xs text-[#9CA3AF]/60">Billing info will appear after your first cycle</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Circular credit progress */}
              <div className="relative flex justify-center py-2">
                <CreditCircle
                  used={billing.usageThisMonth?.totalCostUSD ?? 0}
                  total={billing.monthlyAllowance > 0 ? billing.monthlyAllowance : 1}
                />
              </div>

              {[
                { label: 'Plan', value: billing.plan.charAt(0).toUpperCase() + billing.plan.slice(1) },
                { label: 'Credits', value: billing.credits.toLocaleString() },
                { label: 'Allowance', value: `$${(billing.monthlyAllowance ?? 0).toFixed(2)}` },
                { label: 'Used', value: `$${(billing.usageThisMonth?.totalCostUSD ?? 0).toFixed(2)}` },
                { label: 'Resets', value: new Date(billing.resetDate).toLocaleDateString() },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between text-sm">
                  <span className="text-[#9CA3AF]">{item.label}</span>
                  <span className="text-[#F4F6FF] font-mono">{item.value}</span>
                </div>
              ))}

              {/* Usage progress bar */}
              <div className="pt-2">
                <div className="flex items-center justify-between text-xs text-[#9CA3AF] mb-1.5">
                  <span>Usage</span>
                  <span>{billing.monthlyAllowance > 0 ? `${Math.min(100, ((billing.usageThisMonth?.totalCostUSD ?? 0) / billing.monthlyAllowance * 100)).toFixed(0)}%` : '0%'}</span>
                </div>
                <div className="h-2 bg-[#06061a] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#10B981] transition-all duration-500"
                    style={{
                      width: `${billing.monthlyAllowance > 0 ? Math.min(100, ((billing.usageThisMonth?.totalCostUSD ?? 0) / billing.monthlyAllowance * 100)) : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Get more credits CTA when usage > 80% */}
              {billing.monthlyAllowance > 0 &&
                ((billing.usageThisMonth?.totalCostUSD ?? 0) / billing.monthlyAllowance) > 0.8 && (
                <button
                  onClick={() => nav('/dashboard/billing')}
                  className="w-full mt-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[#FFB800]/30 bg-[#FFB800]/10 text-[#FFB800] text-xs font-medium hover:bg-[#FFB800]/20 transition-colors min-h-[44px]"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Running low — get more credits
                </button>
              )}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Usage Event Log */}
      <SectionCard>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[#F4F6FF]">Usage Events</h2>
          {eventsTotal > 0 && (
            <Badge variant="outline" className="border-[rgba(139,92,246,0.15)] text-[#9CA3AF]">
              {eventsTotal.toLocaleString()} total
            </Badge>
          )}
        </div>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <MessageSquare className="w-8 h-8 text-[#8B5CF6]/20" />
            <p className="text-sm text-[#9CA3AF]">No usage events yet</p>
            <p className="text-xs text-[#9CA3AF]/60">Each AI request will be logged here with cost details</p>
          </div>
        ) : (
          <>
            <MobileTable<UsageEvent>
              columns={[
                {
                  key: 'time', label: 'Time', primary: true,
                  render: (event) => (
                    <span className="text-[#9CA3AF] font-mono text-xs">
                      {new Date(event.createdAt).toLocaleString(undefined, {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  ),
                },
                { key: 'provider', label: 'Provider', render: (event) => <span className="text-[#F4F6FF]">{friendlyProvider(event.provider)}</span> },
                { key: 'model', label: 'Model', hideOnMobile: true, render: (event) => <span className="text-[#9CA3AF] font-mono text-xs">{friendlyModel(event.model)}</span> },
                { key: 'tokens', label: 'Tokens', render: (event) => <span className="text-[#F4F6FF] font-mono text-xs">{fmt(event.tokensIn)} / {fmt(event.tokensOut)}</span> },
                { key: 'cost', label: 'Cost', render: (event) => <span className="text-[#10B981] font-mono text-xs">{fmtCost(event.costUSD)}</span> },
                {
                  key: 'channel', label: 'Channel', hideOnMobile: true,
                  render: (event) => (
                    <Badge variant="outline" className="border-[rgba(139,92,246,0.15)] text-[#9CA3AF] text-xs">
                      {event.channel}
                    </Badge>
                  ),
                },
              ]}
              data={events}
              keyExtractor={(event) => String(event.id)}
              emptyMessage="No usage events yet"
              striped
            />

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <span className="text-xs text-[#9CA3AF]">
                  Page {eventsPage} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={eventsPage <= 1}
                    onClick={() => handleEventsPage(eventsPage - 1)}
                    className="inline-flex items-center px-3 py-1.5 text-sm rounded-lg border border-[rgba(139,92,246,0.15)] text-[#9CA3AF] hover:text-[#F4F6FF] hover:border-[rgba(139,92,246,0.3)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[44px]"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Prev
                  </button>
                  <button
                    disabled={eventsPage >= totalPages}
                    onClick={() => handleEventsPage(eventsPage + 1)}
                    className="inline-flex items-center px-3 py-1.5 text-sm rounded-lg border border-[rgba(139,92,246,0.15)] text-[#9CA3AF] hover:text-[#F4F6FF] hover:border-[rgba(139,92,246,0.3)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[44px]"
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </SectionCard>
    </div>
    </PullToRefreshWrapper>
    </PageShell>
  );
}
