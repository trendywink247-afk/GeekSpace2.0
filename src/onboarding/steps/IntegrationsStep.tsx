import { useState, useEffect, useCallback } from 'react';
import { Link2, Check, ExternalLink, Loader2, RefreshCw, Smartphone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { integrationService } from '@/services/api';
import type { IntegrationType } from '@/types';

const integrationOptions: { id: IntegrationType; name: string; description: string; color: string }[] = [
  { id: 'telegram', name: 'Telegram', description: 'Chat with your agent via Telegram', color: '#0088cc' },
  { id: 'whatsapp', name: 'WhatsApp', description: 'Chat with your agent via WhatsApp', color: '#25d366' },
  { id: 'google-calendar', name: 'Google Calendar', description: 'Sync events and schedules', color: '#4285f4' },
  { id: 'github', name: 'GitHub', description: 'Showcase repos in portfolio', color: '#f0f6fc' },
  { id: 'n8n', name: 'n8n', description: 'Advanced workflow automation', color: '#ff6d5a' },
];

interface IntegrationsStepProps {
  selected: IntegrationType[];
  onToggle: (integrations: IntegrationType[]) => void;
  onSkip: () => void;
}

type ConnectState = 'idle' | 'loading' | 'waiting' | 'checking' | 'connected' | 'error';

export function IntegrationsStep({ selected, onToggle, onSkip }: IntegrationsStepProps) {
  // Telegram state
  const [telegramState, setTelegramState] = useState<ConnectState>('idle');
  const [telegramDeepLink, setTelegramDeepLink] = useState('');

  // WhatsApp state
  const [whatsappState, setWhatsappState] = useState<ConnectState>('idle');
  const [whatsappQR, setWhatsappQR] = useState<string | null>(null);
  const [whatsappSessionId, setWhatsappSessionId] = useState<string | null>(null);
  const [whatsappPolling, setWhatsappPolling] = useState(false);

  // Poll for WhatsApp link status
  const pollWhatsAppStatus = useCallback(async () => {
    if (!whatsappSessionId) return;
    try {
      const { data } = await integrationService.checkWhatsAppQRStatus(whatsappSessionId);
      if (data.linked) {
        setWhatsappState('connected');
        setWhatsappPolling(false);
        if (!selected.includes('whatsapp')) {
          onToggle([...selected, 'whatsapp']);
        }
      }
    } catch {
      // Continue polling
    }
  }, [whatsappSessionId, selected, onToggle]);

  useEffect(() => {
    if (!whatsappPolling) return;
    const interval = setInterval(pollWhatsAppStatus, 3000);
    return () => clearInterval(interval);
  }, [whatsappPolling, pollWhatsAppStatus]);

  const toggle = (id: IntegrationType) => {
    // For telegram, trigger the connect flow instead of just toggling
    if (id === 'telegram' && !selected.includes('telegram')) {
      handleTelegramConnect();
      return;
    }
    // For whatsapp, trigger the QR flow
    if (id === 'whatsapp' && !selected.includes('whatsapp')) {
      handleWhatsAppConnect();
      return;
    }
    // For others, simple toggle
    if (selected.includes(id)) {
      onToggle(selected.filter((i) => i !== id));
    } else {
      onToggle([...selected, id]);
    }
  };

  const handleTelegramConnect = async () => {
    setTelegramState('loading');
    try {
      const { data } = await integrationService.linkTelegram();
      if (data.linked) {
        setTelegramState('connected');
        if (!selected.includes('telegram')) {
          onToggle([...selected, 'telegram']);
        }
      } else if (data.deepLink) {
        setTelegramDeepLink(data.deepLink);
        setTelegramState('waiting');
      } else {
        setTelegramState('idle');
      }
    } catch {
      setTelegramState('error');
    }
  };

  const handleWhatsAppConnect = async () => {
    setWhatsappState('loading');
    try {
      const { data } = await integrationService.linkWhatsAppQR();
      if (data.success && data.qrCodeDataUrl) {
        setWhatsappQR(data.qrCodeDataUrl);
        setWhatsappSessionId(data.sessionId);
        setWhatsappState('waiting');
        setWhatsappPolling(true);
      } else {
        setWhatsappState('error');
      }
    } catch {
      setWhatsappState('error');
    }
  };

  const handleCheckTelegramStatus = async () => {
    setTelegramState('checking');
    try {
      const { data } = await integrationService.checkTelegramLink();
      if (data.linked) {
        setTelegramState('connected');
        if (!selected.includes('telegram')) {
          onToggle([...selected, 'telegram']);
        }
      } else {
        setTelegramState('waiting');
      }
    } catch {
      setTelegramState('waiting');
    }
  };

  const getState = (id: IntegrationType): ConnectState => {
    if (id === 'telegram') return telegramState;
    if (id === 'whatsapp') return whatsappState;
    return selected.includes(id) ? 'connected' : 'idle';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Link2 className="w-6 h-6 text-[#7B61FF]" />
        <h2 className="text-xl font-semibold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          Connect Integrations
        </h2>
      </div>
      <p className="text-[#A7ACB8] text-sm">
        Optional — you can add these later from the dashboard.
      </p>

      {/* WhatsApp QR Modal */}
      {whatsappState === 'waiting' && whatsappQR && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0B0B10] border border-[#25d366]/40 rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[#25d366]" />
                <h3 className="font-semibold text-[#F4F6FF]">Connect WhatsApp</h3>
              </div>
              <button
                onClick={() => {
                  setWhatsappState('idle');
                  setWhatsappPolling(false);
                }}
                className="text-[#A7ACB8] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="text-center space-y-4">
              <div className="bg-white p-4 rounded-xl inline-block">
                <img src={whatsappQR} alt="WhatsApp QR Code" className="w-48 h-48" />
              </div>
              <p className="text-sm text-[#A7ACB8]">
                Open WhatsApp → Settings → Linked Devices → Link a Device
              </p>
              <p className="text-xs text-[#A7ACB8]">
                Scan the QR code to connect
              </p>
              <div className="flex items-center justify-center gap-2 text-xs text-[#61FF7B]">
                <Loader2 className="w-3 h-3 animate-spin" />
                Waiting for scan...
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {integrationOptions.map((opt) => {
          const state = getState(opt.id);
          const isConnected = state === 'connected' || selected.includes(opt.id);
          const isLoading = state === 'loading';
          const isWaiting = state === 'waiting';
          const isChecking = state === 'checking';
          const isError = state === 'error';

          return (
            <div key={opt.id}>
              <button
                type="button"
                onClick={() => toggle(opt.id)}
                className={`w-full p-4 min-h-[44px] rounded-xl border transition-all flex items-center justify-between ${
                  isConnected
                    ? 'border-[#7B61FF] bg-[#7B61FF]/10'
                    : 'border-[#7B61FF]/20 bg-[#05050A] hover:border-[#7B61FF]/40'
                }`}
              >
                <div className="text-left">
                  <div className="font-medium text-[#F4F6FF]">{opt.name}</div>
                  <div className="text-sm text-[#A7ACB8]">{opt.description}</div>
                </div>
                {isConnected ? (
                  <div className="w-6 h-6 rounded-full bg-[#61FF7B] flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-[#0B0B10]" />
                  </div>
                ) : isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-[#7B61FF]" />
                ) : isWaiting ? (
                  <div className="w-2 h-2 rounded-full bg-[#FFD761] animate-pulse" />
                ) : null}
              </button>

              {/* Telegram connect flow panel */}
              {opt.id === 'telegram' && isWaiting && (
                <div className="mt-2 p-4 rounded-xl bg-[#0088cc]/5 border border-[#0088cc]/20 space-y-3">
                  <p className="text-sm text-[#A7ACB8]">
                    Click to open Telegram, then send <span className="text-[#0088cc] font-mono">/start</span> to the bot.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <a
                      href={telegramDeepLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 min-h-[44px] bg-[#0088cc] text-white rounded-lg text-sm font-medium hover:bg-[#0077b5] transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open Telegram
                    </a>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCheckTelegramStatus}
                      className="min-h-[44px] border-[#0088cc]/30 text-[#A7ACB8]"
                    >
                      <RefreshCw className="w-4 h-4 mr-1" />
                      I've connected
                    </Button>
                  </div>
                </div>
              )}

              {opt.id === 'telegram' && isChecking && (
                <div className="mt-2 p-3 rounded-xl bg-[#0088cc]/5 border border-[#0088cc]/20 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#0088cc]" />
                  <span className="text-sm text-[#A7ACB8]">Checking connection...</span>
                </div>
              )}

              {opt.id === 'telegram' && isConnected && (
                <div className="mt-2 p-3 rounded-xl bg-[#61FF7B]/5 border border-[#61FF7B]/20 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#61FF7B]" />
                    <span className="text-sm text-[#61FF7B]">Telegram connected!</span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await integrationService.unlinkTelegram();
                      } catch {
                        // ignore errors — reset UI regardless
                      }
                      setTelegramState('idle');
                      onToggle(selected.filter((i) => i !== 'telegram'));
                    }}
                    className="text-xs text-[#A7ACB8] hover:text-[#F4F6FF] transition-colors underline underline-offset-2"
                  >
                    Unlink
                  </button>
                </div>
              )}

              {opt.id === 'whatsapp' && isConnected && (
                <div className="mt-2 p-3 rounded-xl bg-[#61FF7B]/5 border border-[#61FF7B]/20 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#61FF7B]" />
                    <span className="text-sm text-[#61FF7B]">WhatsApp connected!</span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await integrationService.unlinkWhatsApp();
                      } catch {
                        // ignore errors
                      }
                      setWhatsappState('idle');
                      setWhatsappPolling(false);
                      onToggle(selected.filter((i) => i !== 'whatsapp'));
                    }}
                    className="text-xs text-[#A7ACB8] hover:text-[#F4F6FF] transition-colors underline underline-offset-2"
                  >
                    Unlink
                  </button>
                </div>
              )}

              {opt.id === 'whatsapp' && isError && (
                <div className="mt-2 p-3 rounded-xl bg-[#FF6161]/5 border border-[#FF6161]/20 flex items-center gap-2">
                  <span className="text-sm text-[#FF6161]">Failed to connect. Please try again.</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="text-center pt-2">
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-[#A7ACB8] hover:text-[#7B61FF] transition-colors min-h-[44px] px-4"
        >
          I'll do this later
        </button>
      </div>
    </div>
  );
}
