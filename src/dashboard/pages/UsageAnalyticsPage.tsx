import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageShell } from '@/components/agentin/PageShell';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import type {
  UsageSummary,
  UsageEvent,
  ChartDataPoint,
  ProviderBreakdown,
  HourlyActivity,
  BillingInfo,
} from '@/types';

const PROVIDER_COLORS = ['#00F0FF', '#00FF88', '#FFB800', '#FF2D78', '#61D4FF', '#FF9F61'];
const KPI_COLORS = { cost: '#00FF88', messages: '#00F0FF', tokens: '#FFB800', tools: '#FF2D78' };
const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: '#0C0C18', border: '1px solid rgba(0, 240, 255, 0.3)', borderRadius: '8px' },
  itemStyle: { color: '#E8E8F0' },
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
  const color = pct > 90 ? '#FF6161' : pct > 70 ? '#FFB800' : '#00F0FF';
  const fmt = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: 96, height: 96 }}>
      <svg width="96" height="96" viewBox="0 0 96 96" className="transform -rotate-90">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#06060B" strokeWidth="7" />
        <circle
          cx="48" cy="48" r={r} fill="none"
          stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-[var(--ag-text-primary)] font-mono">{fmt(remaining)}</span>
        <span className="text-[10px] text-[var(--ag-text-muted)]">left</span>
      </div>
    </div>
  );
}

