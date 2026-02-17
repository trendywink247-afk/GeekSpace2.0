import { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  Calendar,
  MapPin,
  Github,
  Twitter,
  Linkedin,
  RefreshCw,
  Shield,
  Plug,
  Activity,
  Wifi,
  WifiOff,
  AlertTriangle,
  Plus,
  Zap,
  ExternalLink,
  Copy,
  Check,
  X,
  Send,
  ChevronRight,
  Loader2,
  CheckCircle2,
  MessageCircle,
  Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDashboardStore } from '@/stores/dashboardStore';
import { integrationService } from '@/services/api';
import type { IntegrationType } from '@/types';

const iconMap: Record<string, typeof MessageSquare> = {
  telegram: Send,
  'google-calendar': Calendar,
  location: MapPin,
  github: Github,
  twitter: Twitter,
  linkedin: Linkedin,
  email: Mail,
};

const colorMap: Record<string, string> = {
  telegram: '#0088cc',
  'google-calendar': '#4285f4',
  location: '#61FF7B',
  github: '#f0f6fc',
  twitter: '#1da1f2',
  linkedin: '#0a66c2',
  n8n: '#ff6d5a',
  manychat: '#0084ff',
  whatsapp: '#25d366',
  'custom-webhook': '#7B61FF',
  email: '#61FF7B',
};

type TelegramStep = 'idle' | 'generating' | 'open-bot' | 'send-code' | 'waiting' | 'success' | 'error';

