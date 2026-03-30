// ============================================================
// Goals Page — Agentic Goal Management
// Create, track, and execute AI-planned goals
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { PageShell, PageHeader, SectionCard } from '@/components/agentin';
import { GsTabBar } from '@/components/agentin';
import {
  Target, Plus, Brain, Play, CheckCircle2, Clock, Pause, AlertTriangle,
  ChevronDown, ChevronRight, Sparkles, Calendar, Trash2, RotateCcw,
  Loader2, Archive, TrendingUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { goalsService, type GoalData, type GoalStepData, type GoalEventData } from '@/services/api';
import { PullToRefreshWrapper } from '@/components/PullToRefreshWrapper';

// ---- Constants ----

const categoryConfig: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  general:   { label: 'General',   color: '#9CA3AF', bg: '#9CA3AF20', emoji: '🎯' },
  career:    { label: 'Career',    color: '#8B5CF6', bg: '#8B5CF620', emoji: '💼' },
  health:    { label: 'Health',    color: '#10B981', bg: '#10B98120', emoji: '🏃' },
  finance:   { label: 'Finance',   color: '#F59E0B', bg: '#F59E0B20', emoji: '💰' },
  learning:  { label: 'Learning',  color: '#3B82F6', bg: '#3B82F620', emoji: '📚' },
  creative:  { label: 'Creative',  color: '#EC4899', bg: '#EC489920', emoji: '🎨' },
  technical: { label: 'Technical', color: '#06B6D4', bg: '#06B6D420', emoji: '⚙️' },
  personal:  { label: 'Personal',  color: '#F97316', bg: '#F9731620', emoji: '🌟' },
};

const statusConfig: Record<string, { label: string; color: string; icon: typeof Target }> = {
  active:    { label: 'Active',    color: '#8B5CF6', icon: Play },
  paused:    { label: 'Paused',    color: '#F59E0B', icon: Pause },
  completed: { label: 'Completed', color: '#10B981', icon: CheckCircle2 },
  failed:    { label: 'Failed',    color: '#EF4444', icon: AlertTriangle },
  archived:  { label: 'Archived',  color: '#6B7280', icon: Archive },
};

const effortBadge: Record<string, { label: string; color: string }> = {
  low:    { label: 'Quick',  color: '#10B981' },
  medium: { label: 'Medium', color: '#F59E0B' },
  high:   { label: 'Deep',   color: '#EF4444' },
};

const agentEmojis: Record<string, string> = {
  weebo: '💚', edith: '🔷', jarvis: '🟣', aria: '🎨',
  forge: '🔧', pulse: '📊', echo: '💙', cal: '📅', nova: '🔭',
};

type FilterTab = 'all' | 'active' | 'completed' | 'paused';

// ---- Main Component ----

