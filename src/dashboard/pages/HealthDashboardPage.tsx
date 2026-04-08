// ============================================================
// HealthDashboardPage — Real-time API health monitor
// Owner agent: pulse (#10B981)
// Revamped: design tokens, PageHeader, SectionCard, useAgentCanvas,
//   SSE auth fix, component map sync with server, mobile QA (44px)
// ============================================================

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
  Search,
  BookOpen,
  Globe,
  Monitor,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageShell, PageHeader, SectionCard } from '@/components/agentin';
import { DashboardPageWrapper } from '@/components/agentin';
import { useAgentCanvas } from '@/hooks/use-agent-canvas';
import { BlurFade } from '@/components/magicui/blur-fade';

// ---- Types (synced with server/src/routes/health.ts) ----

interface ComponentStatus {
  database: string;
  ollama: string;
  openrouter: string;
  edith: string;
  picoclaw: string;
  bridge: string;
  telegram: string;
  n8n: string;
  searxng: string;
  meilisearch: string;
  qdrant: string;
  browser: string;
  [key: string]: string; // future-proof for new probes
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

/** Maps component status string to green/amber/red/grey. */
function statusColor(status: string): string {
  switch (status) {
    case 'ok': case 'reachable': case 'configured': case 'active':
      return 'var(--ag-pulse)'; // pulse agent green
    case 'unreachable': case 'down': case 'no_backends': case 'not_running':
      return '#EF4444'; // red
    case 'not_configured': case 'disabled':
      return 'var(--ag-text-muted)'; // grey
    default:
      return 'var(--ag-amber)'; // amber
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
  searxng: Search,
  meilisearch: BookOpen,
  qdrant: Globe,
  browser: Monitor,
};

const componentLabels: Record<string, string> = {
  database: 'Database',
  ollama: 'Local Engine',
  openrouter: 'Cloud Engine',
  edith: 'Premium Engine',
  picoclaw: 'PicoClaw LLM',
  bridge: 'Bridge',
  telegram: 'Telegram',
  n8n: 'n8n Automations',
  searxng: 'SearXNG Search',
  meilisearch: 'Meilisearch',
  qdrant: 'Qdrant Vectors',
  browser: 'Browser Agent',
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
  const { notifyDone, notifyFail } = useAgentCanvas({ agent: 'pulse', page: 'health-dashboard' });

  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retriesRef = useRef(0);
  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 2000;
  const MAX_DELAY_MS = 10000;
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // REST fallback — /api/health is public (no auth required)
  const fetchRestHealth = useCallback(async () => {
    try {
      const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');
      const res = await fetch(`${apiBase}/health`);
      if (res.ok) {
        const data = await res.json();
        // /api/health is a lightweight liveness probe returning { status: 'ok' | 'degraded' }.
        // Only update the snapshot when the response carries the full dashboard payload
        // (components, metrics, system). Without this guard, spreading the simple probe
        // response leaves snapshot.components undefined and causes a render crash.
        if (data && typeof data.components === 'object' && data.components !== null) {
          setSnapshot({ ...data, topEndpoints: data.topEndpoints ?? [] });
          setConnected(false);
          setError(null);
          notifyDone('Health data fetched via REST').catch(() => {});
        }
        // Simple liveness probe (no components) — keep spinner; SSE will populate
      } else {
        setError('Health API returned an error. Click retry to try again.');
        notifyFail('Health API error').catch(() => {});
      }
    } catch {
      setError('Failed to fetch health data. Click retry to try again.');
      notifyFail('Health fetch failed').catch(() => {});
    }
  }, [notifyDone, notifyFail]);

  // SSE stream — requires ADMIN_TOKEN (not the user JWT).
  // The server's /api/health/stream checks config.adminToken via query param.
  // Since the admin token is server-side only, SSE is used as a best-effort
  // upgrade. If SSE fails (401), we fall back to REST polling which is public.
  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');
    const token = localStorage.getItem('gs_token');
    const url = `${apiBase}/health/stream${token ? `?token=${encodeURIComponent(token)}` : ''}`;
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
      reconnectTimerRef.current = setTimeout(connect, 1000); // eslint-disable-line react-hooks/immutability
    });