export function ConnectionsPage() {
  const { integrations, connectIntegration, disconnectIntegration, isLoading } = useDashboardStore();

  const [telegramDialog, setTelegramDialog] = useState(false);
  const [telegramStep, setTelegramStep] = useState<TelegramStep>('idle');
  const [telegramLink, setTelegramLink] = useState<{
    code?: string;
    deepLink?: string | null;
    botUsername?: string | null;
    message?: string;
    linked?: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [polling, setPolling] = useState(false);

  // Email dialog state
  const [emailDialog, setEmailDialog] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);

  const connectedCount = integrations.filter(c => c.status === 'connected').length;
  const totalRequests = integrations.reduce((acc, c) => acc + c.requestsToday, 0);
  const avgHealth = Math.round(integrations.filter(c => c.status === 'connected').reduce((acc, c) => acc + c.health, 0) / (connectedCount || 1));

  // Poll for Telegram link status
  const pollTelegramStatus = useCallback(async () => {
    try {
      const res = await integrationService.checkTelegramLink();
      if (res.data.linked) {
        setTelegramStep('success');
        setPolling(false);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(pollTelegramStatus, 3000);
    return () => clearInterval(interval);
  }, [polling, pollTelegramStatus]);

  const handleEmailSave = async () => {
    setEmailSaving(true);
    try {
      await integrationService.updateNotificationEmail({ enabled: true, address: emailAddress || undefined });
      await connectIntegration('email');
      setEmailSaved(true);
    } catch { /* ignore */ } finally {
      setEmailSaving(false);
    }
  };

  const handleConnect = async (type: IntegrationType) => {
    if (type === 'whatsapp') {
      return;
    }
    if (type === 'email') {
      setEmailAddress('');
      setEmailSaved(false);
      setEmailDialog(true);
      return;
    }
    if (type === 'telegram') {
      setTelegramDialog(true);
      setTelegramStep('generating');
      try {
        const res = await integrationService.linkTelegram();
        setTelegramLink(res.data);
        if (res.data.linked) {
          setTelegramStep('success');
        } else {
          setTelegramStep('open-bot');
          setPolling(true);
        }
      } catch {
        setTelegramLink({ message: 'Telegram bot is not configured on this server. Contact the admin.' });
        setTelegramStep('error');
      }
      return;
    }

    connectIntegration(type);
  };

  const handleDisconnect = async (id: string) => {
    const integration = integrations.find((i) => i.id === id);
    if (integration?.type === 'email') {
      await integrationService.updateNotificationEmail({ enabled: false });
    }
    disconnectIntegration(id);
  };

  const handleCopyCode = () => {
    if (telegramLink?.code) {
      navigator.clipboard.writeText(`/start link_${telegramLink.code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const closeTelegramDialog = () => {
    if (telegramStep === 'success') {
      window.location.reload();
      return;
    }
    setTelegramDialog(false);
    setTelegramLink(null);
    setTelegramStep('idle');
    setPolling(false);
    setCopied(false);
  };

  const stepNumber = (step: TelegramStep): number => {
    switch (step) {
      case 'generating': return 0;
      case 'open-bot': return 1;
      case 'send-code': return 2;
      case 'waiting': return 3;
      case 'success': return 4;
      default: return 0;
    }
  };

  const currentStepNum = stepNumber(telegramStep);

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

  const getIcon = (type: string) => iconMap[type] || Zap;
  const getColor = (type: string) => colorMap[type] || '#7B61FF';

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Connections
          </h1>
          <p className="text-[#A7ACB8]">
            <span className="text-[#7B61FF] font-medium">{connectedCount}</span> of {integrations.length} services connected
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="border-[#61FF7B]/30 text-[#61FF7B] px-3 py-1">
            <Shield className="w-4 h-4 mr-2" />
            End-to-end encrypted
          </Badge>
          <Button onClick={() => document.getElementById('integration-grid')?.scrollIntoView({ behavior: 'smooth' })} className="bg-[#7B61FF] hover:bg-[#6B51EF]">
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

      {/* Telegram Link Wizard */}
      {telegramDialog && (
        <Card className="bg-[#0B0B10] border-[#0088cc]/40 relative overflow-hidden">
          <CardContent className="p-6">
            <button onClick={closeTelegramDialog} className="absolute top-4 right-4 text-[#A7ACB8] hover:text-white z-10">
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-[#0088cc]/20 flex items-center justify-center">
                <Send className="w-5 h-5 text-[#0088cc]" />
              </div>
              <div>
                <h3 className="font-semibold text-[#F4F6FF]">Connect Telegram</h3>
                <p className="text-xs text-[#A7ACB8]">Link your account in 4 easy steps</p>
              </div>
            </div>

            {/* Step Indicator */}
            {telegramStep !== 'error' && (
              <div className="flex items-center gap-2 mb-6">
                {['Open Bot', 'Send Code', 'Confirm', 'Done'].map((label, i) => {
                  const stepIdx = i + 1;
                  const isActive = currentStepNum === stepIdx;
                  const isDone = currentStepNum > stepIdx;
                  return (
                    <div key={label} className="flex items-center gap-2 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${
                          isDone ? 'bg-[#61FF7B] text-[#0B0B10]' :
                          isActive ? 'bg-[#0088cc] text-white' :
                          'bg-[#1A1A24] text-[#A7ACB8]'
                        }`}>
                          {isDone ? <Check className="w-3.5 h-3.5" /> : stepIdx}
                        </div>
                        <span className={`text-xs hidden sm:inline truncate ${
                          isActive ? 'text-[#F4F6FF] font-medium' :
                          isDone ? 'text-[#61FF7B]' : 'text-[#A7ACB8]'
                        }`}>{label}</span>
                      </div>
                      {i < 3 && <ChevronRight className="w-4 h-4 text-[#A7ACB8]/30 flex-shrink-0" />}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Generating state */}
            {telegramStep === 'generating' && (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="w-8 h-8 text-[#0088cc] animate-spin" />
                <p className="text-sm text-[#A7ACB8]">Setting up your connection...</p>
              </div>
            )}

            {/* Step 1: Open Bot */}
            {telegramStep === 'open-bot' && telegramLink?.deepLink && (
              <div className="space-y-4">
                <div className="bg-[#05050A] rounded-lg p-4 border border-[#0088cc]/20">
                  <div className="flex items-start gap-3">
                    <MessageCircle className="w-5 h-5 text-[#0088cc] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-[#F4F6FF] font-medium mb-1">Open our Telegram bot</p>
                      <p className="text-xs text-[#A7ACB8]">
                        Click the button below to open our bot in Telegram. This will take you to a chat where you can link your account.
                      </p>
                    </div>
                  </div>
                </div>

                <a
                  href={telegramLink.deepLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-[#0088cc] hover:bg-[#0077b5] text-white font-medium transition-colors"
                >
                  <Send className="w-4 h-4" />
                  Open in Telegram
                  <ExternalLink className="w-4 h-4" />
                </a>

                <Button
                  variant="outline"
                  className="w-full border-[#7B61FF]/30 text-[#A7ACB8] hover:text-[#F4F6FF]"
                  onClick={() => setTelegramStep('send-code')}
                >
                  I opened the bot
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}

            {/* Step 2: Send Code */}
            {telegramStep === 'send-code' && telegramLink?.code && (
              <div className="space-y-4">
                <div className="bg-[#05050A] rounded-lg p-4 border border-[#0088cc]/20">
                  <div className="flex items-start gap-3">
                    <Copy className="w-5 h-5 text-[#0088cc] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-[#F4F6FF] font-medium mb-1">Send this command to the bot</p>
                      <p className="text-xs text-[#A7ACB8]">
                        Copy the command below and paste it in the Telegram chat with our bot. Press Send in Telegram.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-[#05050A] border border-[#7B61FF]/20 rounded-lg px-4 py-3 text-sm text-[#F4F6FF] font-mono">
                    /start link_{telegramLink.code}
                  </code>
                  <Button size="sm" variant="outline" onClick={handleCopyCode} className="border-[#7B61FF]/30 h-[46px] px-4">
                    {copied ? <Check className="w-4 h-4 text-[#61FF7B]" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>

                <Button
                  className="w-full bg-[#0088cc] hover:bg-[#0077b5]"
                  onClick={() => setTelegramStep('waiting')}
                >
                  I sent the command
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>

                <p className="text-xs text-[#A7ACB8] text-center">
                  Code expires in 10 minutes
                </p>
              </div>
            )}

            {/* Step 3: Waiting for confirmation */}
            {telegramStep === 'waiting' && (
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="w-16 h-16 rounded-full bg-[#0088cc]/10 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-[#0088cc] animate-spin" />
                </div>
                <div className="text-center">
                  <p className="text-sm text-[#F4F6FF] font-medium mb-1">Waiting for confirmation...</p>
                  <p className="text-xs text-[#A7ACB8]">
                    We're checking if the bot received your command. This usually takes a few seconds.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-[#7B61FF]/30 text-[#A7ACB8]"
                  onClick={() => setTelegramStep('send-code')}
                >
                  Go back
                </Button>
              </div>
            )}

            {/* Step 4: Success */}
            {telegramStep === 'success' && (
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="w-16 h-16 rounded-full bg-[#61FF7B]/10 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-[#61FF7B]" />
                </div>
                <div className="text-center">
                  <p className="text-sm text-[#F4F6FF] font-medium mb-1">Telegram connected!</p>
                  <p className="text-xs text-[#A7ACB8]">
                    You can now chat with your AI agent directly in Telegram. Send any message to get started.
                  </p>
                </div>
                <Button
                  className="bg-[#61FF7B] hover:bg-[#51EF6B] text-[#0B0B10] font-medium"
                  onClick={closeTelegramDialog}
                >
                  Done
                </Button>
              </div>
            )}

            {/* Error state */}
            {telegramStep === 'error' && (
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="w-16 h-16 rounded-full bg-[#FF6161]/10 flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-[#FF6161]" />
                </div>
                <div className="text-center">
                  <p className="text-sm text-[#F4F6FF] font-medium mb-1">Connection failed</p>
                  <p className="text-xs text-[#A7ACB8]">
                    {telegramLink?.message || 'Could not connect to Telegram. Please try again later.'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="border-[#7B61FF]/30"
                    onClick={closeTelegramDialog}
                  >
                    Close
                  </Button>
                  <Button
                    className="bg-[#0088cc] hover:bg-[#0077b5]"
                    onClick={() => handleConnect('telegram')}
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Email Setup Dialog */}
      {emailDialog && (
        <Card className="bg-[#0B0B10] border-[#61FF7B]/40 relative overflow-hidden">
          <CardContent className="p-6">
            <button onClick={() => setEmailDialog(false)} className="absolute top-4 right-4 text-[#A7ACB8] hover:text-white z-10">
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-[#61FF7B]/20 flex items-center justify-center">
                <Mail className="w-5 h-5 text-[#61FF7B]" />
              </div>
              <div>
                <h3 className="font-semibold text-[#F4F6FF]">Enable Email Notifications</h3>
                <p className="text-xs text-[#A7ACB8]">Receive reminders, briefings, and agent summaries via email</p>
              </div>
            </div>

            {emailSaved ? (
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="w-16 h-16 rounded-full bg-[#61FF7B]/10 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-[#61FF7B]" />
                </div>
                <div className="text-center">
                  <p className="text-sm text-[#F4F6FF] font-medium mb-1">Email notifications enabled!</p>
                  <p className="text-xs text-[#A7ACB8]">You'll receive reminders and daily briefings at your configured address.</p>
                </div>
                <Button className="bg-[#61FF7B] hover:bg-[#51EF6B] text-[#0B0B10] font-medium" onClick={() => setEmailDialog(false)}>
                  Done
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-[#05050A] rounded-lg p-4 border border-[#61FF7B]/20">
                  <p className="text-xs text-[#A7ACB8]">
                    By default, notifications go to your signup email. You can optionally set a separate delivery address below.
                  </p>
                </div>

                <div>
                  <label className="text-xs text-[#A7ACB8] mb-1.5 block">Delivery email (optional — leave blank to use your account email)</label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    className="bg-[#05050A] border-[#7B61FF]/20 text-[#F4F6FF] placeholder:text-[#A7ACB8]/50"
                  />
                </div>

                <Button
                  className="w-full bg-[#61FF7B] hover:bg-[#51EF6B] text-[#0B0B10] font-medium"
                  onClick={handleEmailSave}
                  disabled={emailSaving}
                >
                  {emailSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
                  Enable Email Notifications
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Connection Grid */}
      <div id="integration-grid" className="grid md:grid-cols-2 gap-4">
        {integrations.map((connection) => {
          const Icon = getIcon(connection.type);
          const color = getColor(connection.type);
          return (
            <Card
              key={connection.id}
              className="bg-[#0B0B10] border-[#7B61FF]/20 hover:border-[#7B61FF]/40 transition-all duration-300 group"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                      style={{ backgroundColor: `${color}20` }}
                    >
                      <Icon className="w-6 h-6" style={{ color }} />
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
                  ) : connection.type === 'whatsapp' ? (
                    <Badge variant="outline" className="border-[#25d366]/40 text-[#25d366]">
                      Coming Soon
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleConnect(connection.type)}
                      disabled={isLoading}
                      className="bg-[#7B61FF] hover:bg-[#6B51EF]"
                    >
                      Connect
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
                    <span className="text-xs text-[#A7ACB8]">{connection.requestsToday} req today</span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add Connection CTA */}
      <Card className="bg-[#0B0B10] border-[#7B61FF]/20 border-dashed">
        <CardContent className="p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#7B61FF]/10 flex items-center justify-center mx-auto mb-4">
            <Plus className="w-6 h-6 text-[#7B61FF]" />
          </div>
          <h3 className="font-semibold text-[#F4F6FF] mb-2">Add New Connection</h3>
          <p className="text-sm text-[#A7ACB8] mb-4">Connect more services to enhance your agent</p>
          <Button onClick={() => document.getElementById('integration-grid')?.scrollIntoView({ behavior: 'smooth' })} variant="outline" className="border-[#7B61FF]/30 hover:bg-[#7B61FF]/10">
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
