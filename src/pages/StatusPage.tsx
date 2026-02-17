import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const COMPONENT_LABELS: Record<string, string> = {
  database: 'Database',
  ollama: 'Local Engine',
  openrouter: 'Cloud Engine',
  edith: 'Premium Engine',
  picoclaw: 'Weebo Engine',
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
  const navigate = useNavigate();
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

  const getStatusIcon = (s: 'operational' | 'degraded' | 'down') => {
    if (s === 'operational') return <CheckCircle2 className="w-5 h-5 text-[#61FF7B]" />;
    if (s === 'degraded') return <AlertTriangle className="w-5 h-5 text-[#FFD761]" />;
    return <XCircle className="w-5 h-5 text-[#FF6161]" />;
  };

  const getStatusColor = (s: 'operational' | 'degraded' | 'down') => {
    if (s === 'operational') return 'text-[#61FF7B]';
    if (s === 'degraded') return 'text-[#FFD761]';
    return 'text-[#FF6161]';
  };

  const components = health?.components ?? {};
  const entries = Object.entries(components).filter(([key]) => key in COMPONENT_LABELS);
  const allOk = entries.every(([, v]) => componentStatus(v) === 'operational');

  return (
    <div className="min-h-screen bg-[#05050A] text-[#F4F6FF]">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Button variant="ghost" onClick={() => navigate(-1)} className="text-[#A7ACB8] hover:text-[#F4F6FF] mb-8">
          <ArrowLeft className="w-4 h-4 mr-2" />Back
        </Button>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              System Status
            </h1>
            <p className="text-[#A7ACB8]">
              {lastChecked ? `Last checked: ${lastChecked.toLocaleTimeString()}` : 'Checking…'}
              {health && ` · v${health.version} · uptime ${Math.floor(health.uptime / 3600)}h ${Math.floor((health.uptime % 3600) / 60)}m`}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={fetchHealth}
            disabled={checking}
            className="border-[#7B61FF]/30 hover:bg-[#7B61FF]/10"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${checking ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {error && (
          <Card className="mb-8 border bg-[#FF6161]/5 border-[#FF6161]/30">
            <CardContent className="p-6 text-center">
              <XCircle className="w-10 h-10 text-[#FF6161] mx-auto mb-3" />
              <h2 className="text-xl font-bold text-[#FF6161]">Unable to Reach Server</h2>
              <p className="text-sm text-[#A7ACB8] mt-1">Could not connect to the health endpoint</p>
            </CardContent>
          </Card>
        )}

        {health && (
          <>
            <Card className={`mb-8 border ${allOk ? 'bg-[#61FF7B]/5 border-[#61FF7B]/30' : 'bg-[#FFD761]/5 border-[#FFD761]/30'}`}>
              <CardContent className="p-6 text-center">
                {allOk ? (
                  <>
                    <CheckCircle2 className="w-10 h10 text-[#61FF7B] mx-auto mb-3" />
                    <h2 className="text-xl font-bold text-[#61FF7B]">All Systems Operational</h2>
                    <p className="text-sm text-[#A7ACB8] mt-1">Everything is running smoothly</p>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-10 h-10 text-[#FFD761] mx-auto mb-3" />
                    <h2 className="text-xl font-bold text-[#FFD761]">Partial Degradation</h2>
                    <p className="text-sm text-[#A7ACB8] mt-1">Some services are experiencing issues</p>
                  </>
                )}
              </CardContent>
            </Card>

            <div className="space-y-3">
              {entries.map(([key, value]) => {
                const status = componentStatus(value);
                return (
                  <Card key={key} className="bg-[#0B0B10] border-[#7B61FF]/20">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(status)}
                          <span className="font-medium text-[#F4F6FF]">{COMPONENT_LABELS[key]}</span>
                        </div>
                        <span className={`text-sm capitalize ${getStatusColor(status)}`}>
                          {status}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}

        {!health && !error && checking && (
          <div className="text-center text-[#A7ACB8] py-12">Checking system status…</div>
        )}

        <div className="mt-12 p-6 rounded-xl bg-[#0B0B10] border border-[#7B61FF]/20">
          <p className="text-sm text-[#A7ACB8]">
            Experiencing issues? Contact us at{' '}
            <span className="text-[#7B61FF]">support@geekspace.app</span>
          </p>
        </div>
      </div>
    </div>
  );
}
