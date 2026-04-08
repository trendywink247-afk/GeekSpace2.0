// ============================================================
// AnalyticsPage — "Agentin Wrapped" — Personal Analytics Dashboard
// Owner agent: pulse (#10B981)
// State & data-fetching: ./analytics/useAnalytics
// Sub-components: ./analytics/
// ============================================================
import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { PageShell, PageHeader, SectionCard } from '@/components/agentin';
import { DashboardPageWrapper } from '@/components/agentin';
import {
  RefreshCw,
  Activity,
  Zap,
  MessageCircle,
  Clock,
  Flame,
  CheckCircle2,
  BarChart3,
  Download,
} from 'lucide-react';
import {
  containerVariants,
  CARD_SHADOW,
  PeriodTabs,
  SkeletonCard,
  OverviewCard,
  SkeletonInsightCard,
  InsightCard,
  AIInsightCard,
  SkeletonHeatmap,
  SkeletonBar,
  ActivityHeatmap,
  UsageBarChart,
  LatencyChart,
  ProviderPieChart,
  DelegationBarChart,
  useAnalytics,
} from './';

export function AnalyticsPage() {
  const {
    data,
    loading,
    error,
    period,
    setPeriod,
    exporting,
    aiInsights,
    aiInsightsLoading,
    aiInsightsError,
    filteredSnapshots,
    stats,
    insights,
    featureUsage,
    latencyChartData,
    providerPieData,
    delegationChartData,
    load,
    loadAiInsights,
    handleExportCSV,
  } = useAnalytics();

  const { totalConversations, totalTasksCompleted, habitStreak, focusHours,
          conversationTrend, taskTrend, focusTrend } = stats;

  return (
    <DashboardPageWrapper>
      <PageShell maxWidth="5xl">
        <div
          className="space-y-6 pb-24 md:pb-6 overflow-x-hidden"
          style={{ WebkitFontSmoothing: 'antialiased' }}
        >
          {/* ── Header ─────────────────────────────────────────── */}
          <PageHeader
            icon={BarChart3}
            title="Agentin Wrapped"
            subtitle="Your personal AI usage and productivity insights"
            badge={
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-[var(--ag-pulse)]/10 border border-[var(--ag-pulse)]/25 text-[var(--ag-pulse)]">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--ag-pulse)] opacity-75 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--ag-pulse)]" />
                </span>
                Pulse
              </span>
            }
            actions={
              <div className="flex items-center gap-3 flex-wrap">
                <PeriodTabs value={period} onChange={setPeriod} />
                <button
                  onClick={() => void handleExportCSV(filteredSnapshots)}
                  disabled={exporting || loading}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--ag-bg-surface)] text-[var(--ag-text-secondary)] hover:text-[var(--ag-pulse)] backdrop-blur-xl text-sm min-h-[44px] disabled:opacity-40 transition-[color,box-shadow] duration-200 active:scale-[0.96]"
                  style={{ boxShadow: CARD_SHADOW }}
                  aria-label="Export analytics as CSV"
                  title="Export as CSV"
                >
                  <Download className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`} />
                  <span className="hidden sm:inline">Export</span>
                </button>
                <button
                  onClick={load}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--ag-bg-surface)] text-[var(--ag-text-secondary)] hover:text-[var(--ag-pulse)] backdrop-blur-xl text-sm min-h-[44px] transition-[color,box-shadow] duration-200 active:scale-[0.96]"
                  style={{ boxShadow: CARD_SHADOW }}
                  aria-label="Refresh analytics"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            }
          />

          {/* ── Error State ─────────────────────────────────────── */}
          {error && (
            <div
              className="rounded-2xl p-4 flex items-center justify-between"
              style={{
                boxShadow: '0 0 0 1px rgba(239,68,68,0.3), 0 4px 16px rgba(239,68,68,0.1)',
                backgroundColor: 'rgba(239,68,68,0.07)',
              }}
            >
              <span
                className="text-red-400 text-sm"
                style={{ textWrap: 'pretty' } as CSSProperties}
              >
                {error}
              </span>
              <button
                onClick={load}
                className="text-sm text-red-400 hover:text-red-300 underline underline-offset-2 ml-4 flex-shrink-0 min-h-[44px] px-2"
              >
                Retry
              </button>
            </div>
          )}

          {/* ── 1. Overview Stats ───────────────────────────────── */}
          <section aria-label="Overview statistics">
            {loading ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : (
              <motion.div
                className="grid grid-cols-2 lg:grid-cols-4 gap-3"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                <OverviewCard
                  icon={MessageCircle}
                  value={totalConversations}
                  label="Total Conversations"
                  trend={conversationTrend}
                  sparkData={filteredSnapshots.map((d) => d.messagesReceived + d.agentCalls)}
                  color="var(--ag-cyan)"
                />
                <OverviewCard
                  icon={CheckCircle2}
                  value={totalTasksCompleted}
                  label={period === 'week' ? 'Tasks This Week' : period === 'month' ? 'Tasks This Month' : 'Total Tasks'}
                  trend={taskTrend}
                  sparkData={filteredSnapshots.map((d) => d.tasksCompleted)}
                  color="var(--ag-lime)"
                />
                <OverviewCard
                  icon={Flame}
                  value={habitStreak > 0 ? `${habitStreak}d` : '--'}
                  label="Habits Streak"
                  trend={habitStreak > 3 ? 'up' : 'flat'}
                  sparkData={filteredSnapshots.map((d) => d.habitsLogged)}
                  color="var(--ag-violet)"
                />
                <OverviewCard
                  icon={Clock}
                  value={focusHours > 0 ? `${focusHours}h` : '--'}
                  label={period === 'week' ? 'Focus This Week' : period === 'month' ? 'Focus This Month' : 'Total Focus'}
                  trend={focusTrend}
                  sparkData={filteredSnapshots.map((d) => d.focusMinutes)}
                  color="var(--ag-pink)"
                />
              </motion.div>
            )}
          </section>

          {/* ── 2. Activity Heatmap ─────────────────────────────── */}
          <SectionCard title="Activity Heatmap" subtitle="Last 16 weeks — tap a cell to inspect">
            {loading
              ? <SkeletonHeatmap />
              : <ActivityHeatmap heatmap={data.heatmap} activityEntries={data.activityEntries} />}
          </SectionCard>

          {/* ── 3. AI Insights ──────────────────────────────────── */}
          <SectionCard title="AI Insights">
            <div className="flex items-center justify-between mb-4 -mt-1">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[var(--ag-green)]" />
                <span className="text-xs text-[var(--ag-text-secondary)]">Powered by Pulse</span>
              </div>
              <button
                onClick={() => void loadAiInsights(true)}
                disabled={aiInsightsLoading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--ag-bg-surface)] text-[var(--ag-text-secondary)] hover:text-[var(--ag-pulse)] transition-[color,box-shadow] text-xs min-h-[44px]"
                style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.06)' }}
                title="Regenerate insights"
              >
                <RefreshCw className={`w-3 h-3 ${aiInsightsLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
            {aiInsightsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <SkeletonInsightCard key={i} />)}
              </div>
            ) : aiInsights.length > 0 ? (
              <div className="space-y-2">
                {aiInsights.map((insight, i) => <AIInsightCard key={i} insight={insight} />)}
              </div>
            ) : (
              <div className="space-y-2">
                {aiInsightsError || insights.length > 0
                  ? insights.map((text, i) => <InsightCard key={i} text={text} />)
                  : <p className="text-sm text-[var(--ag-text-muted)] py-4 text-center">No insights yet — keep using Agentin to unlock them.</p>}
              </div>
            )}
          </SectionCard>

          {/* ── 4. Agent Metrics Charts ─────────────────────────── */}
          {!loading && (
            <section aria-label="Agent metrics">
              <h2
                className="text-sm font-heading font-semibold text-[var(--ag-text-primary)] mb-3 flex items-center gap-2"
                style={{ textWrap: 'balance' } as CSSProperties}
              >
                <Activity className="w-4 h-4 text-[var(--ag-green)]" />
                Agent Metrics
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <SectionCard title="Response Latency" subtitle="Last 7 days (ms)">
                  <LatencyChart data={latencyChartData} />
                </SectionCard>
                <SectionCard title="LLM Provider Distribution">
                  <ProviderPieChart data={providerPieData} />
                </SectionCard>
                <SectionCard title="Delegation by Agent" subtitle="Calls per agent (estimated)" className="lg:col-span-2">
                  <DelegationBarChart data={delegationChartData} />
                </SectionCard>
              </div>
            </section>
          )}

          {/* ── 5. Usage by Feature ──────────────────────────────── */}
          <SectionCard title="Usage by Feature" subtitle="Relative activity across features">
            {loading ? <SkeletonBar /> : <UsageBarChart items={featureUsage} />}
          </SectionCard>

          {/* ── 6. Agent Breakdown ──────────────────────────────── */}
          {!loading && data.agents.length > 0 && (
            <SectionCard title="Agent Usage" subtitle="Last 30 days">
              <div className="space-y-3">
                {data.agents.map((a) => {
                  const maxCount = Math.max(...data.agents.map((ag) => ag.count), 1);
                  const agentColors: Record<string, string> = {
                    weebo: 'var(--ag-lime)', jarvis: 'var(--ag-violet)',
                    edith: 'var(--ag-cyan)', pulse: 'var(--ag-green)', builtin: 'var(--ag-amber)',
                  };
                  const color = agentColors[a.agent] ?? 'var(--ag-text-muted)';
                  const pct = Math.round((a.count / maxCount) * 100);
                  return (
                    <div key={a.agent} className="flex items-center gap-3 min-h-[32px]">
                      <div className="flex items-center gap-1.5 w-20 flex-shrink-0">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-xs text-[var(--ag-text-primary)] capitalize truncate">{a.agent}</span>
                      </div>
                      <div className="flex-1 h-2 bg-[var(--ag-border-subtle)] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, backgroundColor: color, boxShadow: `0 0 4px ${color}60` }}
                        />
                      </div>
                      <span className="text-xs text-[var(--ag-text-secondary)] w-10 text-right flex-shrink-0 tabular-nums">
                        {a.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}

          {/* ── Footer ──────────────────────────────────────────── */}
          <p className="text-xs text-[var(--ag-text-muted)] text-center pb-4">
            Insights update in real time as you use Agentin
          </p>
        </div>
      </PageShell>
    </DashboardPageWrapper>
  );
}
