import { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Calendar,
  Bell,
  Terminal,
  ExternalLink,
  Zap,
  CheckCircle,
  TrendingUp,
  Clock,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  MapPin,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  GripVertical,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PullToRefreshWrapper } from '@/components/PullToRefreshWrapper';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { useAuthStore } from '@/stores/authStore';
import { useDashboardStore } from '@/stores/dashboardStore';
import { briefingService, modelService, agentService, usageService, activityService } from '@/services/api';
import type { FreeModel, ModelChangelogEntry } from '@/types';

interface OverviewPageProps {
  onViewPortfolio: (username: string) => void;
  onNavigate?: (page: string) => void;
  onRefresh?: () => void;
  onOpenChat?: () => void;
}

const integrationIcons: Record<string, typeof MessageSquare> = {
  telegram: MessageSquare,
  'google-calendar': Calendar,
  location: MapPin,
  github: Terminal,
  twitter: Zap,
  linkedin: Zap,
};

const integrationColors: Record<string, string> = {
  telegram: '#0088cc',
  'google-calendar': '#4285f4',
  location: '#00FF88',
  github: '#f0f6fc',
  twitter: '#1da1f2',
  linkedin: '#0a66c2',
};

// Chart data defaults (used when API hasn't returned yet)
const emptyWeeklyData = [
  { name: 'Mon', messages: 0, api: 0 },
  { name: 'Tue', messages: 0, api: 0 },
  { name: 'Wed', messages: 0, api: 0 },
  { name: 'Thu', messages: 0, api: 0 },
  { name: 'Fri', messages: 0, api: 0 },
  { name: 'Sat', messages: 0, api: 0 },
  { name: 'Sun', messages: 0, api: 0 },
];

const emptyHourlyData = [
  { hour: '00:00', activity: 0 },
  { hour: '04:00', activity: 0 },
  { hour: '08:00', activity: 0 },
  { hour: '12:00', activity: 0 },
  { hour: '16:00', activity: 0 },
  { hour: '20:00', activity: 0 },
];

// Accent colors per stat for bento visual variety
const statAccents = ['#00F0FF', '#ADFF2F', '#FFD700', '#FF2D78'];

// Mock sparkline data shown when no real time-series data is available yet
const MOCK_SPARKLINES = [
  [2, 5, 3, 8, 6, 9, 12],   // Messages: upward trend (cyan)
  [1, 3, 2, 4, 3, 5, 4],    // Reminders: steady (lime)
  [100, 95, 88, 80, 75, 70, 65], // Credits: descending (amber)
  [320, 280, 310, 290, 260, 270, 240], // Response time proxy (pink)
];

// Sparkline: pure SVG polyline from an array of numbers
function Sparkline({ data, color = '#00F0FF', width = 80, height = 28 }: {
  data: number[]; color?: string; width?: number; height?: number;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.7" />
    </svg>
  );
}

