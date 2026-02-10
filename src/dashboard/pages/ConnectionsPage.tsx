import { useState } from 'react';
import { 
  MessageSquare, 
  Calendar, 
  MapPin, 
  Github, 
  Twitter, 
  Linkedin,
  ExternalLink,
  RefreshCw,
  Shield,
  Plug,
  Activity,
  Wifi,
  WifiOff,
  AlertTriangle,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Connection {
  id: string;
  name: string;
  description: string;
  icon: typeof MessageSquare;
  status: 'connected' | 'disconnected' | 'error' | 'pending' | 'paused';
  lastSync?: string;
  features: string[];
  color: string;
  health: number;
  requestsToday: number;
}

const initialConnections: Connection[] = [
  {
    id: 'telegram',
    name: 'Telegram',
    description: 'Send messages, reminders, and receive notifications via Telegram bot',
    icon: MessageSquare,
    status: 'connected',
    lastSync: '2 minutes ago',
    features: ['Send messages', 'Receive reminders', 'Bot commands'],
    color: '#0088cc',
    health: 98,
    requestsToday: 124,
  },
  {
    id: 'calendar',
    name: 'Google Calendar',
    description: 'Sync events, schedule reminders, and check availability',
    icon: Calendar,
    status: 'connected',
    lastSync: '15 minutes ago',
    features: ['Event sync', 'Schedule queries', 'Availability check'],
    color: '#4285f4',
    health: 100,
    requestsToday: 56,
  },
  {
    id: 'location',
    name: 'Location Services',
    description: 'Share location for contextual reminders and "where am I" queries',
    icon: MapPin,
    status: 'paused',
    lastSync: '2 hours ago',
    features: ['Location queries', 'Geofenced reminders', 'Travel time estimates'],
    color: '#61FF7B',
    health: 0,
    requestsToday: 0,
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Sync repositories, track issues, and showcase projects on portfolio',
    icon: Github,
    status: 'error',
    lastSync: '1 day ago',
    features: ['Repo sync', 'Issue tracking', 'Portfolio showcase'],
    color: '#f0f6fc',
    health: 0,
    requestsToday: 0,
  },
  {
    id: 'twitter',
    name: 'Twitter/X',
    description: 'Share updates and connect your social presence',
    icon: Twitter,
    status: 'disconnected',
    features: ['Auto-share', 'Social sync', 'Profile link'],
    color: '#1da1f2',
    health: 0,
    requestsToday: 0,
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    description: 'Professional profile sync and networking',
    icon: Linkedin,
    status: 'disconnected',
    features: ['Profile sync', 'Network updates', 'Professional showcase'],
    color: '#0a66c2',
    health: 0,
    requestsToday: 0,
  },
];

export function ConnectionsPage() {
  const [connections, setConnections] = useState(initialConnections);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const handleConnect = (id: string) => {
    setConnectingId(id);
    setTimeout(() => {
      setConnections(prev => prev.map(conn => 
        conn.id === id ? { ...conn, status: 'connected', lastSync: 'Just now', health: 100 } : conn
      ));
      setConnectingId(null);
    }, 2000);
  };

  const handleDisconnect = (id: string) => {
    setConnections(prev => prev.map(conn => 
      conn.id === id ? { ...conn, status: 'disconnected', lastSync: undefined, health: 0 } : conn
    ));
  };

  const connectedCount = connections.filter(c => c.status === 'connected').length;
  const totalRequests = connections.reduce((acc, c) => acc + c.requestsToday, 0);
  const avgHealth = Math.round(connections.filter(c => c.status === 'connected').reduce((acc, c) => acc + c.health, 0) / (connectedCount || 1));

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <Wifi className="w-4 h-4 text-[#61FF7B]" />;
      case 'error': return <AlertTriangle className="w-4 h-4 text-[#FF6161]" />;
      case 'paused': return <WifiOff className="w-4 h-4 text-[#FFD761]" />;
      default: return <WifiOff className="w-4 h-4 text-[#A7ACB8]" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-[#61FF7B]';
      case 'error': return 'text-[#FF6161]';
      case 'paused': return 'text-[#FFD761]';
      default: return 'text-[#A7ACB8]';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Connections
          </h1>
          <p className="text-[#A7ACB8]">
            <span className="text-[#7B61FF] font-medium">{connectedCount}</span> of {connections.length} services connected
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="border-[#61FF7B]/30 text-[#61FF7B] px-3 py-1">
            <Shield className="w-4 h-4 mr-2" />
            End-to-end encrypted
          </Badge>
          <Button className="bg-[#7B61FF] hover:bg-[#6B51EF]">
            <Plus className="w-4 h-4 mr-2" />
            Add New
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-[#0B0B10] border-[#7B61FF]/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#61FF7B]/10 flex items-center justify-center">
                <Plug className="w-5 h-5 text-[#61FF7B]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[#F4F6FF]">{connectedCount}</div>
                <div className="text-xs text-[#A7ACB8]">Connected</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0B0B10] border-[#7B61FF]/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#7B61FF]/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-[#7B61FF]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[#F4F6FF]">{totalRequests}</div>
                <div className="text-xs text-[#A7ACB8]">Requests Today</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0B0B10] border-[#7B61FF]/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FFD761]/10 flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-[#FFD761]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[#F4F6FF]">{avgHealth}%</div>
                <div className="text-xs text-[#A7ACB8]">Avg Health</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0B0B10] border-[#7B61FF]/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FF61DC]/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-[#FF61DC]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[#F4F6FF]">100%</div>
                <div className="text-xs text-[#A7ACB8]">Secure</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Connection Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {connections.map((connection) => (
          <Card 
            key={connection.id}
            className="bg-[#0B0B10] border-[#7B61FF]/20 hover:border-[#7B61FF]/40 transition-all duration-300 group"
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                    style={{ backgroundColor: `${connection.color}20` }}
                  >
                    <connection.icon className="w-6 h-6" style={{ color: connection.color }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#F4F6FF]">{connection.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {getStatusIcon(connection.status)}
                      <span className={`text-xs ${getStatusColor(connection.status)} capitalize`}>
                        {connection.status}
                      </span>
                    </div>
                  </div>
                </div>
                
                {connection.status === 'connected' ? (
                  <Switch 
                    checked={true}
                    onCheckedChange={() => handleDisconnect(connection.id)}
                  />
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleConnect(connection.id)}
                    disabled={connectingId === connection.id}
                    className="bg-[#7B61FF] hover:bg-[#6B51EF]"
                  >
                    {connectingId === connection.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      'Connect'
                    )}
                  </Button>
                )}
              </div>

              <p className="text-sm text-[#A7ACB8] mb-4">
                {connection.description}
              </p>

              {/* Health Bar for connected services */}
              {connection.status === 'connected' && (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[#A7ACB8]">Health</span>
                    <span className="text-[#F4F6FF]">{connection.health}%</span>
                  </div>
                  <div className="h-1.5 bg-[#05050A] rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500"
                      style={{ 
                        width: `${connection.health}%`,
                        backgroundColor: connection.health > 80 ? '#61FF7B' : connection.health > 50 ? '#FFD761' : '#FF6161'
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Features */}
              <div className="flex flex-wrap gap-2 mb-4">
                {connection.features.map((feature, i) => (
                  <Badge 
                    key={i}
                    variant="outline"
                    className="border-[#7B61FF]/20 text-[#A7ACB8] text-xs"
                  >
                    {feature}
                  </Badge>
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-[#7B61FF]/10">
                {connection.lastSync ? (
                  <span className="text-xs text-[#A7ACB8]">
                    Last synced: {connection.lastSync}
                  </span>
                ) : (
                  <span className="text-xs text-[#A7ACB8]">Never synced</span>
                )}
                
                {connection.status === 'connected' && (
                  <Button variant="ghost" size="sm" className="text-[#7B61FF] hover:text-[#7B61FF] h-auto p-0">
                    Configure <ExternalLink className="w-3 h-3 ml-1" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Connection CTA */}
      <Card className="bg-[#0B0B10] border-[#7B61FF]/20 border-dashed">
        <CardContent className="p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#7B61FF]/10 flex items-center justify-center mx-auto mb-4">
            <Plus className="w-6 h-6 text-[#7B61FF]" />
          </div>
          <h3 className="font-semibold text-[#F4F6FF] mb-2">Add New Connection</h3>
          <p className="text-sm text-[#A7ACB8] mb-4">Connect more services to enhance your agent</p>
          <Button variant="outline" className="border-[#7B61FF]/30 hover:bg-[#7B61FF]/10">
            Browse Integrations
          </Button>
        </CardContent>
      </Card>

      {/* Privacy Note */}
      <Card className="bg-gradient-to-r from-[#7B61FF]/10 to-transparent border-[#7B61FF]/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-[#7B61FF] flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-[#F4F6FF] mb-1">Privacy First</h4>
              <p className="text-xs text-[#A7ACB8]">
                Your data is encrypted and never shared with third parties. You can disconnect any service at any time. 
                Location data is opt-in and only used for contextual reminders.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}