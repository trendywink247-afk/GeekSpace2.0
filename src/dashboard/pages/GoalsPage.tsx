// ============================================================
// Goals Page — Full Redesign
// Shadows over borders · Concentric radii · Violet gradient rings
// Stagger animations · Scale 0.96 on press · CSS vars only
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, type TargetAndTransition } from 'framer-motion';
import { PageShell, PageHeader, SectionCard } from '@/components/agentin';
import { DashboardPageWrapper } from '@/components/agentin';
import {
  Target, Plus, Brain, Play, CheckCircle2, Clock, Pause, AlertTriangle,
  ChevronDown, ChevronRight, Sparkles, Calendar, Trash2, RotateCcw,
  Loader2, Archive, TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { goalsService, type GoalData, type GoalStepData, type GoalEventData } from '@/services/api';
import { PullToRefreshWrapper } from '@/components/PullToRefreshWrapper';

// ---- Animation Variants ----

const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14, filter: 'blur(4px)' },
  visible: {
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { type: 'spring' as const, duration: 0.45, bounce: 0 },
  },
};

const statsVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const statsItemVariants = {
  hidden: { opacity: 0, y: 10, scale: 0.96 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { type: 'spring' as const, duration: 0.4, bounce: 0 },
  },
};

// ---- Constants ----

const categoryConfig: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  general:   { label: 'General',   color: 'var(--ag-text-secondary)', bg: 'rgba(156,163,175,0.12)', emoji: '🎯' },
  career:    { label: 'Career',    color: 'var(--ag-violet)', bg: 'rgba(139,92,246,0.12)', emoji: '💼' },
  health:    { label: 'Health',    color: 'var(--ag-green)', bg: 'rgba(16,185,129,0.12)', emoji: '🏃' },
  finance:   { label: 'Finance',   color: 'var(--ag-amber)', bg: 'rgba(245,158,11,0.12)', emoji: '💰' },
  learning:  { label: 'Learning',  color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', emoji: '📚' },
  creative:  { label: 'Creative',  color: '#EC4899', bg: 'rgba(236,72,153,0.12)', emoji: '🎨' },
  technical: { label: 'Technical', color: '#06B6D4', bg: 'rgba(6,182,212,0.12)', emoji: '⚙️' },
  personal:  { label: 'Personal',  color: 'var(--ag-amber)', bg: 'rgba(249,115,22,0.12)', emoji: '🌟' },
};

const statusConfig: Record<string, { label: string; color: string; icon: typeof Target }> = {
  active:    { label: 'Active',    color: 'var(--ag-cyan)', icon: Play },
  paused:    { label: 'Paused',    color: 'var(--ag-amber)', icon: Pause },
  completed: { label: 'Completed', color: 'var(--ag-green)', icon: CheckCircle2 },
  failed:    { label: 'Failed',    color: '#EF4444', icon: AlertTriangle },
  archived:  { label: 'Archived',  color: 'var(--ag-text-muted)', icon: Archive },
};

const effortBadge: Record<string, { label: string; color: string }> = {
  low:    { label: 'Quick',  color: 'var(--ag-green)' },
  medium: { label: 'Medium', color: 'var(--ag-amber)' },
  high:   { label: 'Deep',   color: '#EF4444' },
};

const agentEmojis: Record<string, string> = {
  weebo: '💚', edith: '🔷', jarvis: '🟣', aria: '🎨',
  forge: '🔧', pulse: '📊', echo: '💙', cal: '📅', nova: '🔭',
};

type FilterTab = 'all' | 'active' | 'completed' | 'paused';