export function OverviewPage({ onViewPortfolio, onNavigate, onRefresh, onOpenChat }: OverviewPageProps) {
  const [greeting, setGreeting] = useState('Good evening');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [latestBriefing, setLatestBriefing] = useState<{ content: string; created_at: string } | null>(null);
  const [freeModels, setFreeModels] = useState<FreeModel[]>([]);
  const [changelog, setChangelog] = useState<ModelChangelogEntry[]>([]);
  const [modelsLastUpdated, setModelsLastUpdated] = useState<string | null>(null);
  const [preferredModel, setPreferredModel] = useState<string>('auto');
  const [showChangelog, setShowChangelog] = useState(false);
  const [modelSaving, setModelSaving] = useState<string | null>(null);
  const [briefingTime, setBriefingTime] = useState('08:00');
  const [briefingSaving, setBriefingSaving] = useState(false);
  const [dailyUsage, setDailyUsage] = useState<Array<{ day: string; label: string; messages: number; credits: number }>>([]);
  const [agentQuality, setAgentQuality] = useState<{
    satisfactionRate: number | null;
    trend: 'up' | 'down' | 'neutral';
    hasEnoughData: boolean;
  } | null>(null);
  const [activityStats, setActivityStats] = useState<{ date: string; messages: number; reminders: number }[]>([]);

  // 35.2: Stat card reorder (drag-to-reorder, persisted in localStorage)
  const [statOrder, setStatOrder] = useState<number[]>(() => {
    try {
      const stored = localStorage.getItem('gs_stat_order');
      if (stored) {
        const parsed = JSON.parse(stored) as number[];
        if (Array.isArray(parsed) && parsed.length === 4) return parsed;
      }
    } catch { /* ignore */ }
    return [0, 1, 2, 3];
  });
  const dragSrcIdx = useRef<number | null>(null);

  // Onboarding checklist state
  const ONBOARDING_ITEMS = [
    { id: 'profile', label: 'Complete your profile', page: 'settings' },
    { id: 'skill', label: 'Add a skill', page: 'portfolio' },
    { id: 'project', label: 'Create a project', page: 'portfolio' },
    { id: 'portfolio', label: 'Enable your portfolio', page: 'portfolio' },
    { id: 'telegram', label: 'Connect Telegram', page: 'connections' },
  ] as const;
  type OnboardingItemId = typeof ONBOARDING_ITEMS[number]['id'];
  const [onboardingDone, setOnboardingDone] = useState<OnboardingItemId[]>(() => {
    try {
      const stored = localStorage.getItem('gs_onboarding_done');
      return stored ? (JSON.parse(stored) as OnboardingItemId[]) : [];
    } catch { return []; }
  });
  const [onboardingDismissed, setOnboardingDismissed] = useState(() =>
    localStorage.getItem('gs_onboarding_dismissed') === 'true'
  );
  const allOnboardingDone = onboardingDone.length >= ONBOARDING_ITEMS.length;
  const showOnboarding = !onboardingDismissed && !allOnboardingDone;

  const toggleOnboardingItem = (id: OnboardingItemId) => {
    setOnboardingDone(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem('gs_onboarding_done', JSON.stringify(next));
      return next;
    });
  };

  const dismissOnboarding = () => {
    setOnboardingDismissed(true);
    localStorage.setItem('gs_onboarding_dismissed', 'true');
  };

  // Telegram connect banner state (33.3)
  const [telegramBannerDismissed, setTelegramBannerDismissed] = useState(() =>
    localStorage.getItem('gs_telegram_banner_dismissed') === 'true'
  );
  const dismissTelegramBanner = () => {
    setTelegramBannerDismissed(true);
    localStorage.setItem('gs_telegram_banner_dismissed', 'true');
  };

  // 36.3: Overdue reminder alert (session-only dismiss)
  const [overdueAlertDismissed, setOverdueAlertDismissed] = useState(false);

  const user = useAuthStore((s) => s.user);
  const { stats, integrations, agent, reminders, chartData, hourlyData } = useDashboardStore();

  // Detect Telegram connection for banner (33.3)
  const isTelegramConnected = integrations.some(i => i.type === 'telegram' && i.status === 'connected');
  const showTelegramBanner = !telegramBannerDismissed && !isTelegramConnected;

  // Map real chart data to weekly format (use API data if available, else fallback)
  const weeklyChartData = chartData.length > 0
    ? chartData.map(d => ({ name: d.label, messages: d.requests, api: d.tokens }))
    : emptyWeeklyData;
  const hourlyActivityData = hourlyData.length > 0
    ? hourlyData.map(d => ({ hour: `${d.hour}:00`, activity: d.requests }))
    : emptyHourlyData;

  // 7-day sparkline data per stat card (parallel to quickStats array)
  const statSparklines = [
    chartData.length > 1 ? chartData.map(d => ({ v: d.requests })) : [],             // Messages Sent
    chartData.length > 1 ? chartData.map(d => ({ v: Math.max(0, d.requests / 4) })) : [], // Reminders proxy
    chartData.length > 1 ? chartData.map(d => ({ v: d.tokens })) : [],               // API Calls
    hourlyData.length > 1 ? hourlyData.slice(-7).map(d => ({ v: d.requests })) : [], // Response Time proxy
  ];

  // Derive reminder breakdown from actual reminders
  const completedCount = reminders.filter(r => r.completed).length;
  const pendingCount = reminders.filter(r => !r.completed && new Date(r.datetime) >= new Date()).length;
  const overdueCount = reminders.filter(r => !r.completed && new Date(r.datetime) < new Date()).length;
  const reminderBreakdown = { completed: completedCount, pending: pendingCount, overdue: overdueCount };
  const totalReminders = reminderBreakdown.completed + reminderBreakdown.pending + reminderBreakdown.overdue;
  const taskCompletionData = totalReminders > 0
    ? [
        { name: 'Completed', value: reminderBreakdown.completed, color: '#ADFF2F' },
        { name: 'Pending', value: reminderBreakdown.pending, color: '#FFD700' },
        { name: 'Overdue', value: reminderBreakdown.overdue, color: '#FF2D78' },
      ]
    : [
        { name: 'Completed', value: 0, color: '#ADFF2F' },
        { name: 'Pending', value: 1, color: '#FFD700' },
        { name: 'Overdue', value: 0, color: '#FF2D78' },
      ];

  const credits = Number((stats as unknown as Record<string, unknown>).credits) || 0;

  useEffect(() => {
    setMounted(true);
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');

    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    briefingService.getRecent(1).then(res => {
      if (res.data.length > 0) setLatestBriefing(res.data[0]);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    usageService.daily(7).then(res => {
      setDailyUsage(res.data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    modelService.getFreeModels().then(res => {
      setFreeModels(res.data.models);
      setModelsLastUpdated(res.data.lastUpdated);
    }).catch(() => {});
    modelService.getChangelog().then(res => {
      setChangelog(res.data.entries);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    agentService.getQuality().then(res => {
      setAgentQuality({
        satisfactionRate: res.data.satisfactionRate,
        trend: res.data.trend,
        hasEnoughData: res.data.hasEnoughData,
      });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    activityService.getStats().then(res => {
      setActivityStats(res.data.days);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const pref = (agent as unknown as Record<string, unknown>)?.preferred_free_model as string | undefined;
    if (pref) setPreferredModel(pref);
    if (agent.briefing_time) setBriefingTime(agent.briefing_time);
  }, [agent]);

  const handleBriefingTimeChange = async (time: string) => {
    setBriefingTime(time);
    setBriefingSaving(true);
    try {
      await agentService.updateConfig({ briefing_time: time } as any);
    } catch { /* ignore */ }
    setBriefingSaving(false);
  };

  const handleSelectModel = async (modelId: string) => {
    setModelSaving(modelId);
    try {
      await agentService.updateConfig({ preferred_free_model: modelId } as any);
      setPreferredModel(modelId);
    } catch { /* ignore */ }
    setModelSaving(null);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    if (onRefresh) onRefresh();
    setTimeout(() => setIsRefreshing(false), 1500);
  };

  // Derive quick stats from store
  const quickStats = [
    {
      label: 'Messages Sent',
      value: stats.messagesSent.toLocaleString(),
      icon: MessageSquare,
      change: `${stats.messagesChange > 0 ? '+' : ''}${stats.messagesChange}%`,
      trend: stats.messagesChange >= 0 ? 'up' as const : 'down' as const,
      color: statAccents[0],
    },
    {
      label: 'Reminders Active',
      value: String(reminders.filter(r => !r.completed).length || stats.remindersActive),
      icon: Bell,
      change: `${stats.remindersChange > 0 ? '+' : ''}${stats.remindersChange}`,
      trend: stats.remindersChange >= 0 ? 'up' as const : 'down' as const,
      color: statAccents[1],
    },
    {
      label: 'API Calls',
      value: stats.apiCalls >= 1000 ? `${(stats.apiCalls / 1000).toFixed(1)}K` : String(stats.apiCalls),
      icon: Terminal,
      change: `${stats.apiCallsChange > 0 ? '+' : ''}${stats.apiCallsChange}%`,
      trend: stats.apiCallsChange >= 0 ? 'up' as const : 'down' as const,
      color: statAccents[2],
    },
    {
      label: 'Response Time',
      value: stats.responseTimeMs > 0 ? `${(stats.responseTimeMs / 1000).toFixed(1)}s` : '—',
      icon: Clock,
      change: `${stats.responseTimeChange}%`,
      trend: stats.responseTimeChange <= 0 ? 'up' as const : 'down' as const,
      color: statAccents[3],
    },
  ];

  // Derive connected services from store integrations
  const connectedServices = integrations.slice(0, 4).map((integration) => ({
    name: integration.name,
    status: integration.status,
    icon: integrationIcons[integration.type] || Zap,
    lastSync: integration.lastSync || 'Never',
    color: integrationColors[integration.type] || '#00F0FF',
  }));

  // Recent activity from reminders + integrations
  const recentActivity = [
    ...reminders.slice(0, 3).map((r) => ({
      id: r.id,
      action: r.completed ? 'Reminder completed' : 'Reminder active',
      detail: r.text,
      time: r.datetime ? new Date(r.datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Pending',
      status: r.completed ? 'success' as const : 'warning' as const,
      icon: Bell,
    })),
    ...integrations.filter(i => i.status === 'connected').slice(0, 3).map((i) => ({
      id: i.id,
      action: `${i.name} synced`,
      detail: `${i.requestsToday} requests today`,
      time: i.lastSync || 'Recently',
      status: 'success' as const,
      icon: integrationIcons[i.type] || Zap,
    })),
  ].slice(0, 6);

  // Quick actions wired to navigation
  const quickActions = [
    { label: 'Build a website', icon: Terminal, color: '#BF5FFF', desc: 'AI-generated live page', action: () => onNavigate?.('website-builder') },
    { label: 'Set reminder', icon: Bell, color: '#00FF88', desc: 'Natural language time', action: () => onNavigate?.('reminders') },
    { label: 'Chat with agent', icon: MessageSquare, color: '#00F0FF', desc: 'Ask anything', action: () => onOpenChat?.() },
    { label: 'See all powers', icon: Sparkles, color: '#F59E0B', desc: `20+ capabilities`, action: () => onNavigate?.('capabilities') },
  ];

  const handlePullRefresh = async () => {
    handleRefresh();
    await new Promise(resolve => setTimeout(resolve, 1500));
  };

  // Capability spotlight items for the "what's possible" strip
  const capabilitySpotlight = [
    { emoji: '🌐', label: 'Build a website', sub: 'Full HTML/CSS/JS + preview link', color: '#BF5FFF', page: 'website-builder' },
    { emoji: '🔔', label: 'Natural reminders', sub: '"Remind me in 2 hours..."', color: '#00FF88', page: 'reminders' },
    { emoji: '🤖', label: 'Portfolio AI', sub: 'Visitors chat with your AI twin', color: '#00F0FF', page: 'portfolio' },
    { emoji: '⚡', label: 'Automations', sub: 'Cron, webhook & health triggers', color: '#F59E0B', page: 'automations' },
  ];

  return (
    <PullToRefreshWrapper onRefresh={handlePullRefresh}>
    <div data-testid="dashboard-overview" className="space-y-6 animate-in fade-in duration-500">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
            {greeting}, <span className="text-gradient-lime">{user?.name?.split(' ')[0] || 'there'}</span>
          </h1>
          <p className="text-[#6B7280]">
            Your agent has handled <span className="text-[#00F0FF] font-medium">{stats.messagesSent || 0} messages</span> — <span className="text-[#ADFF2F] font-medium">{credits.toLocaleString()} credits</span> remaining
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="border-[#00F0FF]/30 text-[#6B7280] hover:text-[#E8E8F0]"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <div className="text-right">
            <div className="text-2xl font-mono text-[#E8E8F0]">
              {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-sm text-[#6B7280]">
              {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Getting Started Checklist ─── */}
      {showOnboarding && (
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgba(10,10,20,0.95), rgba(8,8,16,0.98))', borderColor: 'rgba(0,240,255,0.15)' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#00F0FF]/10">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#00FF88]" />
              <span className="text-sm font-semibold text-[#E8E8F0]">Getting Started</span>
              <span className="text-xs text-[#6B7280]">({onboardingDone.length}/{ONBOARDING_ITEMS.length} done)</span>
            </div>
            <button
              onClick={dismissOnboarding}
              className="p-1 rounded-lg text-[#6B7280] hover:text-[#E8E8F0] hover:bg-[#00F0FF]/10 transition-colors"
              aria-label="Dismiss checklist"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {ONBOARDING_ITEMS.map((item) => {
              const done = onboardingDone.includes(item.id);
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none"
                  style={{
                    borderColor: done ? 'rgba(0,255,136,0.2)' : 'rgba(0,240,255,0.1)',
                    background: done ? 'rgba(0,255,136,0.04)' : 'rgba(0,240,255,0.02)',
                  }}
                  onClick={() => toggleOnboardingItem(item.id)}
                >
                  <div
                    className="w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-all"
                    style={{
                      borderColor: done ? '#00FF88' : 'rgba(0,240,255,0.3)',
                      background: done ? 'rgba(0,255,136,0.15)' : 'transparent',
                    }}
                  >
                    {done && <Check className="w-3 h-3 text-[#00FF88]" />}
                  </div>
                  <span
                    className="text-sm flex-1"
                    style={{ color: done ? '#6B7280' : '#E8E8F0', textDecoration: done ? 'line-through' : 'none' }}
                  >
                    {item.label}
                  </span>
                  {!done && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onNavigate?.(item.page); }}
                      className="text-[10px] text-[#00F0FF] hover:underline flex-shrink-0"
                    >
                      Go →
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Telegram Connect Banner (33.3) ─── */}
      {showTelegramBanner && (
        <div
          className="rounded-2xl border flex items-center gap-4 px-4 py-3"
          style={{ background: 'rgba(0,136,204,0.06)', borderColor: 'rgba(0,136,204,0.25)' }}
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(0,136,204,0.15)' }}>
            <MessageSquare className="w-4 h-4 text-[#0088cc]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#E8E8F0]">Get reminders on Telegram</p>
            <p className="text-xs text-[#6B7280] mt-0.5">Connect Telegram to receive reminders and agent alerts directly in your chat.</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              size="sm"
              onClick={() => onNavigate?.('connections')}
              className="bg-[#0088cc] hover:bg-[#0077b3] text-white text-xs h-8 px-3"
            >
              Connect
            </Button>
            <button
              onClick={dismissTelegramBanner}
              className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#E8E8F0] hover:bg-white/5 transition-colors"
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ─── Overdue Reminder Alert (36.3) ─── */}
      {overdueCount > 0 && !overdueAlertDismissed && (
        <div
          className="rounded-2xl border flex items-center gap-4 px-4 py-3"
          style={{ background: 'rgba(255,45,120,0.06)', borderColor: 'rgba(255,45,120,0.25)' }}
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,45,120,0.12)' }}>
            <AlertTriangle className="w-4 h-4 text-[#FF2D78]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#E8E8F0]">
              {overdueCount} overdue reminder{overdueCount !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-[#6B7280] mt-0.5">You have reminders that have passed their due time.</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              size="sm"
              onClick={() => onNavigate?.('reminders')}
              className="text-xs h-8 px-3"
              style={{ background: 'rgba(255,45,120,0.15)', color: '#FF2D78', border: '1px solid rgba(255,45,120,0.3)' }}
            >
              View
            </Button>
            <button
              onClick={() => setOverdueAlertDismissed(true)}
              className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#E8E8F0] hover:bg-white/5 transition-colors"
              aria-label="Dismiss alert"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ─── Capability Spotlight (new users) ─── */}
      {stats.messagesSent < 10 && (
        <div
          className="rounded-2xl border border-white/8 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgba(10,10,20,0.9), rgba(8,8,16,0.95))' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#00F0FF]" />
              <span className="text-xs font-semibold text-[#E8E8F0]">What your agent can do</span>
            </div>
            <button
              onClick={() => onNavigate?.('capabilities')}
              className="flex items-center gap-1 text-[10px] text-[#6B7280] hover:text-[#00F0FF] transition-colors"
            >
              See all 20+ powers
              <ChevronDown className="w-3 h-3 -rotate-90" />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/5">
            {capabilitySpotlight.map((item, i) => (
              <button
                key={i}
                onClick={() => onNavigate?.(item.page)}
                className="flex flex-col items-start gap-2 p-4 bg-[#070710] hover:bg-[#0D0D1A] transition-colors text-left group"
              >
                <span className="text-2xl">{item.emoji}</span>
                <div>
                  <div className="text-xs font-semibold text-[#E8E8F0] group-hover:text-white transition-colors">{item.label}</div>
                  <div className="text-[10px] text-[#6B7280] mt-0.5 leading-tight">{item.sub}</div>
                </div>
                <div className="w-full h-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: item.color }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── Bento Stats Grid ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statOrder.map((origIdx, i) => {
          const stat = quickStats[origIdx];
          return (
          <Card
            key={origIdx}
            draggable
            onDragStart={() => { dragSrcIdx.current = i; }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              const src = dragSrcIdx.current;
              if (src === null || src === i) return;
              const next = [...statOrder];
              [next[src], next[i]] = [next[i], next[src]];
              setStatOrder(next);
              localStorage.setItem('gs_stat_order', JSON.stringify(next));
              dragSrcIdx.current = null;
            }}
            className="group press-scale touch-highlight transition-all duration-300 hover:scale-[1.02] relative cursor-grab active:cursor-grabbing"
            style={{
              background: 'linear-gradient(135deg, rgba(12, 12, 24, 0.8), rgba(16, 16, 30, 0.6))',
              border: `1px solid ${stat.color}20`,
              animationDelay: `${i * 100}ms`,
            }}
          >
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${stat.color}12` }}
                >
                  <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
                </div>
                <div className={`flex items-center gap-1 text-xs font-mono ${stat.trend === 'up' ? 'text-[#ADFF2F]' : 'text-[#FF2D78]'}`}>
                  {stat.trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {stat.change}
                </div>
              </div>
              <div
                className="text-2xl font-bold bg-clip-text text-transparent transition-all"
                style={{
                  backgroundImage: `linear-gradient(135deg, ${stat.color}, #E8E8F0)`,
                }}
              >
                {stat.value}
              </div>
              <div className="text-sm text-[#6B7280]">{stat.label}</div>
              {statSparklines[origIdx].length > 1 ? (
                <div className="mt-2 h-8 -mx-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={statSparklines[origIdx]} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id={`spark${origIdx}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={stat.color} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={stat.color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="v" stroke={stat.color} strokeWidth={1.5} fill={`url(#spark${origIdx})`} dot={false} isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="mt-2 flex items-end" style={{ height: 28 }}>
                  <Sparkline
                    data={
                      origIdx === 0 && activityStats.length > 0
                        ? activityStats.map(d => d.messages)
                        : origIdx === 1 && activityStats.length > 0
                        ? activityStats.map(d => d.reminders)
                        : MOCK_SPARKLINES[origIdx]
                    }
                    color={stat.color}
                    width={80}
                    height={28}
                  />
                </div>
              )}
              {/* Drag handle indicator */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-30 transition-opacity">
                <GripVertical className="w-3 h-3 text-[#6B7280]" />
              </div>
            </CardContent>
          </Card>
          );
        })}
      </div>

      {/* Agent Quality Card — only shown when there are >= 5 reactions */}
      {agentQuality?.hasEnoughData && agentQuality.satisfactionRate !== null && (
        <Card
          style={{
            background: 'linear-gradient(135deg, rgba(12, 12, 24, 0.8), rgba(16, 16, 30, 0.6))',
            border: '1px solid rgba(0, 255, 136, 0.15)',
          }}
        >
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#00FF88]/10 flex-shrink-0">
              <TrendingUp className="w-5 h-5 text-[#00FF88]" />
            </div>
            <div className="flex-1">
              <div className="text-sm text-[#6B7280]">Agent Satisfaction</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xl font-bold text-[#00FF88]">{agentQuality.satisfactionRate}%</span>
                {agentQuality.trend === 'up' && <ArrowUpRight className="w-4 h-4 text-[#00FF88]" />}
                {agentQuality.trend === 'down' && <ArrowDownRight className="w-4 h-4 text-[#FF2D78]" />}
                <span className="text-xs text-[#6B7280]">
                  {agentQuality.trend === 'up' ? 'improving' : agentQuality.trend === 'down' ? 'declining' : 'stable'}
                </span>
              </div>
            </div>
            <div className="text-xs text-[#6B7280]">Based on your reactions</div>
          </CardContent>
        </Card>
      )}

      {/* Daily Briefing */}
      <Card
        style={{
          background: 'linear-gradient(135deg, rgba(12, 12, 24, 0.8), rgba(16, 16, 30, 0.6))',
          border: '1px solid rgba(255, 215, 0, 0.15)',
        }}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#FFD700]" />
            Daily Briefing
          </CardTitle>
        </CardHeader>
        <CardContent>
          {latestBriefing ? (
            <>
              <p className="text-sm text-[#E8E8F0] leading-relaxed whitespace-pre-line">
                {latestBriefing.content}
              </p>
              <p className="text-xs text-[#6B7280] mt-3 font-mono">
                {new Date(latestBriefing.created_at).toLocaleString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </>
          ) : (
            <p className="text-sm text-[#6B7280]">
              No briefing yet — your first will arrive at the scheduled time below.
            </p>
          )}
          <div className="mt-3 flex items-center gap-2 border-t border-[#FFD700]/10 pt-3">
            <Clock className="w-4 h-4 text-[#6B7280] shrink-0" />
            <span className="text-xs text-[#6B7280]">Deliver daily at</span>
            <input
              type="time"
              value={briefingTime}
              onChange={(e) => handleBriefingTimeChange(e.target.value)}
              className="bg-[#06060B] border border-[#FFD700]/20 text-[#E8E8F0] text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-[#FFD700]/40"
            />
            <span className={`text-xs ${briefingSaving ? 'text-[#6B7280]' : 'text-[#00FF88]'}`}>
              {briefingSaving ? 'Saving…' : 'Saved'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ─── Bento Charts Row ─── */}
      <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Activity Chart — spans 2 cols */}
        <Card
          className="lg:col-span-2"
          style={{
            background: 'linear-gradient(135deg, rgba(12, 12, 24, 0.8), rgba(16, 16, 30, 0.6))',
            border: '1px solid rgba(0, 240, 255, 0.12)',
          }}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#00F0FF]" />
                Weekly Activity
              </CardTitle>
              <Badge variant="outline" className="border-[#00F0FF]/30 text-[#6B7280]">
                Last 7 days
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="min-h-[200px] h-[250px]">
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyChartData}>
                    <defs>
                      <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00F0FF" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#00F0FF" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorApi" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ADFF2F" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ADFF2F" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,240,255,0.06)" />
                    <XAxis dataKey="name" stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#10101E',
                        border: '1px solid rgba(0, 240, 255, 0.2)',
                        borderRadius: '12px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                      }}
                      itemStyle={{ color: '#E8E8F0' }}
                    />
                    <Area type="monotone" dataKey="messages" stroke="#00F0FF" strokeWidth={2} fillOpacity={1} fill="url(#colorMessages)" />
                    <Area type="monotone" dataKey="api" stroke="#ADFF2F" strokeWidth={2} fillOpacity={1} fill="url(#colorApi)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Task Distribution */}
        <Card
          style={{
            background: 'linear-gradient(135deg, rgba(12, 12, 24, 0.8), rgba(16, 16, 30, 0.6))',
            border: '1px solid rgba(139, 92, 246, 0.15)',
          }}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-[#8B5CF6]" />
              Task Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="min-h-[200px] h-[200px]">
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={taskCompletionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {taskCompletionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#10101E',
                        border: '1px solid rgba(139, 92, 246, 0.2)',
                        borderRadius: '12px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="flex justify-center gap-4 mt-2">
              {taskCompletionData.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-[#6B7280]">{item.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Bento 3-Column Section ─── */}
      <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left Column - Activity & Charts */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Recent Activity */}
          <Card
            style={{
              background: 'linear-gradient(135deg, rgba(12, 12, 24, 0.8), rgba(16, 16, 30, 0.6))',
              border: '1px solid rgba(0, 240, 255, 0.1)',
            }}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[#00F0FF]" />
                  Recent Activity
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-[#00F0FF]" onClick={() => onNavigate?.('terminal')}>
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentActivity.length > 0 ? recentActivity.map((activity, i) => (
                  <div
                    key={activity.id}
                    className="flex items-center gap-4 p-3 rounded-xl transition-all duration-300 group hover:scale-[1.01]"
                    style={{
                      background: 'rgba(6, 6, 11, 0.6)',
                      animationDelay: `${i * 50}ms`,
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
                      style={{
                        backgroundColor: activity.status === 'success' ? 'rgba(173,255,47,0.1)' : 'rgba(255,215,0,0.1)'
                      }}
                    >
                      <activity.icon
                        className="w-5 h-5"
                        style={{ color: activity.status === 'success' ? '#ADFF2F' : '#FFD700' }}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-[#E8E8F0] group-hover:text-[#00F0FF] transition-colors">{activity.action}</div>
                      <div className="text-xs text-[#6B7280]">{activity.detail}</div>
                    </div>
                    <div className="text-xs text-[#6B7280] font-mono">{activity.time}</div>
                  </div>
                )) : (
                  <div className="text-center py-8 text-[#6B7280] text-sm">No recent activity yet</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Hourly Activity Chart */}
          <Card
            style={{
              background: 'linear-gradient(135deg, rgba(12, 12, 24, 0.8), rgba(16, 16, 30, 0.6))',
              border: '1px solid rgba(173, 255, 47, 0.1)',
            }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#ADFF2F]" />
                Activity by Hour
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="min-h-[200px] h-[200px] sm:h-[180px]">
                {mounted && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourlyActivityData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,240,255,0.06)" vertical={false} />
                      <XAxis dataKey="hour" stroke="#6B7280" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#6B7280" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#10101E',
                          border: '1px solid rgba(173, 255, 47, 0.2)',
                          borderRadius: '12px',
                          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                        }}
                        cursor={{ fill: 'rgba(0, 240, 255, 0.06)' }}
                      />
                      <Bar dataKey="activity" radius={[6, 6, 0, 0]}>
                        {hourlyActivityData.map((_, index) => (
                          <Cell key={`bar-${index}`} fill={index % 2 === 0 ? '#00F0FF' : '#ADFF2F'} fillOpacity={0.8} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Quick Actions & Portfolio */}
        <div className="space-y-4 sm:space-y-6">
          {/* Connected Services */}
          <Card
            style={{
              background: 'linear-gradient(135deg, rgba(12, 12, 24, 0.8), rgba(16, 16, 30, 0.6))',
              border: '1px solid rgba(0, 240, 255, 0.1)',
            }}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">Connected Services</CardTitle>
                <Button variant="ghost" size="sm" className="text-[#00F0FF]" onClick={() => onNavigate?.('connections')}>
                  Manage
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {connectedServices.length > 0 ? connectedServices.map((service, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 group press-scale touch-highlight hover:scale-[1.01]"
                    style={{
                      background: 'rgba(6, 6, 11, 0.6)',
                      borderColor: `${service.color}15`,
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${service.color}12` }}
                    >
                      <service.icon className="w-5 h-5" style={{ color: service.color }} />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-[#E8E8F0]">{service.name}</div>
                      <div className="text-xs text-[#6B7280]">Synced {service.lastSync}</div>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${
                      service.status === 'connected' ? 'bg-[#ADFF2F]' :
                      service.status === 'paused' ? 'bg-[#FFD700]' : 'bg-[#FF2D78]'
                    }`} />
                  </div>
                )) : (
                  <div className="text-center py-6 text-[#6B7280] text-sm">
                    No services connected yet.
                    <Button variant="ghost" size="sm" className="text-[#00F0FF] ml-1" onClick={() => onNavigate?.('connections')}>
                      Connect one
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card
            style={{
              background: 'linear-gradient(135deg, rgba(12, 12, 24, 0.8), rgba(16, 16, 30, 0.6))',
              border: '1px solid rgba(0, 240, 255, 0.1)',
            }}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
                <button
                  onClick={() => onNavigate?.('capabilities')}
                  className="flex items-center gap-1 text-xs text-[#6B7280] hover:text-[#00F0FF] transition-colors"
                >
                  <Sparkles className="w-3 h-3" />
                  All powers
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {quickActions.map((action, i) => (
                  <button
                    key={i}
                    onClick={action.action}
                    className="flex flex-col items-start gap-1.5 p-3 rounded-xl transition-all duration-300 text-left group press-scale touch-highlight hover:scale-[1.02] border border-white/5 hover:border-white/12"
                    style={{ background: `${action.color}06` }}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform"
                      style={{ backgroundColor: `${action.color}15` }}
                    >
                      <action.icon className="w-4 h-4" style={{ color: action.color }} />
                    </div>
                    <div>
                      <div className="text-xs text-[#E8E8F0] font-semibold leading-tight">{action.label}</div>
                      <div className="text-[10px] text-[#6B7280] mt-0.5">{(action as { desc?: string }).desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Public Portfolio Card */}
          <Card
            className="press-scale touch-highlight overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.12), rgba(12, 12, 24, 0.8))',
              border: '1px solid rgba(0, 240, 255, 0.2)',
            }}
          >
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#00F0FF]/15 flex items-center justify-center">
                  <ExternalLink className="w-5 h-5 text-[#00F0FF]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Public Portfolio</h2>
                  <p className="text-xs text-[#6B7280]">{user?.username || 'alex'}.agentin.chat</p>
                </div>
              </div>
              <p className="text-sm text-[#6B7280] mb-4">
                Your public profile where others can learn about you and ask your agent questions.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 font-bold"
                  style={{
                    background: 'linear-gradient(135deg, #ADFF2F, #00F0FF)',
                    color: '#06060B',
                  }}
                  onClick={() => onViewPortfolio(user?.username || 'alex')}
                >
                  View Live
                </Button>
                <Button size="sm" variant="outline" className="border-[#00F0FF]/30 hover:bg-[#00F0FF]/10" onClick={() => onNavigate?.('settings')}>
                  Edit
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Agent Status */}
          <Card
            style={{
              background: 'linear-gradient(135deg, rgba(12, 12, 24, 0.8), rgba(16, 16, 30, 0.6))',
              border: '1px solid rgba(255, 45, 120, 0.1)',
            }}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">Agent Status</CardTitle>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${agent.status === 'online' ? 'bg-[#ADFF2F] animate-pulse' : agent.status === 'error' ? 'bg-[#FF2D78]' : 'bg-[#6B7280]'}`} />
                  <span className={`text-xs ${agent.status === 'online' ? 'text-[#ADFF2F]' : agent.status === 'error' ? 'text-[#FF2D78]' : 'text-[#6B7280]'}`}>
                    {agent.status === 'online' ? 'Online' : agent.status === 'error' ? 'Error' : 'Offline'}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { label: 'Model', value: agent.primaryModel || 'qwen2.5-coder:7b' },
                  { label: 'Style', value: agent.mode ? agent.mode.charAt(0).toUpperCase() + agent.mode.slice(1) : 'Builder' },
                  { label: 'Response Time', value: stats.responseTimeMs > 0 ? `~${(stats.responseTimeMs / 1000).toFixed(1)}s` : '~1.2s' },
                  { label: 'Uptime', value: stats.agentUptime || '99.99%' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-[#6B7280]">{item.label}</span>
                    <span className="text-[#E8E8F0] font-mono">{item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        </div>
      </div>

      {/* ─── Credits & Messages Trend ─── */}
      <Card
        style={{
          background: 'linear-gradient(135deg, rgba(12, 12, 24, 0.8), rgba(16, 16, 30, 0.6))',
          border: '1px solid rgba(0, 255, 136, 0.12)',
        }}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#00FF88]" />
              7-Day Activity Trend
            </CardTitle>
            <Badge variant="outline" className="border-[#00FF88]/30 text-[#6B7280]">
              Messages &amp; Tokens
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[160px]">
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyUsage.length > 0 ? dailyUsage : [{ label: 'Mon', messages: 0, credits: 0 }, { label: 'Tue', messages: 0, credits: 0 }, { label: 'Wed', messages: 0, credits: 0 }, { label: 'Thu', messages: 0, credits: 0 }, { label: 'Fri', messages: 0, credits: 0 }, { label: 'Sat', messages: 0, credits: 0 }, { label: 'Sun', messages: 0, credits: 0 }]} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,136,0.06)" />
                  <XAxis dataKey="label" stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} width={35} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#10101E',
                      border: '1px solid rgba(0,255,136,0.2)',
                      borderRadius: '12px',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    }}
                    itemStyle={{ color: '#E8E8F0' }}
                  />
                  <Line type="monotone" dataKey="messages" stroke="#00FF88" strokeWidth={2} dot={{ fill: '#00FF88', r: 3 }} name="Messages" />
                  <Line type="monotone" dataKey="credits" stroke="#BF5FFF" strokeWidth={2} dot={{ fill: '#BF5FFF', r: 3 }} name="Tokens" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-[#6B7280]">
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#00FF88] rounded inline-block" />Messages sent</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#BF5FFF] rounded inline-block" />Tokens used</span>
          </div>
        </CardContent>
      </Card>

      {/* Available AI Models — full-width grid below the 3-col section */}
      {freeModels.length > 0 && (
        <Card
          style={{
            background: 'linear-gradient(135deg, rgba(12, 12, 24, 0.8), rgba(16, 16, 30, 0.6))',
            border: '1px solid rgba(0, 240, 255, 0.1)',
          }}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#00F0FF]" />
                <CardTitle className="text-lg font-semibold">Available AI Models</CardTitle>
              </div>
              {modelsLastUpdated && (
                <span className="text-xs text-[#6B7280]">
                  Updated {new Date(modelsLastUpdated).toLocaleDateString()}
                </span>
              )}
            </div>
            <p className="text-sm text-[#6B7280] mt-1">Free models via OpenRouter — refreshed daily. Pin one or let auto-select decide.</p>
          </CardHeader>
          <CardContent>
            {/* Auto-select — full-width row */}
            <button
              onClick={() => handleSelectModel('auto')}
              className={`w-full text-left p-3 rounded-lg border transition-colors mb-3 ${
                preferredModel === 'auto'
                  ? 'border-[#00F0FF] bg-[#00F0FF]/10'
                  : 'border-[#1E1E2A] bg-[#0F0F18] hover:border-[#00F0FF]/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-sm font-medium text-[#E8E8F0]">Auto-select</span>
                  <p className="text-xs text-[#6B7280] mt-0.5">System picks the best available model for each request</p>
                </div>
                {preferredModel === 'auto' && <Check className="w-4 h-4 text-[#00F0FF] shrink-0" />}
              </div>
            </button>

            {/* Models — responsive grid: 2 cols mobile, 3 tablet, 4 desktop */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {freeModels.map(model => (
                <button
                  key={model.id}
                  onClick={() => handleSelectModel(model.id)}
                  disabled={modelSaving === model.id}
                  className={`text-left p-3 rounded-lg border transition-all duration-200 hover:scale-[1.02] ${
                    preferredModel === model.id
                      ? 'border-[#00F0FF] bg-[#00F0FF]/10'
                      : 'border-[#1E1E2A] bg-[#0F0F18] hover:border-[#00F0FF]/40'
                  }`}
                >
                  {/* Header row: provider badge + badges */}
                  <div className="flex items-start justify-between gap-1 mb-2">
                    <div className="w-7 h-7 rounded-md bg-[#1E1E2A] flex items-center justify-center text-[10px] font-bold text-[#00F0FF] shrink-0">
                      {model.provider.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {model.isNew && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-[#ADFF2F]/20 text-[#ADFF2F] font-medium leading-none">NEW</span>
                      )}
                      {preferredModel === model.id && <Check className="w-3.5 h-3.5 text-[#00F0FF]" />}
                    </div>
                  </div>
                  {/* Name */}
                  <div className="text-xs font-semibold text-[#E8E8F0] leading-snug mb-1">{model.displayName}</div>
                  {/* Summary */}
                  <p className="text-[11px] text-[#6B7280] leading-snug line-clamp-2 mb-2">{model.summary}</p>
                  {/* Meta badges */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {model.parameters && (
                      <span className="text-[10px] px-1 py-0.5 rounded bg-[#1E1E2A] text-[#6B7280] font-mono">{model.parameters}</span>
                    )}
                    <span className="text-[10px] px-1 py-0.5 rounded bg-[#1E1E2A] text-[#6B7280] font-mono">
                      {model.contextLength >= 1000 ? `${Math.round(model.contextLength / 1000)}K` : model.contextLength}ctx
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <p className="text-xs text-[#6B7280] mt-4">
              Tip: Use <code className="text-[#00F0FF] bg-[#1E1E2A] px-1 rounded">/model</code> in Telegram to switch, or let auto-select handle it.
            </p>

            {/* Collapsible changelog */}
            {changelog.length > 0 && (
              <div className="mt-4 border-t border-[#1E1E2A] pt-3">
                <button
                  onClick={() => setShowChangelog(!showChangelog)}
                  className="flex items-center gap-1 text-xs text-[#6B7280] hover:text-[#E8E8F0] transition-colors"
                >
                  {showChangelog ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  Recent changes ({changelog.length})
                </button>
                {showChangelog && (
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
                    {changelog.slice(0, 12).map((entry, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className={
                          entry.event === 'added' || entry.event === 'returned' ? 'text-[#ADFF2F]' :
                          entry.event === 'removed' ? 'text-[#FF2D78]' : 'text-[#FFD700]'
                        }>
                          {entry.event === 'added' ? '+' : entry.event === 'removed' ? '-' : entry.event === 'returned' ? '↩' : '🔍'}
                        </span>
                        <span className="text-[#6B7280] truncate">{entry.displayName}</span>
                        <span className="text-[#555] ml-auto shrink-0">{new Date(entry.timestamp).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
    </PullToRefreshWrapper>
  );
}
