// ============================================================
// FocusPage — state, data fetching, actions, layout
// ============================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageShell, PageHeader, SectionCard } from '@/components/agentin';
import { DashboardPageWrapper } from '@/components/agentin';
import { BlurFade } from '@/components/magicui/blur-fade';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import api from '@/services/api';
import { toast } from 'sonner';
import { Target, Bell, BellOff, Flame, Timer } from 'lucide-react';

import {
  type FocusSession,
  type Habit,
  type NotifSettings,
  type FocusSummary,
  pad,
  useTimer,
  SHADOW_CARD,
} from './focus/helpers';
import { FocusSessionTab, CelebrationPulse } from './focus/FocusSessionTab';
import { HabitsTab } from './focus/HabitsTab';
import { StartSessionModal } from './focus/StartSessionModal';
import { AddHabitDialog } from './focus/AddHabitDialog';
import { FocusStatsGrid } from './focus/FocusStatsGrid';

// ---------- Main Component ----------

export function FocusPage() {
  const { notifyDone, notifyFail } = useAgentCanvas({ agent: 'pulse', page: 'focus' });

  // --- Data state ---
  const [session, setSession] = useState<FocusSession | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [settings, setSettings] = useState<NotifSettings | null>(null);
  const [deferredCount, setDeferredCount] = useState(0);
  const [history, setHistory] = useState<FocusSession[]>([]);
  const [summary, setSummary] = useState<FocusSummary | null>(null);

  // --- UI state ---
  const [activeTab, setActiveTab] = useState('focus');
  const [showStartModal, setShowStartModal] = useState(false);
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [durInput, setDurInput] = useState(25);
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitIcon, setNewHabitIcon] = useState('⭐');
  const [newHabitFreq, setNewHabitFreq] = useState('daily');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showBreakSuggestion, setShowBreakSuggestion] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [deletingHabitId, setDeletingHabitId] = useState<number | null>(null);

  // --- Timer ---
  const { elapsed, remaining, progress } = useTimer(
    session?.started_at ?? null,
    session?.duration_min ?? null,
  );

  // --- Wake Lock ---
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!session) {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {/* ignore */});
        wakeLockRef.current = null;
      }
      return;
    }

    async function acquireWakeLock() {
      if (!('wakeLock' in navigator)) return;
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      } catch (err) {
        console.warn('[Focus] Wake lock unavailable:', err instanceof Error ? err.message : err);
      }
    }
    void acquireWakeLock();

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && !wakeLockRef.current) {
        void acquireWakeLock();
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {/* ignore */});
        wakeLockRef.current = null;
      }
    };
  }, [session]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {/* ignore */});
    }
  }, []);

  // --- Data loading ---
  const load = useCallback(async () => {
    try {
      const [sRes, hRes, nsRes, dRes, histRes, sumRes] = await Promise.all([
        api.get('/focus/active'),
        api.get('/habits'),
        api.get('/focus/settings'),
        api.get('/focus/deferred'),
        api.get('/focus/history?limit=20'),
        api.get('/focus/summary'),
      ]);
      setSession((sRes.data as { session: FocusSession | null }).session);
      setHabits((hRes.data as { habits: Habit[] }).habits);
      setSettings((nsRes.data as { settings: NotifSettings }).settings);
      setDeferredCount((dRes.data as { count: number }).count);
      setHistory((histRes.data as { sessions: FocusSession[] }).sessions);
      setSummary((sumRes.data as { summary: FocusSummary }).summary);
    } catch {
      toast.error('Failed to load focus data');
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // --- Session auto-end on timer complete ---
  const prevRemaining = useRef<number | null>(null);
  useEffect(() => {
    if (prevRemaining.current !== null && prevRemaining.current > 0 && remaining === 0 && session) {
      if ('Notification' in window && Notification.permission === 'granted') {
        const dur = session.duration_min ?? Math.floor(elapsed / 60);
        new Notification('Focus Session Complete!', {
          body: `Great work! You focused for ${dur} minutes.`,
          icon: '/favicon.ico',
        });
      }
      void handleEndFocus();
      setShowBreakSuggestion(true);
    }
    prevRemaining.current = remaining;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  // --- Actions ---

  async function handleStartFocus() {
    setLoading(true);
    try {
      const res = await api.post('/focus/start', { goal: goalInput || null, durationMin: durInput });
      setSession((res.data as { session: FocusSession }).session);
      setShowStartModal(false);
      setGoalInput('');
      setShowBreakSuggestion(false);
      toast.success('Focus session started');
      void notifyDone('Focus session started');
    } catch {
      toast.error('Failed to start focus session');
      void notifyFail('Failed to start focus session');
    }
    setLoading(false);
  }

  async function handleEndFocus() {
    setLoading(true);
    try {
      await api.post('/focus/end', { completed: true });
      setSession(null);
      setShowBreakSuggestion(true);
      void load();
      toast.success('Focus session completed');
      void notifyDone('Focus session completed');
    } catch {
      toast.error('Failed to end focus session');
      void notifyFail('Failed to end focus session');
    }
    setLoading(false);
  }

  async function handleLogHabit(id: number) {
    try {
      await api.post('/habits/' + id + '/log', {});
      setHabits(prev => {
        const updated = prev.map(h =>
          h.id === id ? { ...h, logged_today: true, current_streak: h.current_streak + 1 } : h,
        );
        const allDone = updated.length > 0 && updated.every(h => h.logged_today);
        if (allDone) {
          setShowCelebration(true);
          setTimeout(() => setShowCelebration(false), 2000);
        }
        return updated;
      });
      toast.success('Habit logged');
      void notifyDone('Habit checked in');
      setTimeout(() => void load(), 600);
    } catch {
      toast.error('Failed to log habit');
      void notifyFail('Failed to log habit');
    }
  }

  async function handleAddHabit() {
    if (!newHabitName.trim()) return;
    setLoading(true);
    try {
      await api.post('/habits', {
        name: newHabitName.trim(),
        icon: newHabitIcon,
        frequency: newHabitFreq,
      });
      setNewHabitName('');
      setNewHabitIcon('⭐');
      setNewHabitFreq('daily');
      setShowAddHabit(false);
      void load();
      toast.success('Habit added');
      void notifyDone('Habit created');
    } catch {
      toast.error('Failed to add habit');
      void notifyFail('Failed to add habit');
    }
    setLoading(false);
  }

  async function handleDeleteHabit(id: number) {
    setDeletingHabitId(id);
    try {
      await api.delete('/habits/' + id);
      void load();
      toast.success('Habit deleted');
      void notifyDone('Habit deleted');
    } catch {
      toast.error('Failed to delete habit');
      void notifyFail('Failed to delete habit');
    }
    setDeletingHabitId(null);
  }

  async function toggleFocusMode() {
    const newVal = settings?.focus_mode_active ? 0 : 1;
    try {
      const res = await api.patch('/focus/settings', { focus_mode_active: newVal });
      setSettings((res.data as { settings: NotifSettings }).settings);
      toast.success(newVal ? 'Focus mode ON' : 'Focus mode OFF');
      void notifyDone(newVal ? 'Focus mode enabled' : 'Focus mode disabled');
    } catch {
      toast.error('Failed to update focus mode');
      void notifyFail('Failed to update focus mode');
    }
  }

  // --- Derived values ---
  const elapsedStr = pad(Math.floor(elapsed / 60)) + ':' + pad(elapsed % 60);
  const remainStr = remaining !== null ? pad(Math.floor(remaining / 60)) + ':' + pad(remaining % 60) : '';
  const habitsLoggedToday = habits.filter(h => h.logged_today).length;
  const completedHistory = history.filter(h => h.ended_at !== null);

  const focusStreak = (() => {
    if (completedHistory.length === 0) return 0;
    const sessionDates = new Set(
      completedHistory
        .filter(s => s.completed)
        .map(s => new Date(s.started_at).toISOString().slice(0, 10)),
    );
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let streak = 0;
    const check = new Date(today);
    const todayStr = check.toISOString().slice(0, 10);
    const yest = new Date(check);
    yest.setDate(yest.getDate() - 1);
    const yestStr = yest.toISOString().slice(0, 10);
    if (!sessionDates.has(todayStr) && !sessionDates.has(yestStr)) return 0;
    if (!sessionDates.has(todayStr)) {
      check.setDate(check.getDate() - 1);
    }
    while (sessionDates.has(check.toISOString().slice(0, 10))) {
      streak++;
      check.setDate(check.getDate() - 1);
    }
    return streak;
  })();

  // --- Loading skeleton ---
  if (initialLoading) {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="h-8 w-48 rounded-xl animate-pulse" style={{ background: 'var(--ag-bg-surface)' }} />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: 'var(--ag-bg-surface)' }} />
          ))}
        </div>
        <div className="h-64 rounded-2xl animate-pulse" style={{ background: 'var(--ag-bg-surface)' }} />
        <div className="h-48 rounded-2xl animate-pulse" style={{ background: 'var(--ag-bg-surface)' }} />
      </div>
    );
  }

  return (
    <DashboardPageWrapper>
    <PageShell>
    <div className="max-w-2xl mx-auto space-y-6 pb-24 md:pb-6">
      {showCelebration && <CelebrationPulse />}

      {/* ---- Header ---- */}
      <BlurFade delay={0}>
        <PageHeader
          icon={Target}
          title="Focus & Habits"
          subtitle="Coached by Pulse"
          badge={
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--ag-pulse)' }} />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: 'var(--ag-pulse)' }} />
            </span>
          }
          actions={
            <motion.div whileTap={{ scale: 0.96 }}>
              <Button
                variant="ghost" size="sm"
                onClick={toggleFocusMode}
                className="gap-1.5 text-xs min-h-[44px] px-3 rounded-xl transition-all focus-visible:outline-none"
                style={{
                  background: settings?.focus_mode_active ? 'rgba(167,139,250,0.1)' : 'transparent',
                  color: settings?.focus_mode_active ? 'var(--ag-cyan)' : 'var(--ag-text-secondary)',
                  boxShadow: settings?.focus_mode_active ? '0 0 0 1px rgba(167,139,250,0.2)' : 'none',
                }}
                aria-label={settings?.focus_mode_active ? 'Turn focus mode off' : 'Turn focus mode on'}
              >
                {settings?.focus_mode_active ? <BellOff size={14} /> : <Bell size={14} />}
                {settings?.focus_mode_active ? 'Focus ON' : 'Focus OFF'}
              </Button>
            </motion.div>
          }
        />
      </BlurFade>

      {/* ---- Deferred messages banner ---- */}
      <AnimatePresence>
        {deferredCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', duration: 0.35, bounce: 0 }}
          >
            <SectionCard padding="sm" className="border-[var(--ag-border-default)]">
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'var(--ag-text-primary)' }}>
                  <Bell size={14} className="inline mr-1.5" style={{ color: 'var(--ag-cyan)' }} />
                  {deferredCount} message{deferredCount > 1 ? 's' : ''} held during focus
                </span>
                <motion.div whileTap={{ scale: 0.96 }}>
                  <Button
                    size="sm" variant="outline"
                    className="text-xs min-h-[44px] rounded-lg"
                    style={{ borderColor: 'var(--ag-border-default)', color: 'var(--ag-cyan)' }}
                    onClick={() => { setDeferredCount(0); void load(); }}
                  >
                    View now
                  </Button>
                </motion.div>
              </div>
            </SectionCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- Stats Summary ---- */}
      <BlurFade delay={0.15}>
        <FocusStatsGrid
          focusStreak={focusStreak}
          habitsLoggedToday={habitsLoggedToday}
          habitsTotal={habits.length}
          summary={summary}
        />
      </BlurFade>

      {/* ---- Tabs ---- */}
      <BlurFade delay={0.25}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList
            className="w-full p-1 h-12 rounded-xl"
            style={{ background: 'var(--ag-bg-surface)', boxShadow: SHADOW_CARD }}
          >
            <TabsTrigger
              value="focus"
              className="flex-1 rounded-lg h-10 text-sm font-medium transition-colors min-h-[44px]"
              style={{ '--tw-text-opacity': '1' } as React.CSSProperties}
            >
              <Timer size={15} className="mr-1.5" />
              Focus Sessions
            </TabsTrigger>
            <TabsTrigger
              value="habits"
              className="flex-1 rounded-lg h-10 text-sm font-medium transition-colors min-h-[44px]"
            >
              <Flame size={15} className="mr-1.5" />
              Daily Habits
            </TabsTrigger>
          </TabsList>

          <TabsContent value="focus" className="mt-4">
            <FocusSessionTab
              session={session}
              showBreakSuggestion={showBreakSuggestion}
              setShowBreakSuggestion={setShowBreakSuggestion}
              progress={progress}
              remaining={remaining}
              remainStr={remainStr}
              elapsedStr={elapsedStr}
              durInput={durInput}
              setDurInput={setDurInput}
              setShowStartModal={setShowStartModal}
              onEndFocus={handleEndFocus}
              loading={loading}
              history={history}
              completedHistory={completedHistory}
            />
          </TabsContent>

          <TabsContent value="habits" className="mt-4">
            <HabitsTab
              habits={habits}
              habitsLoggedToday={habitsLoggedToday}
              deletingHabitId={deletingHabitId}
              onLogHabit={handleLogHabit}
              onDeleteHabit={handleDeleteHabit}
              onAddHabit={() => setShowAddHabit(true)}
            />
          </TabsContent>
        </Tabs>
      </BlurFade>

      {/* ---- Modals ---- */}
      <StartSessionModal
        open={showStartModal}
        onOpenChange={setShowStartModal}
        goalInput={goalInput}
        setGoalInput={setGoalInput}
        durInput={durInput}
        setDurInput={setDurInput}
        onStart={handleStartFocus}
        loading={loading}
      />

      <AddHabitDialog
        open={showAddHabit}
        onOpenChange={setShowAddHabit}
        newHabitName={newHabitName}
        setNewHabitName={setNewHabitName}
        newHabitIcon={newHabitIcon}
        setNewHabitIcon={setNewHabitIcon}
        newHabitFreq={newHabitFreq}
        setNewHabitFreq={setNewHabitFreq}
        onAdd={handleAddHabit}
        loading={loading}
      />
    </div>
    </PageShell>
    </DashboardPageWrapper>
  );
}
