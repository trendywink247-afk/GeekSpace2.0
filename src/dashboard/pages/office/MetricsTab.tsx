// src/dashboard/pages/office/MetricsTab.tsx
import { useState, useEffect } from 'react';
import { agentTasksService, agentCommsService } from '@/services/api';
import { AGENT_COLORS, AGENT_META, C, CORE_AGENTS } from './constants';
import type { AgentId, CoreAgentId } from './types';

interface TaskStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  completedToday: number;
}

interface CommStats {
  total: number;
  unacknowledged: number;
  byAgent: Record<string, number>;
  byType: Record<string, number>;
}

interface CounterCard {
  label: string;
  value: number;
  icon: string;
  accent: string;
}

export default function MetricsTab({ taskStats: extTaskStats, commStats: extCommStats }: { taskStats?: TaskStats | null; commStats?: CommStats | null }) {
  const [taskStats, setTaskStats] = useState<TaskStats | null>(null);
  const [commStats, setCommStats] = useState<CommStats | null>(null);

  // Use external data when available (from unified 5s poll)
  useEffect(() => {
    if (extTaskStats) setTaskStats(extTaskStats as TaskStats);
    if (extCommStats) setCommStats(extCommStats as CommStats);
  }, [extTaskStats, extCommStats]);
  const [agentBreakdown, setAgentBreakdown] = useState<Record<CoreAgentId, number>>({ weebo: 0, edith: 0, jarvis: 0 });
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const [tasksRes, commsRes] = await Promise.all([
        agentTasksService.stats(),
        agentCommsService.stats(),
      ]);
      setTaskStats(tasksRes.data);
      setCommStats(commsRes.data);

      // Fetch per-agent task counts for bar chart
      const agentCounts: Record<CoreAgentId, number> = { weebo: 0, edith: 0, jarvis: 0 };
      const agentResults = await Promise.all(
        CORE_AGENTS.map((id) => agentTasksService.stats(id))
      );
      CORE_AGENTS.forEach((id, i) => {
        agentCounts[id] = agentResults[i].data.total;
      });
      setAgentBreakdown(agentCounts);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-[#00F0FF]/30 border-t-[#00F0FF] rounded-full animate-spin" />
      </div>
    );
  }

  const counters: CounterCard[] = [
    { label: 'Tasks Today', value: taskStats?.completedToday ?? 0, icon: '\u2705', accent: C.green },
    { label: 'Total Tasks', value: taskStats?.total ?? 0, icon: '\uD83D\uDCCB', accent: C.cyan },
    { label: 'Messages', value: commStats?.total ?? 0, icon: '\uD83D\uDCAC', accent: C.purple },
    { label: 'Pending', value: taskStats?.pending ?? 0, icon: '\u23F3', accent: '#F59E0B' },
  ];

  const maxAgent = Math.max(...Object.values(agentBreakdown), 1);

  return (
    <div className="flex flex-col gap-4 p-3">
      {/* Counter Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {counters.map((c) => (
          <div
            key={c.label}
            className="rounded-lg p-3 text-center"
            style={{ background: C.card, border: `1px solid rgba(0,240,255,0.05)` }}
          >
            <span className="text-lg block mb-1">{c.icon}</span>
            <span className="text-xl font-bold block" style={{ color: c.accent }}>
              {c.value}
            </span>
            <span className="text-[10px]" style={{ color: C.muted }}>{c.label}</span>
          </div>
        ))}
      </div>

      {/* Tasks by Agent — Bar Chart */}
      <div
        className="rounded-lg p-3"
        style={{ background: C.card, border: `1px solid rgba(0,240,255,0.05)` }}
      >
        <h3 className="text-xs font-medium mb-3" style={{ color: C.text }}>Tasks by Agent</h3>
        <div className="flex flex-col gap-2.5">
          {CORE_AGENTS.map((id) => {
            const count = agentBreakdown[id];
            const pct = maxAgent > 0 ? (count / maxAgent) * 100 : 0;
            const color = AGENT_COLORS[id as AgentId];
            const meta = AGENT_META[id as AgentId];

            return (
              <div key={id} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 w-20 flex-shrink-0">
                  <span className="text-sm">{meta.emoji}</span>
                  <span className="text-[10px] font-medium capitalize" style={{ color }}>{id}</span>
                </div>
                <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: C.elevated }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(pct, 2)}%`, background: color, opacity: 0.7 }}
                  />
                </div>
                <span className="text-[10px] font-mono w-6 text-right" style={{ color: C.muted }}>
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Comms by Type */}
      <div
        className="rounded-lg p-3"
        style={{ background: C.card, border: `1px solid rgba(0,240,255,0.05)` }}
      >
        <h3 className="text-xs font-medium mb-3" style={{ color: C.text }}>Communication Types</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(commStats?.byType ?? {}).map(([type, count]) => {
            const typeColors: Record<string, string> = {
              info: C.cyan,
              delegation: '#FFB800',
              alert: '#EF4444',
              request: C.purple,
              response: C.green,
            };
            const color = typeColors[type] ?? C.muted;

            return (
              <div
                key={type}
                className="rounded-lg px-3 py-2 text-center"
                style={{ background: `${color}10`, border: `1px solid ${color}20` }}
              >
                <span className="text-sm font-bold block" style={{ color }}>{count}</span>
                <span className="text-[9px] capitalize" style={{ color: C.muted }}>{type}</span>
              </div>
            );
          })}
          {Object.keys(commStats?.byType ?? {}).length === 0 && (
            <p className="text-[10px]" style={{ color: C.dim }}>No data yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