export function UsageAnalyticsPage() {
  const nav = useNavigate();
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

  // Recharts SSR guard
  useEffect(() => { setMounted(true); }, []);

  // Initial load — fetch all 7 endpoints (added today usage)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

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
      let failures = 0;

      if (results[0].status === 'fulfilled') setSummary(results[0].value.data);
      else failures++;

      if (results[1].status === 'fulfilled') setChartData(results[1].value.data);
      else failures++;

      if (results[2].status === 'fulfilled') setProviders(results[2].value.data);
      else failures++;

      if (results[3].status === 'fulfilled') setHourly(results[3].value.data);
      else failures++;

      if (results[4].status === 'fulfilled') setBilling(results[4].value.data);
      else failures++;

      if (results[5].status === 'fulfilled') {
        setEvents(results[5].value.data.events);
        setEventsTotal(results[5].value.data.total);
      } else failures++;

      if (results[6].status === 'fulfilled') setTodayUsage(results[6].value.data);
      else failures++;

      if (failures === 7) setError('Failed to load usage data. Please try again later.');
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch summary when range changes
  const handleSummaryRange = useCallback((range: SummaryRange) => {
    setSummaryRange(range);
    usageService.summary(range).then(r => setSummary(r.data)).catch(() => {});
  }, []);

  // Re-fetch chart when range changes
  const handleChartRange = useCallback((range: ChartRange) => {
    setChartRange(range);
    usageService.chart(range).then(r => setChartData(r.data)).catch(() => {});
  }, []);

  // Re-fetch events when page changes
  const handleEventsPage = useCallback((page: number) => {
    setEventsPage(page);
    usageService.events(page, 50).then((r) => {
      setEvents(r.data.events);
      setEventsTotal(r.data.total);
    }).catch(() => {});
  }, []);

  // Pull-to-refresh handler
  const handlePullRefresh = async () => {
    await Promise.allSettled([
      usageService.summary(summaryRange).then(r => setSummary(r.data)),
      usageService.chart(chartRange).then(r => setChartData(r.data)),
      usageService.providers().then(r => setProviders(r.data)),
      usageService.latency().then(r => setHourly(r.data)),
      usageService.billing().then(r => setBilling(r.data)),
      usageService.events(eventsPage, 50).then(r => { setEvents(r.data.events); setEventsTotal(r.data.total); }),
      usageService.today().then(r => setTodayUsage(r.data)),
    ]);
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
        <p className="text-[var(--ag-text-muted)]">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()} className="border-[#00F0FF]/30">
          Retry
        </Button>
      </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
    <PullToRefreshWrapper onRefresh={handlePullRefresh}>
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold" style={{ fontFamily: 'Syne, sans-serif' }}>Usage Analytics</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-[var(--ag-cyan)]">Analyzed by Pulse</span>
          </div>
          <p className="text-sm text-[var(--ag-text-muted)] mt-1">Deep-dive into your AI costs and activity</p>
        </div>
        <div className="flex gap-1 bg-[var(--ag-bg-surface)] border border-[#00F0FF]/20 rounded-lg p-1">
          {(['day', 'week', 'month'] as SummaryRange[]).map((r) => (
            <button
              key={r}
              onClick={() => handleSummaryRange(r)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all min-h-[44px] focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50 ${
                summaryRange === r
                  ? 'bg-[#00F0FF] text-white'
                  : 'text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)]'
              }`}
            >
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-[#00F0FF]/20">
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <Skeleton className="h-7 w-24" />
                <Skeleton className="h-4 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            {/* Total Cost */}
            <Card className="border-[#00F0FF]/20 hover:border-[#00F0FF]/40 transition-all group press-scale touch-highlight">
              <CardContent className="p-4 sm:p-5">
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
                <div className="text-xl sm:text-2xl font-bold text-[var(--ag-text-primary)] group-hover:text-[#00FF88] transition-colors font-mono">
                  ${(summary?.totalCostUSD ?? 0).toFixed(2)}
                </div>
                <div className="text-xs sm:text-sm text-[var(--ag-text-muted)]">Total Cost</div>
              </CardContent>
            </Card>

            {/* Messages */}
            <Card className="border-[#00F0FF]/20 hover:border-[#00F0FF]/40 transition-all group press-scale touch-highlight">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${KPI_COLORS.messages}15` }}>
                    <MessageSquare className="w-5 h-5" style={{ color: KPI_COLORS.messages }} />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-[var(--ag-text-primary)] group-hover:text-[var(--ag-cyan)] transition-colors">
                  {fmt(summary?.totalMessages ?? 0)}
                </div>
                <div className="text-xs sm:text-sm text-[var(--ag-text-muted)]">Messages</div>
              </CardContent>
            </Card>

            {/* Tokens */}
            <Card className="border-[#00F0FF]/20 hover:border-[#00F0FF]/40 transition-all group press-scale touch-highlight">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${KPI_COLORS.tokens}15` }}>
                    <Coins className="w-5 h-5" style={{ color: KPI_COLORS.tokens }} />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-[var(--ag-text-primary)] group-hover:text-[#FFB800] transition-colors">
                  {fmt(summary?.totalTokensIn ?? 0)} / {fmt(summary?.totalTokensOut ?? 0)}
                </div>
                <div className="text-xs sm:text-sm text-[var(--ag-text-muted)]">Tokens In / Out</div>
              </CardContent>
            </Card>

            {/* Tool Calls */}
            <Card className="border-[#00F0FF]/20 hover:border-[#00F0FF]/40 transition-all group press-scale touch-highlight">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${KPI_COLORS.tools}15` }}>
                    <Wrench className="w-5 h-5" style={{ color: KPI_COLORS.tools }} />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-bold text-[var(--ag-text-primary)] group-hover:text-[#FF2D78] transition-colors">
                  {fmt(summary?.totalToolCalls ?? 0)}
                </div>
                <div className="text-xs sm:text-sm text-[var(--ag-text-muted)]">Tool Calls</div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Today's Real-Time Usage */}
      {!loading && todayUsage && (
        <Card className="border-[#00F0FF]/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5 text-[var(--ag-cyan)]" />
              Today's Usage
              <Badge variant="outline" className="border-[#ADFF2F]/30 text-[#ADFF2F] text-xs ml-2">
                Live
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* Token usage with circle */}
              <div className="flex flex-col items-center gap-2 col-span-2 sm:col-span-1">
                <CreditCircle used={todayUsage.tokenUsed} total={todayUsage.tokenBudget} />
                <div className="text-center">
                  <div className="text-xs text-[var(--ag-text-muted)]">Token Budget</div>
                  <div className="text-xs font-mono text-[var(--ag-text-primary)]">
                    {fmt(todayUsage.tokenUsed)} / {fmt(todayUsage.tokenBudget)}
                  </div>
                </div>
              </div>
              {/* Messages */}
              <div className="flex flex-col items-center gap-2">
                <CreditCircle used={todayUsage.messages.used} total={todayUsage.messages.limit} />
                <div className="text-center">
                  <div className="text-xs text-[var(--ag-text-muted)]">Messages</div>
                  <div className="text-xs font-mono text-[var(--ag-text-primary)]">
                    {todayUsage.messages.used} / {todayUsage.messages.limit}
                  </div>
                </div>
              </div>
              {/* Voice */}
              <div className="flex flex-col items-center gap-2">
                <CreditCircle used={todayUsage.voice.used} total={todayUsage.voice.limit} />
                <div className="text-center">
                  <div className="text-xs text-[var(--ag-text-muted)]">Voice</div>
                  <div className="text-xs font-mono text-[var(--ag-text-primary)]">
                    {todayUsage.voice.used} / {todayUsage.voice.limit}
                  </div>
                </div>
              </div>
              {/* Images */}
              <div className="flex flex-col items-center gap-2">
                <CreditCircle used={todayUsage.images.used} total={todayUsage.images.limit} />
                <div className="text-center">
                  <div className="text-xs text-[var(--ag-text-muted)]">Images</div>
                  <div className="text-xs font-mono text-[var(--ag-text-primary)]">
                    {todayUsage.images.used} / {todayUsage.images.limit}
                  </div>
                </div>
              </div>
            </div>

            {/* Get more credits CTA when any usage > 80% */}
            {(todayUsage.tokenPercentage > 80 ||
              todayUsage.messages.percentage > 80 ||
              todayUsage.voice.percentage > 80 ||
              todayUsage.images.percentage > 80) && (
              <button
                onClick={() => nav('/dashboard/billing')}
                className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[#FFB800]/30 bg-[#FFB800]/10 text-[#FFB800] text-sm font-medium hover:bg-[#FFB800]/20 transition-colors min-h-[44px]"
              >
                <Zap className="w-4 h-4" />
                Running low on credits — upgrade your plan
              </button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cost Over Time Chart */}
      <Card className="border-[#00F0FF]/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[var(--ag-cyan)]" />
              Cost Over Time
            </CardTitle>
            <div className="flex gap-1 bg-[#06060B] border border-[#00F0FF]/20 rounded-lg p-0.5">
              {(['7d', '14d', '30d'] as ChartRange[]).map((r) => (
                <button
                  key={r}
                  onClick={() => handleChartRange(r)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all min-h-[44px] focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50 ${
                    chartRange === r
                      ? 'bg-[#00F0FF] text-white'
                      : 'text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="min-h-[180px] h-[280px]">
            {loading ? (
              <Skeleton className="w-full h-full rounded-lg" />
            ) : mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00FF88" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00FF88" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#00F0FF10" />
                  <XAxis dataKey="label" stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="#6B7280"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={safeDollar2}
                  />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={safeDollar4}
                  />
                  <Area type="monotone" dataKey="cost" stroke="#00FF88" strokeWidth={2} fillOpacity={1} fill="url(#costGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Two-column: Provider Breakdown + Hourly Activity */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Provider Breakdown */}
        <Card className="border-[#00F0FF]/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Provider Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="w-full h-[220px] rounded-lg" />
            ) : pieData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[220px] gap-2">
                <BarChart3 className="w-8 h-8 text-[var(--ag-cyan)]/20" />
                <p className="text-sm text-[var(--ag-text-muted)]">No provider data yet</p>
                <p className="text-xs text-[var(--ag-text-muted)]/60">Start chatting to see provider breakdown</p>
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
                      <span className="text-xs text-[var(--ag-text-muted)]">{friendlyProvider(p.provider)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Hourly Activity */}
        <Card className="border-[#00F0FF]/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Hourly Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="w-full h-[250px] rounded-lg" />
            ) : hourlyData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[250px] gap-2">
                <Activity className="w-8 h-8 text-[var(--ag-cyan)]/20" />
                <p className="text-sm text-[var(--ag-text-muted)]">No activity data yet</p>
                <p className="text-xs text-[var(--ag-text-muted)]/60">Your hourly usage patterns will appear here</p>
              </div>
            ) : (
              <div className="min-h-[180px] h-[250px]">
                {mounted && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#00F0FF10" vertical={false} />
                      <XAxis dataKey="hour" stroke="#6B7280" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#6B7280" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip
                        {...TOOLTIP_STYLE}
                        cursor={{ fill: 'rgba(0, 240, 255, 0.1)' }}
                      />
                      <Bar dataKey="requests" fill="#00F0FF" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Three-column: Top Tools + Billing */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Top Tools by Cost */}
        <Card className="lg:col-span-2 border-[#00F0FF]/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Top Tools by Cost</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="w-full h-[200px] rounded-lg" />
            ) : toolData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[200px] gap-2">
                <Wrench className="w-8 h-8 text-[#FF2D78]/20" />
                <p className="text-sm text-[var(--ag-text-muted)]">No tool usage yet</p>
                <p className="text-xs text-[var(--ag-text-muted)]/60">Tool call costs will appear after your first agent run</p>
              </div>
            ) : (
              <div className="min-h-[180px] h-[200px]">
                {mounted && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={toolData} layout="vertical" margin={{ left: 80 }}>
                      <defs>
                        <linearGradient id="toolBarGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#00F0FF" />
                          <stop offset="50%" stopColor="#00FF88" />
                          <stop offset="100%" stopColor="#FF2D78" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#00F0FF10" horizontal={false} />
                      <XAxis
                        type="number"
                        stroke="#6B7280"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={safeDollar2}
                      />
                      <YAxis type="category" dataKey="name" stroke="#6B7280" fontSize={11} tickLine={false} axisLine={false} width={75} />
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
          </CardContent>
        </Card>

        {/* Billing Summary */}
        <Card className="border-[#00F0FF]/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Billing</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-5 w-full" />
                ))}
              </div>
            ) : !billing ? (
              <div className="flex flex-col items-center justify-center py-6 gap-2">
                <DollarSign className="w-8 h-8 text-[#00FF88]/20" />
                <p className="text-sm text-[var(--ag-text-muted)]">No billing data</p>
                <p className="text-xs text-[var(--ag-text-muted)]/60">Billing info will appear after your first cycle</p>
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
                    <span className="text-[var(--ag-text-muted)]">{item.label}</span>
                    <span className="text-[var(--ag-text-primary)] font-mono">{item.value}</span>
                  </div>
                ))}

                {/* Usage progress bar */}
                <div className="pt-2">
                  <div className="flex items-center justify-between text-xs text-[var(--ag-text-muted)] mb-1.5">
                    <span>Usage</span>
                    <span>{billing.monthlyAllowance > 0 ? `${Math.min(100, ((billing.usageThisMonth?.totalCostUSD ?? 0) / billing.monthlyAllowance * 100)).toFixed(0)}%` : '0%'}</span>
                  </div>
                  <div className="h-2 bg-[#06060B] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#00F0FF] to-[#00FF88] transition-all duration-500"
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
          </CardContent>
        </Card>
      </div>

      {/* Usage Event Log */}
      <Card className="border-[#00F0FF]/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">Usage Events</CardTitle>
            {eventsTotal > 0 && (
              <Badge variant="outline" className="border-[#00F0FF]/30 text-[var(--ag-text-muted)]">
                {eventsTotal.toLocaleString()} total
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <MessageSquare className="w-8 h-8 text-[var(--ag-cyan)]/20" />
              <p className="text-sm text-[var(--ag-text-muted)]">No usage events yet</p>
              <p className="text-xs text-[var(--ag-text-muted)]/60">Each AI request will be logged here with cost details</p>
            </div>
          ) : (
            <>
              <MobileTable<UsageEvent>
                columns={[
                  {
                    key: 'time', label: 'Time', primary: true,
                    render: (event) => (
                      <span className="text-[var(--ag-text-muted)] font-mono text-xs">
                        {new Date(event.createdAt).toLocaleString(undefined, {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    ),
                  },
                  { key: 'provider', label: 'Provider', render: (event) => <span className="text-[var(--ag-text-primary)]">{friendlyProvider(event.provider)}</span> },
                  { key: 'model', label: 'Model', hideOnMobile: true, render: (event) => <span className="text-[var(--ag-text-muted)] font-mono text-xs">{friendlyModel(event.model)}</span> },
                  { key: 'tokens', label: 'Tokens', render: (event) => <span className="text-[var(--ag-text-primary)] font-mono text-xs">{fmt(event.tokensIn)} / {fmt(event.tokensOut)}</span> },
                  { key: 'cost', label: 'Cost', render: (event) => <span className="text-[#00FF88] font-mono text-xs">{fmtCost(event.costUSD)}</span> },
                  {
                    key: 'channel', label: 'Channel', hideOnMobile: true,
                    render: (event) => (
                      <Badge variant="outline" className="border-[#00F0FF]/30 text-[var(--ag-text-muted)] text-xs">
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
                  <span className="text-xs text-[var(--ag-text-muted)]">
                    Page {eventsPage} of {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={eventsPage <= 1}
                      onClick={() => handleEventsPage(eventsPage - 1)}
                      className="border-[#00F0FF]/30 text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)] disabled:opacity-40"
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={eventsPage >= totalPages}
                      onClick={() => handleEventsPage(eventsPage + 1)}
                      className="border-[#00F0FF]/30 text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)] disabled:opacity-40"
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
    </PullToRefreshWrapper>
    </PageShell>
  );
}
