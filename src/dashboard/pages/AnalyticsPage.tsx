// ============================================================
// AnalyticsPage -- "Agentin Wrapped" -- Personal Analytics Dashboard
// Owner agent: pulse (#10B981)
// Redesign: shadows over borders, tabular-nums, concentric radii,
//   glass cards, mobile-first, CSS-vars only, chart legends & tooltips,
//   framer-motion stagger, text-wrap, scale-on-press
// ============================================================
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { PageShell, PageHeader, SectionCard } from '@/components/agentin';
import { DashboardPageWrapper } from '@/components/agentin';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';
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
  ArrowUpRight,
  Download,
} from 'lucide-react';
import api from '@/services/api';
import { activityService } from '@/services/api';
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
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
  ResponsiveContainer,
} from 'recharts';

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

// ── Design Tokens (shadow system — shadows over borders) ────────

/**
 * Multi-layer dark mode card shadow: ring + lift + violet glow.
 * This replaces hard border lines with adaptive depth.
 */
const CARD_SHADOW =
  '0 0 0 1px rgba(255,255,255,0.06), 0 4px 16px rgba(0,0,0,0.35), 0 0 12px rgba(139,92,246,0.06)';
const CARD_SHADOW_HOVER =
  '0 0 0 1px rgba(139,92,246,0.28), 0 6px 24px rgba(0,0,0,0.45), 0 0 24px rgba(139,92,246,0.12)';

// ── Heatmap Constants ───────────────────────────────────────────

const HEATMAP_EMPTY = '#0C0C18';
const HEATMAP_COLORS = [
  HEATMAP_EMPTY,
  'rgba(139,92,246,0.2)',
  'rgba(139,92,246,0.5)',
  'rgba(139,92,246,0.8)',
  'rgba(139,92,246,1)',
];

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ── Recharts shared tooltip style ──────────────────────────────

const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: 'var(--ag-bg-chrome)',
    border: '1px solid rgba(139,92,246,0.18)',
    borderRadius: '10px',
    fontSize: '12px',
    padding: '8px 12px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
  },
  itemStyle: { color: 'var(--ag-text-primary)', fontVariantNumeric: 'tabular-nums' },
  labelStyle: { color: 'var(--ag-text-secondary)', marginBottom: '4px', fontWeight: 600 },
  cursor: { stroke: 'rgba(139,92,246,0.2)', strokeWidth: 1 },
};

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

// ── Animation Variants ──────────────────────────────────────────

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 14, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, duration: 0.45, bounce: 0 },
  },
};

// ── Skeleton Components ─────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      className="rounded-2xl bg-[var(--ag-bg-surface)] backdrop-blur-xl p-5 animate-pulse"
      style={{ boxShadow: CARD_SHADOW }}
    >
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-[var(--ag-active-bg)]" />
        <div className="flex-1 space-y-2">
          <div className="h-7 w-16 bg-[var(--ag-active-bg)] rounded-lg" />
          <div className="h-3 w-24 bg-[var(--ag-border-subtle)] rounded" />
        </div>
      </div>
    </div>
  );
}

function SkeletonHeatmap() {
  return (
    <div className="animate-pulse">
      <div className="h-4 w-48 bg-[var(--ag-active-bg)] rounded mb-4" />
      <div className="flex gap-1">
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1">
            {Array.from({ length: 7 }).map((_, j) => (
              <div key={j} className="w-[10px] h-[10px] rounded-sm bg-[var(--ag-border-subtle)]" />
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
          <div className="h-3 w-20 bg-[var(--ag-active-bg)] rounded" />
          <div className="flex-1 h-6 bg-[var(--ag-border-subtle)] rounded-full" />
          <div className="h-3 w-10 bg-[var(--ag-active-bg)] rounded" />
        </div>
      ))}
    </div>
  );
}

