// AnalyticsPage.tsx -- "Agentin Wrapped" -- Personal Analytics Dashboard
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Activity,
  Zap,
  MessageCircle,
  Clock,
  Lightbulb,
  Flame,
  CheckCircle2,
  BarChart3,
  Calendar,
  Target,
  ArrowUpRight,
  Download,
} from 'lucide-react';
import api from '@/services/api';
import { activityService } from '@/services/api';

// ── Types ───────────────────────────────────────────────────────

type TimePeriod = 'week' | 'month' | 'all';

interface DailySnapshot {
  date: string;
  tasksCompleted: number;
  remindersCreated: number;
  messagesReceived: number;
  focusMinutes: number;
  habitsLogged: number;
  agentCalls: number;
  notesCreated: number;
}

interface WeeklySummary {
  topAgent: string;
  totalFocusHours: number;
  taskCompletionRate: number;
  longestHabitStreak: { name: string; streak: number } | null;
  mostActiveDay: string;
  inboxTriagedCount: number;
  workflowsRun: number;
  aiInsight: string;
}

interface HeatmapPoint {
  date: string;
  intensity: number;
}

interface AgentUsage {
  agent: string;
  count: number;
}

interface ActivityEntry {
  id: string;
  action: string;
  details: string;
  icon: string;
  created_at: string;
}

interface AnalyticsData {
  snapshots: DailySnapshot[];
  weekly: WeeklySummary | null;
  heatmap: HeatmapPoint[];
  agents: AgentUsage[];
  activityEntries: ActivityEntry[];
}

// ── Heatmap Constants ───────────────────────────────────────────

const HEATMAP_EMPTY = '#0C0C18';
const HEATMAP_COLORS = [
  HEATMAP_EMPTY,
  'rgba(0,240,255,0.2)',
  'rgba(0,240,255,0.5)',
  'rgba(0,240,255,0.8)',
  'rgba(0,240,255,1)',
];

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ── Utility Functions ───────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function getWeekday(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00Z');
  // Convert Sunday=0 to Monday-based: Mon=0..Sun=6
  const day = d.getUTCDay();
  return day === 0 ? 6 : day - 1;
}

function computeTrend(data: number[]): 'up' | 'down' | 'flat' {
  if (data.length < 2) return 'flat';
  const mid = Math.floor(data.length / 2);
  const first = data.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
  const second = data.slice(mid).reduce((a, b) => a + b, 0) / (data.length - mid);
  if (second > first * 1.05) return 'up';
  if (second < first * 0.95) return 'down';
  return 'flat';
}

// ── Skeleton Components ─────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-[#0C0C18] border border-[#00F0FF]/10 rounded-2xl p-5 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-[#1a1a2e]" />
        <div className="flex-1 space-y-2">
          <div className="h-7 w-16 bg-[#1a1a2e] rounded" />
          <div className="h-3 w-24 bg-[#1a1a2e] rounded" />
        </div>
      </div>
    </div>
  );
}

