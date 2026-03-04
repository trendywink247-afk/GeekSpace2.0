// AnalyticsPage.tsx -- Phase 102: Personal Analytics Dashboard
import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, RefreshCw, BarChart2, Activity, Zap, MessageCircle, FileText, Clock, Users } from 'lucide-react';
import api from '@/services/api';

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

interface TopicCount {
  topic: string;
  count: number;
}

const INTENSITY_COLORS = [
  'bg-[#1a1a2e]',
  'bg-[#00F0FF]/20',
  'bg-[#00F0FF]/45',
  'bg-[#00F0FF]/70',
  'bg-[#00F0FF]',
];

const AGENT_COLORS: Record<string, string> = {
  weebo: '#00FF88',
  jarvis: '#BF5FFF',
  edith: '#00F0FF',
  builtin: '#F59E0B',
};

function Sparkline({ data, color = '#00F0FF' }: { data: number[]; color?: string }) {
  if (!data.length) return <div className="h-12 flex items-center text-[#6B7280] text-xs">No data</div>;
  const max = Math.max(...data, 1);
  const w = 300;
  const h = 48;
  const pts = data.map((v, i) => `${(i / Math.max(data.length - 1, 1)) * w},${h - (v / max) * h}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12" preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="2" points={pts} />
    </svg>
  );
}

function HeatmapGrid({ points }: { points: HeatmapPoint[] }) {
  const [tooltip, setTooltip] = useState<{ date: string; intensity: number; x: number; y: number } | null>(null);
  if (!points.length) return null;

  const weeks: HeatmapPoint[][] = [];
  let week: HeatmapPoint[] = [];
  const firstDay = new Date(points[0].date + 'T00:00:00Z').getUTCDay();
  for (let i = 0; i < firstDay; i++) week.push({ date: '', intensity: -1 });
  for (const pt of points) {
    week.push(pt);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length) { while (week.length < 7) week.push({ date: '', intensity: -1 }); weeks.push(week); }

  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div className="overflow-x-auto">
      {tooltip && (
        <div
          className="fixed z-50 bg-[#0e0e1a] border border-[#00F0FF]/30 rounded px-2 py-1 text-xs text-[#F4F6FF] pointer-events-none"
          style={{ top: tooltip.y - 32, left: tooltip.x - 60 }}
        >
          {tooltip.date} &mdash; {tooltip.intensity} action{tooltip.intensity !== 1 ? 's' : ''}
        </div>
      )}
      <div className="flex gap-1">
        <div className="flex flex-col gap-1 mr-1 mt-5">
          {dayLabels.map((d, i) => (
            <div key={i} className="h-3 text-[10px] text-[#6B7280] leading-3">{i % 2 === 1 ? d : ''}</div>
          ))}
        </div>
        <div className="flex gap-1">
          {weeks.map((wk, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {wk.map((pt, di) => (
                <div
                  key={di}
                  className={`w-3 h-3 rounded-sm cursor-pointer transition-opacity ${pt.intensity < 0 ? 'opacity-0' : INTENSITY_COLORS[Math.min(Math.max(pt.intensity, 0), 4)]}`}
                  onMouseEnter={(e) => pt.intensity >= 0 && setTooltip({ date: pt.date, intensity: pt.intensity, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setTooltip(null)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2 text-xs text-[#6B7280]">
        <span>Less</span>
        {INTENSITY_COLORS.map((cls, i) => (
          <div key={i} className={`w-3 h-3 rounded-sm ${cls}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color = '#00F0FF',
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <div className="bg-[#0e0e1a] border border-[#1a1a2e] rounded-xl p-4 flex items-center gap-3">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: color + '22' }}
      >
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div>
        <div className="text-lg font-bold text-[#F4F6FF]">{value}</div>
        <div className="text-xs text-[#6B7280]">{label}</div>
      </div>
    </div>
  );
}

