import { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Calendar, 
  Bell, 
  Terminal, 
  ExternalLink,
  Zap,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Clock,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

interface OverviewPageProps {
  onViewPortfolio: (username: string) => void;
}

const recentActivity = [
  { id: 1, action: 'Reminder sent', detail: 'Call mom tomorrow 9am', time: '2m ago', status: 'success', icon: Bell },
  { id: 2, action: 'Calendar synced', detail: '3 events imported', time: '15m ago', status: 'success', icon: Calendar },
  { id: 3, action: 'Telegram message', detail: 'Replied to @sarah', time: '1h ago', status: 'success', icon: MessageSquare },
  { id: 4, action: 'Agent query', detail: 'What\'s my schedule?', time: '2h ago', status: 'success', icon: Zap },
  { id: 5, action: 'API call', detail: 'Weather data fetched', time: '3h ago', status: 'success', icon: Terminal },
  { id: 6, action: 'System alert', detail: 'Low credits warning', time: '5h ago', status: 'warning', icon: AlertCircle },
];

const quickStats = [
  { label: 'Messages Sent', value: '1,247', icon: MessageSquare, change: '+12%', trend: 'up', color: '#7B61FF' },
  { label: 'Reminders Active', value: '23', icon: Bell, change: '+3', trend: 'up', color: '#61FF7B' },
  { label: 'API Calls', value: '8.4K', icon: Terminal, change: '+24%', trend: 'up', color: '#FFD761' },
  { label: 'Response Time', value: '1.2s', icon: Clock, change: '-8%', trend: 'down', color: '#FF61DC' },
];

const connectedServices = [
  { name: 'Telegram', status: 'connected', icon: MessageSquare, lastSync: '2m ago', color: '#0088cc' },
  { name: 'Google Calendar', status: 'connected', icon: Calendar, lastSync: '15m ago', color: '#4285f4' },
  { name: 'Location', status: 'paused', icon: Zap, lastSync: '2h ago', color: '#61FF7B' },
  { name: 'GitHub', status: 'error', icon: Terminal, lastSync: '1d ago', color: '#f0f6fc' },
];

// Chart data
const messageData = [
  { name: 'Mon', messages: 120, api: 80 },
  { name: 'Tue', messages: 150, api: 95 },
  { name: 'Wed', messages: 180, api: 110 },
  { name: 'Thu', messages: 140, api: 85 },
  { name: 'Fri', messages: 200, api: 130 },
  { name: 'Sat', messages: 90, api: 60 },
  { name: 'Sun', messages: 110, api: 70 },
];

const taskCompletionData = [
  { name: 'Completed', value: 68, color: '#61FF7B' },
  { name: 'Pending', value: 23, color: '#FFD761' },
  { name: 'Overdue', value: 9, color: '#FF6161' },
];

const hourlyActivity = [
  { hour: '00:00', activity: 12 },
  { hour: '04:00', activity: 5 },
  { hour: '08:00', activity: 45 },
  { hour: '12:00', activity: 78 },
  { hour: '16:00', activity: 65 },
  { hour: '20:00', activity: 42 },
];

export function OverviewPage({ onViewPortfolio }: OverviewPageProps) {
  const [greeting, setGreeting] = useState('Good evening');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');

    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1500);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            {greeting}, <span className="text-gradient">Alex</span>
          </h1>
          <p className="text-[#A7ACB8]">
            Your agent has handled <span className="text-[#7B61FF] font-medium">47 tasks</span> today
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            className="border-[#7B61FF]/30 text-[#A7ACB8] hover:text-[#F4F6FF]"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <div className="text-right">
            <div className="text-2xl font-mono text-[#F4F6FF]">
              {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-sm text-[#A7ACB8]">
              {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {quickStats.map((stat, i) => (
          <Card 
            key={i} 
            className="bg-[#0B0B10] border-[#7B61FF]/20 hover:border-[#7B61FF]/40 transition-all duration-300 group"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${stat.color}15` }}
                >
                  <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
                </div>
                <div className={`flex items-center gap-1 text-xs font-mono ${stat.trend === 'up' ? 'text-[#61FF7B]' : 'text-[#FF61DC]'}`}>
                  {stat.trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {stat.change}
                </div>
              </div>
              <div className="text-2xl font-bold text-[#F4F6FF] group-hover:text-[#7B61FF] transition-colors">{stat.value}</div>
              <div className="text-sm text-[#A7ACB8]">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Activity Chart */}
        <Card className="lg:col-span-2 bg-[#0B0B10] border-[#7B61FF]/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#7B61FF]" />
                Weekly Activity
              </CardTitle>
              <Badge variant="outline" className="border-[#7B61FF]/30 text-[#A7ACB8]">
                Last 7 days
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={messageData}>
                    <defs>
                      <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7B61FF" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#7B61FF" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorApi" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#61FF7B" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#61FF7B" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#7B61FF10" />
                    <XAxis dataKey="name" stroke="#A7ACB8" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#A7ACB8" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0B0B10', border: '1px solid rgba(123, 97, 255, 0.3)', borderRadius: '8px' }}
                      itemStyle={{ color: '#F4F6FF' }}
                    />
                    <Area type="monotone" dataKey="messages" stroke="#7B61FF" strokeWidth={2} fillOpacity={1} fill="url(#colorMessages)" />
                    <Area type="monotone" dataKey="api" stroke="#61FF7B" strokeWidth={2} fillOpacity={1} fill="url(#colorApi)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Task Distribution */}
        <Card className="bg-[#0B0B10] border-[#7B61FF]/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-[#7B61FF]" />
              Task Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
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
                      contentStyle={{ backgroundColor: '#0B0B10', border: '1px solid rgba(123, 97, 255, 0.3)', borderRadius: '8px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="flex justify-center gap-4 mt-2">
              {taskCompletionData.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-[#A7ACB8]">{item.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Activity & Services */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Activity */}
          <Card className="bg-[#0B0B10] border-[#7B61FF]/20">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[#7B61FF]" />
                  Recent Activity
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-[#7B61FF]">
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentActivity.map((activity, i) => (
                  <div 
                    key={activity.id} 
                    className="flex items-center gap-4 p-3 rounded-xl bg-[#05050A] hover:bg-[#7B61FF]/5 transition-all duration-300 group"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div 
                      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors`}
                      style={{ 
                        backgroundColor: activity.status === 'success' ? '#61FF7B15' : '#FFD76115'
                      }}
                    >
                      <activity.icon 
                        className="w-5 h-5" 
                        style={{ color: activity.status === 'success' ? '#61FF7B' : '#FFD761' }}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-[#F4F6FF] group-hover:text-[#7B61FF] transition-colors">{activity.action}</div>
                      <div className="text-xs text-[#A7ACB8]">{activity.detail}</div>
                    </div>
                    <div className="text-xs text-[#A7ACB8] font-mono">{activity.time}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Hourly Activity Chart */}
          <Card className="bg-[#0B0B10] border-[#7B61FF]/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#7B61FF]" />
                Activity by Hour
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[180px]">
                {mounted && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourlyActivity}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#7B61FF10" vertical={false} />
                      <XAxis dataKey="hour" stroke="#A7ACB8" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#A7ACB8" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0B0B10', border: '1px solid rgba(123, 97, 255, 0.3)', borderRadius: '8px' }}
                        cursor={{ fill: 'rgba(123, 97, 255, 0.1)' }}
                      />
                      <Bar dataKey="activity" fill="#7B61FF" radius={[4, 4, 0, 0]} />
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
          <Card className="bg-[#0B0B10] border-[#7B61FF]/20">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">Connected Services</CardTitle>
                <Button variant="ghost" size="sm" className="text-[#7B61FF]">
                  Manage
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {connectedServices.map((service, i) => (
                  <div 
                    key={i} 
                    className="flex items-center gap-3 p-3 rounded-xl bg-[#05050A] border border-[#7B61FF]/10 hover:border-[#7B61FF]/30 transition-all duration-300 group"
                  >
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${service.color}15` }}
                    >
                      <service.icon className="w-5 h-5" style={{ color: service.color }} />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-[#F4F6FF]">{service.name}</div>
                      <div className="text-xs text-[#A7ACB8]">Synced {service.lastSync}</div>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${
                      service.status === 'connected' ? 'bg-[#61FF7B]' : 
                      service.status === 'paused' ? 'bg-[#FFD761]' : 'bg-[#FF6161]'
                    }`} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="bg-[#0B0B10] border-[#7B61FF]/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { label: 'Set a reminder', icon: Bell, color: '#7B61FF' },
                  { label: 'Check schedule', icon: Calendar, color: '#61FF7B' },
                  { label: 'Send message', icon: MessageSquare, color: '#FFD761' },
                  { label: 'Open terminal', icon: Terminal, color: '#FF61DC' },
                ].map((action, i) => (
                  <button
                    key={i}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#05050A] hover:bg-[#7B61FF]/10 transition-all duration-300 text-left group"
                  >
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${action.color}15` }}
                    >
                      <action.icon className="w-4 h-4" style={{ color: action.color }} />
                    </div>
                    <span className="text-sm text-[#F4F6FF] group-hover:text-[#7B61FF] transition-colors">{action.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Public Portfolio Card */}
          <Card className="bg-gradient-to-br from-[#7B61FF]/20 to-[#0B0B10] border-[#7B61FF]/30">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#7B61FF]/20 flex items-center justify-center">
                  <ExternalLink className="w-5 h-5 text-[#7B61FF]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Public Portfolio</h2>
                  <p className="text-xs text-[#A7ACB8]">alex.geekspace.space</p>
                </div>
              </div>
              <p className="text-sm text-[#A7ACB8] mb-4">
                Your public profile where others can learn about you and ask your agent questions.
              </p>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  className="flex-1 bg-[#7B61FF] hover:bg-[#6B51EF]"
                  onClick={() => onViewPortfolio('alex')}
                >
                  View Live
                </Button>
                <Button size="sm" variant="outline" className="border-[#7B61FF]/50 hover:bg-[#7B61FF]/10">
                  Edit
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Agent Status */}
          <Card className="bg-[#0B0B10] border-[#7B61FF]/20">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">Agent Status</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#61FF7B] rounded-full animate-pulse" />
                  <span className="text-xs text-[#61FF7B]">Online</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { label: 'Model', value: 'OpenClaw v2.1' },
                  { label: 'Style', value: 'Builder' },
                  { label: 'Response Time', value: '~1.2s' },
                  { label: 'Uptime', value: '99.99%' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-[#A7ACB8]">{item.label}</span>
                    <span className="text-[#F4F6FF] font-mono">{item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}