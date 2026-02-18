import { useState } from 'react';
import { Link2, Check, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { integrationService } from '@/services/api';
import type { IntegrationType } from '@/types';

const integrationOptions: { id: IntegrationType; name: string; description: string }[] = [
  { id: 'telegram', name: 'Telegram', description: 'Chat with your agent via Telegram' },
  { id: 'google-calendar', name: 'Google Calendar', description: 'Sync events and schedules' },
  { id: 'github', name: 'GitHub', description: 'Showcase repos in portfolio' },
  { id: 'n8n', name: 'n8n', description: 'Advanced workflow automation' },
];

interface IntegrationsStepProps {
  selected: IntegrationType[];
  onToggle: (integrations: IntegrationType[]) => void;
  onSkip: () => void;
}

export function IntegrationsStep({ selected, onToggle, onSkip }: IntegrationsStepProps) {
  const [telegramState, setTelegramState] = useState<'idle' | 'loading' | 'waiting' | 'checking' | 'connected'>('idle');
  const [deepLink, setDeepLink] = useState('');

  const toggle = (id: IntegrationType) => {
    // For telegram, trigger the connect flow instead of just toggling
    if (id === 'telegram' && !selected.includes('telegram')) {
      handleTelegramConnect();
      return;
    }
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
        // Already connected
        setTelegramState('connected');
        if (!selected.includes('telegram')) {
          onToggle([...selected, 'telegram']);
        }
      } else if (data.deepLink) {
        setDeepLink(data.deepLink);
        setTelegramState('waiting');
      } else {
        setTelegramState('idle');
      }
    } catch {
      setTelegramState('idle');
    }
  };

  const handleCheckStatus = async () => {
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
      <div className="space-y-3">
        {integrationOptions.map((opt) => {
          const isSelected = selected.includes(opt.id);
          const isTelegram = opt.id === 'telegram';

          return (
            <div key={opt.id}>
              <button
                type="button"
                onClick={() => toggle(opt.id)}
                className={`w-full p-4 rounded-xl border transition-all flex items-center justify-between ${
                  isSelected || (isTelegram && telegramState === 'connected')
                    ? 'border-[#7B61FF] bg-[#7B61FF]/10'
                    : 'border-[#7B61FF]/20 bg-[#05050A] hover:border-[#7B61FF]/40'
                }`}
              >
                <div className="text-left">
                  <div className="font-medium text-[#F4F6FF]">{opt.name}</div>
                  <div className="text-sm text-[#A7ACB8]">{opt.description}</div>
                </div>
                {(isSelected || telegramState === 'connected') ? (
                  <div className="w-6 h-6 rounded-full bg-[#7B61FF] flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                ) : isTelegram && telegramState === 'loading' ? (
                  <Loader2 className="w-5 h-5 animate-spin text-[#7B61FF]" />
                ) : null}
              </button>

              {/* Telegram connect flow panel */}
              {isTelegram && telegramState === 'waiting' && (
                <div className="mt-2 p-4 rounded-xl bg-[#7B61FF]/5 border border-[#7B61FF]/20 space-y-3">
                  <p className="text-sm text-[#A7ACB8]">
                    Click the button below to open Telegram, then send <span className="text-[#7B61FF] font-mono">/start</span> to the bot.
                  </p>
                  <div className="flex gap-2">
                    <a
                      href={deepLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#7B61FF] text-white rounded-lg text-sm font-medium hover:bg-[#6B51EF] transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open Telegram
                    </a>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCheckStatus}
                      className="border-[#7B61FF]/30 text-[#A7ACB8]"
                    >
                      <RefreshCw className="w-4 h-4 mr-1" />
                      I've connected
                    </Button>
                  </div>
                </div>
              )}

              {isTelegram && telegramState === 'checking' && (
                <div className="mt-2 p-3 rounded-xl bg-[#7B61FF]/5 border border-[#7B61FF]/20 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#7B61FF]" />
                  <span className="text-sm text-[#A7ACB8]">Checking connection...</span>
                </div>
              )}

              {isTelegram && telegramState === 'connected' && (
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
                    }}
                    className="text-xs text-[#A7ACB8] hover:text-[#F4F6FF] transition-colors underline underline-offset-2"
                  >
                    Link a different account
                  </button>
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
          className="text-sm text-[#A7ACB8] hover:text-[#7B61FF] transition-colors"
        >
          I'll do this later
        </button>
      </div>
    </div>
  );
}
