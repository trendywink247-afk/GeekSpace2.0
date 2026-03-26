import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  Send,
  Link2,
  Clock,
  Mic,
  Brain,
  CheckSquare,
  CalendarDays,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PullToRefreshWrapper } from '@/components/PullToRefreshWrapper';
import { AgentStatusStrip } from '@/components/AgentStatusStrip';
import { DiscoverCard } from '@/components/DiscoverCard';
import { QuickActionsGrid } from '@/components/dashboard/QuickActionsGrid';
import { RecentGenerations } from '@/components/dashboard/RecentGenerations';
import { StreakCard } from '@/components/dashboard/StreakCard';
import { InboxCard } from '@/components/dashboard/InboxCard';
import { useAuthStore } from '@/stores/authStore';
import { useDashboardStore } from '@/stores/dashboardStore';
import {
  activityService,
  memoryService,
  reminderService,
  dashboardService,
} from '@/services/api';
import type { ConversationEntry } from '@/types';

// ---------------------------------------------------------------------------
// Overview API types (matches GET /api/dashboard/overview response)
// ---------------------------------------------------------------------------

interface OverviewReminder {
  id: string;
  text: string;
  datetime: string;
  category: string;
  recurring: string;
  priority: string;
  overdue: boolean;
}

interface OverviewHabit {
  id: number;
  name: string;
  icon: string;
  streak: number;
  loggedToday: boolean;
}

interface OverviewCalendarEvent {
  id: number;
  title: string;
  start_time: number;
  end_time: number | null;
}

interface OverviewWeeklyStats {
  messagesThisWeek: number;
  remindersCompleted: number;
  habitsLogged: number;
}

interface OverviewRecentConversation {
  id: string;
  content: string;
  created_at: string;
}

interface OverviewData {
  greeting: string;
  remindersDueToday: OverviewReminder[];
  habitsToday: OverviewHabit[];
  calendarEventsToday: OverviewCalendarEvent[];
  weeklyStats: OverviewWeeklyStats;
  recentConversations: OverviewRecentConversation[];
}

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

/** Detect Indian festivals and notable holidays (approximate fixed dates, 2026 calendar) */
function getFestivalGreeting(): string | null {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const day = now.getDate();

  // Fixed-date festivals
  if (month === 1 && day === 1) return 'Happy New Year!';
  if (month === 1 && day === 14) return 'Happy Makar Sankranti / Pongal!';
  if (month === 1 && day === 26) return 'Happy Republic Day!';
  if (month === 3 && day >= 9 && day <= 11) return 'Happy Maha Shivaratri!';
  if (month === 3 && day >= 14 && day <= 16) return 'Happy Holi!';
  if (month === 4 && day === 2) return 'Happy Ugadi / Gudi Padwa!';
  if (month === 4 && day === 6) return 'Happy Ram Navami!';
  if (month === 4 && day === 14) return 'Happy Baisakhi!';
  if (month === 5 && day === 1) return 'Happy May Day!';
  if (month === 5 && day === 12) return 'Happy Buddha Purnima!';
  if (month === 6 && day >= 26 && day <= 28) return 'Happy Eid al-Adha!';
  if (month === 7 && day >= 17 && day <= 19) return 'Happy Muharram!';
  if (month === 8 && day === 12) return 'Happy Raksha Bandhan!';
  if (month === 8 && day === 14) return 'Happy Janmashtami!';
  if (month === 8 && day === 15) return 'Happy Independence Day!';
  if (month === 8 && day >= 22 && day <= 31) return 'Happy Ganesh Chaturthi!';
  if (month === 9 && day >= 17 && day <= 26) return 'Happy Navratri!';
  if (month === 10 && day >= 2 && day <= 3) return 'Happy Dussehra!';
  if (month === 10 && day >= 20 && day <= 22) return 'Happy Diwali!';
  if (month === 10 && day === 23) return 'Happy Bhai Dooj!';
  if (month === 11 && day >= 1 && day <= 3) return 'Happy Diwali!';
  if (month === 11 && day >= 12 && day <= 15) return 'Happy Chhath Puja!';
  if (month === 11 && day === 24) return 'Happy Guru Nanak Jayanti!';
  if (month === 12 && day === 25) return 'Merry Christmas!';
  if (month === 12 && day === 31) return 'Happy New Year Eve!';
  return null;
}