export function GoalsPage() {
  const [goals, setGoals] = useState<GoalData[]>([]);
  const [stats, setStats] = useState<{ total: number; active: number; completed: number; completionRate: number } | null>(null);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);
  const [goalDetails, setGoalDetails] = useState<Record<string, { steps: GoalStepData[]; events: GoalEventData[] }>>({});
  const [planningGoalId, setPlanningGoalId] = useState<string | null>(null);
  const [executingGoalId, setExecutingGoalId] = useState<string | null>(null);

  const loadGoals = useCallback(async () => {
    try {
      const [goalsRes, statsRes] = await Promise.all([
        goalsService.list(filter === 'all' ? undefined : filter),
        goalsService.stats(),
      ]);
      setGoals(goalsRes.data.goals || []);
      setStats(statsRes.data);
    } catch {
      // silently fail — show empty state
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { loadGoals(); }, [loadGoals]);

  const loadGoalDetails = async (goalId: string) => {
    if (goalDetails[goalId]) return;
    try {
      const [stepsRes, eventsRes] = await Promise.all([
        goalsService.getSteps(goalId),
        goalsService.getEvents(goalId, 20),
      ]);
      setGoalDetails(prev => ({
        ...prev,
        [goalId]: { steps: stepsRes.data.steps || [], events: eventsRes.data.events || [] },
      }));
    } catch { /* ignore */ }
  };

  const toggleExpand = (goalId: string) => {
    if (expandedGoal === goalId) {
      setExpandedGoal(null);
    } else {
      setExpandedGoal(goalId);
      loadGoalDetails(goalId);
    }
  };

  const handlePlan = async (goalId: string) => {
    setPlanningGoalId(goalId);
    try {
      const res = await goalsService.plan(goalId);
      setGoalDetails(prev => ({
        ...prev,
        [goalId]: { steps: res.data.steps || [], events: prev[goalId]?.events || [] },
      }));
      await loadGoals();
    } catch { /* ignore */ }
    setPlanningGoalId(null);
  };

  const handleExecuteNext = async (goalId: string) => {
    setExecutingGoalId(goalId);
    try {
      await goalsService.executeNext(goalId);
      const [stepsRes, eventsRes] = await Promise.all([
        goalsService.getSteps(goalId),
        goalsService.getEvents(goalId, 20),
      ]);
      setGoalDetails(prev => ({
        ...prev,
        [goalId]: { steps: stepsRes.data.steps || [], events: eventsRes.data.events || [] },
      }));
      await loadGoals();
    } catch { /* ignore */ }
    setExecutingGoalId(null);
  };

  const handleDelete = async (goalId: string) => {
    try {
      await goalsService.delete(goalId);
      setGoals(prev => prev.filter(g => g.id !== goalId));
      if (expandedGoal === goalId) setExpandedGoal(null);
    } catch { /* ignore */ }
  };

  const handleStatusChange = async (goalId: string, newStatus: string) => {
    try {
      await goalsService.update(goalId, { status: newStatus });
      await loadGoals();
    } catch { /* ignore */ }
  };

  const filteredGoals = goals;

  const filterTabs = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'completed', label: 'Completed' },
    { id: 'paused', label: 'Paused' },
  ];

  return (
    <PageShell>
      <PullToRefreshWrapper onRefresh={loadGoals}>
        <div className="space-y-6 pb-24 md:pb-6">
          <PageHeader
            title="Goals"
            subtitle="Set goals and let your agents plan & execute them"
            icon={Target}
            actions={
              <button
                onClick={() => setShowCreate(true)}
                className="gs-btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold min-h-[44px]"
              >
                <Plus className="w-4 h-4" /> New Goal
              </button>
            }
          />

          {/* Stats Bar */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Active', value: stats.active, color: '#8B5CF6', icon: Play },
                { label: 'Completed', value: stats.completed, color: '#10B981', icon: CheckCircle2 },
                { label: 'Total', value: stats.total, color: '#8B5CF6', icon: Target },
                { label: 'Success Rate', value: `${Math.round(stats.completionRate || 0)}%`, color: '#F59E0B', icon: TrendingUp },
              ].map(s => (
                <div
                  key={s.label}
                  className="gs-card flex items-center gap-3 px-4 py-3"
                  style={{ borderColor: `${s.color}25` }}
                >
                  <div className="gs-icon-pill" style={{ backgroundColor: `${s.color}15` }}>
                    <s.icon className="w-4 h-4" style={{ color: s.color }} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                    <div className="text-xs text-[#9CA3AF]">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Filter Tabs */}
          <GsTabBar
            tabs={filterTabs}
            activeTab={filter}
            onChange={(id) => setFilter(id as FilterTab)}
          />

          {/* Goals List */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 bg-white/[0.04] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filteredGoals.length === 0 ? (
            <SectionCard>
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="gs-icon-pill gs-icon-pill-violet w-16 h-16 mb-4">
                  <Target className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-semibold text-[#F4F6FF] mb-2">No goals yet</h3>
                <p className="text-[#9CA3AF] mb-6 max-w-md">
                  Set a goal and let your AI agents break it down into actionable steps, then execute them autonomously.
                </p>
                <button
                  onClick={() => setShowCreate(true)}
                  className="gs-btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
                >
                  <Sparkles className="w-4 h-4" /> Create Your First Goal
                </button>
              </div>
            </SectionCard>
          ) : (
            <div className="space-y-3">
              {filteredGoals.map(goal => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  expanded={expandedGoal === goal.id}
                  details={goalDetails[goal.id]}
                  planning={planningGoalId === goal.id}
                  executing={executingGoalId === goal.id}
                  onToggle={() => toggleExpand(goal.id)}
                  onPlan={() => handlePlan(goal.id)}
                  onExecute={() => handleExecuteNext(goal.id)}
                  onDelete={() => handleDelete(goal.id)}
                  onStatusChange={(s) => handleStatusChange(goal.id, s)}
                />
              ))}
            </div>
          )}
        </div>
      </PullToRefreshWrapper>

      {/* Create Goal Dialog */}
      <CreateGoalDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={async () => {
          setShowCreate(false);
          await loadGoals();
        }}
      />
    </PageShell>
  );
}

// ---- Goal Card Component ----

