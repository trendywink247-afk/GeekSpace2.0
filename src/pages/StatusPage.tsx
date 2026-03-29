import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, Activity } from 'lucide-react';
import { PublicPageShell, SectionCard } from '@/components/agentin';

const COMPONENT_LABELS: Record<string, string> = {
  database: 'Database',
  ollama: 'Local Engine',
  openrouter: 'Cloud Engine',
  edith: 'Premium Engine',
  weebo: 'Weebo Engine',
  bridge: 'Bridge Router',
  telegram: 'Telegram Bot',
  n8n: 'Automation (n8n)',
};

const OK_STATUSES = new Set(['ok', 'reachable', 'configured', 'active']);
const DEGRADED_STATUSES = new Set(['degraded']);

function componentStatus(value: string): 'operational' | 'degraded' | 'down' {
  if (OK_STATUSES.has(value)) return 'operational';
  if (DEGRADED_STATUSES.has(value)) return 'degraded';
  return 'down';
}

interface HealthData {
  ok: boolean;
  status: string;
  uptime: number;
  version: string;
  timestamp: string;
  components: Record<string, string>;
}

export function StatusPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    setChecking(true);
    setError(false);
    try {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error('Health check failed');
      const data: HealthData = await res.json();
      setHealth(data);
      setLastChecked(new Date());
    } catch {
      setError(true);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  // Auto-refresh every 30s so status reflects current state
  useEffect(() => {
    const interval = setInterval(() => { void fetchHealth(); }, 30_000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const getStatusIcon = (s: 'operational' | 'degraded' | 'down') => {
    if (s === 'operational') return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
    if (s === 'degraded') return <AlertTriangle className="w-5 h-5 text-amber-400" />;
    return <XCircle className="w-5 h-5 text-rose-400" />;
  };

  const getStatusColor = (s: 'operational' | 'degraded' | 'down') => {
    if (s === 'operational') return 'text-emerald-400';
    if (s === 'degraded') return 'text-amber-400';
    return 'text-rose-400';
  };

  const getStatusPill = (s: 'operational' | 'degraded' | 'down') => {
    if (s === 'operational') return 'gs-icon-pill-emerald';
    if (s === 'degraded') return 'gs-icon-pill-amber';
    return 'gs-icon-pill-rose';
  };

  const components = health?.components ?? {};
  const entries = Object.entries(components).filter(([key]) => key in COMPONENT_LABELS);
  const allOk = entries.every(([, v]) => componentStatus(v) === 'operational');

  return (
    <PublicPageShell title="System Status" icon={Activity} maxWidth="3xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="gs-section-label mb-2">Monitoring</p>
            <h1 className="text-3xl md:text-4xl font-bold font-heading text-gradient">
              System Status
            </h1>
            <p className="text-[var(--ag-text-muted,#9CA3AF)] mt-1 text-sm">
              {lastChecked ? `Last checked: ${lastChecked.toLocaleTimeString()}` : 'Checking\u2026'}
              {health && ` \u00b7 v${health.version} \u00b7 uptime ${Math.floor(health.uptime / 3600)}h ${Math.floor((health.uptime % 3600) / 60)}m`}
            </p>
          </div>
          <button
            onClick={fetchHealth}
            disabled={checking}
            className="gs-btn-ghost flex items-center gap-2 min-h-[44px] px-4 py-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Error state */}
        {error && (
          <div className="gs-card p-6 border-rose-500/30">
            <div className="text-center py-2">
              <div className="gs-icon-pill gs-icon-pill-rose mx-auto mb-4">
                <XCircle className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold font-heading text-rose-400 mb-2">Unable to Reach Server</h2>
              <p className="text-sm text-[var(--ag-text-muted,#9CA3AF)]">Could not connect to the health endpoint</p>
            </div>
          </div>
        )}

        {/* Loading state */}
        {!health && !error && checking && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white/[0.04] rounded-xl animate-pulse h-14" />
            ))}
          </div>
        )}

        {/* Overall status */}
        {health && (
          <>
            <div className={`gs-card p-5 ${allOk ? 'border-emerald-500/30' : 'border-amber-500/30'}`}>
              <div className="flex items-center gap-4">
                <div className={`gs-icon-pill ${allOk ? 'gs-icon-pill-emerald' : 'gs-icon-pill-amber'}`}>
                  {allOk
                    ? <CheckCircle2 className="w-5 h-5" />
                    : <AlertTriangle className="w-5 h-5" />
                  }
                </div>
                <div>
                  <h2 className={`text-lg font-bold font-heading ${allOk ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {allOk ? 'All Systems Operational' : 'Partial Degradation'}
                  </h2>
                  <p className="text-sm text-[var(--ag-text-muted,#9CA3AF)]">
                    {allOk ? 'Everything is running smoothly' : 'Some services are experiencing issues'}
                  </p>
                </div>
              </div>
            </div>

            {/* Component list */}
            <div className="space-y-2">
              <p className="gs-section-label px-1">Components</p>
              {entries.map(([key, value]) => {
                const status = componentStatus(value);
                return (
                  <div key={key} className="gs-card px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`gs-icon-pill ${getStatusPill(status)}`} style={{ width: '32px', height: '32px' }}>
                          {getStatusIcon(status)}
                        </div>
                        <span className="font-medium text-sm text-[var(--ag-text-primary,#F4F6FF)]">{COMPONENT_LABELS[key]}</span>
                      </div>
                      <span className={`text-sm capitalize font-medium ${getStatusColor(status)}`}>
                        {status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Contact */}
        <SectionCard>
          <p className="text-sm text-[var(--ag-text-muted,#9CA3AF)]">
            Experiencing issues? Contact us at{' '}
            <a href="mailto:support@agentin.chat" className="text-[var(--ag-violet,#8B5CF6)] hover:text-[var(--ag-violet,#8B5CF6)]/80 transition-colors">support@agentin.chat</a>
          </p>
        </SectionCard>
      </div>
    </PublicPageShell>
  );
}