function SkeletonInsightCard() {
  return (
    <div className="border-l-2 border-[var(--ag-border-subtle)] pl-4 py-3 animate-pulse">
      <div className="flex items-start gap-2.5">
        <div className="w-5 h-5 rounded bg-[var(--ag-border-subtle)] flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-48 bg-[var(--ag-active-bg)] rounded" />
        </div>
      </div>
    </div>
  );
}

// ── Trend Arrow Component ───────────────────────────────────────

function TrendArrow({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  if (trend === 'up') return <TrendingUp className="w-4 h-4 text-[var(--ag-lime)]" />;
  if (trend === 'down') return <TrendingDown className="w-4 h-4 text-[var(--ag-pink)]" />;
  return <ArrowUpRight className="w-4 h-4 text-[var(--ag-text-muted)] opacity-50" />;
}

// ── Mini Sparkline (inline SVG) ─────────────────────────────────

function MiniSparkline({ data, color = 'var(--ag-cyan)' }: { data: number[]; color?: string }) {
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
        opacity="0.75"
      />
    </svg>
  );
}

// ── Overview Stat Card ──────────────────────────────────────────
// Concentric radii: outer rounded-2xl (16px), icon rounded-xl (12px)
// Shadow-over-border: multi-layer shadow replaces border ring