function SkeletonHeatmap() {
  return (
    <div className="bg-[#0C0C18] border border-[#00F0FF]/10 rounded-2xl p-5 animate-pulse">
      <div className="h-4 w-48 bg-[#1a1a2e] rounded mb-4" />
      <div className="flex gap-1">
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1">
            {Array.from({ length: 7 }).map((_, j) => (
              <div key={j} className="w-[10px] h-[10px] rounded-sm bg-[#1a1a2e]" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonBar() {
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-3 w-20 bg-[#1a1a2e] rounded" />
          <div className="flex-1 h-6 bg-[#1a1a2e] rounded-full" />
          <div className="h-3 w-10 bg-[#1a1a2e] rounded" />
        </div>
      ))}
    </div>
  );
}

function SkeletonInsight() {
  return (
    <div className="border-l-2 border-[#1a1a2e] pl-4 py-2 animate-pulse">
      <div className="h-4 w-64 bg-[#1a1a2e] rounded" />
    </div>
  );
}

// ── Trend Arrow Component ───────────────────────────────────────

function TrendArrow({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  if (trend === 'up') {
    return <TrendingUp className="w-4 h-4 text-[#ADFF2F]" />;
  }
  if (trend === 'down') {
    return <TrendingDown className="w-4 h-4 text-[#FF2D78]" />;
  }
  return <ArrowUpRight className="w-4 h-4 text-[#8892A4] opacity-40" />;
}

// ── Mini Sparkline (inline SVG) ─────────────────────────────────

function MiniSparkline({ data, color = '#00F0FF' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const w = 60;
  const h = 24;
  const points = data
    .map((v, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * w;
      const y = h - (v / max) * (h - 2) - 1;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-[60px] h-6 flex-shrink-0"
      preserveAspectRatio="none"
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        opacity="0.7"
      />
    </svg>
  );
}

// ── Overview Stat Card ──────────────────────────────────────────

function OverviewCard({
  icon: Icon,
  value,
  label,
  trend,
  sparkData,
  color = '#00F0FF',
}: {
  icon: React.ElementType;
  value: string | number;
  label: string;
  trend: 'up' | 'down' | 'flat';
  sparkData: number[];
  color?: string;
}) {
  return (
    <div className="bg-[#0C0C18] border border-[#00F0FF]/10 rounded-2xl p-5 flex flex-col gap-3 min-w-0">
      <div className="flex items-start justify-between">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: color + '18' }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <TrendArrow trend={trend} />
      </div>
      <div>
        <div className="text-2xl font-bold text-[#F4F6FF] tracking-tight">{value}</div>
        <div className="text-xs text-[#8892A4] mt-0.5">{label}</div>
      </div>
      {sparkData.length >= 2 && (
        <div className="mt-auto">
          <MiniSparkline data={sparkData} color={color} />
        </div>
      )}
    </div>
  );
}

// ── Activity Heatmap (inline SVG, GitHub-style, Mon-Sun) ────────

function ActivityHeatmap({
  heatmap,
  activityEntries,
}: {
  heatmap: HeatmapPoint[];
  activityEntries: ActivityEntry[];
}) {
  const [tooltip, setTooltip] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Build a message count map from activity entries (for richer data)
  const messageCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of activityEntries) {
      const dateKey = entry.created_at.slice(0, 10);
      map.set(dateKey, (map.get(dateKey) ?? 0) + 1);
    }
    return map;
  }, [activityEntries]);

  // Build grid data: last 16 weeks
  const gridData = useMemo(() => {
    const today = new Date();
    const cells: {
      date: string;
      count: number;
      weekCol: number;
      dayRow: number;
    }[] = [];

    const heatmapMap = new Map<string, number>();
    for (const pt of heatmap) {
      heatmapMap.set(pt.date, pt.intensity);
    }

    // Go back 16 weeks from today (112 days)
    const totalDays = 16 * 7;
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - totalDays + 1);

    // Align to Monday
    const startDay = startDate.getUTCDay();
    const mondayOffset = startDay === 0 ? -6 : 1 - startDay;
    startDate.setDate(startDate.getDate() + mondayOffset);

    for (let i = 0; i < totalDays; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayRow = getWeekday(dateStr); // 0=Mon..6=Sun
      const weekCol = Math.floor(i / 7);

      // Use heatmap intensity if available, else activity entry count
      const count = heatmapMap.get(dateStr) ?? messageCountByDate.get(dateStr) ?? 0;

      // Only include cells up to today
      if (d <= today) {
        cells.push({ date: dateStr, count, weekCol, dayRow });
      }
    }

    return cells;
  }, [heatmap, messageCountByDate]);

  // Calculate max for color scaling
  const maxCount = useMemo(() => {
    return Math.max(...gridData.map((c) => c.count), 1);
  }, [gridData]);

  const getColor = (count: number): string => {
    if (count === 0) return HEATMAP_COLORS[0];
    const ratio = count / maxCount;
    if (ratio <= 0.25) return HEATMAP_COLORS[1];
    if (ratio <= 0.5) return HEATMAP_COLORS[2];
    if (ratio <= 0.75) return HEATMAP_COLORS[3];
    return HEATMAP_COLORS[4];
  };

  const cellSize = 10;
  const gap = 2;
  const step = cellSize + gap;
  const labelWidth = 28;
  const numWeeks = Math.max(...gridData.map((c) => c.weekCol), 0) + 1;
  const svgWidth = labelWidth + numWeeks * step + gap;
  const svgHeight = 7 * step + gap;

  const handleMouseEnter = (
    e: React.MouseEvent,
    date: string,
    count: number,
  ) => {
    const rect = (e.target as SVGElement).getBoundingClientRect();
    setTooltip({
      text: `${formatDate(date)}: ${count} message${count !== 1 ? 's' : ''}`,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
  };

  return (
    <div className="relative">
      {tooltip && (
        <div
          className="fixed z-50 bg-[#12121F] border border-[#00F0FF]/30 rounded-lg px-3 py-1.5 text-xs text-[#F4F6FF] pointer-events-none whitespace-nowrap"
          style={{
            top: tooltip.y - 28,
            left: tooltip.x,
            transform: 'translateX(-50%)',
          }}
        >
          {tooltip.text}
        </div>
      )}
      <div className="overflow-x-auto pb-2">
        <svg
          ref={svgRef}
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="min-w-0"
        >
          {/* Day labels */}
          {DAY_LABELS.map((label, i) => (
            <text
              key={label}
              x={12}
              y={i * step + cellSize - 1}
              textAnchor="middle"
              className="text-[8px]"
              fill="#8892A4"
              fontFamily="system-ui, sans-serif"
              fontSize="8"
            >
              {i % 2 === 0 ? label : ''}
            </text>
          ))}
          {/* Grid cells */}
          {gridData.map((cell) => (
            <rect
              key={cell.date}
              x={labelWidth + cell.weekCol * step}
              y={cell.dayRow * step}
              width={cellSize}
              height={cellSize}
              rx={2}
              ry={2}
              fill={getColor(cell.count)}
              className="cursor-pointer transition-opacity hover:opacity-80"
              onMouseEnter={(e) => handleMouseEnter(e, cell.date, cell.count)}
              onMouseLeave={() => setTooltip(null)}
            />
          ))}
        </svg>
      </div>
      {/* Legend */}
      <div className="flex items-center gap-2 mt-2 text-xs text-[#8892A4]">
        <span>Less</span>
        {HEATMAP_COLORS.map((color, i) => (
          <div
            key={i}
            className="w-[10px] h-[10px] rounded-sm"
            style={{ backgroundColor: color }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

// ── AI Insight Card ─────────────────────────────────────────────

function InsightCard({ text }: { text: string }) {
  return (
    <div className="border-l-2 border-[#ADFF2F] pl-4 py-2 flex items-start gap-2.5">
      <Lightbulb className="w-4 h-4 text-[#ADFF2F] mt-0.5 flex-shrink-0" />
      <span className="text-sm text-[#F4F6FF]">{text}</span>
    </div>
  );
}

// ── Usage Bar Chart ─────────────────────────────────────────────

function UsageBarChart({
  items,
}: {
  items: { label: string; value: number; color: string }[];
}) {
  const total = items.reduce((s, it) => s + it.value, 0) || 1;
  const maxVal = Math.max(...items.map((it) => it.value), 1);

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const pct = Math.round((item.value / total) * 100);
        const barWidth = (item.value / maxVal) * 100;
        return (
          <div key={item.label} className="flex items-center gap-3">
            <span className="text-xs text-[#8892A4] w-20 text-right flex-shrink-0">
              {item.label}
            </span>
            <div className="flex-1 h-6 bg-[#0C0C18] rounded-full overflow-hidden relative">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${barWidth}%`,
                  backgroundColor: item.color,
                  minWidth: item.value > 0 ? '8px' : '0',
                }}
              />
            </div>
            <span className="text-xs text-[#F4F6FF] w-12 text-right font-medium flex-shrink-0">
              {pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Time Period Tabs ────────────────────────────────────────────

function PeriodTabs({
  value,
  onChange,
}: {
  value: TimePeriod;
  onChange: (v: TimePeriod) => void;
}) {
  const tabs: { key: TimePeriod; label: string }[] = [
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'all', label: 'All Time' },
  ];

  return (
    <div className="flex gap-1 bg-[#0C0C18] border border-[#00F0FF]/10 rounded-xl p-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-4 py-2 rounded-lg text-xs font-medium transition-all min-h-[44px] ${
            value === tab.key
              ? 'bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30'
              : 'text-[#8892A4] hover:text-[#F4F6FF] border border-transparent'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────

export function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData>({
    snapshots: [],
    weekly: null,
    heatmap: [],
    agents: [],
    activityEntries: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<TimePeriod>('week');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fire all requests in parallel; catch individual failures gracefully
      const results = await Promise.allSettled([
        api.get<{ snapshots: DailySnapshot[] }>('analytics/snapshot', {
          params: { days: 365 },
        }),
        api.get<{ summary: WeeklySummary }>('analytics/weekly'),
        api.get<{ heatmap: HeatmapPoint[] }>('analytics/heatmap'),
        api.get<{ agents: AgentUsage[] }>('analytics/agents'),
        api.get<{ activity: ActivityEntry[] }>('activity', {
          params: { limit: 100 },
        }),
      ]);

      const snapshots =
        results[0].status === 'fulfilled'
          ? results[0].value.data.snapshots ?? []
          : [];
      const weekly =
        results[1].status === 'fulfilled'
          ? results[1].value.data.summary ?? null
          : null;
      const heatmap =
        results[2].status === 'fulfilled'
          ? results[2].value.data.heatmap ?? []
          : [];
      const agents =
        results[3].status === 'fulfilled'
          ? results[3].value.data.agents ?? []
          : [];
      const activityEntries =
        results[4].status === 'fulfilled'
          ? results[4].value.data.activity ?? []
          : [];

      // If ALL requests failed, show error
      if (results.every((r) => r.status === 'rejected')) {
        setError('Failed to load analytics data. Please try again.');
      }

      setData({ snapshots, weekly, heatmap, agents, activityEntries });
    } catch {
      setError('Failed to load analytics data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Compute period-filtered data ──────────────────────────────

  const filteredSnapshots = useMemo(() => {
    const now = new Date();
    if (period === 'week') {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - 7);
      const cutStr = cutoff.toISOString().slice(0, 10);
      return data.snapshots.filter((s) => s.date >= cutStr);
    }
    if (period === 'month') {
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - 30);
      const cutStr = cutoff.toISOString().slice(0, 10);
      return data.snapshots.filter((s) => s.date >= cutStr);
    }
    return data.snapshots;
  }, [data.snapshots, period]);

  // ── Overview Stats ────────────────────────────────────────────

  const totalConversations = filteredSnapshots.reduce(
    (s, d) => s + d.messagesReceived + d.agentCalls,
    0,
  );
  const totalTasksCompleted = filteredSnapshots.reduce(
    (s, d) => s + d.tasksCompleted,
    0,
  );
  const habitStreak = data.weekly?.longestHabitStreak?.streak ?? 0;
  const focusHours =
    period === 'week'
      ? data.weekly?.totalFocusHours ?? 0
      : Math.round(
          (filteredSnapshots.reduce((s, d) => s + d.focusMinutes, 0) / 60) * 10,
        ) / 10;

  const conversationTrend = computeTrend(
    filteredSnapshots.map((d) => d.messagesReceived + d.agentCalls),
  );
  const taskTrend = computeTrend(
    filteredSnapshots.map((d) => d.tasksCompleted),
  );
  const focusTrend = computeTrend(
    filteredSnapshots.map((d) => d.focusMinutes),
  );

  // ── AI Insights (computed from available data) ────────────────

  const insights = useMemo(() => {
    const result: string[] = [];

    // 1. "You're most productive on [day]"
    if (data.weekly?.mostActiveDay) {
      result.push(`You're most productive on ${data.weekly.mostActiveDay}`);
    } else if (filteredSnapshots.length > 0) {
      // Compute most productive day from snapshots
      const dayTotals = new Map<string, number>();
      for (const snap of filteredSnapshots) {
        const d = new Date(snap.date + 'T00:00:00Z');
        const dayName = d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
        dayTotals.set(dayName, (dayTotals.get(dayName) ?? 0) + snap.tasksCompleted + snap.messagesReceived);
      }
      let bestDay = '';
      let bestCount = 0;
      dayTotals.forEach((count, day) => {
        if (count > bestCount) { bestDay = day; bestCount = count; }
      });
      if (bestDay) {
        result.push(`You're most productive on ${bestDay}s`);
      }
    }

    // 2. "Your focus sessions average [X] minutes"
    const focusSnapshots = filteredSnapshots.filter((d) => d.focusMinutes > 0);
    if (focusSnapshots.length > 0) {
      const avgFocusMinutes = Math.round(
        focusSnapshots.reduce((s, d) => s + d.focusMinutes, 0) / focusSnapshots.length,
      );
      result.push(`Your focus sessions average ${avgFocusMinutes} minutes`);
    }

    // 3. "You've completed [X]% more tasks than last week"
    if (filteredSnapshots.length >= 7 && period === 'week') {
      const thisWeekTasks = filteredSnapshots.reduce((s, d) => s + d.tasksCompleted, 0);
      // Compare with previous period from full snapshot set
      const allSnaps = data.snapshots;
      const prevWeekSnaps = allSnaps.slice(
        Math.max(0, allSnaps.length - 14),
        Math.max(0, allSnaps.length - 7),
      );
      const prevWeekTasks = prevWeekSnaps.reduce((s, d) => s + d.tasksCompleted, 0);
      if (prevWeekTasks > 0) {
        const pctChange = Math.round(((thisWeekTasks - prevWeekTasks) / prevWeekTasks) * 100);
        if (pctChange > 0) {
          result.push(`You've completed ${pctChange}% more tasks than last week`);
        } else if (pctChange < 0) {
          result.push(`Task volume is down ${Math.abs(pctChange)}% from last week — time to ramp up!`);
        } else {
          result.push('Your task output is holding steady from last week');
        }
      } else if (thisWeekTasks > 0) {
        result.push(`You've completed ${thisWeekTasks} tasks this week — great start!`);
      }
    }

    // Peak hours (estimate from activity entries)
    if (data.activityEntries.length > 0 && result.length < 4) {
      const hourCounts = new Map<number, number>();
      for (const entry of data.activityEntries) {
        const hour = new Date(entry.created_at).getHours();
        hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
      }
      let peakHour = 0;
      let peakCount = 0;
      hourCounts.forEach((count, hour) => {
        if (count > peakCount) {
          peakHour = hour;
          peakCount = count;
        }
      });
      const startHour = peakHour;
      const endHour = (peakHour + 2) % 24;
      const fmtHour = (h: number) => {
        if (h === 0) return '12am';
        if (h === 12) return '12pm';
        return h < 12 ? `${h}am` : `${h - 12}pm`;
      };
      result.push(`Peak hours: ${fmtHour(startHour)}-${fmtHour(endHour)}`);
    }

    // Task completion rate
    if (data.weekly?.taskCompletionRate != null && result.length < 5) {
      result.push(
        `Task completion rate: ${data.weekly.taskCompletionRate}%`,
      );
    }

    // AI insight from backend
    if (data.weekly?.aiInsight && result.length < 5) {
      result.push(data.weekly.aiInsight);
    }

    // Fallback if no data at all
    if (result.length === 0) {
      result.push('Start using Agentin more to unlock personalized insights.');
    }

    return result.slice(0, 5);
  }, [data, filteredSnapshots, period]);

  // ── CSV Export ──────────────────────────────────────────────────

  const [exporting, setExporting] = useState(false);

  const handleExportCSV = useCallback(async () => {
    setExporting(true);
    try {
      const res = await activityService.export();
      const blob = res.data instanceof Blob ? res.data : new Blob([res.data as BlobPart], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `agentin-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      // Fallback: generate CSV from local snapshot data
      const rows = [
        ['Date', 'Messages', 'Tasks Completed', 'Focus Minutes', 'Habits Logged', 'Agent Calls', 'Notes Created'].join(','),
        ...filteredSnapshots.map((s) =>
          [s.date, s.messagesReceived + s.agentCalls, s.tasksCompleted, s.focusMinutes, s.habitsLogged, s.agentCalls, s.notesCreated].join(','),
        ),
      ].join('\n');
      const blob = new Blob([rows], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `agentin-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } finally {
      setExporting(false);
    }
  }, [filteredSnapshots]);

  // ── Usage by Feature (horizontal bar chart data) ──────────────

  const featureUsage = useMemo(() => {
    const chat = filteredSnapshots.reduce(
      (s, d) => s + d.messagesReceived + d.agentCalls,
      0,
    );
    const reminders = filteredSnapshots.reduce(
      (s, d) => s + d.remindersCreated,
      0,
    );
    const habits = filteredSnapshots.reduce(
      (s, d) => s + d.habitsLogged,
      0,
    );
    const focus = filteredSnapshots.reduce(
      (s, d) => s + d.focusMinutes,
      0,
    );
    return [
      { label: 'Chat', value: chat, color: '#00F0FF' },
      { label: 'Reminders', value: reminders, color: '#ADFF2F' },
      { label: 'Habits', value: habits, color: '#8B5CF6' },
      { label: 'Focus', value: focus, color: '#FF2D78' },
    ];
  }, [filteredSnapshots]);

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#F4F6FF] flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-[#00F0FF]" />
            Agentin Wrapped
          </h1>
          <p className="text-sm text-[#8892A4] mt-1">
            Your personal AI usage and productivity insights
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <PeriodTabs value={period} onChange={setPeriod} />
          <button
            onClick={handleExportCSV}
            disabled={exporting || loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0C0C18] border border-[#ADFF2F]/10 text-[#8892A4] hover:text-[#ADFF2F] hover:border-[#ADFF2F]/30 transition-all text-sm min-h-[44px] disabled:opacity-40"
            aria-label="Export analytics as CSV"
            title="Export as CSV"
          >
            <Download className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`} />
            <span className="hidden sm:inline">Export</span>
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0C0C18] border border-[#00F0FF]/10 text-[#8892A4] hover:text-[#00F0FF] hover:border-[#00F0FF]/30 transition-all text-sm min-h-[44px]"
            aria-label="Refresh analytics"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center justify-between">
          <span className="text-red-400 text-sm">{error}</span>
          <button
            onClick={load}
            className="text-sm text-red-400 hover:text-red-300 underline underline-offset-2 ml-4 flex-shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* 1. Overview Stats Cards */}
      <section>
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <OverviewCard
              icon={MessageCircle}
              value={totalConversations}
              label="Total Conversations"
              trend={conversationTrend}
              sparkData={filteredSnapshots.map(
                (d) => d.messagesReceived + d.agentCalls,
              )}
              color="#00F0FF"
            />
            <OverviewCard
              icon={CheckCircle2}
              value={totalTasksCompleted}
              label={
                period === 'week'
                  ? 'Tasks This Week'
                  : period === 'month'
                    ? 'Tasks This Month'
                    : 'Total Tasks'
              }
              trend={taskTrend}
              sparkData={filteredSnapshots.map((d) => d.tasksCompleted)}
              color="#ADFF2F"
            />
            <OverviewCard
              icon={Flame}
              value={habitStreak > 0 ? `${habitStreak}d` : '--'}
              label="Habits Streak"
              trend={habitStreak > 3 ? 'up' : habitStreak > 0 ? 'flat' : 'flat'}
              sparkData={filteredSnapshots.map((d) => d.habitsLogged)}
              color="#8B5CF6"
            />
            <OverviewCard
              icon={Clock}
              value={focusHours > 0 ? `${focusHours}h` : '--'}
              label={
                period === 'week'
                  ? 'Focus This Week'
                  : period === 'month'
                    ? 'Focus This Month'
                    : 'Total Focus'
              }
              trend={focusTrend}
              sparkData={filteredSnapshots.map((d) => d.focusMinutes)}
              color="#FF2D78"
            />
          </div>
        )}
      </section>

      {/* 2. Activity Heatmap */}
      <section className="bg-[#0C0C18] border border-[#00F0FF]/10 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-[#F4F6FF] mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#00F0FF]" />
          Activity Heatmap
          <span className="text-xs text-[#8892A4] font-normal ml-1">
            Last 16 weeks
          </span>
        </h2>
        {loading ? (
          <SkeletonHeatmap />
        ) : (
          <ActivityHeatmap
            heatmap={data.heatmap}
            activityEntries={data.activityEntries}
          />
        )}
      </section>

      {/* 3. AI-Generated Insights Panel */}
      <section className="bg-[#0C0C18] border border-[#00F0FF]/10 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-[#F4F6FF] mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#ADFF2F]" />
          AI Insights
        </h2>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonInsight key={i} />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {insights.map((text, i) => (
              <InsightCard key={i} text={text} />
            ))}
          </div>
        )}
      </section>

      {/* 4. Usage by Feature (horizontal bar chart) */}
      <section className="bg-[#0C0C18] border border-[#00F0FF]/10 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-[#F4F6FF] mb-5 flex items-center gap-2">
          <Target className="w-4 h-4 text-[#00F0FF]" />
          Usage by Feature
        </h2>
        {loading ? (
          <SkeletonBar />
        ) : (
          <UsageBarChart items={featureUsage} />
        )}
      </section>

      {/* 5. Agent Breakdown (bonus section, retained from original) */}
      {!loading && data.agents.length > 0 && (
        <section className="bg-[#0C0C18] border border-[#00F0FF]/10 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-[#F4F6FF] mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#8B5CF6]" />
            Agent Usage
            <span className="text-xs text-[#8892A4] font-normal ml-1">
              Last 30 days
            </span>
          </h2>
          <div className="space-y-3">
            {data.agents.map((a) => {
              const maxCount = Math.max(
                ...data.agents.map((ag) => ag.count),
                1,
              );
              const agentColors: Record<string, string> = {
                weebo: '#ADFF2F',
                jarvis: '#8B5CF6',
                edith: '#00F0FF',
                builtin: '#F59E0B',
              };
              return (
                <div key={a.agent} className="flex items-center gap-3">
                  <span className="text-xs text-[#F4F6FF] w-16 capitalize flex-shrink-0">
                    {a.agent}
                  </span>
                  <div className="flex-1 h-2 bg-[#12121F] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${(a.count / maxCount) * 100}%`,
                        backgroundColor:
                          agentColors[a.agent] ?? '#6B7280',
                      }}
                    />
                  </div>
                  <span className="text-xs text-[#8892A4] w-8 text-right flex-shrink-0">
                    {a.count}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Footer */}
      <p className="text-xs text-[#8892A4] text-center pb-4">
        Insights update in real time as you use Agentin
      </p>
    </div>
  );
}
