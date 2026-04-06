// ── Types ───────────────────────────────────────────────────────

export type TimePeriod = 'week' | 'month' | 'all';

export interface DailySnapshot {
  date: string;
  tasksCompleted: number;
  remindersCreated: number;
  messagesReceived: number;
  focusMinutes: number;
  habitsLogged: number;
  agentCalls: number;
  notesCreated: number;
}

export interface WeeklySummary {
  topAgent: string;
  totalFocusHours: number;
  taskCompletionRate: number;
  longestHabitStreak: { name: string; streak: number } | null;
  mostActiveDay: string;
  inboxTriagedCount: number;
  workflowsRun: number;
  aiInsight: string;
}

export interface HeatmapPoint {
  date: string;
  intensity: number;
}

export interface AgentUsage {
  agent: string;
  count: number;
}

export interface ActivityEntry {
  id: string;
  action: string;
  details: string;
  icon: string;
  created_at: string;
}

export interface AnalyticsData {
  snapshots: DailySnapshot[];
  weekly: WeeklySummary | null;
  heatmap: HeatmapPoint[];
  agents: AgentUsage[];
  activityEntries: ActivityEntry[];
}

export interface AIInsight {
  icon: string;
  text: string;
  type: 'positive' | 'warning' | 'tip' | 'achievement';
}

// ── Design Tokens ───────────────────────────────────────────────

export const CARD_SHADOW =
  '0 0 0 1px rgba(255,255,255,0.06), 0 4px 16px rgba(0,0,0,0.35), 0 0 12px rgba(139,92,246,0.06)';
export const CARD_SHADOW_HOVER =
  '0 0 0 1px rgba(139,92,246,0.28), 0 6px 24px rgba(0,0,0,0.45), 0 0 24px rgba(139,92,246,0.12)';

export const HEATMAP_EMPTY = '#0C0C18';
export const HEATMAP_COLORS = [
  HEATMAP_EMPTY,
  'rgba(139,92,246,0.2)',
  'rgba(139,92,246,0.5)',
  'rgba(139,92,246,0.8)',
  'rgba(139,92,246,1)',
];

export const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const TOOLTIP_STYLE = {
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

export const PROVIDER_COLORS_MAP: Record<string, string> = {
  OpenRouter: '#A78BFA',
  PicoClaw: '#ADFF2F',
  Groq: '#8B5CF6',
  Together: '#FF2D78',
  Ollama: '#F59E0B',
};

export const INSIGHT_ACCENT: Record<string, string> = {
  achievement: 'var(--ag-lime)',
  warning: 'var(--ag-amber)',
  tip: 'var(--ag-cyan)',
  positive: 'var(--ag-violet)',
};

// ── Animation Variants ──────────────────────────────────────────

export const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

export const cardVariants = {
  hidden: { opacity: 0, y: 14, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, duration: 0.45, bounce: 0 },
  },
};

// ── Utility Functions ───────────────────────────────────────────

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function getWeekday(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay();
  return day === 0 ? 6 : day - 1;
}

export function computeTrend(data: number[]): 'up' | 'down' | 'flat' {
  if (data.length < 2) return 'flat';
  const mid = Math.floor(data.length / 2);
  const first = data.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
  const second = data.slice(mid).reduce((a, b) => a + b, 0) / (data.length - mid);
  if (second > first * 1.05) return 'up';
  if (second < first * 0.95) return 'down';
  return 'flat';
}
