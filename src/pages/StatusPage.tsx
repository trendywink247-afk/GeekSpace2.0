import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ServiceStatus {
  name: string;
  status: 'operational' | 'degraded' | 'down';
  latency?: number;
}

export function StatusPage() {
  const navigate = useNavigate();
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: 'API Server', status: 'operational', latency: 42 },
    { name: 'AI Agent Engine', status: 'operational', latency: 180 },
    { name: 'Database', status: 'operational', latency: 12 },
    { name: 'Automation Runner', status: 'operational', latency: 95 },
    { name: 'Telegram Integration', status: 'operational', latency: 68 },
    { name: 'Portfolio Hosting', status: 'operational', latency: 35 },
    { name: 'WebSocket Gateway', status: 'operational', latency: 22 },
  ]);
  const [lastChecked, setLastChecked] = useState(new Date());
  const [checking, setChecking] = useState(false);

  const refresh = async () => {
    setChecking(true);
    // Simulate a health check
    await new Promise((r) => setTimeout(r, 800));
    setServices((prev) =>
      prev.map((s) => ({
        ...s,
        latency: Math.round((s.latency || 50) * (0.8 + Math.random() * 0.4)),
      }))
    );
    setLastChecked(new Date());
    setChecking(false);
  };

  useEffect(() => {
    // Check on mount
    refresh();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational': return <CheckCircle2 className="w-5 h-5 text-[#61FF7B]" />;
      case 'degraded': return <AlertTriangle className="w-5 h-5 text-[#FFD761]" />;
      case 'down': return <XCircle className="w-5 h-5 text-[#FF6161]" />;
      default: return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'operational': return 'text-[#61FF7B]';
      case 'degraded': return 'text-[#FFD761]';
      case 'down': return 'text-[#FF6161]';
      default: return 'text-[#A7ACB8]';
    }
  };

  const allOperational = services.every((s) => s.status === 'operational');

  return (
    <div className="min-h-screen bg-[#05050A] text-[#F4F6FF]">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="text-[#A7ACB8] hover:text-[#F4F6FF] mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />Back
        </Button>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              System Status
            </h1>
            <p className="text-[#A7ACB8]">
              Last checked: {lastChecked.toLocaleTimeString()}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={refresh}
            disabled={checking}
            className="border-[#7B61FF]/30 hover:bg-[#7B61FF]/10"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${checking ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Overall status banner */}
        <Card className={`mb-8 border ${allOperational ? 'bg-[#61FF7B]/5 border-[#61FF7B]/30' : 'bg-[#FFD761]/5 border-[#FFD761]/30'}`}>
          <CardContent className="p-6 text-center">
            {allOperational ? (
              <>
                <CheckCircle2 className="w-10 h-10 text-[#61FF7B] mx-auto mb-3" />
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

        {/* Individual services */}
        <div className="space-y-3">
          {services.map((service) => (
            <Card key={service.name} className="bg-[#0B0B10] border-[#7B61FF]/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(service.status)}
                    <span className="font-medium text-[#F4F6FF]">{service.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    {service.latency !== undefined && (
                      <span className="text-xs text-[#A7ACB8] font-mono">{service.latency}ms</span>
                    )}
                    <span className={`text-sm capitalize ${getStatusText(service.status)}`}>
                      {service.status}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

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
