// src/dashboard/pages/office/MetricsTab.tsx
import { AGENT_COLORS, AGENT_META, C } from '../constants';
import type { AgentId } from '../entities/types';

/** All 9 agent IDs for the activity breakdown. */
const ALL_AGENTS: AgentId[] = ['weebo', 'edith', 'jarvis', 'aria', 'forge', 'pulse', 'echo', 'cal', 'nova'];

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

interface DelegationStatus {
  used: number;
  limit: number;
  remaining: number;
  plan: string;
}

export default function MetricsTab({ taskStats, commStats, delegationStatus }: { taskStats?: TaskStats | null; commStats?: CommStats | null; delegationStatus?: DelegationStatus | null }) {
  // Show loading only if props haven't arrived yet
  if (!taskStats && !commStats) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-[#A78BFA]/30 border-t-[#A78BFA] rounded-full animate-spin" />
      </div>
    );
  }

  const counters: CounterCard[] = [
    { label: 'Tasks Today', value: taskStats?.completedToday ?? 0, icon: '\u2705', accent: C.green },
    { label: 'Total Tasks', value: taskStats?.total ?? 0, icon: '\uD83D\uDCCB', accent: C.cyan },
    { label: 'Messages', value: commStats?.total ?? 0, icon: '\uD83D\uDCAC', accent: C.purple },
    { label: 'Pending', value: taskStats?.pending ?? 0, icon: '\u23F3', accent: '#F59E0B' },
  ];

  // Derive per-agent breakdown from commStats.byAgent — all 9 agents
  const agentBreakdown: Record<string, number> = {};
  for (const id of ALL_AGENTS) {
    agentBreakdown[id] = commStats?.byAgent?.[id] ?? 0;
  }
  const maxAgent = Math.max(...Object.values(agentBreakdown), 1);

  return (
    <div className="flex flex-col gap-4 p-3">
      {/* Counter Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {counters.map((c) => (
          <div
            key={c.label}
            className="rounded-lg p-2 md:p-3 text-center"
            style={{ background: C.card, border: `1px solid rgba(139,92,246,0.05)` }}
          >
            <span className="text-base md:text-lg block mb-0.5">{c.icon}</span>
            <span className="text-lg md:text-xl font-bold block" style={{ color: c.accent }}>
              {c.value}
            </span>
            <span className="text-[9px] md:text-[10px]" style={{ color: C.muted }}>{c.label}</span>
          </div>
        ))}
      </div>

      {/* Delegation Meter */}
      {delegationStatus && (
        <div
          className="rounded-lg p-3"
          style={{ background: C.card, border: `1px solid rgba(139,92,246,0.05)` }}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-medium" style={{ color: C.text }}>Delegations Today</h3>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full capitalize"
              style={{ background: `${C.cyan}15`, color: C.cyan, border: `1px solid ${C.cyan}30` }}>
              {delegationStatus.plan}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: C.elevated }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min((delegationStatus.used / delegationStatus.limit) * 100, 100)}%`,
                  background: delegationStatus.remaining <= 2
                    ? '#EF4444'
                    : delegationStatus.remaining <= 5
                    ? '#F59E0B'
                    : C.cyan,
                }}
              />
            </div>
            <span className="text-[10px] font-mono flex-shrink-0" style={{ color: C.muted }}>
              {delegationStatus.used}/{delegationStatus.limit}
            </span>
          </div>
          {delegationStatus.remaining <= 2 && (
            <p className="text-[9px] mt-1.5" style={{ color: '#EF4444' }}>
              {delegationStatus.remaining === 0
                ? 'Limit reached — upgrade for more delegations'
                : `Only ${delegationStatus.remaining} left today`}
            </p>
          )}
        </div>
      )}

      {/* Activity by Agent -- Bar Chart */}
      <div
        className="rounded-lg p-3"
        style={{ background: C.card, border: `1px solid rgba(139,92,246,0.05)` }}
      >
        <h3 className="text-xs font-medium mb-3" style={{ color: C.text }}>Activity by Agent</h3>
        <div className="flex flex-col gap-1.5 md:gap-2.5">
          {ALL_AGENTS.map((id) => {
            const count = agentBreakdown[id];
            const pct = maxAgent > 0 ? (count / maxAgent) * 100 : 0;
            const color = AGENT_COLORS[id];
            const meta = AGENT_META[id];

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

      {/* Comms by Type — only shown when there's data */}
      {Object.keys(commStats?.byType ?? {}).length > 0 && (
        <div
          className="rounded-lg p-3"
          style={{ background: C.card, border: `1px solid rgba(139,92,246,0.05)` }}
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
          </div>
        </div>
      )}
    </div>
  );
}