/** Calculate estimated hours saved by AI: each message interaction saves ~2 minutes on avg */
function computeTimeSaved(totalMessages: number): { hours: number; minutes: number } {
  const totalMinutes = totalMessages * 2; // 2 min saved per message
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}

/** Check if user account is less than 7 days old */
function isNewUser(createdAt?: string): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= 7;
}

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Pure SVG sparkline with hover tooltips */
function ActivitySparkline({
  data,
  labels,
  color = '#00F0FF',
}: {
  data: number[];
  labels?: string[];
  color?: string;
}) {
  const w = 200;
  const h = 48;
  const pad = 4;
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

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
  const areaPath =
    `M${points[0].x},${h} ` +
    points.map((p) => `L${p.x},${p.y}`).join(' ') +
    ` L${points[points.length - 1].x},${h} Z`;

  // Compute hit zone width per point for hover detection
  const hitZoneWidth = (w - pad * 2) / Math.max(data.length - 1, 1);

  return (
    <div ref={containerRef} className="relative">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-12"
        preserveAspectRatio="none"
        aria-label="Activity sparkline over the last 7 days"
        onMouseLeave={() => setHoveredIdx(null)}
      >
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
        {/* Vertical hover guide line */}
        {hoveredIdx !== null && points[hoveredIdx] && (
          <line
            x1={points[hoveredIdx].x}
            y1={0}
            x2={points[hoveredIdx].x}
            y2={h}
            stroke={color}
            strokeWidth="0.8"
            strokeDasharray="3 2"
            opacity={0.4}
          />
        )}
        {/* Dots */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hoveredIdx === i ? 4 : 3}
            fill={hoveredIdx === i ? '#F4F6FF' : color}
            stroke={hoveredIdx === i ? color : '#0C0C18'}
            strokeWidth={hoveredIdx === i ? 2 : 1.5}
            className="transition-all duration-150"
          />
        ))}
        {/* Invisible hit zones for hover */}
        {points.map((p, i) => (
          <rect
            key={`hit-${i}`}
            x={p.x - hitZoneWidth / 2}
            y={0}
            width={hitZoneWidth}
            height={h}
            fill="transparent"
            onMouseEnter={() => setHoveredIdx(i)}
            onTouchStart={() => setHoveredIdx(i)}
            style={{ cursor: 'crosshair' }}
          />
        ))}
      </svg>
      {/* Tooltip */}
      {hoveredIdx !== null && points[hoveredIdx] && (
        <div
          className="absolute -top-9 pointer-events-none z-10 rounded-md px-2 py-1 text-xs font-mono whitespace-nowrap border border-[#00F0FF]/20"
          style={{
            left: `${(points[hoveredIdx].x / w) * 100}%`,
            transform: 'translateX(-50%)',
            background: '#12121F',
            color: '#F4F6FF',
          }}
        >
          {labels?.[hoveredIdx] ? `${labels[hoveredIdx]}: ` : ''}
          <span style={{ color }}>{data[hoveredIdx]}</span>
          {' msg'}
        </div>
      )}
    </div>
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
// ---------------------------------------------------------------------------
// iOS Install Banner
// ---------------------------------------------------------------------------

const IOS_DISMISS_KEY = 'ios-install-dismissed-at';
const IOS_DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function shouldShowIOSBanner(): boolean {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isSafari =
    /Safari/i.test(navigator.userAgent) &&
    !/Chrome|CriOS|FxiOS|EdgiOS/i.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (!isIOS || !isSafari || isStandalone) return false;

  const dismissedAt = localStorage.getItem(IOS_DISMISS_KEY);
  if (dismissedAt) {
    const elapsed = Date.now() - parseInt(dismissedAt, 10);
    if (elapsed < IOS_DISMISS_TTL_MS) return false;
  }
  return true;
}

function IOSInstallBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      role="banner"
      aria-label="iOS install guide"
      className="flex items-center gap-3 rounded-xl border border-[#00F0FF]/20 bg-[#00F0FF]/5 px-4 py-3 text-sm"
    >
      <span className="text-base leading-none select-none" aria-hidden>📱</span>
      <span className="flex-1 text-[#8892A4]">
        <span className="font-medium text-[#F4F6FF]">Install Agentin:</span>{' '}
        Tap the{' '}
        <span className="inline-flex items-center gap-0.5 font-medium text-[#00F0FF]">
          Share <span aria-label="share icon">⬆</span>
        </span>{' '}
        button → <span className="font-medium text-[#F4F6FF]">"Add to Home Screen"</span>
      </span>
      <button
        onClick={onDismiss}
        aria-label="Dismiss iOS install guide"
        className="p-1 rounded-lg hover:bg-[#00F0FF]/10 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center text-[#8892A4] hover:text-[#F4F6FF]"
      >
        <X className="w-4 h-4" />
      </button>
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
  // iOS install banner — shown after 3s delay
  const [showIOSBanner, setShowIOSBanner] = useState(false);
  // Day labels for sparkline
  const [dayLabels, setDayLabels] = useState<string[]>([]);

  // GAP-1: Overview endpoint data
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [completingReminder, setCompletingReminder] = useState<string | null>(null);

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

  // "AI saved you X hours" — calculate from total weekly activity
  const weeklyMessages = activityData.reduce((a, b) => a + b, 0);
  const timeSaved = useMemo(() => computeTimeSaved(weeklyMessages), [weeklyMessages]);

  // Quick chat input state
  const [quickChatInput, setQuickChatInput] = useState('');
  const quickChatRef = useRef<HTMLInputElement>(null);

  // Onboarding: detect new user (first 7 days)
  const showOnboarding = isNewUser(user?.createdAt);

  // GAP-1: Fetch unified overview endpoint
  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const res = await dashboardService.overview();
      setOverviewData(res.data as OverviewData);
    } catch {
      // Non-fatal: overview sections show empty state
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  // GAP-1: Complete a reminder via the overview card
  const handleCompleteReminder = useCallback(async (id: string) => {
    setCompletingReminder(id);
    try {
      await reminderService.update(id, { completed: true });
      // Optimistically remove from overview
      setOverviewData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          remindersDueToday: prev.remindersDueToday.filter((r) => r.id !== id),
          weeklyStats: {
            ...prev.weeklyStats,
            remindersCompleted: prev.weeklyStats.remindersCompleted + 1,
          },
        };
      });
    } catch {
      // Silently fail — user can retry
    } finally {
      setCompletingReminder(null);
    }
  }, []);

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
    fetchOverview();
  }, [fetchOverviewData, fetchOverview]);

  // Show iOS install banner after 3s if applicable
  useEffect(() => {
    if (!shouldShowIOSBanner()) return;
    const timer = setTimeout(() => setShowIOSBanner(true), 3000);
    return () => clearTimeout(timer);
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
    await new Promise((resolve) => setTimeout(resolve, 1200));
  };

  // ---------------------------------------------------------------------------
  // Glance cards data
  // ---------------------------------------------------------------------------

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
      color: '#00F0FF',
      bgColor: 'rgba(0,240,255,0.08)',
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
    { label: 'New Reminder', icon: Bell, color: '#00F0FF', bgColor: 'rgba(0,240,255,0.1)', page: 'reminders?openAdd=true' },
    { label: 'Chat with Weebo', icon: MessageSquare, color: '#ADFF2F', bgColor: 'rgba(173,255,47,0.1)', action: () => onOpenChat?.() },
    { label: 'Start Focus', icon: Timer, color: '#8B5CF6', bgColor: 'rgba(139,92,246,0.1)', page: 'focus' },
    { label: 'Log Habit', icon: Target, color: '#FF2D78', bgColor: 'rgba(255,45,120,0.1)', page: 'reminders' },
    { label: 'New Note', icon: FileText, color: '#FFB800', bgColor: 'rgba(255,184,0,0.1)', page: 'docs' },
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const greeting = getGreeting();
  const firstName = user?.name?.split(' ')[0] || 'there';
  const festivalGreeting = getFestivalGreeting();

  // Determine if user is in an empty/new state (no data at all)
  const isEmptyState =
    !loading &&
    conversations.length === 0 &&
    reminders.length === 0 &&
    messagesToday === 0 &&
    activityData.every((v) => v === 0);

  return (
    <PullToRefreshWrapper onRefresh={handlePullRefresh}>
      <div
        data-testid="dashboard-overview"
        className="space-y-6 pb-24 md:pb-6"
        style={{ background: '#05050A' }}
      >
        {/* ─── iOS Install Banner ─── */}
        {showIOSBanner && (
          <IOSInstallBanner onDismiss={handleIOSDismiss} />
        )}

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
              {/* Festival / holiday greeting pill */}
              {festivalGreeting && (
                <span
                  className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-xs font-medium border border-[#FFB800]/20 animate-pulse"
                  style={{ background: 'rgba(255,184,0,0.1)', color: '#FFB800' }}
                >
                  <Sparkles className="w-3 h-3" />
                  {festivalGreeting}
                </span>
              )}
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

        {/* ─── Agent Status Strip ─── */}
        <AgentStatusStrip
          onAgentClick={(agentId) => onNavigate?.(`chat?agent=${agentId}`)}
        />

        {/* ─── Sprint 4: Quick Actions Grid ─── */}
        <QuickActionsGrid onNavigate={onNavigate} onOpenChat={onOpenChat} />

        {/* ─── Sprint 4: Creations + Streak row ─── */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RecentGenerations onNavigate={onNavigate} />
          </div>
          <div className="lg:col-span-1">
            <StreakCard onNavigate={onNavigate} />
          </div>
        </div>

        {/* ─── Sprint 4: Inbox Card ─── */}
        <InboxCard onNavigate={onNavigate} onOpenChat={onOpenChat} />

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
                      else if (card.key === 'time-saved') onNavigate?.('activity');
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (card.key === 'reminders') onNavigate?.('reminders');
                        else if (card.key === 'messages') onOpenChat?.();
                        else if (card.key === 'focus') onNavigate?.('focus');
                        else if (card.key === 'time-saved') onNavigate?.('activity');
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
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium text-[#F4F6FF] whitespace-nowrap snap-start transition-all hover:scale-[1.03] active:scale-95 min-h-[44px] focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50"
                style={{
                  background: action.bgColor,
                  borderColor: `${action.color}20`,
                }}
              >
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ background: action.bgColor }}
                >
                  <action.icon className="w-3.5 h-3.5" style={{ color: action.color }} />
                </div>
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
                    {conversations.map((convo) => {
                      // Pick agent color by content hash for visual variety
                      const agentColors = ['#00F0FF', '#ADFF2F', '#8B5CF6', '#FF2D78', '#FFB800'];
                      const colorIdx = convo.id.charCodeAt(0) % agentColors.length;
                      const agentColor = agentColors[colorIdx];
                      return (
                        <button
                          key={convo.id}
                          onClick={() => onOpenChat?.()}
                          className="w-full p-4 flex items-start gap-3 text-left hover:bg-[#00F0FF]/[0.03] transition-colors group"
                        >
                          {/* Agent avatar — colored circle with initial */}
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold"
                            style={{
                              background: `${agentColor}15`,
                              color: agentColor,
                              border: `1.5px solid ${agentColor}30`,
                            }}
                          >
                            W
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[#F4F6FF] truncate group-hover:text-[#00F0FF] transition-colors leading-snug">
                              {convo.content.length > 80
                                ? convo.content.slice(0, 77) + '...'
                                : convo.content}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs font-medium" style={{ color: agentColor }}>
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
                      );
                    })}
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
                    <ActivitySparkline data={activityData} labels={dayLabels} color="#00F0FF" />
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

            {/* ─── Discover Card ─── */}
            <div className="mt-3">
              <DiscoverCard
                onNavigate={(path) => onNavigate?.(path)}
                onOpenChat={() => onOpenChat?.()}
              />
            </div>
          </section>
        </div>

        {/* ─── GAP-1: Today's Reminders Card ─── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2
              className="text-sm font-semibold text-[#8892A4] uppercase tracking-wider"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              Today&apos;s Reminders
            </h2>
            <button
              onClick={() => onNavigate?.('reminders')}
              className="flex items-center gap-1 text-xs text-[#8892A4] hover:text-[#00F0FF] transition-colors"
            >
              All reminders
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <Card
            className="border-[#00F0FF]/10 bg-[#0C0C18] rounded-2xl overflow-hidden"
            style={{ background: '#0C0C18' }}
          >
            <CardContent className="p-0">
              {overviewLoading ? (
                <div className="divide-y divide-[#00F0FF]/5">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="p-4 flex items-center gap-3">
                      <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                      <Skeleton className="w-14 h-7 rounded-md" />
                    </div>
                  ))}
                </div>
              ) : overviewData && overviewData.remindersDueToday.length > 0 ? (
                <div className="divide-y divide-[#00F0FF]/5">
                  {overviewData.remindersDueToday.map((rem) => (
                    <div
                      key={rem.id}
                      className={`p-4 flex items-center gap-3 ${rem.overdue ? 'bg-[#FF2D78]/[0.04]' : ''}`}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                          background: rem.overdue ? 'rgba(255,45,120,0.12)' : 'rgba(0,240,255,0.08)',
                        }}
                      >
                        <Bell className="w-4 h-4" style={{ color: rem.overdue ? '#FF2D78' : '#00F0FF' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#F4F6FF] truncate">{rem.text}</p>
                        <span className={`text-xs ${rem.overdue ? 'text-[#FF2D78]' : 'text-[#8892A4]'}`}>
                          {rem.overdue ? 'Overdue - ' : ''}
                          {new Date(rem.datetime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={completingReminder === rem.id}
                        onClick={() => handleCompleteReminder(rem.id)}
                        className="text-[#ADFF2F] hover:bg-[#ADFF2F]/10 text-xs px-2 h-7 rounded-md"
                      >
                        {completingReminder === rem.id ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <Check className="w-3 h-3 mr-1" />
                            Done
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center">
                  <CheckCircle2 className="w-6 h-6 text-[#ADFF2F]/40 mx-auto mb-1.5" />
                  <p className="text-sm text-[#ADFF2F]">No reminders for today</p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ─── GAP-1: Habits Today Card ─── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2
              className="text-sm font-semibold text-[#8892A4] uppercase tracking-wider"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              Habits Today
            </h2>
            <button
              onClick={() => onNavigate?.('reminders')}
              className="flex items-center gap-1 text-xs text-[#8892A4] hover:text-[#00F0FF] transition-colors"
            >
              Manage
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <Card
            className="border-[#00F0FF]/10 bg-[#0C0C18] rounded-2xl overflow-hidden"
            style={{ background: '#0C0C18' }}
          >
            <CardContent className="p-0">
              {overviewLoading ? (
                <div className="p-4 space-y-3">
                  <Skeleton className="h-3 w-24 mb-2" />
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="w-8 h-8 rounded-lg" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-3 w-1/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : overviewData && overviewData.habitsToday.length > 0 ? (
                <>
                  {/* Progress bar */}
                  <div className="px-4 pt-4 pb-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-[#8892A4]">
                        {overviewData.habitsToday.filter((h) => h.loggedToday).length}/{overviewData.habitsToday.length} habits done
                      </span>
                      <span className="text-xs font-mono text-[#ADFF2F]">
                        {Math.round((overviewData.habitsToday.filter((h) => h.loggedToday).length / overviewData.habitsToday.length) * 100)}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#1A1A2E] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#ADFF2F] to-[#00F0FF] transition-all duration-500"
                        style={{
                          width: `${(overviewData.habitsToday.filter((h) => h.loggedToday).length / overviewData.habitsToday.length) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="divide-y divide-[#00F0FF]/5">
                    {overviewData.habitsToday.map((habit) => (
                      <div
                        key={habit.id}
                        className="px-4 py-3 flex items-center gap-3"
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
                          style={{ background: habit.loggedToday ? 'rgba(173,255,47,0.1)' : 'rgba(139,92,246,0.08)' }}
                        >
                          {habit.icon === 'star' ? <Target className="w-4 h-4 text-[#8B5CF6]" /> : habit.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${habit.loggedToday ? 'text-[#ADFF2F]' : 'text-[#F4F6FF]'}`}>
                            {habit.name}
                          </p>
                          <span className="text-xs text-[#8892A4]">
                            {habit.streak > 0 ? `${habit.streak} day streak` : 'No streak yet'}
                          </span>
                        </div>
                        {habit.loggedToday ? (
                          <div className="w-7 h-7 rounded-full bg-[#ADFF2F]/15 flex items-center justify-center flex-shrink-0">
                            <Check className="w-4 h-4 text-[#ADFF2F]" />
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onNavigate?.('reminders')}
                            className="text-[#8B5CF6] hover:bg-[#8B5CF6]/10 text-xs px-2 h-7 rounded-md"
                          >
                            Log
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="p-6 text-center">
                  <Target className="w-6 h-6 text-[#8892A4]/30 mx-auto mb-1.5" />
                  <p className="text-sm text-[#8892A4]">No habits set up yet</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1.5 text-[#00F0FF]"
                    onClick={() => onNavigate?.('reminders')}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Create a habit
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ─── GAP-1: Calendar Today Card ─── */}
        {overviewData && overviewData.calendarEventsToday.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2
                className="text-sm font-semibold text-[#8892A4] uppercase tracking-wider"
                style={{ fontFamily: 'Syne, sans-serif' }}
              >
                Calendar Today
              </h2>
              <button
                onClick={() => onNavigate?.('calendar')}
                className="flex items-center gap-1 text-xs text-[#8892A4] hover:text-[#00F0FF] transition-colors"
              >
                Full calendar
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <Card
              className="border-[#00F0FF]/10 bg-[#0C0C18] rounded-2xl overflow-hidden"
              style={{ background: '#0C0C18' }}
            >
              <CardContent className="p-0">
                <div className="divide-y divide-[#00F0FF]/5">
                  {overviewData.calendarEventsToday.slice(0, 4).map((evt) => {
                    const startDate = new Date(evt.start_time);
                    const endDate = evt.end_time ? new Date(evt.end_time) : null;
                    const now = Date.now();
                    const isCurrent = evt.start_time <= now && (evt.end_time ? evt.end_time >= now : true);
                    return (
                      <div
                        key={evt.id}
                        className={`p-4 flex items-center gap-3 ${isCurrent ? 'bg-[#00F0FF]/[0.04] border-l-2 border-l-[#00F0FF]' : ''}`}
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: isCurrent ? 'rgba(0,240,255,0.12)' : 'rgba(139,92,246,0.08)' }}
                        >
                          <CalendarDays className="w-4 h-4" style={{ color: isCurrent ? '#00F0FF' : '#8B5CF6' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[#F4F6FF] truncate">{evt.title}</p>
                          <span className="text-xs text-[#8892A4]">
                            {startDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                            {endDate ? ` - ${endDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}
                          </span>
                        </div>
                        {isCurrent && (
                          <span className="text-[10px] font-medium text-[#00F0FF] bg-[#00F0FF]/10 px-2 py-0.5 rounded-full">
                            NOW
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* ─── GAP-1: Weekly Stats Card ─── */}
        {overviewData && (
          <section>
            <h2
              className="text-sm font-semibold text-[#8892A4] uppercase tracking-wider mb-3"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              This Week
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <Card className="border-[#00F0FF]/10 bg-[#0C0C18] rounded-2xl" style={{ background: '#0C0C18' }}>
                <CardContent className="p-4 text-center">
                  <MessageSquare className="w-5 h-5 text-[#00F0FF] mx-auto mb-1.5" />
                  <div className="text-xl font-bold text-[#00F0FF] font-mono">
                    {overviewData.weeklyStats.messagesThisWeek}
                  </div>
                  <div className="text-[10px] text-[#8892A4] mt-0.5">Messages</div>
                </CardContent>
              </Card>
              <Card className="border-[#ADFF2F]/10 bg-[#0C0C18] rounded-2xl" style={{ background: '#0C0C18' }}>
                <CardContent className="p-4 text-center">
                  <CheckCircle2 className="w-5 h-5 text-[#ADFF2F] mx-auto mb-1.5" />
                  <div className="text-xl font-bold text-[#ADFF2F] font-mono">
                    {overviewData.weeklyStats.remindersCompleted}
                  </div>
                  <div className="text-[10px] text-[#8892A4] mt-0.5">Reminders Done</div>
                </CardContent>
              </Card>
              <Card className="border-[#8B5CF6]/10 bg-[#0C0C18] rounded-2xl" style={{ background: '#0C0C18' }}>
                <CardContent className="p-4 text-center">
                  <Target className="w-5 h-5 text-[#8B5CF6] mx-auto mb-1.5" />
                  <div className="text-xl font-bold text-[#8B5CF6] font-mono">
                    {overviewData.weeklyStats.habitsLogged}
                  </div>
                  <div className="text-[10px] text-[#8892A4] mt-0.5">Habits Logged</div>
                </CardContent>
              </Card>
            </div>
          </section>
        )}

        {/* ─── Onboarding Checklist (new users, first 7 days) ─── */}
        {showOnboarding && (
          <section
            className={`transition-all duration-700 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            <h2
              className="text-sm font-semibold text-[#8892A4] uppercase tracking-wider mb-3"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              Get started
            </h2>
            <Card
              className="border-[#00F0FF]/15 bg-[#0C0C18] rounded-2xl overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #0C0C18 0%, #12121F 100%)' }}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-3 mb-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, rgba(0,240,255,0.15), rgba(173,255,47,0.1))' }}
                  >
                    <Sparkles className="w-5 h-5 text-[#00F0FF]" />
                  </div>
                  <div>
                    <h3
                      className="text-base font-bold text-[#F4F6FF]"
                      style={{ fontFamily: 'Syne, sans-serif' }}
                    >
                      Welcome to Agentin!
                    </h3>
                    <p className="text-xs text-[#8892A4] mt-0.5">
                      Complete these steps to unlock your full AI experience.
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {[
                    {
                      label: 'Connect Telegram',
                      desc: 'Chat with your AI on the go',
                      icon: Link2,
                      color: '#8B5CF6',
                      done: false,
                      action: () => onNavigate?.('connections'),
                    },
                    {
                      label: 'Set up habits',
                      desc: 'Track your daily goals',
                      icon: Target,
                      color: '#ADFF2F',
                      done: reminders.length > 0,
                      action: () => onNavigate?.('reminders'),
                    },
                    {
                      label: 'Try voice input',
                      desc: 'Talk to Weebo hands-free',
                      icon: Mic,
                      color: '#FF2D78',
                      done: false,
                      action: () => onOpenChat?.(),
                    },
                    {
                      label: 'Add a memory',
                      desc: 'Teach your AI about you',
                      icon: Brain,
                      color: '#00F0FF',
                      done: false,
                      action: () => onNavigate?.('memory'),
                    },
                  ].map((step) => (
                    <button
                      key={step.label}
                      onClick={step.action}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all hover:scale-[1.01] active:scale-[0.99] min-h-[44px] ${
                        step.done
                          ? 'border-[#ADFF2F]/20 bg-[#ADFF2F]/5'
                          : 'border-[#00F0FF]/10 hover:border-[#00F0FF]/25'
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: `${step.color}15` }}
                      >
                        {step.done ? (
                          <CheckSquare className="w-4 h-4 text-[#ADFF2F]" />
                        ) : (
                          <step.icon className="w-4 h-4" style={{ color: step.color }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium ${step.done ? 'text-[#ADFF2F] line-through' : 'text-[#F4F6FF]'}`}>
                          {step.label}
                        </div>
                        <div className="text-xs text-[#8892A4]">{step.desc}</div>
                      </div>
                      {!step.done && (
                        <ArrowRight className="w-4 h-4 text-[#8892A4]/40 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* ─── Onboarding Card (empty state, no-data fallback) ─── */}
        {isEmptyState && !showOnboarding && (
          <section
            className={`transition-all duration-700 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            <Card
              className="border-[#00F0FF]/15 bg-[#0C0C18] rounded-2xl overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #0C0C18 0%, #12121F 100%)' }}
            >
              <CardContent className="p-6 sm:p-8">
                <div className="flex items-start gap-4 mb-5">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, rgba(0,240,255,0.15), rgba(173,255,47,0.1))' }}
                  >
                    <Sparkles className="w-6 h-6 text-[#00F0FF]" />
                  </div>
                  <div>
                    <h3
                      className="text-lg font-bold text-[#F4F6FF]"
                      style={{ fontFamily: 'Syne, sans-serif' }}
                    >
                      Welcome to Agentin!
                    </h3>
                    <p className="text-sm text-[#8892A4] mt-1 leading-relaxed">
                      Start by chatting with Weebo, setting a reminder, or connecting Telegram.
                      Your dashboard will light up as you go.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={() => onOpenChat?.()}
                    className="flex items-center gap-3 p-3 rounded-xl border border-[#ADFF2F]/15 transition-all hover:border-[#ADFF2F]/30 hover:scale-[1.02] active:scale-95 min-h-[44px]"
                    style={{ background: 'rgba(173,255,47,0.06)' }}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#ADFF2F]/10 flex-shrink-0">
                      <Send className="w-4 h-4 text-[#ADFF2F]" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-medium text-[#F4F6FF]">Chat with Weebo</div>
                      <div className="text-xs text-[#8892A4]">Ask anything</div>
                    </div>
                  </button>
                  <button
                    onClick={() => onNavigate?.('reminders?openAdd=true')}
                    className="flex items-center gap-3 p-3 rounded-xl border border-[#00F0FF]/15 transition-all hover:border-[#00F0FF]/30 hover:scale-[1.02] active:scale-95 min-h-[44px]"
                    style={{ background: 'rgba(0,240,255,0.06)' }}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#00F0FF]/10 flex-shrink-0">
                      <Bell className="w-4 h-4 text-[#00F0FF]" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-medium text-[#F4F6FF]">Set a Reminder</div>
                      <div className="text-xs text-[#8892A4]">Stay on track</div>
                    </div>
                  </button>
                  <button
                    onClick={() => onNavigate?.('connections')}
                    className="flex items-center gap-3 p-3 rounded-xl border border-[#8B5CF6]/15 transition-all hover:border-[#8B5CF6]/30 hover:scale-[1.02] active:scale-95 min-h-[44px]"
                    style={{ background: 'rgba(139,92,246,0.06)' }}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#8B5CF6]/10 flex-shrink-0">
                      <Link2 className="w-4 h-4 text-[#8B5CF6]" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-medium text-[#F4F6FF]">Connect Telegram</div>
                      <div className="text-xs text-[#8892A4]">Chat on the go</div>
                    </div>
                  </button>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* ─── Quick Chat Input ─── */}
        <section
          className={`transition-all duration-700 delay-400 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (quickChatInput.trim()) {
                onOpenChat?.();
                setQuickChatInput('');
              }
            }}
            className="relative"
          >
            <div className="flex items-center gap-2 rounded-2xl border border-[#00F0FF]/15 bg-[#0C0C18] p-2 transition-all focus-within:border-[#00F0FF]/40 focus-within:shadow-[0_0_20px_rgba(0,240,255,0.05)]">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#ADFF2F]/10 flex-shrink-0 ml-1">
                <MessageSquare className="w-4 h-4 text-[#ADFF2F]" />
              </div>
              <input
                ref={quickChatRef}
                type="text"
                value={quickChatInput}
                onChange={(e) => setQuickChatInput(e.target.value)}
                placeholder="Ask Weebo anything..."
                className="flex-1 bg-transparent text-sm text-[#F4F6FF] placeholder:text-[#8892A4]/60 outline-none min-h-[36px] px-1"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!quickChatInput.trim()}
                className="rounded-xl bg-[#00F0FF]/15 text-[#00F0FF] hover:bg-[#00F0FF]/25 border-0 disabled:opacity-30 min-h-[36px] px-3"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </section>
      </div>
    </PullToRefreshWrapper>
  );
}
