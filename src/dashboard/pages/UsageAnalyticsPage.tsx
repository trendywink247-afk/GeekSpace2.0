import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  MessageSquare,
  Coins,
  Wrench,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

const PROVIDER_COLORS = ['#7B61FF', '#61FF7B', '#FFD761', '#FF61DC', '#61D4FF', '#FF9F61'];
const KPI_COLORS = { cost: '#61FF7B', messages: '#7B61FF', tokens: '#FFD761', tools: '#FF61DC' };
const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: '#0B0B10', border: '1px solid rgba(123, 97, 255, 0.3)', borderRadius: '8px' },
  itemStyle: { color: '#F4F6FF' },
};

type SummaryRange = 'day' | 'week' | 'month';
type ChartRange = '7d' | '14d' | '30d';

export function UsageAnalyticsPage() {
  const [mounted, setMounted] = useState(false);

  // Data state
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [providers, setProviders] = useState<ProviderBreakdown[]>([]);
  const [hourly, setHourly] = useState<HourlyActivity[]>([]);
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [eventsTotal, setEventsTotal] = useState(0);

  // UI state
  const [summaryRange, setSummaryRange] = useState<SummaryRange>('month');
  const [chartRange, setChartRange] = useState<ChartRange>('7d');
  const [eventsPage, setEventsPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Recharts SSR guard
  useEffect(() => { setMounted(true); }, []);

  // Initial load — fetch all 6 endpoints
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

      if (failures === 6) setError('Failed to load usage data. Please try again later.');
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
    color: PROVIDER_COLORS[i % PROVIDER_COLORS.length],
  }));

  const totalPages = Math.ceil(eventsTotal / 50);

  // Format helpers
  const fmt = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
  const fmtCost = (n: number) => `$${n.toFixed(4)}`;

  if (error && !summary && !chartData.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertTriangle className="w-10 h-10 text-[#FF6161]" />
        <p className="text-[#A7ACB8]">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()} className="border-[#7B61FF]/30">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Usage Analytics
          </h1>
          <p className="text-sm text-[#A7ACB8] mt-1">Deep-dive into your AI costs and activity</p>
        </div>
        <div className="flex gap-1 bg-[#0B0B10] border border-[#7B61FF]/20 rounded-lg p-1">
          {(['day', 'week', 'month'] as SummaryRange[]).map((r) => (
            <button
              key={r}
              onClick={() => handleSummaryRange(r)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                summaryRange === r
                  ? 'bg-[#7B61FF] text-white'
                  : 'text-[#A7ACB8] hover:text-[#F4F6FF]'
              }`}
            >
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="bg-[#0B0B10] border-[#7B61FF]/20">
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
            <Card className="bg-[#0B0B10] border-[#7B61FF]/20 hover:border-[#7B61FF]/40 transition-all group">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${KPI_COLORS.cost}15` }}>
                    <DollarSign className="w-5 h-5" style={{ color: KPI_COLORS.cost }} />
                  </div>
                  {summary?.forecastUSD !== undefined && (
                    <div className="flex items-center gap-1 text-xs font-mono text-[#FFD761]">
                      <TrendingUp className="w-3 h-3" />
                      ~${summary.forecastUSD.toFixed(2)}
                    </div>
                  )}
                </div>
                <div className="text-2xl font-bold text-[#F4F6FF] group-hover:text-[#61FF7B] transition-colors font-mono">
                  ${summary?.totalCostUSD.toFixed(2) ?? '0.00'}
                </div>
                <div className="text-sm text-[#A7ACB8]">Total Cost</div>
              </CardContent>
            </Card>

            {/* Messages */}
            <Card className="bg-[#0B0B10] border-[#7B61FF]/20 hover:border-[#7B61FF]/40 transition-all group">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${KPI_COLORS.messages}15` }}>
                    <MessageSquare className="w-5 h-5" style={{ color: KPI_COLORS.messages }} />
                  </div>
                </div>
                <div className="text-2xl font-bold text-[#F4F6FF] group-hover:text-[#7B61FF] transition-colors">
                  {fmt(summary?.totalMessages ?? 0)}
                </div>
                <div className="text-sm text-[#A7ACB8]">Messages</div>
              </CardContent>
            </Card>

            {/* Tokens */}
            <Card className="bg-[#0B0B10] border-[#7B61FF]/20 hover:border-[#7B61FF]/40 transition-all group">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${KPI_COLORS.tokens}15` }}>
                    <Coins className="w-5 h-5" style={{ color: KPI_COLORS.tokens }} />
                  </div>
                </div>
                <div className="text-2xl font-bold text-[#F4F6FF] group-hover:text-[#FFD761] transition-colors">
                  {fmt(summary?.totalTokensIn ?? 0)} / {fmt(summary?.totalTokensOut ?? 0)}
                </div>
                <div className="text-sm text-[#A7ACB8]">Tokens In / Out</div>
              </CardContent>
            </Card>

            {/* Tool Calls */}
            <Card className="bg-[#0B0B10] border-[#7B61FF]/20 hover:border-[#7B61FF]/40 transition-all group">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${KPI_COLORS.tools}15` }}>
                    <Wrench className="w-5 h-5" style={{ color: KPI_COLORS.tools }} />
                  </div>
                </div>
                <div className="text-2xl font-bold text-[#F4F6FF] group-hover:text-[#FF61DC] transition-colors">
                  {fmt(summary?.totalToolCalls ?? 0)}
                </div>
                <div className="text-sm text-[#A7ACB8]">Tool Calls</div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Cost Over Time Chart */}
      <Card className="bg-[#0B0B10] border-[#7B61FF]/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#7B61FF]" />
              Cost Over Time
            </CardTitle>
            <div className="flex gap-1 bg-[#05050A] border border-[#7B61FF]/20 rounded-lg p-0.5">
              {(['7d', '14d', '30d'] as ChartRange[]).map((r) => (
                <button
                  key={r}
                  onClick={() => handleChartRange(r)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                    chartRange === r
                      ? 'bg-[#7B61FF] text-white'
                      : 'text-[#A7ACB8] hover:text-[#F4F6FF]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            {loading ? (
              <Skeleton className="w-full h-full rounded-lg" />
            ) : mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#61FF7B" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#61FF7B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#7B61FF10" />
                  <XAxis dataKey="label" stroke="#A7ACB8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="#A7ACB8"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                  />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={(value: number) => [`$${value.toFixed(4)}`, 'Cost']}
                  />
                  <Area type="monotone" dataKey="cost" stroke="#61FF7B" strokeWidth={2} fillOpacity={1} fill="url(#costGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Two-column: Provider Breakdown + Hourly Activity */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Provider Breakdown */}
        <Card className="bg-[#0B0B10] border-[#7B61FF]/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Provider Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="w-full h-[220px] rounded-lg" />
            ) : pieData.length === 0 ? (
              <div className="flex items-center justify-center h-[220px] text-sm text-[#A7ACB8]">No provider data</div>
            ) : (
              <>
                <div className="h-[220px]">
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
                          formatter={(value: number) => [`$${value.toFixed(4)}`, 'Cost']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="flex flex-wrap justify-center gap-3 mt-2">
                  {pieData.map((p) => (
                    <div key={p.provider} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="text-xs text-[#A7ACB8]">{p.provider}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Hourly Activity */}
        <Card className="bg-[#0B0B10] border-[#7B61FF]/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Hourly Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="w-full h-[250px] rounded-lg" />
            ) : hourlyData.length === 0 ? (
              <div className="flex items-center justify-center h-[250px] text-sm text-[#A7ACB8]">No activity data</div>
            ) : (
              <div className="h-[250px]">
                {mounted && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#7B61FF10" vertical={false} />
                      <XAxis dataKey="hour" stroke="#A7ACB8" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#A7ACB8" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip
                        {...TOOLTIP_STYLE}
                        cursor={{ fill: 'rgba(123, 97, 255, 0.1)' }}
                      />
                      <Bar dataKey="requests" fill="#7B61FF" radius={[4, 4, 0, 0]} />
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
        <Card className="lg:col-span-2 bg-[#0B0B10] border-[#7B61FF]/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Top Tools by Cost</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="w-full h-[200px] rounded-lg" />
            ) : toolData.length === 0 ? (
              <div className="flex items-center justify-center h-[200px] text-sm text-[#A7ACB8]">No tool usage data</div>
            ) : (
              <div className="h-[200px]">
                {mounted && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={toolData} layout="vertical" margin={{ left: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#7B61FF10" horizontal={false} />
                      <XAxis
                        type="number"
                        stroke="#A7ACB8"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                      />
                      <YAxis type="category" dataKey="name" stroke="#A7ACB8" fontSize={11} tickLine={false} axisLine={false} width={75} />
                      <Tooltip
                        {...TOOLTIP_STYLE}
                        formatter={(value: number) => [`$${value.toFixed(4)}`, 'Cost']}
                      />
                      <Bar dataKey="cost" fill="#FF61DC" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Billing Summary */}
        <Card className="bg-[#0B0B10] border-[#7B61FF]/20">
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
              <div className="text-sm text-[#A7ACB8]">No billing data</div>
            ) : (
              <div className="space-y-4">
                {[
                  { label: 'Plan', value: billing.plan.charAt(0).toUpperCase() + billing.plan.slice(1) },
                  { label: 'Credits', value: billing.credits.toLocaleString() },
                  { label: 'Monthly Allowance', value: `$${billing.monthlyAllowance.toFixed(2)}` },
                  { label: 'Used This Month', value: `$${billing.usageThisMonth.totalCostUSD.toFixed(2)}` },
                  { label: 'Resets', value: new Date(billing.resetDate).toLocaleDateString() },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-sm">
                    <span className="text-[#A7ACB8]">{item.label}</span>
                    <span className="text-[#F4F6FF] font-mono">{item.value}</span>
                  </div>
                ))}

                {/* Usage progress bar */}
                <div className="pt-2">
                  <div className="flex items-center justify-between text-xs text-[#A7ACB8] mb-1.5">
                    <span>Usage</span>
                    <span>{billing.monthlyAllowance > 0 ? `${Math.min(100, (billing.usageThisMonth.totalCostUSD / billing.monthlyAllowance * 100)).toFixed(0)}%` : '0%'}</span>
                  </div>
                  <div className="h-2 bg-[#05050A] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#7B61FF] to-[#61FF7B] transition-all duration-500"
                      style={{
                        width: `${billing.monthlyAllowance > 0 ? Math.min(100, (billing.usageThisMonth.totalCostUSD / billing.monthlyAllowance * 100)) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Usage Event Log */}
      <Card className="bg-[#0B0B10] border-[#7B61FF]/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">Usage Events</CardTitle>
            {eventsTotal > 0 && (
              <Badge variant="outline" className="border-[#7B61FF]/30 text-[#A7ACB8]">
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
            <div className="text-center py-8 text-sm text-[#A7ACB8]">No usage events yet</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#7B61FF]/20">
                      <TableHead className="text-[#A7ACB8]">Time</TableHead>
                      <TableHead className="text-[#A7ACB8]">Provider</TableHead>
                      <TableHead className="text-[#A7ACB8]">Model</TableHead>
                      <TableHead className="text-[#A7ACB8] text-right">Tokens</TableHead>
                      <TableHead className="text-[#A7ACB8] text-right">Cost</TableHead>
                      <TableHead className="text-[#A7ACB8]">Channel</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((event) => (
                      <TableRow key={event.id} className="border-[#7B61FF]/10 hover:bg-[#7B61FF]/5">
                        <TableCell className="text-[#A7ACB8] font-mono text-xs">
                          {new Date(event.createdAt).toLocaleString(undefined, {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                          })}
                        </TableCell>
                        <TableCell className="text-[#F4F6FF]">{event.provider}</TableCell>
                        <TableCell className="text-[#A7ACB8] font-mono text-xs">{event.model}</TableCell>
                        <TableCell className="text-[#F4F6FF] text-right font-mono text-xs">
                          {fmt(event.tokensIn)} / {fmt(event.tokensOut)}
                        </TableCell>
                        <TableCell className="text-[#61FF7B] text-right font-mono text-xs">
                          {fmtCost(event.costUSD)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-[#7B61FF]/30 text-[#A7ACB8] text-xs">
                            {event.channel}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <span className="text-xs text-[#A7ACB8]">
                    Page {eventsPage} of {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={eventsPage <= 1}
                      onClick={() => handleEventsPage(eventsPage - 1)}
                      className="border-[#7B61FF]/30 text-[#A7ACB8] hover:text-[#F4F6FF] disabled:opacity-40"
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={eventsPage >= totalPages}
                      onClick={() => handleEventsPage(eventsPage + 1)}
                      className="border-[#7B61FF]/30 text-[#A7ACB8] hover:text-[#F4F6FF] disabled:opacity-40"
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
  );
}
