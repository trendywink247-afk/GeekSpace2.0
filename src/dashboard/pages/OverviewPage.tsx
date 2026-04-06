import { useState, useEffect, useCallback, useMemo } from 'react';
import { BlurFade } from '@/components/magicui/blur-fade';
import { Bell, MessageSquare, Timer, Clock, AlertTriangle, X } from 'lucide-react';
import { PullToRefreshWrapper } from '@/components/PullToRefreshWrapper';
import { AgentStatusStrip } from '@/components/AgentStatusStrip';
import { LiveAgentFeed } from '@/components/LiveAgentFeed';
import { QuickActionsGrid } from '@/components/dashboard/QuickActionsGrid';
import { RecentGenerations } from '@/components/dashboard/RecentGenerations';
import { StreakCard } from '@/components/dashboard/StreakCard';
import { InboxCard } from '@/components/dashboard/InboxCard';
import { GoalsSummaryCard } from '@/components/dashboard/GoalsSummaryCard';
import { PageShell } from '@/components/agentin';
import { DashboardPageWrapper } from '@/components/agentin';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';
import { useAuthStore } from '@/stores/auth-store';
import { useDashboardStore } from '@/stores/dashboard-store';
import { activityService, memoryService, reminderService, dashboardService } from '@/services/api';
import type { ConversationEntry } from '@/types';

import {
  GreetingSection,
  GlanceCards,
  ActivityFeed,
  QuickActions,
  SparklineCard,
  RemindersSection,
  HabitsSection,
  CalendarSection,
  WeeklyStats,
  OnboardingChecklist,
  EmptyState,
  QuickChatInput,
  getGreeting,
  getFestivalGreeting,
  computeTimeSaved,
  isNewUser,
  shouldShowIOSBanner,
  IOS_DISMISS_KEY,
} from './overview';
import type { OverviewData, GlanceCard } from './overview';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OverviewPageProps {
  onViewPortfolio: (username: string) => void;
  onNavigate?: (page: string) => void;
  onRefresh?: () => void;
  onOpenChat?: () => void;
}

// ---------------------------------------------------------------------------
// iOS Install Banner (page-level — reads from navigator)
// ---------------------------------------------------------------------------

function IOSInstallBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      role="banner"
      aria-label="iOS install guide"
      className="flex items-center gap-3 rounded-xl border border-[var(--ag-border-glow)] bg-[var(--ag-cyan)]/5 px-4 py-3 text-sm"
    >
      <span className="text-base leading-none select-none" aria-hidden>📱</span>
      <span className="flex-1 text-[var(--ag-text-secondary)]">
        <span className="font-medium text-[var(--ag-text-primary)]">Install Agentin:</span>{' '}
        Tap the{' '}
        <span className="inline-flex items-center gap-0.5 font-medium text-[var(--ag-cyan)]">
          Share <span aria-label="share icon">⬆</span>
        </span>{' '}
        button → <span className="font-medium text-[var(--ag-text-primary)]">"Add to Home Screen"</span>
      </span>
      <button
        onClick={onDismiss}
        aria-label="Dismiss iOS install guide"
        className="p-1 rounded-lg hover:bg-[var(--ag-cyan)]/10 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)]"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OverviewPage — data fetching + layout orchestration only
// ---------------------------------------------------------------------------