export function AnalyticsPage() {
  const [snapshots, setSnapshots] = useState<DailySnapshot[]>([]);
  const [weekly, setWeekly] = useState<WeeklySummary | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([]);
  const [agents, setAgents] = useState<AgentUsage[]>([]);
  const [topics, setTopics] = useState<TopicCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [snapRes, weekRes, heatRes, agentRes, topicRes] = await Promise.all([
        api.get<{ snapshots: DailySnapshot[] }>('analytics/snapshot'),
        api.get<{ summary: WeeklySummary }>('analytics/weekly'),
        api.get<{ heatmap: HeatmapPoint[] }>('analytics/heatmap'),
        api.get<{ agents: AgentUsage[] }>('analytics/agents'),
        api.get<{ topics: TopicCount[] }>('analytics/topics'),
      ]);
      setSnapshots(snapRes.data.snapshots ?? []);
      setWeekly(weekRes.data.summary ?? null);
      setHeatmap(heatRes.data.heatmap ?? []);
      setAgents(agentRes.data.agents ?? []);
      setTopics(topicRes.data.topics ?? []);
    } catch {
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const last30 = snapshots.slice(-30);
  const last7 = snapshots.slice(-7);
  const totalAgentCalls = last7.reduce((s, d) => s + d.agentCalls, 0);
  const totalFocusMin = last30.reduce((s, d) => s + d.focusMinutes, 0);
  const totalHabits = last7.reduce((s, d) => s + d.habitsLogged, 0);
  const totalNotes = last7.reduce((s, d) => s + d.notesCreated, 0);
  const totalTasks = last30.reduce((s, d) => s + d.tasksCompleted, 0);
  const maxAgentCount = agents.reduce((m, a) => Math.max(m, a.count), 1);

  return (
    <div className="p-4 md:p-6 space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F4F6FF] flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-[#00F0FF]" />
            Personal Analytics
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">Your activity patterns across Agentin</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0e0e1a] border border-[#1a1a2e] text-[#6B7280] hover:text-[#00F0FF] hover:border-[#00F0FF]/30 transition-all text-sm min-h-[44px]"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">{error}</div>
      )}

      <section className="bg-[#0a0a12] border border-[#1a1a2e] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#F4F6FF] mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#00F0FF]" />
          Activity Heatmap &mdash; Last 365 Days
        </h2>
        {loading ? (
          <div className="h-24 flex items-center justify-center text-[#6B7280] text-sm">Loading...</div>
        ) : (
          <HeatmapGrid points={heatmap} />
        )}
      </section>

      {weekly && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-[#F4F6FF] flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-[#00FF88]" />
            This Week
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard label="Focus Hours" value={`${weekly.totalFocusHours}h`} icon={Clock} color="#00F0FF" />
            <StatCard label="Task Rate" value={`${weekly.taskCompletionRate}%`} icon={Zap} color="#00FF88" />
            <StatCard label="Habits" value={totalHabits} icon={Activity} color="#BF5FFF" />
            <StatCard label="Agent Chats" value={totalAgentCalls} icon={MessageCircle} color="#F59E0B" />
            <StatCard label="Notes" value={totalNotes} icon={FileText} color="#EC4899" />
          </div>

          {agents.length > 0 && (
            <div className="bg-[#0a0a12] border border-[#1a1a2e] rounded-xl p-5">
              <h3 className="text-xs font-semibold text-[#6B7280] mb-3 flex items-center gap-2">
                <Users className="w-3.5 h-3.5" />
                Agent Usage (30 days)
              </h3>
              <div className="space-y-3">
                {agents.map((a) => (
                  <div key={a.agent} className="flex items-center gap-3">
                    <span className="text-xs text-[#F4F6FF] w-16 capitalize">{a.agent}</span>
                    <div className="flex-1 h-2 bg-[#1a1a2e] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${(a.count / maxAgentCount) * 100}%`, backgroundColor: AGENT_COLORS[a.agent] ?? '#6B7280' }}
                      />
                    </div>
                    <span className="text-xs text-[#6B7280] w-8 text-right">{a.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-[#F59E0B]/5 border border-[#F59E0B]/20 rounded-xl p-4">
            <div className="text-sm text-[#F4F6FF] flex gap-2">
              <span>&#128161;</span>
              <span>{weekly.aiInsight}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B7280]">
            <span className="px-2 py-1 rounded-full bg-[#BF5FFF]/20 text-[#BF5FFF] font-medium">{weekly.mostActiveDay}</span>
            <span>is your most active day</span>
            {weekly.longestHabitStreak && (
              <>
                <span className="mx-1">&bull;</span>
                <span className="px-2 py-1 rounded-full bg-[#00FF88]/20 text-[#00FF88] font-medium">{weekly.longestHabitStreak.name}</span>
                <span>{weekly.longestHabitStreak.streak}-day streak</span>
              </>
            )}
          </div>
        </section>
      )}

      {last30.length > 1 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-[#F4F6FF] flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#EC4899]" />
            30-Day Trends
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#0a0a12] border border-[#1a1a2e] rounded-xl p-4">
              <div className="text-xs text-[#6B7280] mb-2 flex items-center justify-between">
                <span>Tasks Completed</span>
                <span className="text-[#00FF88]">{totalTasks} total</span>
              </div>
              <Sparkline data={last30.map((d) => d.tasksCompleted)} color="#00FF88" />
            </div>
            <div className="bg-[#0a0a12] border border-[#1a1a2e] rounded-xl p-4">
              <div className="text-xs text-[#6B7280] mb-2 flex items-center justify-between">
                <span>Focus Minutes</span>
                <span className="text-[#00F0FF]">{Math.round((totalFocusMin / 60) * 10) / 10}h total</span>
              </div>
              <Sparkline data={last30.map((d) => d.focusMinutes)} color="#00F0FF" />
            </div>
          </div>
        </section>
      )}

      {topics.length > 0 && (
        <section className="bg-[#0a0a12] border border-[#1a1a2e] rounded-xl p-5">
          <h3 className="text-xs font-semibold text-[#6B7280] mb-3">Top Topics from Memories &amp; Notes</h3>
          <div className="flex flex-wrap gap-2">
            {topics.map((t) => (
              <span
                key={t.topic}
                className="px-2 py-1 rounded-full text-xs border border-[#00F0FF]/20 text-[#00F0FF] bg-[#00F0FF]/5 hover:bg-[#00F0FF]/10 transition-colors"
              >
                {t.topic} <span className="text-[#6B7280]">{t.count}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      <p className="text-xs text-[#6B7280] text-center pb-4">
        Weekly report sent every Sunday at 7 PM via Telegram
      </p>
    </div>
  );
}
// Wed Mar  4 15:36:07 UTC 2026
