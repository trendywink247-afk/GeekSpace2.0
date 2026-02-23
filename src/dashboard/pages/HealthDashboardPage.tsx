import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Activity,
  Database,
  Cpu,
  Wifi,
  Clock,
  AlertTriangle,
  Zap,
  Server,
  RefreshCw,
  ArrowUpRight,
  Send,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// ---- Types ----

interface ComponentStatus {
  database: string;
  ollama: string;
  openrouter: string;
  edith: string;
  picoclaw: string;
  bridge: string;
  telegram: string;
  n8n: string;
}

interface TopEndpoint {
  path: string;
  count: number;
  errors: number;
  avgMs: number;
}

interface HealthSnapshot {
  timestamp: string;
  components: ComponentStatus;
  metrics: {
    totalRequests: number;
    totalErrors: number;
    avgLatencyMs: number;
    requestsPerMinute: number;
    activeConnections: number;
  };
  system: {
    uptime: number;
    memoryMb: number;
  };
  topEndpoints: TopEndpoint[];
}

// ---- Status helpers ----

function statusColor(status: string): string {
  switch (status) {
    case 'ok': case 'reachable': case 'configured': case 'active':
      return '#00FF88';
    case 'unreachable': case 'down': case 'no_backends':
      return '#FF6161';
    case 'not_configured': case 'disabled':
      return '#6B7280';
    default:
      return '#FFB800';
  }
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

const componentIcons: Record<string, typeof Database> = {
  database: Database,
  ollama: Cpu,
  openrouter: Wifi,
  edith: Server,
  picoclaw: Zap,
  bridge: ArrowUpRight,
  telegram: Send,
  n8n: RefreshCw,
};

const componentLabels: Record<string, string> = {
  database: 'Database',
  ollama: 'Local Engine',
  openrouter: 'Cloud Engine',
  edith: 'Premium Engine',
  picoclaw: 'Weebo Engine',
  bridge: 'Bridge',
  telegram: 'Telegram',
  n8n: 'n8n Automations',
};

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ---- Component ----

export function HealthDashboardPage() {
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retriesRef = useRef(0);
  const MAX_RETRIES = 10;
  const BASE_DELAY_MS = 3000;
  const MAX_DELAY_MS = 30000;
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Define fetchRestHealth first so connect can reference it
  const fetchRestHealth = useCallback(async () => {
    try {
      const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');
      const res = await fetch(`${apiBase}/api/health`);
      if (res.ok) {
        const data = await res.json();
        setSnapshot(data);
        setConnected(false); // Not using SSE, but we have data
        setError(null);
      } else {
        setError('Health API returned an error. Click retry to try again.');
      }
    } catch {
      setError('Failed to fetch health data. Click retry to try again.');
    }
  }, []);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');
    const url = `${apiBase}/api/health/stream`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnected(true);
      setError(null);
      retriesRef.current = 0;
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as HealthSnapshot;
        setSnapshot(data);
      } catch { /* ignore malformed */ }
    };

    es.addEventListener('timeout', () => {
      es.close();
      setConnected(false);
      retriesRef.current = 0;
      reconnectTimerRef.current = setTimeout(connect, 1000);
    });

    es.onerror = () => {
      es.close();
      setConnected(false);

      if (retriesRef.current >= MAX_RETRIES) {
        setError('Health stream unavailable. Using REST fallback.');
        // Fall back to REST polling
        fetchRestHealth();
        // Set up REST polling interval (every 10 seconds)
        restIntervalRef.current = setInterval(fetchRestHealth, 10000);
        return;
      }

      retriesRef.current += 1;
      const delay = Math.min(BASE_DELAY_MS * Math.pow(2, retriesRef.current - 1), MAX_DELAY_MS);
      setError(`Connection lost. Retrying in ${Math.round(delay / 1000)}s... (${retriesRef.current}/${MAX_RETRIES})`);
      reconnectTimerRef.current = setTimeout(connect, delay);
    };
  }, [fetchRestHealth]);

  const handleRetry = () => {
    retriesRef.current = 0;
    setError(null);
    // Clear any existing REST interval
    if (restIntervalRef.current) {
      clearInterval(restIntervalRef.current);
      restIntervalRef.current = null;
    }
    connect();
  };

  useEffect(() => {
    connect();
    return () => {
      eventSourceRef.current?.close();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    };
  }, [connect]);

  if (!snapshot) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-[#00F0FF] animate-spin" />
      </div>
    );
  }

  const errorRate = snapshot.metrics.totalRequests > 0
    ? Math.round((snapshot.metrics.totalErrors / snapshot.metrics.totalRequests) * 100 * 10) / 10
    : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1
            className="text-3xl md:text-4xl font-bold mb-1"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            API Health
          </h1>
          <p className="text-[#6B7280] flex items-center gap-2 text-sm md:text-base">
            {connected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-[#00FF88] animate-pulse shrink-0" />
                <span className="truncate">Live — updates every 5s</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-[#FF6161] shrink-0" />
                <span className="truncate">{error || 'Disconnected'}</span>
                {error && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetry}
                    className="ml-2 h-6 px-2 text-xs border-[#00F0FF]/30 hover:bg-[#00F0FF]/10"
                  >
                    Retry
                  </Button>
                )}
              </>
            )}
          </p>
        </div>
        <Badge
          variant="outline"
          className="border-[#00F0FF]/40 text-[#00F0FF] shrink-0 text-xs"
        >
          {new Date(snapshot.timestamp).toLocaleTimeString()}
        </Badge>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Requests', value: snapshot.metrics.totalRequests, icon: Activity, color: '#00F0FF' },
          { label: 'Errors', value: snapshot.metrics.totalErrors, icon: AlertTriangle, color: snapshot.metrics.totalErrors > 0 ? '#FF6161' : '#00FF88' },
          { label: 'Avg Latency', value: `${snapshot.metrics.avgLatencyMs}ms`, icon: Clock, color: snapshot.metrics.avgLatencyMs > 1000 ? '#FFB800' : '#00FF88' },
          { label: 'Req/min', value: snapshot.metrics.requestsPerMinute, icon: Zap, color: '#00F0FF' },
          { label: 'Uptime', value: formatUptime(snapshot.system.uptime), icon: Server, color: '#00FF88' },
        ].map((stat) => (
          <Card key={stat.label} className="border-[#00F0FF]/20 press-scale">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                <span className="text-xs text-[#6B7280]">{stat.label}</span>
              </div>
              <p className="text-2xl md:text-xl font-bold text-[#E8E8F0]">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Component Status Grid */}
      <div>
        <h2 className="text-lg font-semibold text-[#E8E8F0] mb-3">Components</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(snapshot.components).map(([key, status]) => {
            const Icon = componentIcons[key] || Wifi;
            const color = statusColor(status);
            return (
              <Card key={key} className="transition-all hover:border-[#00F0FF]/40 press-scale" style={{ borderColor: `${color}40` }}>
                <CardContent className="p-3 md:p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}15` }}>
                    <Icon className="w-4 h-4" style={{ color }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#E8E8F0] truncate">{componentLabels[key] || key}</p>
                    <p className="text-xs" style={{ color }}>{statusLabel(status)}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Error Rate + Memory */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-[#00F0FF]/20">
          <CardContent className="p-5">
            <h3 className="text-sm text-[#6B7280] mb-2">Error Rate (5-min window)</h3>
            <div className="flex items-end gap-3">
              <span className="text-3xl font-bold" style={{ color: errorRate > 5 ? '#FF6161' : errorRate > 0 ? '#FFB800' : '#00FF88' }}>
                {errorRate}%
              </span>
              <span className="text-sm text-[#6B7280] mb-1">
                {snapshot.metrics.totalErrors} / {snapshot.metrics.totalRequests} requests
              </span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[#00F0FF]/20">
          <CardContent className="p-5">
            <h3 className="text-sm text-[#6B7280] mb-2">Memory Usage</h3>
            <div className="flex items-end gap-3">
              <span className="text-3xl font-bold text-[#00F0FF]">{snapshot.system.memoryMb} MB</span>
              <span className="text-sm text-[#6B7280] mb-1">heap used</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Endpoints */}
      {snapshot.topEndpoints.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-[#E8E8F0] mb-3">Hot Endpoints (5-min window)</h2>
          <Card className="border-[#00F0FF]/20 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#00F0FF]/10">
                    <th className="text-left text-[#6B7280] font-medium px-4 py-3">Endpoint</th>
                    <th className="text-right text-[#6B7280] font-medium px-4 py-3">Hits</th>
                    <th className="text-right text-[#6B7280] font-medium px-4 py-3">Errors</th>
                    <th className="text-right text-[#6B7280] font-medium px-4 py-3">Avg Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.topEndpoints.map((ep) => (
                    <tr key={ep.path} className="border-b border-[#00F0FF]/5 hover:bg-[#00F0FF]/5 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-[#E8E8F0] text-xs whitespace-nowrap">{ep.path}</td>
                      <td className="px-4 py-2.5 text-right text-[#E8E8F0]">{ep.count}</td>
                      <td className="px-4 py-2.5 text-right" style={{ color: ep.errors > 0 ? '#FF6161' : '#00FF88' }}>{ep.errors}</td>
                      <td className="px-4 py-2.5 text-right" style={{ color: ep.avgMs > 1000 ? '#FFB800' : '#6B7280' }}>{ep.avgMs}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-xs text-[#6B7280]/50 py-2">
        {snapshot.metrics.activeConnections} active stream{snapshot.metrics.activeConnections !== 1 ? 's' : ''} · Window resets every 5 min
      </div>
    </div>
  );
}
