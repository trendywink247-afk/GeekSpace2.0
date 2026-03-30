// src/dashboard/pages/office/GoalsTab.tsx
// Goals Command Center tab for the office sidebar.
// Shows active goals with progress, current step, and quick actions.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Plus, ChevronRight } from 'lucide-react';
import { AGENT_META, AGENT_COLORS } from './constants';
import type { AgentId } from './types';
import { goalsService } from '@/services/api';
import type { GoalData, GoalStepData } from '@/services/api';

export function GoalsTab() {
  const navigate = useNavigate();
  const [goals, setGoals] = useState<GoalData[]>([]);
  const [steps, setSteps] = useState<Record<string, GoalStepData[]>>({});
  const [stats, setStats] = useState<{ total: number; active: number; completed: number; completionRate: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [goalsRes, statsRes] = await Promise.all([
          goalsService.list('active'),
          goalsService.stats(),
        ]);
        if (cancelled) return;
        const activeGoals = (goalsRes.data.goals ?? []).slice(0, 5);
        setGoals(activeGoals);
        setStats(statsRes.data);

        // Fetch steps for each goal
        const stepEntries = await Promise.all(
          activeGoals.map(async (g) => {
            try {
              const res = await goalsService.getSteps(g.id);
              return [g.id, res.data.steps ?? []] as const;
            } catch { return [g.id, []] as const; }
          }),
        );
        if (!cancelled) setSteps(Object.fromEntries(stepEntries));
      } catch { /* silent */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-3 p-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-white/[0.03]" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3 overflow-y-auto" style={{ maxHeight: 'calc(100% - 48px)' }}>
      {/* Stats header */}
      {stats && (
        <div className="flex items-center justify-between px-1 mb-1">
          <div className="flex items-center gap-2">
            <Target className="w-3.5 h-3.5 text-[var(--ag-cyan)]" />
            <span className="text-xs font-semibold text-[var(--ag-text-primary)]">
              {stats.active} active goal{stats.active !== 1 ? 's' : ''}
            </span>
          </div>
          {stats.completionRate > 0 && (
            <span className="text-[10px] text-[var(--ag-lime)]">
              {Math.round(stats.completionRate)}% completion rate
            </span>
          )}
        </div>
      )}

      {/* Goal cards */}
      {goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <Target className="w-8 h-8 text-[var(--ag-text-muted)]" />
          <p className="text-sm text-[var(--ag-text-secondary)]">No active goals</p>
          <button
            onClick={() => navigate('/dashboard/goals')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: 'rgba(0,240,255,0.1)',
              color: 'var(--ag-cyan)',
              border: '1px solid rgba(0,240,255,0.2)',
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            Set your first goal
          </button>
        </div>
      ) : (
        goals.map((goal) => {
          const agentId = (goal.assigned_agent || 'weebo') as AgentId;
          const meta = AGENT_META[agentId] ?? AGENT_META.weebo;
          const color = AGENT_COLORS[agentId] ?? '#00F0FF';
          const goalSteps = steps[goal.id] ?? [];
          const completedSteps = goalSteps.filter(s => s.status === 'completed' || s.status === 'skipped').length;
          const totalSteps = goalSteps.length;
          const currentStep = goalSteps.find(s => s.status === 'in_progress' || s.status === 'pending');
          const progress = goal.progress ?? (totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0);

          return (
            <button
              key={goal.id}
              onClick={() => navigate(`/dashboard/goals?id=${goal.id}`)}
              className="text-left w-full rounded-xl p-3 transition-all duration-200 hover:scale-[1.01] group"
              style={{
                background: 'rgba(12,12,30,0.4)',
                border: `1px solid ${color}15`,
                boxShadow: `0 2px 8px rgba(0,0,0,0.15)`,
              }}
            >
              {/* Title row */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">{meta.emoji}</span>
                <span className="text-xs font-semibold text-[var(--ag-text-primary)] truncate flex-1">
                  {goal.title}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-[var(--ag-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              {/* Progress bar */}
              <div className="h-1.5 rounded-full bg-white/[0.05] mb-1.5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(progress, 2)}%`,
                    background: `linear-gradient(90deg, ${color}80, ${color})`,
                    boxShadow: `0 0 8px ${color}40`,
                  }}
                />
              </div>

              {/* Step info */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--ag-text-secondary)] truncate max-w-[70%]">
                  {currentStep
                    ? `Step ${completedSteps + 1}/${totalSteps}: ${currentStep.title}`
                    : totalSteps > 0
                      ? `${completedSteps}/${totalSteps} steps done`
                      : 'No steps yet'}
                </span>
                <span className="text-[10px] font-medium" style={{ color }}>
                  {progress}%
                </span>
              </div>
            </button>
          );
        })
      )}

      {/* Create goal CTA */}
      {goals.length > 0 && (
        <button
          onClick={() => navigate('/dashboard/goals')}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-medium transition-all duration-200 hover:scale-[1.01]"
          style={{
            background: 'rgba(0,240,255,0.06)',
            border: '1px dashed rgba(0,240,255,0.2)',
            color: 'var(--ag-cyan)',
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          Create Goal
        </button>
      )}
    </div>
  );
}
