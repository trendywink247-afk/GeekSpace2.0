// ============================================================
// Goals Summary Card — Overview page widget
// Shows active goals with progress + quick CTA
// ============================================================

import { useState, useEffect } from 'react';
import { Target, ArrowRight, Plus, Sparkles, TrendingUp } from 'lucide-react';
import { SectionCard } from '@/components/agentin';
import { goalsService, type GoalData } from '@/services/api';

interface Props {
  onNavigate?: (page: string) => void;
}

export function GoalsSummaryCard({ onNavigate }: Props) {
  const [goals, setGoals] = useState<GoalData[]>([]);
  const [stats, setStats] = useState<{ active: number; completed: number; completionRate: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      goalsService.list('active').catch(() => ({ data: { goals: [] } })),
      goalsService.stats().catch(() => ({ data: { active: 0, completed: 0, completionRate: 0 } })),
    ]).then(([goalsRes, statsRes]) => {
      setGoals((goalsRes.data.goals || []).slice(0, 3));
      setStats(statsRes.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <SectionCard>
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-32 rounded bg-white/5" />
          <div className="h-16 rounded-lg bg-white/5" />
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-[#00F0FF]" />
          <span className="text-sm font-semibold text-[#E8E8F0]">Goals</span>
          {stats && stats.active > 0 && (
            <span className="text-xs text-[#6B7280]">
              {stats.active} active · {Math.round(stats.completionRate || 0)}% success
            </span>
          )}
        </div>
        <button
          onClick={() => onNavigate?.('goals')}
          className="flex items-center gap-1 text-xs text-[#00F0FF] hover:text-[#00D4E0] transition-colors"
        >
          View all <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="flex items-center gap-4 rounded-xl border border-dashed border-white/10 p-4">
          <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/10 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-[#8B5CF6]" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-[#E8E8F0] font-medium">Set your first goal</p>
            <p className="text-xs text-[#6B7280]">AI will plan the steps and help you achieve it</p>
          </div>
          <button
            onClick={() => onNavigate?.('goals')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-black"
            style={{ background: 'linear-gradient(135deg, #8B5CF6, #F59E0B)' }}
          >
            <Plus className="w-3 h-3 inline mr-1" />Create
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {goals.map(goal => (
            <div
              key={goal.id}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-white/3 transition-colors cursor-pointer"
              onClick={() => onNavigate?.('goals')}
            >
              {/* Mini progress ring */}
              <svg width="32" height="32" viewBox="0 0 32 32" className="flex-shrink-0">
                <circle cx="16" cy="16" r="13" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
                <circle
                  cx="16" cy="16" r="13" fill="none"
                  stroke="#00F0FF"
                  strokeWidth="2.5"
                  strokeDasharray={`${(goal.progress / 100) * 81.7} 81.7`}
                  strokeLinecap="round"
                  transform="rotate(-90 16 16)"
                />
              </svg>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-[#E8E8F0] truncate block">{goal.title}</span>
                <span className="text-xs text-[#6B7280]">{goal.progress}% complete</span>
              </div>
              <TrendingUp className="w-3.5 h-3.5 text-[#00F0FF] flex-shrink-0" />
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