function GoalCard({
  goal, expanded, details, planning, executing,
  onToggle, onPlan, onExecute, onDelete, onStatusChange,
}: {
  goal: GoalData;
  expanded: boolean;
  details?: { steps: GoalStepData[]; events: GoalEventData[] };
  planning: boolean;
  executing: boolean;
  onToggle: () => void;
  onPlan: () => void;
  onExecute: () => void;
  onDelete: () => void;
  onStatusChange: (status: string) => void;
}) {
  const cat = categoryConfig[goal.category] || categoryConfig.general;
  const status = statusConfig[goal.status] || statusConfig.active;
  const StatusIcon = status.icon;
  const completedSteps = details?.steps.filter(s => s.status === 'completed').length ?? 0;
  const totalSteps = details?.steps.length ?? 0;
  const hasSteps = totalSteps > 0;
  const pendingSteps = details?.steps.filter(s => s.status === 'pending' || s.status === 'in_progress') ?? [];

  return (
    <div
      className="gs-card overflow-hidden transition-all duration-200"
      style={{ borderColor: expanded ? `${status.color}40` : undefined }}
    >
      {/* Card Header — always visible */}
      <div
        className="flex items-center gap-4 p-4 cursor-pointer select-none"
        onClick={onToggle}
      >
        {/* Progress Ring */}
        <div className="relative flex-shrink-0">
          <svg width="48" height="48" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
            <circle
              cx="24" cy="24" r="20" fill="none"
              stroke={status.color}
              strokeWidth="3"
              strokeDasharray={`${(goal.progress / 100) * 125.6} 125.6`}
              strokeLinecap="round"
              transform="rotate(-90 24 24)"
              style={{ transition: 'stroke-dasharray 0.5s ease' }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold" style={{ color: status.color }}>
            {goal.progress}%
          </span>
        </div>

        {/* Title + Meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-semibold text-[#F4F6FF] truncate">{goal.title}</h3>
            <Badge variant="outline" style={{ color: cat.color, borderColor: `${cat.color}40`, background: cat.bg, fontSize: '0.65rem' }}>
              {cat.emoji} {cat.label}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-[#6B7280]">
            <span className="flex items-center gap-1">
              <StatusIcon className="w-3 h-3" style={{ color: status.color }} />
              {status.label}
            </span>
            {goal.assigned_agent && (
              <span>{agentEmojis[goal.assigned_agent] || '🤖'} {goal.assigned_agent}</span>
            )}
            {goal.target_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(goal.target_date).toLocaleDateString()}
              </span>
            )}
            {hasSteps && (
              <span>{completedSteps}/{totalSteps} steps</span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="hidden sm:block w-24">
          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#10B981] transition-all duration-500"
              style={{ width: `${goal.progress}%` }}
            />
          </div>
        </div>

        {/* Expand Arrow */}
        {expanded ? (
          <ChevronDown className="w-5 h-5 text-[#6B7280] flex-shrink-0" />
        ) : (
          <ChevronRight className="w-5 h-5 text-[#6B7280] flex-shrink-0" />
        )}
      </div>

      {/* Expanded Detail */}
      {expanded && (
        <div className="border-t border-white/[0.06] px-4 pb-4">
          {/* Description */}
          {goal.description && (
            <p className="text-sm text-[#9CA3AF] mt-3 mb-4">{goal.description}</p>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            {!hasSteps && goal.status === 'active' && (
              <button
                onClick={onPlan}
                disabled={planning}
                className="gs-btn-ghost flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm"
              >
                {planning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
                {planning ? 'Planning...' : 'Plan with AI'}
              </button>
            )}
            {pendingSteps.length > 0 && goal.status === 'active' && (
              <button
                onClick={onExecute}
                disabled={executing}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ background: '#10B98120', color: '#10B981', border: '1px solid #10B98140' }}
              >
                {executing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                {executing ? 'Executing...' : 'Execute Next Step'}
              </button>
            )}
            {goal.status === 'active' && (
              <button
                onClick={() => onStatusChange('paused')}
                className="gs-btn-ghost flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-[#F59E0B] border-[#F59E0B]/30"
              >
                <Pause className="w-3.5 h-3.5" /> Pause
              </button>
            )}
            {goal.status === 'paused' && (
              <button
                onClick={() => onStatusChange('active')}
                className="gs-btn-ghost flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-[#8B5CF6] border-[#8B5CF6]/30"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Resume
              </button>
            )}
            <button
              onClick={onDelete}
              className="gs-btn-ghost flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-red-400 border-red-400/30 ml-auto"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>

          {/* Steps */}
          {details?.steps && details.steps.length > 0 && (
            <div className="space-y-2">
              <p className="gs-section-label mb-2">Steps</p>
              {details.steps.sort((a, b) => a.step_order - b.step_order).map(step => (
                <StepRow key={step.id} step={step} />
              ))}
            </div>
          )}

          {/* Events Timeline */}
          {details?.events && details.events.length > 0 && (
            <div className="mt-4">
              <p className="gs-section-label mb-2">Activity</p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {details.events.slice(0, 10).map(event => (
                  <div key={event.id} className="flex items-start gap-2 text-xs text-[#6B7280]">
                    <Clock className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span className="flex-1">{event.message}</span>
                    <span className="text-[#4B5563] flex-shrink-0">{timeAgo(event.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Step Row ----

function StepRow({ step }: { step: GoalStepData }) {
  const effort = effortBadge[step.effort] || effortBadge.medium;
  const isComplete = step.status === 'completed';
  const isFailed = step.status === 'failed';
  const isActive = step.status === 'in_progress';

  return (
    <div
      className="flex items-center gap-3 rounded-lg px-3 py-2"
      style={{
        background: isActive ? '#8B5CF608' : 'rgba(255,255,255,0.02)',
        borderLeft: `3px solid ${isComplete ? '#10B981' : isFailed ? '#EF4444' : isActive ? '#8B5CF6' : '#333'}`,
      }}
    >
      <div className="flex-shrink-0">
        {isComplete ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        ) : isActive ? (
          <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
        ) : isFailed ? (
          <AlertTriangle className="w-4 h-4 text-red-400" />
        ) : (
          <div className="w-4 h-4 rounded-full border-2 border-[#4B5563]" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <span className={`text-sm ${isComplete ? 'text-[#6B7280] line-through' : 'text-[#D1D5DB]'}`}>
          {step.title}
        </span>
      </div>
      <Badge variant="outline" style={{ color: effort.color, borderColor: `${effort.color}30`, fontSize: '0.6rem', padding: '1px 6px' }}>
        {effort.label}
      </Badge>
      {step.assigned_agent && (
        <span className="text-xs text-[#4B5563]">{agentEmojis[step.assigned_agent] || '🤖'}</span>
      )}
    </div>
  );
}

// ---- Create Goal Dialog ----

function CreateGoalDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [targetDate, setTargetDate] = useState('');
  const [autoPlan, setAutoPlan] = useState(true);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const res = await goalsService.create({
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        target_date: targetDate || undefined,
      });
      if (autoPlan && res.data.goal?.id) {
        await goalsService.plan(res.data.goal.id);
      }
      setTitle('');
      setDescription('');
      setCategory('general');
      setTargetDate('');
      onCreated();
    } catch { /* ignore */ }
    setCreating(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md bg-[#0C0C18] border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#F4F6FF]">
            <Target className="w-5 h-5 text-[#8B5CF6]" /> New Goal
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <label className="gs-section-label mb-1.5 block">What do you want to achieve?</label>
            <input
              placeholder="e.g. Learn TypeScript in 30 days"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="gs-input w-full px-3 py-2.5 rounded-xl text-sm"
              autoFocus
            />
          </div>
          <div>
            <label className="gs-section-label mb-1.5 block">Description (optional)</label>
            <textarea
              placeholder="Add more context for your AI agents..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="gs-input w-full px-3 py-2.5 rounded-xl text-sm resize-none"
              rows={3}
            />
          </div>
          <div>
            <label className="gs-section-label mb-2 block">Category</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(categoryConfig).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setCategory(key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all min-h-[36px] ${
                    category === key ? 'gs-pill-active' : 'gs-pill'
                  }`}
                  style={category === key ? { color: cfg.color, backgroundColor: cfg.bg, borderColor: `${cfg.color}40` } : {}}
                >
                  {cfg.emoji} {cfg.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="gs-section-label mb-1.5 block">Target Date (optional)</label>
            <input
              type="date"
              value={targetDate}
              onChange={e => setTargetDate(e.target.value)}
              className="gs-input w-full px-3 py-2.5 rounded-xl text-sm"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoPlan}
              onChange={e => setAutoPlan(e.target.checked)}
              className="rounded border-[#4B5563]"
            />
            <Sparkles className="w-4 h-4 text-violet-400" />
            <span className="text-sm text-[#D1D5DB]">Let AI plan this automatically</span>
          </label>
          <button
            onClick={handleCreate}
            disabled={!title.trim() || creating}
            className="gs-btn-primary w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold disabled:opacity-50"
          >
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {autoPlan ? 'Creating & Planning...' : 'Creating...'}
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" /> Create Goal
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---- Helpers ----

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
