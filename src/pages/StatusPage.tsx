import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    if (s === 'operational') return <CheckCircle2 className="w-5 h-5 text-[#ADFF2F]" />;
    if (s === 'degraded') return <AlertTriangle className="w-5 h-5 text-[#FFD700]" />;
    return <XCircle className="w-5 h-5 text-[#FF6161]" />;
  };

  const getStatusColor = (s: 'operational' | 'degraded' | 'down') => {
    if (s === 'operational') return 'text-[#ADFF2F]';
    if (s === 'degraded') return 'text-[#FFD700]';
    return 'text-[#FF6161]';
  };

  const components = health?.components ?? {};
  const entries = Object.entries(components).filter(([key]) => key in COMPONENT_LABELS);
  const allOk = entries.every(([, v]) => componentStatus(v) === 'operational');

  return (
    <PublicPageShell title="System Status" icon={Activity} maxWidth="3xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold font-heading text-[var(--ag-text-primary,#F4F6FF)]">
              System Status
            </h1>
            <p className="text-[var(--ag-text-muted,#9CA3AF)] mt-1">
              {lastChecked ? `Last checked: ${lastChecked.toLocaleTimeString()}` : 'Checking\u2026'}
              {health && ` \u00b7 v${health.version} \u00b7 uptime ${Math.floor(health.uptime / 3600)}h ${Math.floor((health.uptime % 3600) / 60)}m`}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={fetchHealth}
            disabled={checking}
            className="min-h-[44px] border-[var(--ag-border-default,rgba(139,92,246,0.15))] hover:bg-[var(--ag-active-bg,rgba(139,92,246,0.08))]"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${checking ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Error state */}
        {error && (
          <SectionCard className="border-[#FF6161]/30">
            <div className="text-center py-2">
              <XCircle className="w-10 h-10 text-[#FF6161] mx-auto mb-3" />
              <h2 className="text-xl font-bold font-heading text-[#FF6161]">Unable to Reach Server</h2>
              <p className="text-sm text-[var(--ag-text-muted,#9CA3AF)] mt-1">Could not connect to the health endpoint</p>
            </div>
          </SectionCard>
        )}

        {/* Overall status */}
        {health && (
          <>
            <SectionCard className={allOk ? 'border-[#ADFF2F]/30' : 'border-[#FFD700]/30'}>
              <div className="text-center py-2">
                {allOk ? (
                  <>
                    <CheckCircle2 className="w-10 h-10 text-[#ADFF2F] mx-auto mb-3" />
                    <h2 className="text-xl font-bold font-heading text-[#ADFF2F]">All Systems Operational</h2>
                    <p className="text-sm text-[var(--ag-text-muted,#9CA3AF)] mt-1">Everything is running smoothly</p>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-10 h-10 text-[#FFD700] mx-auto mb-3" />
                    <h2 className="text-xl font-bold font-heading text-[#FFD700]">Partial Degradation</h2>
                    <p className="text-sm text-[var(--ag-text-muted,#9CA3AF)] mt-1">Some services are experiencing issues</p>
                  </>
                )}
              </div>
            </SectionCard>

            {/* Component list */}
            <div className="space-y-3">
              {entries.map(([key, value]) => {
                const status = componentStatus(value);
                return (
                  <SectionCard key={key} padding="sm">
                    <div className="flex items-center justify-between min-h-[36px]">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(status)}
                        <span className="font-medium text-[var(--ag-text-primary,#F4F6FF)]">{COMPONENT_LABELS[key]}</span>
                      </div>
                      <span className={`text-sm capitalize ${getStatusColor(status)}`}>
                        {status}
                      </span>
                    </div>
                  </SectionCard>
                );
              })}
            </div>
          </>
        )}

        {/* Loading state */}
        {!health && !error && checking && (
          <div className="text-center text-[var(--ag-text-muted,#9CA3AF)] py-12">Checking system status&hellip;</div>
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