    es.onerror = () => {
      es.close();
      setConnected(false);

      if (retriesRef.current >= MAX_RETRIES) {
        setError('Live stream unavailable. Using periodic refresh.');
        // Fall back to REST polling (public endpoint, no auth needed)
        fetchRestHealth();
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
    setRefreshing(true);
    if (restIntervalRef.current) {
      clearInterval(restIntervalRef.current);
      restIntervalRef.current = null;
    }
    // Fetch REST immediately, then attempt SSE
    fetchRestHealth().finally(() => setRefreshing(false));
    connect();
  };

  useEffect(() => {
    fetchRestHealth();
    connect();
    return () => {
      eventSourceRef.current?.close();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    };
  }, [connect, fetchRestHealth]);

  // ---- Loading state ----
  if (!snapshot) {
    return (
      <PageShell>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-8 h-8 text-[var(--ag-pulse)] animate-spin" />
          <p className="text-sm text-[var(--ag-text-secondary)]">Connecting to health service...</p>
          {error && (
            <div className="text-center space-y-3">
              <p className="text-sm text-[var(--ag-text-secondary)]">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                className="bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-amber)] bg-clip-text text-transparent border-[var(--ag-border-default)] hover:border-[var(--ag-border-active)] hover:bg-[var(--ag-active-bg)] min-h-[44px] min-w-[44px] transition-all duration-300"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </div>
          )}
        </div>
      </PageShell>
    );
  }

  const errorRate = snapshot.metrics.totalRequests > 0
    ? Math.round((snapshot.metrics.totalErrors / snapshot.metrics.totalRequests) * 100 * 10) / 10
    : 0;

  const healthyCount = Object.values(snapshot.components).filter(s =>
    s === 'ok' || s === 'reachable' || s === 'configured' || s === 'active'
  ).length;
  const totalCount = Object.keys(snapshot.components).length;

  return (
    <DashboardPageWrapper>
    <PageShell>
    <div data-testid="health-page" className="space-y-6">

      {/* ---- Page Header with Pulse ownership dot (#10B981) ---- */}
      <PageHeader
        icon={Activity}
        title="API Health"
        subtitle={connected
          ? 'Live stream active — updates every 15s'
          : error || 'Periodic refresh — updates every 10s'}
        badge={
          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-[var(--ag-pulse)]/10 border border-[var(--ag-pulse)]/30 text-[var(--ag-pulse)]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--ag-pulse)] opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--ag-pulse)]" />
            </span>
            Pulse
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            {/* Connection status indicator */}
            <span
              className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
                connected
                  ? 'bg-[var(--ag-pulse)]/10 border-[var(--ag-pulse)]/30 text-[var(--ag-pulse)]'
                  : 'bg-[var(--ag-amber)]/10 border-[var(--ag-amber)]/30 text-[var(--ag-amber)]'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-[var(--ag-pulse)] animate-pulse' : 'bg-[var(--ag-amber)]'}`} />
              {connected ? 'SSE' : 'REST'}
            </span>
            {/* Timestamp */}
            <span className="text-xs text-[var(--ag-text-secondary)] hidden sm:inline">
              {new Date(snapshot.timestamp).toLocaleTimeString()}
            </span>
            {/* Retry / Refresh */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRetry}
              disabled={refreshing}
              aria-label="Refresh health data"
              className="min-h-[44px] min-w-[44px] text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50 hover:bg-gradient-to-r hover:from-[var(--ag-violet)]/10 hover:to-[var(--ag-amber)]/10 transition-[transform,background] duration-150 active:scale-[0.96]"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        }
      />

      {/* ---- Stats Row ---- */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Requests', value: snapshot.metrics.totalRequests.toLocaleString(), icon: Activity, color: 'var(--ag-violet)' },
          { label: 'Errors', value: snapshot.metrics.totalErrors.toLocaleString(), icon: AlertTriangle, color: snapshot.metrics.totalErrors > 0 ? '#EF4444' : 'var(--ag-pulse)' },
          { label: 'Avg Latency', value: `${snapshot.metrics.avgLatencyMs}ms`, icon: Clock, color: snapshot.metrics.avgLatencyMs > 1000 ? 'var(--ag-amber)' : 'var(--ag-pulse)' },
          { label: 'Req/min', value: snapshot.metrics.requestsPerMinute.toString(), icon: Zap, color: 'var(--ag-violet)' },
          { label: 'Uptime', value: formatUptime(snapshot.system.uptime), icon: Server, color: 'var(--ag-pulse)' },
        ].map((stat, i) => (
          <BlurFade key={stat.label} delay={0.05 * i}>
            <SectionCard padding="sm">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                <span className="text-xs text-[var(--ag-text-secondary)]">{stat.label}</span>
              </div>
              <p className="text-2xl md:text-xl font-bold text-[var(--ag-text-primary)] tabular-nums">{stat.value}</p>
            </SectionCard>
          </BlurFade>
        ))}
      </div>

      {/* ---- Component Status Grid ---- */}
      <div>
        <h2 className="text-base font-semibold font-heading text-[var(--ag-text-primary)] mb-3 flex items-center gap-2">
          <Server className="w-5 h-5 text-[var(--ag-pulse)]" />
          Components
          <span className="text-xs text-[var(--ag-text-secondary)] font-normal ml-1">
            {healthyCount}/{totalCount} healthy
          </span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Object.entries(snapshot.components).map(([key, status], i) => {
            const Icon = componentIcons[key] || Wifi;
            const color = statusColor(status);
            const isHealthy = color === 'var(--ag-pulse)';
            return (
              <BlurFade key={key} delay={0.03 * i}>
                <SectionCard padding="sm" className="!p-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${color}15` }}
                    >
                      <Icon className="w-4 h-4" style={{ color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--ag-text-primary)] truncate">
                        {componentLabels[key] || key}
                      </p>
                      <p className="text-xs flex items-center gap-1.5" style={{ color }}>
                        <span
                          className={`w-2 h-2 rounded-full inline-block shrink-0${isHealthy ? ' animate-pulse' : ''}`}
                          style={{ backgroundColor: color }}
                        />
                        {statusLabel(status)}
                      </p>
                    </div>
                  </div>
                </SectionCard>
              </BlurFade>
            );
          })}
        </div>
      </div>

      {/* ---- Error Rate + Memory ---- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BlurFade delay={0.1}>
          <SectionCard>
            <h3 className="text-sm font-heading text-[var(--ag-text-secondary)] mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              Error Rate (5-min window)
            </h3>
            <div className="flex items-end gap-3">
              <span className="text-3xl font-bold tabular-nums" style={{ color: errorRate > 5 ? '#EF4444' : errorRate > 0 ? 'var(--ag-amber)' : 'var(--ag-pulse)' }}>
                {errorRate}%
              </span>
              <span className="text-sm text-[var(--ag-text-secondary)] mb-1">
                {snapshot.metrics.totalErrors} / {snapshot.metrics.totalRequests} requests
              </span>
            </div>
          </SectionCard>
        </BlurFade>
        <BlurFade delay={0.15}>
          <SectionCard>
            <h3 className="text-sm font-heading text-[var(--ag-text-secondary)] mb-2 flex items-center gap-1.5">
              <Cpu className="w-4 h-4" />
              Memory Usage
            </h3>
            <div className="flex items-end gap-3">
              <span className="text-3xl font-bold text-[var(--ag-violet)] tabular-nums">{snapshot.system.memoryMb} MB</span>
              <span className="text-sm text-[var(--ag-text-secondary)] mb-1">heap used</span>
            </div>
          </SectionCard>
        </BlurFade>
      </div>

      {/* ---- Top Endpoints ---- */}
      {(snapshot.topEndpoints ?? []).length > 0 && (
        <BlurFade delay={0.2}>
          <div>
            <h2 className="text-base font-semibold font-heading text-[var(--ag-text-primary)] mb-3 flex items-center gap-2">
              <Zap className="w-5 h-5 text-[var(--ag-amber)]" />
              Hot Endpoints (5-min window)
            </h2>
            <SectionCard padding="sm" className="!p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[rgba(139,92,246,0.08)]">
                      <th className="text-left text-[var(--ag-text-secondary)] font-medium px-4 py-3">Endpoint</th>
                      <th className="text-right text-[var(--ag-text-secondary)] font-medium px-4 py-3">Hits</th>
                      <th className="text-right text-[var(--ag-text-secondary)] font-medium px-4 py-3">Errors</th>
                      <th className="text-right text-[var(--ag-text-secondary)] font-medium px-4 py-3">Avg Latency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(snapshot.topEndpoints ?? []).map((ep) => (
                      <tr key={ep.path} className="border-b border-[rgba(139,92,246,0.04)] hover:bg-[rgba(139,92,246,0.04)] transition-colors">
                        <td className="px-4 py-2.5 font-mono text-[var(--ag-text-primary)] text-xs whitespace-nowrap">{ep.path}</td>
                        <td className="px-4 py-2.5 text-right text-[var(--ag-text-primary)] tabular-nums">{ep.count}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: ep.errors > 0 ? '#EF4444' : 'var(--ag-pulse)' }}>{ep.errors}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: ep.avgMs > 1000 ? 'var(--ag-amber)' : 'var(--ag-text-secondary)' }}>{ep.avgMs}ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        </BlurFade>
      )}

      {/* ---- Footer ---- */}
      <div className="text-center text-xs text-[var(--ag-text-muted)] py-2">
        {snapshot.metrics.activeConnections} active stream{snapshot.metrics.activeConnections !== 1 ? 's' : ''} · Window resets every 5 min
      </div>
    </div>
    </PageShell>
    </DashboardPageWrapper>
  );
}