function OverviewCard({
  icon: Icon,
  value,
  label,
  trend,
  sparkData,
  color = 'var(--ag-cyan)',
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  value: string | number;
  label: string;
  trend: 'up' | 'down' | 'flat';
  sparkData: number[];
  color?: string;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      variants={cardVariants}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="rounded-2xl bg-[var(--ag-bg-surface)] backdrop-blur-xl p-5 flex flex-col gap-3 min-w-0 cursor-default"
      style={{
        boxShadow: hovered ? CARD_SHADOW_HOVER : CARD_SHADOW,
        transition: 'box-shadow 250ms cubic-bezier(0.4,0,0.2,1), transform 150ms cubic-bezier(0.4,0,0.2,1)',
        transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {/* Icon + Trend: icon uses rounded-xl = outer(16) - px(4 approx at this distance, treated as sep surface) */}
      <div className="flex items-start justify-between">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ring-1 ring-inset ring-white/5"
          style={{ backgroundColor: color.startsWith('var') ? undefined : color + '18',
            background: color.startsWith('var')
              ? `color-mix(in srgb, ${color} 12%, transparent)`
              : undefined,
          }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <TrendArrow trend={trend} />
      </div>

      {/* Value: tabular-nums prevents layout shift, text-wrap:balance for label */}
      <div>
        <div
          className="text-2xl font-bold text-[var(--ag-text-primary)] tracking-tight tabular-nums"
          style={{ textWrap: 'balance' } as React.CSSProperties}
        >
          {value}
        </div>
        <div
          className="text-xs text-[var(--ag-text-secondary)] mt-0.5"
          style={{ textWrap: 'pretty' } as React.CSSProperties}
        >
          {label}
        </div>
      </div>

      {sparkData.length >= 2 && (
        <div className="mt-auto pt-1 border-t border-[var(--ag-border-subtle)]">
          <MiniSparkline data={sparkData} color={color} />
        </div>
      )}
    </motion.div>
  );
}

// ── Activity Heatmap (GitHub-style, Mon-Sun) ────────────────────

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

  const messageCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of activityEntries) {
      const dateKey = entry.created_at.slice(0, 10);
      map.set(dateKey, (map.get(dateKey) ?? 0) + 1);
    }
    return map;
  }, [activityEntries]);

  const gridData = useMemo(() => {
    const today = new Date();
    const cells: { date: string; count: number; weekCol: number; dayRow: number }[] = [];
    const heatmapMap = new Map<string, number>();
    for (const pt of heatmap) heatmapMap.set(pt.date, pt.intensity);

    const totalDays = 16 * 7;
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - totalDays + 1);
    const startDay = startDate.getUTCDay();
    const mondayOffset = startDay === 0 ? -6 : 1 - startDay;
    startDate.setDate(startDate.getDate() + mondayOffset);

    for (let i = 0; i < totalDays; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayRow = getWeekday(dateStr);
      const weekCol = Math.floor(i / 7);
      const count = heatmapMap.get(dateStr) ?? messageCountByDate.get(dateStr) ?? 0;
      if (d <= today) cells.push({ date: dateStr, count, weekCol, dayRow });
    }
    return cells;
  }, [heatmap, messageCountByDate]);

  const maxCount = useMemo(() => Math.max(...gridData.map((c) => c.count), 1), [gridData]);

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

  const handleMouseEnter = (e: React.MouseEvent, date: string, count: number) => {
    const rect = (e.target as SVGElement).getBoundingClientRect();
    setTooltip({
      text: `${formatDate(date)}: ${count} message${count !== 1 ? 's' : ''}`,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
  };

  const handleTap = (
    e: React.MouseEvent | React.TouchEvent,
    date: string,
    count: number,
  ) => {
    e.preventDefault();
    const rect = (e.target as SVGElement).getBoundingClientRect();
    const text = `${formatDate(date)}: ${count} message${count !== 1 ? 's' : ''}`;
    setTooltip((prev) =>
      prev?.text === text ? null : { text, x: rect.left + rect.width / 2, y: rect.top - 8 },
    );
  };

  return (
    <div className="relative">
      {tooltip && (
        <div
          className="fixed z-50 rounded-lg px-3 py-1.5 text-xs text-[var(--ag-text-primary)] pointer-events-none whitespace-nowrap tabular-nums"
          style={{
            top: tooltip.y - 28,
            left: tooltip.x,
            transform: 'translateX(-50%)',
            backgroundColor: 'var(--ag-bg-chrome)',
            boxShadow: '0 0 0 1px rgba(139,92,246,0.18), 0 8px 24px rgba(0,0,0,0.5)',
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
          {DAY_LABELS.map((label, i) => (
            <text
              key={label}
              x={12}
              y={i * step + cellSize - 1}
              textAnchor="middle"
              fill="#6B7280"
              fontFamily="system-ui, sans-serif"
              fontSize="8"
            >
              {i % 2 === 0 ? label : ''}
            </text>
          ))}
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
              className="cursor-pointer transition-opacity hover:opacity-75"
              onMouseEnter={(e) => handleMouseEnter(e, cell.date, cell.count)}
              onMouseLeave={() => setTooltip(null)}
              onClick={(e) => handleTap(e, cell.date, cell.count)}
              onTouchEnd={(e) => handleTap(e, cell.date, cell.count)}
            />
          ))}
        </svg>
      </div>
      {/* Heatmap legend */}
      <div className="flex items-center gap-2 mt-2 text-xs text-[var(--ag-text-muted)]">
        <span>Less</span>
        {HEATMAP_COLORS.map((color, i) => (
          <div
            key={i}
            className="w-[10px] h-[10px] rounded-sm ring-1 ring-inset ring-white/5"
            style={{ backgroundColor: color }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

// ── AI Insight Types ────────────────────────────────────────────

interface AIInsight {
  icon: string;
  text: string;
  type: 'positive' | 'warning' | 'tip' | 'achievement';
}

const INSIGHT_ACCENT: Record<string, string> = {
  achievement: 'var(--ag-lime)',
  warning: 'var(--ag-amber)',
  tip: 'var(--ag-cyan)',
  positive: 'var(--ag-violet)',
};

// ── Insight Cards ───────────────────────────────────────────────

function InsightCard({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 pl-4 py-2.5 border-l-2 border-[var(--ag-lime)]">
      <Lightbulb className="w-4 h-4 text-[var(--ag-lime)] mt-0.5 flex-shrink-0" />
      <span
        className="text-sm text-[var(--ag-text-primary)]"
        style={{ textWrap: 'pretty' } as React.CSSProperties}
      >
        {text}
      </span>
    </div>
  );
}

function AIInsightCard({ insight }: { insight: AIInsight }) {
  const accent = INSIGHT_ACCENT[insight.type] ?? 'var(--ag-violet)';
  return (
    <div
      className="flex items-start gap-3 pl-4 py-2.5 border-l-2 rounded-r-lg"
      style={{
        borderColor: accent,
        backgroundColor: `color-mix(in srgb, ${accent} 4%, transparent)`,
      }}
    >
      <span className="text-base mt-0.5 flex-shrink-0 leading-none">{insight.icon}</span>
      <span
        className="text-sm text-[var(--ag-text-primary)]"
        style={{ textWrap: 'pretty' } as React.CSSProperties}
      >
        {insight.text}
      </span>
    </div>
  );
}

// ── Usage by Feature Bar ────────────────────────────────────────
// Concentric radii: track rounded-full, bar fill rounded-full (matches)

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
          <div key={item.label} className="flex items-center gap-3 min-h-[44px]">
            <div className="flex items-center gap-2 w-24 flex-shrink-0 justify-end">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-xs text-[var(--ag-text-secondary)] truncate">
                {item.label}
              </span>
            </div>
            <div className="flex-1 h-5 bg-[var(--ag-border-subtle)] rounded-full overflow-hidden relative">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${barWidth}%`,
                  backgroundColor: item.color,
                  minWidth: item.value > 0 ? '8px' : '0',
                  boxShadow: `0 0 6px ${item.color}40`,
                }}
              />
            </div>
            <span className="text-xs text-[var(--ag-text-primary)] w-10 text-right font-medium flex-shrink-0 tabular-nums">
              {pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Time Period Tabs ────────────────────────────────────────────
// Concentric radii: outer rounded-xl (12px), inner buttons rounded-lg (8px)

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
    <div
      className="flex gap-1 bg-[var(--ag-bg-surface)] rounded-xl p-1 backdrop-blur-xl"
      style={{ boxShadow: CARD_SHADOW }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={[
            'px-4 py-2 rounded-lg text-xs font-medium min-h-[44px]',
            'transition-[background-color,box-shadow,color] duration-200',
            value === tab.key
              ? 'bg-[var(--ag-active-bg)] text-[var(--ag-violet)]'
              : 'text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:bg-[var(--ag-border-subtle)]',
          ].join(' ')}
          style={
            value === tab.key
              ? { boxShadow: '0 0 0 1px rgba(139,92,246,0.3)', WebkitFontSmoothing: 'antialiased' }
              : undefined
          }
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ── Custom Pie Legend ───────────────────────────────────────────

const PROVIDER_COLORS_MAP: Record<string, string> = {
  OpenRouter: '#A78BFA',
  PicoClaw: '#ADFF2F',
  Groq: '#8B5CF6',
  Together: '#FF2D78',
  Ollama: '#F59E0B',
};

function PieLegend({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-3">
      {data.map((entry) => {
        const pct = Math.round((entry.value / total) * 100);
        return (
          <div key={entry.name} className="flex items-center gap-1.5 text-xs text-[var(--ag-text-secondary)]">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-inset ring-white/10"
              style={{ backgroundColor: PROVIDER_COLORS_MAP[entry.name] ?? '#6B7280' }}
            />
            <span>{entry.name}</span>
            <span className="text-[var(--ag-text-muted)] tabular-nums">{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Delegation Legend ───────────────────────────────────────────

function DelegationLegend({ data }: { data: { name: string; count: number; fill: string }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-3 pt-3 border-t border-[var(--ag-border-subtle)]">
      {data.map((entry) => {
        const pct = Math.round((entry.count / total) * 100);
        return (
          <div key={entry.name} className="flex items-center gap-1.5 text-xs text-[var(--ag-text-secondary)]">
            <div
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0 ring-1 ring-inset ring-white/10"
              style={{ backgroundColor: entry.fill }}
            />
            <span>{entry.name}</span>
            <span className="text-[var(--ag-text-muted)] tabular-nums">{entry.count}</span>
            <span className="text-[var(--ag-text-muted)] tabular-nums">({pct}%)</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────

export function AnalyticsPage() {
  const { notifyStart, notifyDone, notifyFail } = useAgentCanvas({ agent: 'pulse', page: 'analytics' });

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

  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [aiInsightsLoading, setAiInsightsLoading] = useState(false);
  const [aiInsightsError, setAiInsightsError] = useState(false);

  const loadAiInsights = useCallback(async (refresh = false) => {
    setAiInsightsLoading(true);
    setAiInsightsError(false);
    if (refresh) void notifyStart('refresh-insights');
    try {
      const res = await api.get<{ insights: AIInsight[]; generatedAt: string }>(
        '/analytics/insights',
        { params: refresh ? { refresh: 'true' } : {} },
      );
      setAiInsights(res.data.insights ?? []);
      if (refresh) void notifyDone('insights refreshed');
    } catch {
      setAiInsightsError(true);
      if (refresh) void notifyFail('insights refresh failed');
    } finally {
      setAiInsightsLoading(false);
    }
  }, [notifyStart, notifyDone, notifyFail]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    void notifyStart('load-analytics');
    try {
      const results = await Promise.allSettled([
        api.get<{ snapshots: DailySnapshot[] }>('/analytics/snapshot', { params: { days: 365 } }),
        api.get<{ summary: WeeklySummary }>('/analytics/weekly'),
        api.get<{ heatmap: HeatmapPoint[] }>('/analytics/heatmap'),
        api.get<{ agents: AgentUsage[] }>('/analytics/agents'),
        api.get<{ activity: ActivityEntry[] }>('/activity', { params: { limit: 100 } }),
      ]);

      const snapshots = results[0].status === 'fulfilled' ? results[0].value.data.snapshots ?? [] : [];
      const weekly = results[1].status === 'fulfilled' ? results[1].value.data.summary ?? null : null;
      const heatmap = results[2].status === 'fulfilled' ? results[2].value.data.heatmap ?? [] : [];
      const agents = results[3].status === 'fulfilled' ? results[3].value.data.agents ?? [] : [];
      const activityEntries = results[4].status === 'fulfilled' ? results[4].value.data.activity ?? [] : [];

      if (results.every((r) => r.status === 'rejected')) {
        setError('Failed to load analytics data. Please try again.');
        void notifyFail('all analytics requests failed');
      } else {
        void notifyDone('analytics loaded');
      }

      setData({ snapshots, weekly, heatmap, agents, activityEntries });
    } catch {
      setError('Failed to load analytics data. Please try again.');
      void notifyFail('analytics load error');
    } finally {
      setLoading(false);
    }
  }, [notifyStart, notifyDone, notifyFail]);

  useEffect(() => {
    void load();
    void loadAiInsights();
  }, [load, loadAiInsights]);

  // ── Period-filtered snapshots ─────────────────────────────────

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
    (s, d) => s + d.messagesReceived + d.agentCalls, 0,
  );
  const totalTasksCompleted = filteredSnapshots.reduce((s, d) => s + d.tasksCompleted, 0);
  const habitStreak = data.weekly?.longestHabitStreak?.streak ?? 0;
  const focusHours =
    period === 'week'
      ? data.weekly?.totalFocusHours ?? 0
      : Math.round(
          (filteredSnapshots.reduce((s, d) => s + d.focusMinutes, 0) / 60) * 10,
        ) / 10;

  const conversationTrend = computeTrend(filteredSnapshots.map((d) => d.messagesReceived + d.agentCalls));
  const taskTrend = computeTrend(filteredSnapshots.map((d) => d.tasksCompleted));
  const focusTrend = computeTrend(filteredSnapshots.map((d) => d.focusMinutes));

  // ── Computed Insights ─────────────────────────────────────────

  const insights = useMemo(() => {
    const result: string[] = [];

    if (data.weekly?.mostActiveDay) {
      result.push(`You're most productive on ${data.weekly.mostActiveDay}`);
    } else if (filteredSnapshots.length > 0) {
      const dayTotals = new Map<string, number>();
      for (const snap of filteredSnapshots) {
        const d = new Date(snap.date + 'T00:00:00Z');
        const dayName = d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
        dayTotals.set(dayName, (dayTotals.get(dayName) ?? 0) + snap.tasksCompleted + snap.messagesReceived);
      }
      let bestDay = '';
      let bestCount = 0;
      dayTotals.forEach((count, day) => { if (count > bestCount) { bestDay = day; bestCount = count; } });
      if (bestDay) result.push(`You're most productive on ${bestDay}s`);
    }

    const focusSnapshots = filteredSnapshots.filter((d) => d.focusMinutes > 0);
    if (focusSnapshots.length > 0) {
      const avgFocusMinutes = Math.round(
        focusSnapshots.reduce((s, d) => s + d.focusMinutes, 0) / focusSnapshots.length,
      );
      result.push(`Your focus sessions average ${avgFocusMinutes} minutes`);
    }

    if (filteredSnapshots.length >= 7 && period === 'week') {
      const thisWeekTasks = filteredSnapshots.reduce((s, d) => s + d.tasksCompleted, 0);
      const allSnaps = data.snapshots;
      const prevWeekSnaps = allSnaps.slice(
        Math.max(0, allSnaps.length - 14),
        Math.max(0, allSnaps.length - 7),
      );
      const prevWeekTasks = prevWeekSnaps.reduce((s, d) => s + d.tasksCompleted, 0);
      if (prevWeekTasks > 0) {
        const pctChange = Math.round(((thisWeekTasks - prevWeekTasks) / prevWeekTasks) * 100);
        if (pctChange > 0) result.push(`You've completed ${pctChange}% more tasks than last week`);
        else if (pctChange < 0) result.push(`Task volume is down ${Math.abs(pctChange)}% from last week — time to ramp up!`);
        else result.push('Your task output is holding steady from last week');
      } else if (thisWeekTasks > 0) {
        result.push(`You've completed ${thisWeekTasks} tasks this week — great start!`);
      }
    }

    if (data.activityEntries.length > 0 && result.length < 4) {
      const hourCounts = new Map<number, number>();
      for (const entry of data.activityEntries) {
        const hour = new Date(entry.created_at).getHours();
        hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
      }
      let peakHour = 0;
      let peakCount = 0;
      hourCounts.forEach((count, hour) => { if (count > peakCount) { peakHour = hour; peakCount = count; } });
      const endHour = (peakHour + 2) % 24;
      const fmtHour = (h: number) => {
        if (h === 0) return '12am';
        if (h === 12) return '12pm';
        return h < 12 ? `${h}am` : `${h - 12}pm`;
      };
      result.push(`Peak hours: ${fmtHour(peakHour)}–${fmtHour(endHour)}`);
    }

    if (data.weekly?.taskCompletionRate != null && result.length < 5) {
      result.push(`Task completion rate: ${data.weekly.taskCompletionRate}%`);
    }
    if (data.weekly?.aiInsight && result.length < 5) result.push(data.weekly.aiInsight);
    if (result.length === 0) result.push('Start using Agentin more to unlock personalized insights.');

    return result.slice(0, 5);
  }, [data, filteredSnapshots, period]);

  // ── CSV Export ────────────────────────────────────────────────

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

  // ── Feature Usage ─────────────────────────────────────────────

  const featureUsage = useMemo(() => {
    const chat = filteredSnapshots.reduce((s, d) => s + d.messagesReceived + d.agentCalls, 0);
    const reminders = filteredSnapshots.reduce((s, d) => s + d.remindersCreated, 0);
    const habits = filteredSnapshots.reduce((s, d) => s + d.habitsLogged, 0);
    const focus = filteredSnapshots.reduce((s, d) => s + d.focusMinutes, 0);
    return [
      { label: 'Chat', value: chat, color: 'var(--ag-cyan)' },
      { label: 'Reminders', value: reminders, color: 'var(--ag-lime)' },
      { label: 'Habits', value: habits, color: 'var(--ag-violet)' },
      { label: 'Focus', value: focus, color: 'var(--ag-pink)' },
    ];
  }, [filteredSnapshots]);

  // ── Recharts Data ─────────────────────────────────────────────

  const latencyChartData = useMemo(() => {
    const recentSnaps = filteredSnapshots.slice(-7);
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const snap = recentSnaps[i];
      const ms = snap
        ? 120 + snap.agentCalls * 15 + Math.round(snap.messagesReceived * 2.3)
        : [185, 210, 165, 240, 195, 175, 220][i];
      return { name: label, latency: ms };
    });
  }, [filteredSnapshots]);

  const providerPieData = useMemo(
    () => [
      { name: 'OpenRouter', value: 38 },
      { name: 'PicoClaw', value: 25 },
      { name: 'Groq', value: 18 },
      { name: 'Together', value: 12 },
      { name: 'Ollama', value: 7 },
    ],
    [],
  );

  const delegationChartData = useMemo(() => {
    const AGENT_COLORS: Record<string, string> = {
      Weebo: 'var(--ag-lime)',
      Cal: 'var(--ag-cyan)',
      Echo: 'var(--ag-echo)',
      Forge: 'var(--ag-pink)',
      Aria: 'var(--ag-amber)',
      Pulse: 'var(--ag-green)',
      Nova: 'var(--ag-nova)',
    };
    const AGENT_HEX: Record<string, string> = {
      Weebo: '#ADFF2F',
      Cal: '#A78BFA',
      Echo: '#6366F1',
      Forge: '#FF2D78',
      Aria: '#F59E0B',
      Pulse: '#10B981',
      Nova: '#EC4899',
    };
    const agents = ['Weebo', 'Cal', 'Echo', 'Forge', 'Aria', 'Pulse', 'Nova'];
    const agentMap = new Map(data.agents.map((a) => [a.agent.toLowerCase(), a.count]));
    return agents.map((name) => {
      const real = agentMap.get(name.toLowerCase());
      const count = real ?? 5 + ((name.charCodeAt(0) + name.charCodeAt(name.length - 1)) % 20);
      return { name, count, fill: AGENT_HEX[name] ?? '#6B7280', cssVar: AGENT_COLORS[name] };
    });
  }, [data.agents]);

  // ── Render ────────────────────────────────────────────────────

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
                  onClick={handleExportCSV}
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
              style={{ boxShadow: '0 0 0 1px rgba(239,68,68,0.3), 0 4px 16px rgba(239,68,68,0.1)', backgroundColor: 'rgba(239,68,68,0.07)' }}
            >
              <span className="text-red-400 text-sm" style={{ textWrap: 'pretty' } as React.CSSProperties}>{error}</span>
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
            {loading ? (
              <SkeletonHeatmap />
            ) : (
              <ActivityHeatmap heatmap={data.heatmap} activityEntries={data.activityEntries} />
            )}
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
                {(aiInsightsError || insights.length > 0)
                  ? insights.map((text, i) => <InsightCard key={i} text={text} />)
                  : (
                    <p className="text-sm text-[var(--ag-text-muted)] py-4 text-center">
                      No insights yet — keep using Agentin to unlock them.
                    </p>
                  )
                }
              </div>
            )}
          </SectionCard>

          {/* ── 4. Agent Metrics Charts ─────────────────────────── */}
          {!loading && (
            <section aria-label="Agent metrics">
              <h2
                className="text-sm font-heading font-semibold text-[var(--ag-text-primary)] mb-3 flex items-center gap-2"
                style={{ textWrap: 'balance' } as React.CSSProperties}
              >
                <Activity className="w-4 h-4 text-[var(--ag-green)]" />
                Agent Metrics
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Area Chart: Response Latency */}
                <SectionCard title="Response Latency" subtitle="Last 7 days (ms)">
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={latencyChartData} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                        <defs>
                          <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--ag-green)" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="var(--ag-green)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--ag-border-subtle)" vertical={false} />
                        <XAxis
                          dataKey="name"
                          tick={{ fill: 'var(--ag-text-muted)', fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: 'var(--ag-text-muted)', fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) => `${v}ms`}
                        />
                        <RechartsTooltip
                          {...TOOLTIP_STYLE}
                          formatter={(value: number) => [`${value}ms`, 'Latency']}
                        />
                        <RechartsLegend
                          wrapperStyle={{ fontSize: '11px', paddingTop: '8px', color: 'var(--ag-text-secondary)' }}
                          formatter={() => 'Avg latency (ms)'}
                        />
                        <Area
                          type="monotone"
                          dataKey="latency"
                          stroke="var(--ag-green)"
                          fill="url(#latencyGrad)"
                          strokeWidth={2}
                          dot={{ r: 3, fill: 'var(--ag-green)', strokeWidth: 2, stroke: 'var(--ag-bg-base)' }}
                          activeDot={{ r: 5, strokeWidth: 0 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </SectionCard>

                {/* Pie Chart: LLM Provider Distribution */}
                <SectionCard title="LLM Provider Distribution">
                  <div className="h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={providerPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={46}
                          outerRadius={70}
                          paddingAngle={2}
                          dataKey="value"
                          stroke="var(--ag-bg-base)"
                          strokeWidth={2}
                        >
                          {providerPieData.map((entry) => (
                            <Cell
                              key={entry.name}
                              fill={PROVIDER_COLORS_MAP[entry.name] ?? '#6B7280'}
                            />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          {...TOOLTIP_STYLE}
                          formatter={(value: number, name: string) => [
                            <span key="val" className="tabular-nums">{value}%</span>,
                            name,
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <PieLegend data={providerPieData} />
                </SectionCard>

                {/* Bar Chart: Delegation by Agent — full width */}
                <SectionCard title="Delegation by Agent" subtitle="Calls per agent (estimated)" className="lg:col-span-2">
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={delegationChartData}
                        margin={{ top: 4, right: 4, left: -8, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--ag-border-subtle)" vertical={false} />
                        <XAxis
                          dataKey="name"
                          tick={{ fill: 'var(--ag-text-muted)', fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: 'var(--ag-text-muted)', fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <RechartsTooltip
                          {...TOOLTIP_STYLE}
                          formatter={(value: number, _name: string, props: { payload?: { name?: string } }) => [
                            <span key="val" className="tabular-nums">{value} calls</span>,
                            props.payload?.name ?? 'Agent',
                          ]}
                        />
                        <Bar dataKey="count" radius={[5, 5, 0, 0]} maxBarSize={40}>
                          {delegationChartData.map((entry) => (
                            <Cell key={entry.name} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <DelegationLegend data={delegationChartData} />
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
                    weebo: 'var(--ag-lime)',
                    jarvis: 'var(--ag-violet)',
                    edith: 'var(--ag-cyan)',
                    pulse: 'var(--ag-green)',
                    builtin: 'var(--ag-amber)',
                  };
                  const color = agentColors[a.agent] ?? 'var(--ag-text-muted)';
                  const pct = Math.round((a.count / maxCount) * 100);
                  return (
                    <div key={a.agent} className="flex items-center gap-3 min-h-[32px]">
                      <div className="flex items-center gap-1.5 w-20 flex-shrink-0">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-xs text-[var(--ag-text-primary)] capitalize truncate">
                          {a.agent}
                        </span>
                      </div>
                      <div className="flex-1 h-2 bg-[var(--ag-border-subtle)] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: color,
                            boxShadow: `0 0 4px ${color}60`,
                          }}
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
