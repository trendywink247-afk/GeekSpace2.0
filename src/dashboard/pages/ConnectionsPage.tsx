// ============================================================
// Improved Connections Page
// Better visual feedback, working states, QR code for WhatsApp
// ============================================================

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
  X,
  Send,
  Loader2,
  CheckCircle2,
  Mail,
  Smartphone,
  Image as ImageIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useMobileDetect } from '@/hooks/useMobileDetect';
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
  whatsapp: MessageSquare,
  image: ImageIcon,
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
  image: '#FF61DC',
};

type TelegramStep = 'idle' | 'generating' | 'open-bot' | 'send-code' | 'waiting' | 'success' | 'error';
type WhatsAppStep = 'idle' | 'generating' | 'show-qr' | 'waiting' | 'success' | 'error';

export function ConnectionsPage() {
  const { integrations, connectIntegration, disconnectIntegration, isLoading, loadDashboard } = useDashboardStore();
  const isMobile = useMobileDetect();

  const [telegramDialog, setTelegramDialog] = useState(false);
  const [telegramStep, setTelegramStep] = useState<TelegramStep>('idle');
  const [telegramLink, setTelegramLink] = useState<{
    code?: string;
    deepLink?: string | null;
    botUsername?: string | null;
    message?: string;
    linked?: boolean;
  } | null>(null);
  const [polling, setPolling] = useState(false);

  // WhatsApp dialog state
  const [whatsappDialog, setWhatsappDialog] = useState(false);
  const [whatsappStep, setWhatsappStep] = useState<WhatsAppStep>('idle');
  const [whatsappQR, setWhatsappQR] = useState<string | null>(null);
  const [whatsappSessionId, setWhatsappSessionId] = useState<string | null>(null);
  const [whatsappPolling, setWhatsappPolling] = useState(false);

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

  // Poll for WhatsApp link status
  const pollWhatsAppStatus = useCallback(async () => {
    if (!whatsappSessionId) return;
    try {
      const res = await integrationService.checkWhatsAppQRStatus(whatsappSessionId);
      if (res.data.linked) {
        setWhatsappStep('success');
        setWhatsappPolling(false);
      }
    } catch { /* ignore */ }
  }, [whatsappSessionId]);

  useEffect(() => {
    if (!whatsappPolling) return;
    const interval = setInterval(pollWhatsAppStatus, 3000);
    return () => clearInterval(interval);
  }, [whatsappPolling, pollWhatsAppStatus]);

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
      setWhatsappDialog(true);
      setWhatsappStep('generating');
      try {
        const res = await integrationService.linkWhatsAppQR();
        if (res.data.success && res.data.qrCodeDataUrl) {
          setWhatsappQR(res.data.qrCodeDataUrl);
          setWhatsappSessionId(res.data.sessionId);
          setWhatsappStep('show-qr');
          setWhatsappPolling(true);
        } else {
          setWhatsappStep('error');
        }
      } catch {
        setWhatsappStep('error');
      }
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
    if (integration?.type === 'whatsapp') {
      await integrationService.unlinkWhatsApp();
    }
    disconnectIntegration(id);
  };

  const closeTelegramDialog = () => {
    setTelegramDialog(false);
    setTelegramLink(null);
    setTelegramStep('idle');
    setPolling(false);
    loadDashboard();
  };

  const closeWhatsAppDialog = () => {
    setWhatsappDialog(false);
    setWhatsappQR(null);
    setWhatsappSessionId(null);
    setWhatsappStep('idle');
    setWhatsappPolling(false);
    loadDashboard();
  };

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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-[#0B0B10] border-[#7B61FF]/20 hover:border-[#7B61FF]/40 transition-all">
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
        <Card className="bg-[#0B0B10] border-[#7B61FF]/20 hover:border-[#7B61FF]/40 transition-all">
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
        <Card className="bg-[#0B0B10] border-[#7B61FF]/20 hover:border-[#7B61FF]/40 transition-all">
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
        <Card className="bg-[#0B0B10] border-[#7B61FF]/20 hover:border-[#7B61FF]/40 transition-all">
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
          <CardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
            <button onClick={closeTelegramDialog} className="absolute top-4 right-4 text-[#A7ACB8] hover:text-white z-10">
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-[#0088cc]/20 flex items-center justify-center">
                <Send className="w-5 h-5 text-[#0088cc]" />
              </div>
              <div>
                <h3 className="font-semibold text-[#F4F6FF]">Connect Telegram</h3>
                <p className="text-xs text-[#A7ACB8]">Chat with your agent on Telegram</p>
              </div>
            </div>

            {telegramStep === 'generating' && (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="w-8 h-8 text-[#0088cc] animate-spin" />
                <p className="text-sm text-[#A7ACB8]">Setting up your connection...</p>
              </div>
            )}

            {telegramStep === 'open-bot' && telegramLink?.deepLink && (
              <div className="space-y-4">
                <div className="bg-[#05050A] rounded-lg p-4 border border-[#0088cc]/20">
                  <p className="text-sm text-[#F4F6FF] font-medium mb-2">Step 1: Open Telegram</p>
                  <p className="text-xs text-[#A7ACB8]">Click below to open our bot, then send the start command.</p>
                </div>
                <a href={telegramLink.deepLink} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-[#0088cc] hover:bg-[#0077b5] text-white font-medium">
                  <Send className="w-4 h-4" />
                  Open in Telegram
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}

            {telegramStep === 'success' && (
              <div className="flex flex-col items-center gap-4 py-6">
                <CheckCircle2 className="w-12 h-12 text-[#61FF7B]" />
                <p className="text-sm text-[#F4F6FF] font-medium">Telegram connected!</p>
                <Button className="bg-[#61FF7B] hover:bg-[#51EF6B] text-[#0B0B10]" onClick={closeTelegramDialog}>
                  Done
                </Button>
              </div>
            )}

            {telegramStep === 'error' && (
              <div className="text-center py-6">
                <AlertTriangle className="w-12 h-12 text-[#FF6161] mx-auto mb-2" />
                <p className="text-sm text-[#F4F6FF]">Connection failed</p>
                <p className="text-xs text-[#A7ACB8] mt-1">{telegramLink?.message}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* WhatsApp Link Wizard with QR */}
      {whatsappDialog && (
        <Card className="bg-[#0B0B10] border-[#25d366]/40 relative overflow-hidden">
          <CardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
            <button onClick={closeWhatsAppDialog} className="absolute top-4 right-4 text-[#A7ACB8] hover:text-white z-10">
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-[#25d366]/20 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-[#25d366]" />
              </div>
              <div>
                <h3 className="font-semibold text-[#F4F6FF]">Connect WhatsApp</h3>
                <p className="text-xs text-[#A7ACB8]">Scan QR code with your phone</p>
              </div>
            </div>

            {whatsappStep === 'generating' && (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="w-8 h-8 text-[#25d366] animate-spin" />
                <p className="text-sm text-[#A7ACB8]">Generating QR code...</p>
              </div>
            )}

            {whatsappStep === 'show-qr' && whatsappQR && (
              <div className="space-y-4 text-center">
                <div className="bg-white p-4 rounded-xl inline-block">
                  <img src={whatsappQR} alt="WhatsApp QR Code" className="w-48 h-48" />
                </div>
                <p className="text-sm text-[#A7ACB8]">
                  Open WhatsApp → Settings → Linked Devices → Link a Device
                </p>
                <p className="text-xs text-[#A7ACB8]">
                  Scan the QR code above to connect
                </p>
                <div className="flex items-center justify-center gap-2 text-xs text-[#61FF7B]">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Waiting for scan...
                </div>
              </div>
            )}

            {whatsappStep === 'success' && (
              <div className="flex flex-col items-center gap-4 py-6">
                <CheckCircle2 className="w-12 h-12 text-[#61FF7B]" />
                <p className="text-sm text-[#F4F6FF] font-medium">WhatsApp connected!</p>
                <Button className="bg-[#61FF7B] hover:bg-[#51EF6B] text-[#0B0B10]" onClick={closeWhatsAppDialog}>
                  Done
                </Button>
              </div>
            )}

            {whatsappStep === 'error' && (
              <div className="text-center py-6">
                <AlertTriangle className="w-12 h-12 text-[#FF6161] mx-auto mb-2" />
                <p className="text-sm text-[#F4F6FF]">Connection failed</p>
                <p className="text-xs text-[#A7ACB8] mt-1">Please try again later</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Email Dialog */}
      {emailDialog && (
        <Card className="bg-[#0B0B10] border-[#61FF7B]/40 relative overflow-hidden">
          <CardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
            <button onClick={() => setEmailDialog(false)} className="absolute top-4 right-4 text-[#A7ACB8] hover:text-white z-10">
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-[#61FF7B]/20 flex items-center justify-center">
                <Mail className="w-5 h-5 text-[#61FF7B]" />
              </div>
              <div>
                <h3 className="font-semibold text-[#F4F6FF]">Email Notifications</h3>
                <p className="text-xs text-[#A7ACB8]">Get reminders and briefings via email</p>
              </div>
            </div>

            {emailSaved ? (
              <div className="text-center py-4">
                <CheckCircle2 className="w-12 h-12 text-[#61FF7B] mx-auto mb-2" />
                <p className="text-sm text-[#F4F6FF]">Email notifications enabled!</p>
              </div>
            ) : (
              <div className="space-y-4">
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  className="bg-[#05050A] border-[#7B61FF]/20 text-[#F4F6FF]"
                />
                <Button
                  className="w-full bg-[#61FF7B] hover:bg-[#51EF6B] text-[#0B0B10]"
                  onClick={handleEmailSave}
                  disabled={emailSaving}
                >
                  {emailSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
                  Enable Notifications
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
              <CardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 sm:gap-4">
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
                  ) : (
                    <Button
                      size={isMobile ? 'default' : 'sm'}
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

                <div className="flex flex-wrap gap-2 mb-4">
                  {connection.features.map((feature, i) => (
                    <Badge key={i} variant="outline" className="border-[#7B61FF]/20 text-[#A7ACB8] text-xs">
                      {feature}
                    </Badge>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-[#7B61FF]/10 text-xs text-[#A7ACB8]">
                  {connection.lastSync ? (
                    <span>Last synced: {connection.lastSync}</span>
                  ) : (
                    <span>Never synced</span>
                  )}
                  {connection.status === 'connected' && (
                    <span>{connection.requestsToday} req today</span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Privacy Note */}
      <Card className="bg-gradient-to-r from-[#7B61FF]/10 to-transparent border-[#7B61FF]/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-[#7B61FF] flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-[#F4F6FF] mb-1">Privacy First</h4>
              <p className="text-xs text-[#A7ACB8]">
                Your data is encrypted and never shared. You can disconnect any service at any time.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
