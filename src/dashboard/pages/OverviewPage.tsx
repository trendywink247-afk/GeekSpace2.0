import { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Bell,
  Target,
  Timer,
  Plus,
  Sparkles,
  FileText,
  RefreshCw,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PullToRefreshWrapper } from '@/components/PullToRefreshWrapper';
import { useAuthStore } from '@/stores/authStore';
import { useDashboardStore } from '@/stores/dashboardStore';
import {
  activityService,
  memoryService,
} from '@/services/api';
import type { ConversationEntry } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OverviewPageProps {
  onViewPortfolio: (username: string) => void;
  onNavigate?: (page: string) => void;
  onRefresh?: () => void;
  onOpenChat?: () => void;
}

interface GlanceCard {
  key: string;
  label: string;
  value: string;
  sub: string;
  icon: typeof Bell;
  color: string;
  bgColor: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Pure SVG sparkline -- no charting library needed */
function ActivitySparkline({ data, color = '#00F0FF' }: { data: number[]; color?: string }) {
  const w = 200;
  const h = 48;
  const pad = 4;
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-12 text-xs text-[#8892A4]">
        Not enough data yet
      </div>
    );
  }
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return { x, y };
  });
  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');
  // Fill area path
  const areaPath = `M${points[0].x},${h} ` + points.map((p) => `L${p.x},${p.y}`).join(' ') + ` L${points[points.length - 1].x},${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12" preserveAspectRatio="none" aria-label="Activity sparkline over the last 7 days">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#spark-fill)" />
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Dots */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} stroke="#0C0C18" strokeWidth="1.5" />
      ))}
    </svg>
  );
}

/** Skeleton placeholder for a glance card */
function GlanceCardSkeleton() {
  return (
    <div className="min-w-[160px] flex-shrink-0 snap-start rounded-2xl border border-[#00F0FF]/10 bg-[#0C0C18] p-4">
      <Skeleton className="w-10 h-10 rounded-xl mb-3" />
      <Skeleton className="h-7 w-12 mb-1" />
      <Skeleton className="h-4 w-20 mb-1" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OverviewPage({ onNavigate, onRefresh, onOpenChat }: OverviewPageProps) {
  const user = useAuthStore((s) => s.user);
  const { stats, reminders } = useDashboardStore();
  const loadErrors = useDashboardStore((s) => s.loadErrors);
  const loadDashboard = useDashboardStore((s) => s.loadDashboard);

  // Data states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationEntry[]>([]);
  const [activityData, setActivityData] = useState<number[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loadErrDismissed, setLoadErrDismissed] = useState(false);
  // Day labels for sparkline
  const [dayLabels, setDayLabels] = useState<string[]>([]);

  // Derived: today's reminders
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const todaysReminders = reminders.filter((r) => {
    if (!r.datetime) return false;
    const dt = new Date(r.datetime);
    return dt >= todayStart && dt <= todayEnd;
  });
  const pendingReminders = todaysReminders.filter((r) => !r.completed);
  const nextReminder = pendingReminders
    .filter((r) => new Date(r.datetime) >= new Date())
    .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())[0];

  // Messages today count from stats
  const messagesToday = stats.messagesSent || 0;

  // Load data
  const fetchOverviewData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled([
        memoryService.conversations(5),
        activityService.getStats(),
      ]);

      // Conversations
      if (results[0].status === 'fulfilled') {
        const convos = results[0].value.data;
        // Get only user messages to show as conversation previews
        setConversations(Array.isArray(convos) ? convos.filter((c) => c.role === 'user').slice(0, 3) : []);
      }

      // Activity stats for sparkline
      if (results[1].status === 'fulfilled') {
        const days = results[1].value.data.days || [];
        setActivityData(days.map((d: { messages: number }) => d.messages));
        setDayLabels(days.map((d: { date: string }) => {
          const dt = new Date(d.date);
          return dt.toLocaleDateString(undefined, { weekday: 'short' });
        }));
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
  }, [fetchOverviewData]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    onRefresh?.();
    fetchOverviewData().finally(() => setIsRefreshing(false));
  }, [onRefresh, fetchOverviewData]);

  const handlePullRefresh = async () => {
    handleRefresh();
    await new Promise((resolve) => setTimeout(resolve, 1200));
  };

  // ---------------------------------------------------------------------------
  // Glance cards data
  // ---------------------------------------------------------------------------

  const glanceCards: GlanceCard[] = [
    {
      key: 'reminders',
      label: 'Reminders',
      value: String(pendingReminders.length),
      sub: nextReminder
        ? `Next: ${new Date(nextReminder.datetime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
        : 'No upcoming',
      icon: Bell,
      color: '#00F0FF',
      bgColor: 'rgba(0,240,255,0.08)',
    },
    {
      key: 'habits',
      label: 'Habits',
      value: `${reminders.filter((r) => r.completed).length}/${reminders.length || 0}`,
      sub: reminders.length > 0 ? 'logged today' : 'Start tracking',
      icon: Target,
      color: '#ADFF2F',
      bgColor: 'rgba(173,255,47,0.08)',
    },
    {
      key: 'messages',
      label: 'Conversations',
      value: String(messagesToday),
      sub: 'messages today',
      icon: MessageSquare,
      color: '#8B5CF6',
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

  // ---------------------------------------------------------------------------
  // Quick actions
  // ---------------------------------------------------------------------------

  const quickActions = [
    { label: 'New Reminder', icon: Bell, color: '#00F0FF', page: 'reminders?openAdd=true' },
    { label: 'Chat with Weebo', icon: MessageSquare, color: '#ADFF2F', action: () => onOpenChat?.() },
    { label: 'Start Focus', icon: Timer, color: '#FF2D78', page: 'focus' },
    { label: 'Log Habit', icon: Target, color: '#8B5CF6', page: 'reminders' },
    { label: 'New Note', icon: FileText, color: '#FFD700', page: 'docs' },
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const greeting = getGreeting();
  const firstName = user?.name?.split(' ')[0] || 'there';

  return (
    <PullToRefreshWrapper onRefresh={handlePullRefresh}>
      <div
        data-testid="dashboard-overview"
        className="space-y-6 pb-8"
        style={{ background: '#05050A' }}
      >
        {/* ─── Personalized Greeting Header ─── */}
        <div
          className={`transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <h1
                className="text-3xl md:text-4xl font-bold tracking-tight"
                style={{ fontFamily: 'Syne, sans-serif', color: '#F4F6FF' }}
              >
                {greeting},{' '}
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: 'linear-gradient(135deg, #00F0FF, #ADFF2F)' }}
                >
                  {firstName}
                </span>
              </h1>
              <p className="text-[#8892A4] mt-1.5 text-sm sm:text-base">
                {pendingReminders.length > 0 && (
                  <>
                    You have{' '}
                    <span className="text-[#00F0FF] font-medium">
                      {pendingReminders.length} reminder{pendingReminders.length !== 1 ? 's' : ''}
                    </span>{' '}
                    today
                    {reminders.length > 0 && (
                      <>
                        ,{' '}
                        <span className="text-[#ADFF2F] font-medium">
                          {reminders.filter((r) => r.completed).length} task{reminders.filter((r) => r.completed).length !== 1 ? 's' : ''} done
                        </span>
                      </>
                    )}
                  </>
                )}
                {pendingReminders.length === 0 && (
                  <>
                    {messagesToday > 0 ? (
                      <>
                        <span className="text-[#00F0FF] font-medium">{messagesToday} messages</span> sent today
                      </>
                    ) : (
                      <>All clear — ready to start your day</>
                    )}
                  </>
                )}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="border-[#00F0FF]/20 text-[#8892A4] hover:text-[#F4F6FF] hover:border-[#00F0FF]/40 self-start sm:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* ─── Load error banner ─── */}
        {loadErrors > 0 && !loadErrDismissed && (
          <div className="flex items-center gap-3 rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-4 py-3 text-sm text-[#F59E0B]">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">
              {loadErrors} section{loadErrors > 1 ? 's' : ''} failed to load.
            </span>
            <button
              onClick={() => { setLoadErrDismissed(true); void loadDashboard(); }}
              className="text-xs underline hover:no-underline"
            >
              Retry
            </button>
            <button
              onClick={() => setLoadErrDismissed(true)}
              aria-label="Dismiss"
              className="p-1 rounded hover:bg-[#F59E0B]/20 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ─── Error state ─── */}
        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-[#FF2D78]/30 bg-[#FF2D78]/10 px-4 py-3 text-sm text-[#FF2D78]">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              onClick={handleRefresh}
              className="text-xs underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* ─── Today At A Glance ─── */}
        <section>
          <h2
            className="text-sm font-semibold text-[#8892A4] uppercase tracking-wider mb-3"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            Today at a glance
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-none md:grid md:grid-cols-4 md:overflow-visible">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <GlanceCardSkeleton key={i} />)
              : glanceCards.map((card, idx) => (
                  <div
                    key={card.key}
                    className={`min-w-[160px] flex-shrink-0 snap-start rounded-2xl border border-[#00F0FF]/10 bg-[#0C0C18] p-4 transition-all duration-500 hover:border-[#00F0FF]/25 hover:scale-[1.02] cursor-pointer ${
                      mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                    }`}
                    style={{ transitionDelay: `${idx * 80}ms` }}
                    onClick={() => {
                      if (card.key === 'reminders') onNavigate?.('reminders');
                      else if (card.key === 'messages') onOpenChat?.();
                      else if (card.key === 'focus') onNavigate?.('focus');
                      else if (card.key === 'habits') onNavigate?.('reminders');
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (card.key === 'reminders') onNavigate?.('reminders');
                        else if (card.key === 'messages') onOpenChat?.();
                        else if (card.key === 'focus') onNavigate?.('focus');
                        else if (card.key === 'habits') onNavigate?.('reminders');
                      }
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                      style={{ backgroundColor: card.bgColor }}
                    >
                      <card.icon className="w-5 h-5" style={{ color: card.color }} />
                    </div>
                    <div
                      className="text-2xl font-bold"
                      style={{ color: card.color }}
                    >
                      {card.value}
                    </div>
                    <div className="text-sm font-medium text-[#F4F6FF] mt-0.5">{card.label}</div>
                    <div className="text-xs text-[#8892A4] mt-0.5">{card.sub}</div>
                  </div>
                ))}
          </div>
        </section>

        {/* ─── Quick Actions Strip ─── */}
        <section>
          <h2
            className="text-sm font-semibold text-[#8892A4] uppercase tracking-wider mb-3"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            Quick actions
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory scrollbar-none">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => {
                  if (action.action) action.action();
                  else if (action.page) onNavigate?.(action.page);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#00F0FF]/10 bg-[#0C0C18] text-sm font-medium text-[#F4F6FF] whitespace-nowrap snap-start transition-all hover:border-[#00F0FF]/30 hover:bg-[#0C0C18]/80 active:scale-95 min-h-[44px] focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50"
              >
                <action.icon className="w-4 h-4 flex-shrink-0" style={{ color: action.color }} />
                {action.label}
              </button>
            ))}
          </div>
        </section>

        {/* ─── Two-column layout: Conversations + Sparkline ─── */}
        <div className="grid gap-4 lg:grid-cols-5">
          {/* Recent Conversations */}
          <section className="lg:col-span-3">
            <div className="flex items-center justify-between mb-3">
              <h2
                className="text-sm font-semibold text-[#8892A4] uppercase tracking-wider"
                style={{ fontFamily: 'Syne, sans-serif' }}
              >
                Recent conversations
              </h2>
              <button
                onClick={() => onNavigate?.('chat')}
                className="flex items-center gap-1 text-xs text-[#8892A4] hover:text-[#00F0FF] transition-colors"
              >
                View all
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <Card
              className="border-[#00F0FF]/10 bg-[#0C0C18] rounded-2xl overflow-hidden"
              style={{ background: '#0C0C18' }}
            >
              <CardContent className="p-0">
                {loading ? (
                  <div className="divide-y divide-[#00F0FF]/5">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="p-4 flex items-start gap-3">
                        <Skeleton className="w-9 h-9 rounded-lg flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : conversations.length > 0 ? (
                  <div className="divide-y divide-[#00F0FF]/5">
                    {conversations.map((convo) => (
                      <button
                        key={convo.id}
                        onClick={() => onOpenChat?.()}
                        className="w-full p-4 flex items-start gap-3 text-left hover:bg-[#00F0FF]/[0.03] transition-colors group"
                      >
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-[#8B5CF6]/10 mt-0.5">
                          <Sparkles className="w-4 h-4 text-[#8B5CF6]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#F4F6FF] truncate group-hover:text-[#00F0FF] transition-colors">
                            {convo.content.length > 80
                              ? convo.content.slice(0, 80) + '...'
                              : convo.content}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-[#8892A4]">
                              Weebo
                            </span>
                            <span className="text-[#8892A4]/40">|</span>
                            <span className="text-xs text-[#8892A4]">
                              {relativeTime(convo.createdAt)}
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-[#8892A4]/40 group-hover:text-[#00F0FF] transition-colors flex-shrink-0 mt-1" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <MessageSquare className="w-8 h-8 text-[#8892A4]/30 mx-auto mb-2" />
                    <p className="text-sm text-[#8892A4]">No conversations yet</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 text-[#00F0FF]"
                      onClick={() => onOpenChat?.()}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Start a chat
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Activity Sparkline */}
          <section className="lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h2
                className="text-sm font-semibold text-[#8892A4] uppercase tracking-wider"
                style={{ fontFamily: 'Syne, sans-serif' }}
              >
                7-day activity
              </h2>
              <button
                onClick={() => onNavigate?.('activity')}
                className="flex items-center gap-1 text-xs text-[#8892A4] hover:text-[#00F0FF] transition-colors"
              >
                Details
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <Card
              className="border-[#00F0FF]/10 bg-[#0C0C18] rounded-2xl"
              style={{ background: '#0C0C18' }}
            >
              <CardContent className="p-4">
                {loading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-12 w-full" />
                    <div className="flex justify-between">
                      {Array.from({ length: 7 }).map((_, i) => (
                        <Skeleton key={i} className="h-3 w-6" />
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <ActivitySparkline data={activityData} color="#00F0FF" />
                    {/* Day labels */}
                    {dayLabels.length > 0 && (
                      <div className="flex justify-between mt-2 px-1">
                        {dayLabels.map((label, i) => (
                          <span key={i} className="text-[10px] text-[#8892A4] font-mono">
                            {label}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Summary stats */}
                    <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-[#00F0FF]/5">
                      <div>
                        <div className="text-xs text-[#8892A4]">Total this week</div>
                        <div className="text-lg font-bold text-[#00F0FF] font-mono">
                          {activityData.reduce((a, b) => a + b, 0)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-[#8892A4]">Today</div>
                        <div className="text-lg font-bold text-[#ADFF2F] font-mono">
                          {activityData.length > 0 ? activityData[activityData.length - 1] : 0}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Completion badge */}
            {!loading && reminders.length > 0 && (
              <div
                className="mt-3 rounded-2xl border border-[#ADFF2F]/10 bg-[#0C0C18] p-4 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ADFF2F]/10 flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-[#ADFF2F]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#F4F6FF]">
                    {reminders.filter((r) => r.completed).length} of {reminders.length} tasks done
                  </div>
                  <div className="text-xs text-[#8892A4] mt-0.5">
                    {reminders.filter((r) => r.completed).length === reminders.length
                      ? 'All caught up!'
                      : `${reminders.length - reminders.filter((r) => r.completed).length} remaining`}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </PullToRefreshWrapper>
  );
}