// ---- Shadow tokens (dark mode — shadows over borders) ----
const SHADOW_CARD = '0 0 0 1px rgba(255,255,255,0.06), 0 2px 8px rgba(0,0,0,0.35), 0 1px 2px rgba(0,0,0,0.2)';
const SHADOW_CARD_HOVER = '0 0 0 1px rgba(139,92,246,0.18), 0 6px 20px rgba(0,0,0,0.45), 0 0 24px rgba(139,92,246,0.08)';
const SHADOW_CARD_EXPANDED = '0 0 0 1px rgba(139,92,246,0.28), 0 8px 28px rgba(0,0,0,0.5), 0 0 32px rgba(139,92,246,0.12)';

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

  return (
    <DashboardPageWrapper>
    <PageShell>
      <PullToRefreshWrapper onRefresh={loadGoals}>
        <PageHeader
          title="Goals"
          subtitle="Set goals and let your agents plan & execute them"
          icon={Target}
          actions={
            <motion.div whileTap={{ scale: 0.96 }} style={{ display: 'inline-flex' }}>
              <Button
                onClick={() => setShowCreate(true)}
                className="gap-2 min-h-[44px] rounded-xl font-semibold"
                style={{ background: 'linear-gradient(135deg, var(--ag-violet), var(--ag-amber))', border: 'none' }}
              >
                <Plus className="w-4 h-4" /> New Goal
              </Button>
            </motion.div>
          }
        />

        {/* Stats Bar — stagger + shadow depth */}
        {stats && (
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6"
            initial="hidden"
            animate="visible"
            variants={statsVariants}
          >
            {[
              { label: 'Active',      value: stats.active,                              color: 'var(--ag-cyan)',    icon: Play },
              { label: 'Completed',   value: stats.completed,                           color: 'var(--ag-green)',   icon: CheckCircle2 },
              { label: 'Total',       value: stats.total,                               color: 'var(--ag-violet)',  icon: Target },
              { label: 'Success Rate',value: `${Math.round(stats.completionRate || 0)}%`, color: 'var(--ag-amber)', icon: TrendingUp },
            ].map(s => (
              <motion.div
                key={s.label}
                variants={statsItemVariants}
                className="flex items-center gap-3 rounded-2xl px-4 py-3 backdrop-blur-xl"
                style={{
                  background: 'var(--ag-bg-surface)',
                  boxShadow: SHADOW_CARD,
                  transition: 'box-shadow var(--ag-transition-fast)',
                }}
                whileHover={{ boxShadow: SHADOW_CARD_HOVER } as TargetAndTransition}
              >
                <div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `color-mix(in srgb, ${s.color} 15%, transparent)` }}>
                  <s.icon className="w-4 h-4" style={{ color: s.color }} />
                </div>
                <div>
                  <div
                    className="text-2xl font-bold leading-none"
                    style={{ color: s.color, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {s.value}
                  </div>
                  <div className="text-xs text-[var(--ag-text-muted)] mt-0.5">{s.label}</div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Filter Tabs */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterTab)} className="mb-6">
          <TabsList className="rounded-xl p-1 h-11" style={{ background: 'var(--ag-bg-surface)', boxShadow: SHADOW_CARD }}>
            {(['all', 'active', 'completed', 'paused'] as FilterTab[]).map(tab => (
              <TabsTrigger
                key={tab}
                value={tab}
                className="rounded-lg capitalize text-sm transition-all duration-200 min-h-[36px]"
              >
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Goals List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--ag-cyan)' }} />
          </div>
        ) : filteredGoals.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', duration: 0.4, bounce: 0 }}>
            <SectionCard>
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5" style={{ background: 'rgba(139,92,246,0.08)', boxShadow: '0 0 0 1px rgba(139,92,246,0.12)' }}>
                  <Target className="w-10 h-10" style={{ color: 'var(--ag-text-muted)' }} />
                </div>
                <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--ag-text-primary)', textWrap: 'balance' } as React.CSSProperties}>
                  No goals yet
                </h3>
                <p className="mb-6 max-w-md text-sm" style={{ color: 'var(--ag-text-secondary)', textWrap: 'pretty' } as React.CSSProperties}>
                  Set a goal and let your AI agents break it down into actionable steps, then execute them autonomously.
                </p>
                <motion.div whileTap={{ scale: 0.96 }}>
                  <Button
                    onClick={() => setShowCreate(true)}
                    className="gap-2 rounded-xl min-h-[44px] font-semibold"
                    style={{ background: 'linear-gradient(135deg, var(--ag-violet), var(--ag-amber))', border: 'none' }}
                  >
                    <Sparkles className="w-4 h-4" /> Create Your First Goal
                  </Button>
                </motion.div>
              </div>
            </SectionCard>
          </motion.div>
        ) : (
          <motion.div
            className="space-y-3"
            initial="hidden"
            animate="visible"
            variants={listVariants}
          >
            {filteredGoals.map(goal => (
              <motion.div key={goal.id} variants={itemVariants} layout>
                <GoalCard
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
              </motion.div>
            ))}
          </motion.div>
        )}
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
    </DashboardPageWrapper>
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

  // r=22 → circumference = 2π×22 ≈ 138.23
  const circ = 138.23;
  const gradId = `pg-${goal.id}`;

  return (
    <motion.div
      className="overflow-hidden rounded-2xl backdrop-blur-xl"
      style={{
        background: 'var(--ag-bg-surface)',
        boxShadow: expanded ? SHADOW_CARD_EXPANDED : SHADOW_CARD,
      }}
      animate={{ boxShadow: expanded ? SHADOW_CARD_EXPANDED : SHADOW_CARD }}
      whileHover={{ boxShadow: expanded ? SHADOW_CARD_EXPANDED : SHADOW_CARD_HOVER } as TargetAndTransition}
      transition={{ duration: 0.2 }}
    >
      {/* Card Header — always visible */}
      <motion.div
        className="flex items-center gap-4 p-4 cursor-pointer select-none"
        onClick={onToggle}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.1 }}
      >
        {/* Violet Gradient Progress Ring */}
        <div className="relative flex-shrink-0">
          <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true">
            <defs>
              <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--ag-violet)" />
                <stop offset="100%" stopColor="var(--ag-cyan)" />
              </linearGradient>
            </defs>
            {/* Track */}
            <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(139,92,246,0.1)" strokeWidth="3.5" />
            {/* Progress */}
            <circle
              cx="26" cy="26" r="22" fill="none"
              stroke={`url(#${gradId})`}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray={`${(goal.progress / 100) * circ} ${circ}`}
              transform="rotate(-90 26 26)"
              style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(0.4,0,0.2,1)' }}
            />
            {/* Glow layer */}
            <circle
              cx="26" cy="26" r="22" fill="none"
              stroke="var(--ag-violet)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${(goal.progress / 100) * circ} ${circ}`}
              transform="rotate(-90 26 26)"
              opacity="0.12"
              style={{ filter: 'blur(3px)', transition: 'stroke-dasharray 0.6s cubic-bezier(0.4,0,0.2,1)' }}
            />
          </svg>
          <span
            className="absolute inset-0 flex items-center justify-center text-[11px] font-bold"
            style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ag-cyan)' }}
          >
            {goal.progress}%
          </span>
        </div>

        {/* Title + Meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3
              className="text-base font-semibold truncate"
              style={{ color: 'var(--ag-text-primary)', WebkitFontSmoothing: 'antialiased' }}
            >
              {goal.title}
            </h3>
            <Badge
              variant="outline"
              style={{
                color: cat.color,
                borderColor: 'transparent',
                background: cat.bg,
                fontSize: '0.65rem',
                padding: '2px 7px',
                borderRadius: '6px',
              }}
            >
              {cat.emoji} {cat.label}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: 'var(--ag-text-muted)' }}>
            <span className="flex items-center gap-1">
              <StatusIcon className="w-3 h-3" style={{ color: status.color }} />
              <span style={{ color: status.color }}>{status.label}</span>
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
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{completedSteps}/{totalSteps} steps</span>
            )}
          </div>
        </div>

        {/* Expand Chevron — cross-fade animation */}
        <div className="relative w-5 h-5 flex-shrink-0" style={{ color: 'var(--ag-text-muted)' }}>
          <ChevronDown
            className="w-5 h-5 absolute inset-0 transition-[opacity,transform] duration-300"
            style={{ opacity: expanded ? 1 : 0, transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
          />
          <ChevronRight
            className="w-5 h-5 absolute inset-0 transition-[opacity,transform] duration-300"
            style={{ opacity: expanded ? 0 : 1, transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
          />
        </div>
      </motion.div>

      {/* Expanded Detail — AnimatePresence for smooth height animation */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div
              className="px-4 pb-4"
              style={{ borderTop: '1px solid rgba(139,92,246,0.08)' }}
            >
              {/* Description */}
              {goal.description && (
                <p className="text-sm mt-3 mb-4" style={{ color: 'var(--ag-text-secondary)', textWrap: 'pretty' } as React.CSSProperties}>
                  {goal.description}
                </p>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 mb-4">
                {!hasSteps && goal.status === 'active' && (
                  <motion.div whileTap={{ scale: 0.96 }}>
                    <Button
                      size="sm" onClick={onPlan} disabled={planning}
                      className="gap-1.5 rounded-lg min-h-[36px]"
                      variant="outline"
                    >
                      {planning
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Brain className="w-3.5 h-3.5" />}
                      {planning ? 'Planning…' : 'Plan with AI'}
                    </Button>
                  </motion.div>
                )}
                {pendingSteps.length > 0 && goal.status === 'active' && (
                  <motion.div whileTap={{ scale: 0.96 }}>
                    <Button
                      size="sm" onClick={onExecute} disabled={executing}
                      className="gap-1.5 rounded-lg min-h-[36px]"
                      style={{
                        background: 'rgba(16,185,129,0.12)',
                        color: 'var(--ag-green)',
                        border: '1px solid rgba(16,185,129,0.2)',
                      }}
                    >
                      {executing
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Play className="w-3.5 h-3.5" />}
                      {executing ? 'Executing…' : 'Execute Next Step'}
                    </Button>
                  </motion.div>
                )}
                {goal.status === 'active' && (
                  <motion.div whileTap={{ scale: 0.96 }}>
                    <Button
                      size="sm" variant="outline"
                      onClick={() => onStatusChange('paused')}
                      className="gap-1.5 rounded-lg min-h-[36px]"
                      style={{ color: 'var(--ag-amber)', borderColor: 'rgba(245,158,11,0.25)' }}
                    >
                      <Pause className="w-3.5 h-3.5" /> Pause
                    </Button>
                  </motion.div>
                )}
                {goal.status === 'paused' && (
                  <motion.div whileTap={{ scale: 0.96 }}>
                    <Button
                      size="sm" variant="outline"
                      onClick={() => onStatusChange('active')}
                      className="gap-1.5 rounded-lg min-h-[36px]"
                      style={{ color: 'var(--ag-cyan)', borderColor: 'rgba(167,139,250,0.25)' }}
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Resume
                    </Button>
                  </motion.div>
                )}
                <motion.div whileTap={{ scale: 0.96 }} className="ml-auto">
                  <Button
                    size="sm" variant="outline"
                    onClick={onDelete}
                    className="gap-1.5 rounded-lg min-h-[36px]"
                    style={{ color: '#EF4444', borderColor: 'rgba(239,68,68,0.25)' }}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </Button>
                </motion.div>
              </div>

              {/* Steps — concentric: card rounded-2xl, steps rounded-lg */}
              {details?.steps && details.steps.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--ag-text-muted)' }}>
                    Steps
                  </h4>
                  {details.steps
                    .sort((a, b) => a.step_order - b.step_order)
                    .map((step, idx) => (
                      <motion.div
                        key={step.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.04, type: 'spring', duration: 0.3, bounce: 0 }}
                      >
                        <StepRow step={step} />
                      </motion.div>
                    ))}
                </div>
              )}

              {/* Events Timeline */}
              {details?.events && details.events.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--ag-text-muted)' }}>
                    Activity
                  </h4>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {details.events.slice(0, 10).map(event => (
                      <div key={event.id} className="flex items-start gap-2 text-xs" style={{ color: 'var(--ag-text-muted)' }}>
                        <Clock className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span className="flex-1">{event.message}</span>
                        <span className="flex-shrink-0 opacity-60" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {timeAgo(event.created_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ---- Step Row — concentric radii inside GoalCard (outer 2xl → inner lg) ----

function StepRow({ step }: { step: GoalStepData }) {
  const effort = effortBadge[step.effort] || effortBadge.medium;
  const isComplete = step.status === 'completed';
  const isFailed = step.status === 'failed';
  const isActive = step.status === 'in_progress';

  const accentColor = isComplete ? 'var(--ag-green)' : isFailed ? '#EF4444' : isActive ? 'var(--ag-cyan)' : 'rgba(255,255,255,0.1)';

  return (
    <div
      className="flex items-center gap-3 rounded-lg px-3 py-2.5"
      style={{
        background: isActive ? 'rgba(167,139,250,0.06)' : 'rgba(255,255,255,0.02)',
        boxShadow: `inset 3px 0 0 ${accentColor}`,
      }}
    >
      <div className="flex-shrink-0">
        {isComplete ? (
          <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--ag-green)' }} />
        ) : isActive ? (
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--ag-cyan)' }} />
        ) : isFailed ? (
          <AlertTriangle className="w-4 h-4" style={{ color: '#EF4444' }} />
        ) : (
          <div className="w-4 h-4 rounded-full border-2" style={{ borderColor: 'var(--ag-border-default)' }} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <span
          className="text-sm"
          style={{
            color: isComplete ? 'var(--ag-text-muted)' : 'var(--ag-text-primary)',
            textDecoration: isComplete ? 'line-through' : 'none',
          }}
        >
          {step.title}
        </span>
      </div>
      <Badge
        variant="outline"
        style={{
          color: effort.color,
          borderColor: 'transparent',
          background: `color-mix(in srgb, ${effort.color} 12%, transparent)`,
          fontSize: '0.6rem',
          padding: '1px 6px',
          borderRadius: '4px',
        }}
      >
        {effort.label}
      </Badge>
      {step.assigned_agent && (
        <span className="text-xs opacity-50">{agentEmojis[step.assigned_agent] || '🤖'}</span>
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
      <DialogContent
        className="max-w-md rounded-2xl"
        style={{
          background: 'var(--ag-bg-elevated)',
          boxShadow: '0 0 0 1px rgba(139,92,246,0.15), 0 24px 48px rgba(0,0,0,0.6), 0 0 60px rgba(139,92,246,0.08)',
          backdropFilter: 'blur(20px)',
          border: 'none',
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ color: 'var(--ag-text-primary)', WebkitFontSmoothing: 'antialiased' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.15)' }}>
              <Target className="w-4 h-4" style={{ color: 'var(--ag-cyan)' }} />
            </div>
            New Goal
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--ag-text-secondary)' }}>
              What do you want to achieve?
            </label>
            <Input
              placeholder="e.g. Learn TypeScript in 30 days"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="rounded-xl h-11"
              style={{ background: 'var(--ag-bg-surface)', borderColor: 'var(--ag-border-default)' }}
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--ag-text-secondary)' }}>
              Description <span style={{ color: 'var(--ag-text-muted)' }}>(optional)</span>
            </label>
            <textarea
              placeholder="Add more context for your AI agents…"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 transition-all"
              style={{
                background: 'var(--ag-bg-surface)',
                border: '1px solid var(--ag-border-default)',
                color: 'var(--ag-text-primary)',
                focusRingColor: 'var(--ag-violet)',
              } as React.CSSProperties}
              rows={3}
            />
          </div>
          <div>
            <label className="text-xs mb-2 block font-medium" style={{ color: 'var(--ag-text-secondary)' }}>Category</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(categoryConfig).map(([key, cfg]) => (
                <motion.button
                  key={key}
                  onClick={() => setCategory(key)}
                  whileTap={{ scale: 0.94 }}
                  className="px-3 py-1.5 rounded-full text-xs font-medium min-h-[32px] transition-all duration-200"
                  style={{
                    background: category === key ? cfg.bg : 'rgba(255,255,255,0.04)',
                    color: category === key ? cfg.color : 'var(--ag-text-muted)',
                    boxShadow: category === key
                      ? `0 0 0 1px ${cfg.color}40`
                      : '0 0 0 1px rgba(255,255,255,0.06)',
                  }}
                >
                  {cfg.emoji} {cfg.label}
                </motion.button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs mb-1.5 block font-medium" style={{ color: 'var(--ag-text-secondary)' }}>
              Target Date <span style={{ color: 'var(--ag-text-muted)' }}>(optional)</span>
            </label>
            <Input
              type="date"
              value={targetDate}
              onChange={e => setTargetDate(e.target.value)}
              className="rounded-xl h-11"
              style={{ background: 'var(--ag-bg-surface)', borderColor: 'var(--ag-border-default)' }}
            />
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer py-1">
            <input
              type="checkbox"
              checked={autoPlan}
              onChange={e => setAutoPlan(e.target.checked)}
              className="rounded"
              style={{ accentColor: 'var(--ag-violet)' }}
            />
            <Sparkles className="w-4 h-4" style={{ color: 'var(--ag-cyan)' }} />
            <span className="text-sm" style={{ color: 'var(--ag-text-primary)' }}>Let AI plan this automatically</span>
          </label>
          <motion.div whileTap={{ scale: 0.97 }}>
            <Button
              onClick={handleCreate}
              disabled={!title.trim() || creating}
              className="w-full gap-2 rounded-xl min-h-[44px] font-semibold"
              style={{ background: 'linear-gradient(135deg, var(--ag-violet), var(--ag-amber))', border: 'none' }}
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {autoPlan ? 'Creating & Planning…' : 'Creating…'}
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" /> Create Goal
                </>
              )}
            </Button>
          </motion.div>
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
  return `${days}d ago`;
}
