import { useState, useEffect } from 'react';
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
  Check
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
  Cell
} from 'recharts';
import { useAuthStore } from '@/stores/authStore';
import { useDashboardStore } from '@/stores/dashboardStore';
import { briefingService, modelService, agentService } from '@/services/api';
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

  const user = useAuthStore((s) => s.user);
  const { stats, integrations, agent, reminders, chartData, hourlyData } = useDashboardStore();

  // Map real chart data to weekly format (use API data if available, else fallback)
  const weeklyChartData = chartData.length > 0
    ? chartData.map(d => ({ name: d.label, messages: d.requests, api: d.tokens }))
    : emptyWeeklyData;
  const hourlyActivityData = hourlyData.length > 0
    ? hourlyData.map(d => ({ hour: `${d.hour}:00`, activity: d.requests }))
    : emptyHourlyData;

  // Derive reminder breakdown from actual reminders
  const completedCount = reminders.filter(r => r.completed).length;
  const pendingCount = reminders.filter(r => !r.completed && new Date(r.datetime) >= new Date()).length;
  const overdueCount = reminders.filter(r => !r.completed && new Date(r.datetime) < new Date()).length;
  const reminderBreakdown = { completed: completedCount, pending: pendingCount, overdue: overdueCount };
  const totalReminders = reminderBreakdown.completed + reminderBreakdown.pending + reminderBreakdown.overdue;
  const taskCompletionData = totalReminders > 0
    ? [
        { name: 'Completed', value: reminderBreakdown.completed, color: '#00FF88' },
        { name: 'Pending', value: reminderBreakdown.pending, color: '#FFB800' },
        { name: 'Overdue', value: reminderBreakdown.overdue, color: '#FF6161' },
      ]
    : [
        { name: 'Completed', value: 0, color: '#00FF88' },
        { name: 'Pending', value: 1, color: '#FFB800' },
        { name: 'Overdue', value: 0, color: '#FF6161' },
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
    modelService.getFreeModels().then(res => {
      setFreeModels(res.data.models);
      setModelsLastUpdated(res.data.lastUpdated);
    }).catch(() => {});
    modelService.getChangelog().then(res => {
      setChangelog(res.data.entries);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const pref = (agent as unknown as Record<string, unknown>)?.preferred_free_model as string | undefined;
    if (pref) setPreferredModel(pref);
  }, [agent]);

  const handleSelectModel = async (modelId: string) => {
    setModelSaving(modelId);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      color: '#00FFD4',
    },
    {
      label: 'Reminders Active',
      value: String(reminders.filter(r => !r.completed).length || stats.remindersActive),
      icon: Bell,
      change: `${stats.remindersChange > 0 ? '+' : ''}${stats.remindersChange}`,
      trend: stats.remindersChange >= 0 ? 'up' as const : 'down' as const,
      color: '#00FF88',
    },
    {
      label: 'API Calls',
      value: stats.apiCalls >= 1000 ? `${(stats.apiCalls / 1000).toFixed(1)}K` : String(stats.apiCalls),
      icon: Terminal,
      change: `${stats.apiCallsChange > 0 ? '+' : ''}${stats.apiCallsChange}%`,
      trend: stats.apiCallsChange >= 0 ? 'up' as const : 'down' as const,
      color: '#FFB800',
    },
    {
      label: 'Response Time',
      value: stats.responseTimeMs > 0 ? `${(stats.responseTimeMs / 1000).toFixed(1)}s` : '—',
      icon: Clock,
      change: `${stats.responseTimeChange}%`,
      trend: stats.responseTimeChange <= 0 ? 'up' as const : 'down' as const,
      color: '#FF0080',
    },
  ];

  // Derive connected services from store integrations
  const connectedServices = integrations.slice(0, 4).map((integration) => ({
    name: integration.name,
    status: integration.status,
    icon: integrationIcons[integration.type] || Zap,
    lastSync: integration.lastSync || 'Never',
    color: integrationColors[integration.type] || '#00FFD4',
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
    { label: 'Set a reminder', icon: Bell, color: '#00FFD4', action: () => onNavigate?.('reminders') },
    { label: 'Check schedule', icon: Calendar, color: '#00FF88', action: () => onNavigate?.('reminders') },
    { label: 'Send message', icon: MessageSquare, color: '#FFB800', action: () => onOpenChat?.() },
    { label: 'Open terminal', icon: Terminal, color: '#FF0080', action: () => onNavigate?.('terminal') },
  ];

  const handlePullRefresh = async () => {
    handleRefresh();
    await new Promise(resolve => setTimeout(resolve, 1500));
  };

  return (
    <PullToRefreshWrapper onRefresh={handlePullRefresh}>
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
            {greeting}, <span className="text-gradient">{user?.name?.split(' ')[0] || 'there'}</span>
          </h1>
          <p className="text-[#6B7280]">
            Your agent has handled <span className="text-[#00FFD4] font-medium">{stats.messagesSent || 0} messages</span> — <span className="text-[#00FF88] font-medium">{credits.toLocaleString()} credits</span> remaining
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="border-[#00FFD4]/30 text-[#6B7280] hover:text-[#E8E8F0]"
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

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {quickStats.map((stat, i) => (
          <Card
            key={i}
            className="bg-[#0A0A0F] border-[#00FFD4]/20 hover:border-[#00FFD4]/40 transition-all duration-300 group press-scale touch-highlight"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${stat.color}15` }}
                >
                  <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
                </div>
                <div className={`flex items-center gap-1 text-xs font-mono ${stat.trend === 'up' ? 'text-[#00FF88]' : 'text-[#FF0080]'}`}>
                  {stat.trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {stat.change}
                </div>
              </div>
              <div className="text-2xl font-bold text-[#E8E8F0] group-hover:text-[#00FFD4] transition-colors">{stat.value}</div>
              <div className="text-sm text-[#6B7280]">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Daily Briefing */}
      {latestBriefing && (
        <Card className="bg-[#0A0A0F] border-[#00FFD4]/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#FFB800]" />
              Daily Briefing
            </CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}

      {/* Charts Row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Activity Chart */}
        <Card className="lg:col-span-2 bg-[#0A0A0F] border-[#00FFD4]/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#00FFD4]" />
                Weekly Activity
              </CardTitle>
              <Badge variant="outline" className="border-[#00FFD4]/30 text-[#6B7280]">
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
                        <stop offset="5%" stopColor="#00FFD4" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#00FFD4" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorApi" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00FF88" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#00FF88" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#00FFD410" />
                    <XAxis dataKey="name" stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0A0A0F', border: '1px solid rgba(0, 255, 212, 0.3)', borderRadius: '8px' }}
                      itemStyle={{ color: '#E8E8F0' }}
                    />
                    <Area type="monotone" dataKey="messages" stroke="#00FFD4" strokeWidth={2} fillOpacity={1} fill="url(#colorMessages)" />
                    <Area type="monotone" dataKey="api" stroke="#00FF88" strokeWidth={2} fillOpacity={1} fill="url(#colorApi)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Task Distribution */}
        <Card className="bg-[#0A0A0F] border-[#00FFD4]/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-[#00FFD4]" />
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
                      contentStyle={{ backgroundColor: '#0A0A0F', border: '1px solid rgba(0, 255, 212, 0.3)', borderRadius: '8px' }}
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

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Activity & Charts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Activity */}
          <Card className="bg-[#0A0A0F] border-[#00FFD4]/20">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[#00FFD4]" />
                  Recent Activity
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-[#00FFD4]" onClick={() => onNavigate?.('terminal')}>
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentActivity.length > 0 ? recentActivity.map((activity, i) => (
                  <div
                    key={activity.id}
                    className="flex items-center gap-4 p-3 rounded-xl bg-[#030304] hover:bg-[#00FFD4]/5 transition-all duration-300 group"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
                      style={{
                        backgroundColor: activity.status === 'success' ? '#00FF8815' : '#FFB80015'
                      }}
                    >
                      <activity.icon
                        className="w-5 h-5"
                        style={{ color: activity.status === 'success' ? '#00FF88' : '#FFB800' }}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-[#E8E8F0] group-hover:text-[#00FFD4] transition-colors">{activity.action}</div>
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
          <Card className="bg-[#0A0A0F] border-[#00FFD4]/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#00FFD4]" />
                Activity by Hour
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="min-h-[200px] h-[200px] sm:h-[180px]">
                {mounted && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourlyActivityData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#00FFD410" vertical={false} />
                      <XAxis dataKey="hour" stroke="#6B7280" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#6B7280" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0A0A0F', border: '1px solid rgba(0, 255, 212, 0.3)', borderRadius: '8px' }}
                        cursor={{ fill: 'rgba(0, 255, 212, 0.1)' }}
                      />
                      <Bar dataKey="activity" fill="#00FFD4" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Quick Actions & Portfolio */}
        <div className="space-y-6">
          {/* Connected Services */}
          <Card className="bg-[#0A0A0F] border-[#00FFD4]/20">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">Connected Services</CardTitle>
                <Button variant="ghost" size="sm" className="text-[#00FFD4]" onClick={() => onNavigate?.('connections')}>
                  Manage
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {connectedServices.length > 0 ? connectedServices.map((service, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 rounded-xl bg-[#030304] border border-[#00FFD4]/10 hover:border-[#00FFD4]/30 transition-all duration-300 group press-scale touch-highlight"
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${service.color}15` }}
                    >
                      <service.icon className="w-5 h-5" style={{ color: service.color }} />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-[#E8E8F0]">{service.name}</div>
                      <div className="text-xs text-[#6B7280]">Synced {service.lastSync}</div>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${
                      service.status === 'connected' ? 'bg-[#00FF88]' :
                      service.status === 'paused' ? 'bg-[#FFB800]' : 'bg-[#FF6161]'
                    }`} />
                  </div>
                )) : (
                  <div className="text-center py-6 text-[#6B7280] text-sm">
                    No services connected yet.
                    <Button variant="ghost" size="sm" className="text-[#00FFD4] ml-1" onClick={() => onNavigate?.('connections')}>
                      Connect one
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="bg-[#0A0A0F] border-[#00FFD4]/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {quickActions.map((action, i) => (
                  <button
                    key={i}
                    onClick={action.action}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#030304] hover:bg-[#00FFD4]/10 transition-all duration-300 text-left group press-scale touch-highlight"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${action.color}15` }}
                    >
                      <action.icon className="w-4 h-4" style={{ color: action.color }} />
                    </div>
                    <span className="text-sm text-[#E8E8F0] group-hover:text-[#00FFD4] transition-colors">{action.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Public Portfolio Card */}
          <Card className="bg-gradient-to-br from-[#00FFD4]/20 to-[#0A0A0F] border-[#00FFD4]/30 press-scale touch-highlight">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#00FFD4]/20 flex items-center justify-center">
                  <ExternalLink className="w-5 h-5 text-[#00FFD4]" />
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
                  className="flex-1 bg-[#00FFD4] hover:bg-[#00D4B0]"
                  onClick={() => onViewPortfolio(user?.username || 'alex')}
                >
                  View Live
                </Button>
                <Button size="sm" variant="outline" className="border-[#00FFD4]/50 hover:bg-[#00FFD4]/10" onClick={() => onNavigate?.('settings')}>
                  Edit
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Agent Status */}
          <Card className="bg-[#0A0A0F] border-[#00FFD4]/20">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">Agent Status</CardTitle>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${agent.status === 'online' ? 'bg-[#00FF88] animate-pulse' : agent.status === 'error' ? 'bg-[#FF6161]' : 'bg-[#6B7280]'}`} />
                  <span className={`text-xs ${agent.status === 'online' ? 'text-[#00FF88]' : agent.status === 'error' ? 'text-[#FF6161]' : 'text-[#6B7280]'}`}>
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

      {/* Available AI Models — full-width grid below the 3-col section */}
      {freeModels.length > 0 && (
        <Card className="bg-[#0A0A0F] border-[#00FFD4]/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#00FFD4]" />
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
                  ? 'border-[#00FFD4] bg-[#00FFD4]/10'
                  : 'border-[#1E1E2A] bg-[#0F0F18] hover:border-[#00FFD4]/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-sm font-medium text-[#E8E8F0]">Auto-select</span>
                  <p className="text-xs text-[#6B7280] mt-0.5">System picks the best available model for each request</p>
                </div>
                {preferredModel === 'auto' && <Check className="w-4 h-4 text-[#00FFD4] shrink-0" />}
              </div>
            </button>

            {/* Models — responsive grid: 2 cols mobile, 3 tablet, 4 desktop */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {freeModels.map(model => (
                <button
                  key={model.id}
                  onClick={() => handleSelectModel(model.id)}
                  disabled={modelSaving === model.id}
                  className={`text-left p-3 rounded-lg border transition-colors ${
                    preferredModel === model.id
                      ? 'border-[#00FFD4] bg-[#00FFD4]/10'
                      : 'border-[#1E1E2A] bg-[#0F0F18] hover:border-[#00FFD4]/40'
                  }`}
                >
                  {/* Header row: provider badge + badges */}
                  <div className="flex items-start justify-between gap-1 mb-2">
                    <div className="w-7 h-7 rounded-md bg-[#1E1E2A] flex items-center justify-center text-[10px] font-bold text-[#00FFD4] shrink-0">
                      {model.provider.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {model.isNew && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-[#FFB800]/20 text-[#FFB800] font-medium leading-none">NEW</span>
                      )}
                      {preferredModel === model.id && <Check className="w-3.5 h-3.5 text-[#00FFD4]" />}
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
              Tip: Use <code className="text-[#00FFD4] bg-[#1E1E2A] px-1 rounded">/model</code> in Telegram to switch, or let auto-select handle it.
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
                          entry.event === 'added' || entry.event === 'returned' ? 'text-[#00FF88]' :
                          entry.event === 'removed' ? 'text-[#FF6161]' : 'text-[#FFB800]'
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