export function OverviewPage({ onNavigate, onRefresh, onOpenChat }: OverviewPageProps) {
  const user = useAuthStore((s) => s.user);
  const { stats, reminders } = useDashboardStore();
  const loadErrors = useDashboardStore((s) => s.loadErrors);
  const loadDashboard = useDashboardStore((s) => s.loadDashboard);
  const { notifyStart, notifyDone, notifyFail } = useAgentCanvas({ agent: 'weebo', page: 'overview' });

  // ── State ──────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationEntry[]>([]);
  const [activityData, setActivityData] = useState<number[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loadErrDismissed, setLoadErrDismissed] = useState(false);
  const [showIOSBanner, setShowIOSBanner] = useState(false);
  const [dayLabels, setDayLabels] = useState<string[]>([]);
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [completingReminder, setCompletingReminder] = useState<string | null>(null);

  // ── Derived ────────────────────────────────────────────────────────────────
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

  const pendingReminders = useMemo(() => {
    return reminders.filter((r) => {
      if (!r.datetime) return false;
      const dt = new Date(r.datetime);
      return dt >= todayStart && dt <= todayEnd && !r.completed;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reminders]);

  const nextReminder = useMemo(() =>
    pendingReminders
      .filter((r) => new Date(r.datetime) >= new Date())
      .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())[0],
    [pendingReminders]
  );

  const messagesToday = stats.messagesSent || 0;
  const weeklyMessages = useMemo(() => activityData.reduce((a, b) => a + b, 0), [activityData]);
  const timeSaved = useMemo(() => computeTimeSaved(weeklyMessages), [weeklyMessages]);

  const greeting = getGreeting();
  const firstName = user?.name?.split(' ')[0] || 'there';
  const festivalGreeting = getFestivalGreeting();
  const showOnboarding = isNewUser(user?.createdAt);
  const isEmptyState =
    !loading &&
    conversations.length === 0 &&
    reminders.length === 0 &&
    messagesToday === 0 &&
    activityData.every((v) => v === 0);

  const completedRemindersCount = reminders.filter((r) => r.completed).length;

  // ── Glance cards ───────────────────────────────────────────────────────────
  const glanceCards: GlanceCard[] = [
    {
      key: 'time-saved',
      label: 'AI Time Saved',
      value: timeSaved.hours > 0 ? `${timeSaved.hours}h ${timeSaved.minutes}m` : `${timeSaved.minutes}m`,
      sub: weeklyMessages > 0 ? `from ${weeklyMessages} messages` : 'Start chatting!',
      icon: Clock,
      color: '#FFB800',
      bgColor: 'rgba(255,184,0,0.08)',
    },
    {
      key: 'reminders',
      label: 'Reminders',
      value: String(pendingReminders.length),
      sub: nextReminder
        ? `Next: ${new Date(nextReminder.datetime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
        : 'No upcoming',
      icon: Bell,
      color: 'var(--ag-cyan)',
      bgColor: 'rgba(139,92,246,0.08)',
    },
    {
      key: 'messages',
      label: 'Conversations',
      value: String(messagesToday),
      sub: 'messages today',
      icon: MessageSquare,
      color: 'var(--ag-violet)',
      bgColor: 'rgba(139,92,246,0.08)',
    },
    {
      key: 'focus',
      label: 'Focus',
      value: stats.responseTimeMs > 0 ? `${Math.round(stats.responseTimeMs / 60000)}m` : '--',
      sub: stats.responseTimeMs > 0 ? 'session time' : 'Start a session',
      icon: Timer,
      color: '#FF2D78',
      bgColor: 'rgba(255,45,120,0.08)',
    },
  ];

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const res = await dashboardService.overview();
      setOverviewData(res.data as OverviewData);
    } catch { /* non-fatal */ } finally {
      setOverviewLoading(false);
    }
  }, []);

  const handleCompleteReminder = useCallback(async (id: string) => {
    setCompletingReminder(id);
    void notifyStart('complete-reminder');
    try {
      await reminderService.update(id, { completed: true });
      setOverviewData((prev) => prev ? {
        ...prev,
        remindersDueToday: prev.remindersDueToday.filter((r) => r.id !== id),
        weeklyStats: { ...prev.weeklyStats, remindersCompleted: prev.weeklyStats.remindersCompleted + 1 },
      } : prev);
      void notifyDone('Reminder completed');
    } catch {
      void notifyFail('Failed to complete reminder');
    } finally {
      setCompletingReminder(null);
    }
  }, [notifyStart, notifyDone, notifyFail]);

  const fetchOverviewData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [convRes, actRes] = await Promise.allSettled([
        memoryService.conversations(5),
        activityService.getStats(),
      ]);
      if (convRes.status === 'fulfilled') {
        const convos = convRes.value.data;
        setConversations(Array.isArray(convos) ? convos.filter((c) => c.role === 'user').slice(0, 3) : []);
      }
      if (actRes.status === 'fulfilled') {
        const days = actRes.value.data.days || [];
        setActivityData(days.map((d: { messages: number }) => d.messages));
        setDayLabels(days.map((d: { date: string }) =>
          new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' })
        ));
      }
    } catch {
      setError('Failed to load overview data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchOverviewData();
    fetchOverview();
  }, [fetchOverviewData, fetchOverview]);

  useEffect(() => {
    if (!shouldShowIOSBanner()) return;
    const t = setTimeout(() => setShowIOSBanner(true), 3000);
    return () => clearTimeout(t);
  }, []);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    onRefresh?.();
    Promise.all([fetchOverviewData(), fetchOverview()]).finally(() => setIsRefreshing(false));
  }, [onRefresh, fetchOverviewData, fetchOverview]);

  const handleIOSDismiss = useCallback(() => {
    localStorage.setItem(IOS_DISMISS_KEY, String(Date.now()));
    setShowIOSBanner(false);
  }, []);

  const handlePullRefresh = async () => {
    handleRefresh();
    await new Promise((r) => setTimeout(r, 1200));
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <DashboardPageWrapper>
      <PullToRefreshWrapper onRefresh={handlePullRefresh}>
        <PageShell maxWidth="6xl" spacing={6}>
          <div data-testid="dashboard-overview" className="space-y-6">

            {showIOSBanner && <IOSInstallBanner onDismiss={handleIOSDismiss} />}

            <GreetingSection
              greeting={greeting}
              firstName={firstName}
              pendingRemindersCount={pendingReminders.length}
              messagesToday={messagesToday}
              festivalGreeting={festivalGreeting}
              isRefreshing={isRefreshing}
              onRefresh={handleRefresh}
            />

            <BlurFade delay={0.05}>
              <AgentStatusStrip onAgentClick={(id) => onNavigate?.(`chat?agent=${id}`)} />
            </BlurFade>

            <BlurFade delay={0.10}><LiveAgentFeed onNavigate={onNavigate} /></BlurFade>

            <BlurFade delay={0.15}><GoalsSummaryCard onNavigate={onNavigate} /></BlurFade>

            <BlurFade delay={0.20}>
              <QuickActionsGrid onNavigate={onNavigate} onOpenChat={onOpenChat} />
            </BlurFade>

            <BlurFade delay={0.25} className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2"><RecentGenerations onNavigate={onNavigate} /></div>
              <div className="lg:col-span-1"><StreakCard onNavigate={onNavigate} /></div>
            </BlurFade>

            <BlurFade delay={0.30}>
              <InboxCard onNavigate={onNavigate} onOpenChat={onOpenChat} />
            </BlurFade>

            {/* Load error banner */}
            {loadErrors > 0 && !loadErrDismissed && (
              <div className="flex items-center gap-3 rounded-xl border border-[var(--ag-amber)]/30 bg-[var(--ag-amber)]/10 px-4 py-3 text-sm text-[var(--ag-amber)]">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{loadErrors} section{loadErrors > 1 ? 's' : ''} failed to load.</span>
                <button onClick={() => { setLoadErrDismissed(true); void loadDashboard(); }} className="text-sm underline hover:no-underline min-h-[44px] min-w-[44px] flex items-center justify-center">Retry</button>
                <button onClick={() => setLoadErrDismissed(true)} aria-label="Dismiss" className="p-1 rounded hover:bg-[var(--ag-amber)]/20 min-h-[44px] min-w-[44px] flex items-center justify-center"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="flex items-center gap-3 rounded-xl border border-[var(--ag-pink)]/30 bg-[var(--ag-pink)]/10 px-4 py-3 text-sm text-[var(--ag-pink)]">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{error}</span>
                <button onClick={handleRefresh} className="text-sm underline hover:no-underline min-h-[44px] min-w-[44px] flex items-center justify-center">Retry</button>
              </div>
            )}

            <GlanceCards loading={loading} glanceCards={glanceCards} mounted={mounted} onNavigate={onNavigate} onOpenChat={onOpenChat} />

            <QuickActions onNavigate={onNavigate} onOpenChat={onOpenChat} onNotifyStart={(n) => void notifyStart(n)} />

            {/* Two-column: conversations + sparkline */}
            <BlurFade delay={0.50} className="grid gap-4 lg:grid-cols-5">
              <ActivityFeed loading={loading} conversations={conversations} onNavigate={onNavigate} onOpenChat={onOpenChat} />
              <SparklineCard
                loading={loading}
                activityData={activityData}
                dayLabels={dayLabels}
                totalReminders={reminders.length}
                completedReminders={completedRemindersCount}
                onNavigate={onNavigate}
                onOpenChat={onOpenChat}
              />
            </BlurFade>

            <BlurFade delay={0.55}>
              <RemindersSection overviewData={overviewData} overviewLoading={overviewLoading} completingReminder={completingReminder} onCompleteReminder={handleCompleteReminder} onNavigate={onNavigate} />
            </BlurFade>

            <BlurFade delay={0.60}>
              <HabitsSection overviewData={overviewData} overviewLoading={overviewLoading} onNavigate={onNavigate} />
            </BlurFade>

            {overviewData && overviewData.calendarEventsToday.length > 0 && (
              <BlurFade delay={0.65}>
                <CalendarSection events={overviewData.calendarEventsToday} onNavigate={onNavigate} />
              </BlurFade>
            )}

            {overviewData && (
              <BlurFade delay={0.70}>
                <WeeklyStats stats={overviewData.weeklyStats} />
              </BlurFade>
            )}

            {showOnboarding && (
              <BlurFade delay={0.40}>
                <OnboardingChecklist hasReminders={reminders.length > 0} onNavigate={onNavigate} onOpenChat={onOpenChat} />
              </BlurFade>
            )}

            {isEmptyState && !showOnboarding && (
              <BlurFade delay={0.45}>
                <EmptyState onNavigate={onNavigate} onOpenChat={onOpenChat} />
              </BlurFade>
            )}

            <BlurFade delay={0.35}>
              <QuickChatInput onOpenChat={onOpenChat} />
            </BlurFade>

          </div>
        </PageShell>
      </PullToRefreshWrapper>
    </DashboardPageWrapper>
  );
}
