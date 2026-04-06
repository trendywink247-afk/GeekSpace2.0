// ─── Custom Telegram Bot Section ─────────────────────────────────────────────
// Collapsible panel inside the Telegram card allowing users to connect their
// own bot via a BotFather token.
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  ExternalLink,
  Key,
  Unplug,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { type CustomBotStatus, type CustomBotInfo, slideDown } from './helpers';

interface CustomBotSectionProps {
  customBotToken: string;
  customBotStatus: CustomBotStatus;
  customBotInfo: CustomBotInfo | null;
  customBotError: string | null;
  customBotExpanded: boolean;
  onToggleExpand: () => void;
  onTokenChange: (token: string) => void;
  onStatusChange: (status: CustomBotStatus) => void;
  onErrorChange: (error: string | null) => void;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function CustomBotSection({
  customBotToken,
  customBotStatus,
  customBotInfo,
  customBotError,
  customBotExpanded,
  onToggleExpand,
  onTokenChange,
  onStatusChange,
  onErrorChange,
  onConnect,
  onDisconnect,
}: CustomBotSectionProps) {
  return (
    <div className="mb-4">
      {/* ── Divider ── */}
      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px" style={{ background: 'rgba(167,139,250,0.1)' }} />
        <span className="text-[11px] text-[var(--ag-text-muted)]">or</span>
        <div className="flex-1 h-px" style={{ background: 'rgba(167,139,250,0.1)' }} />
      </div>

      {/* ── Toggle button ── */}
      <button
        onClick={onToggleExpand}
        className="flex items-center justify-between w-full min-h-[44px] px-3 py-2.5 rounded-xl group/cbot active:scale-[0.96] transition-[transform,box-shadow] duration-150"
        style={{
          background: 'var(--ag-bg-deep)',
          boxShadow: customBotExpanded
            ? '0 0 0 1px rgba(167,139,250,0.3), 0 0 12px rgba(167,139,250,0.08)'
            : '0 0 0 1px rgba(167,139,250,0.15)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <Bot className="w-4 h-4 text-[var(--ag-text-accent)]" />
          <span className="text-sm font-medium text-[var(--ag-text-primary)]">Connect Your Own Bot</span>
          {customBotStatus === 'connected' && customBotInfo && (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-[var(--ag-green)]"
              style={{ background: 'rgba(0,255,136,0.1)', boxShadow: '0 0 0 1px rgba(0,255,136,0.2)' }}
            >
              Active
            </span>
          )}
        </div>
        {customBotExpanded ? (
          <ChevronUp className="w-4 h-4 text-[var(--ag-text-muted)] group-hover/cbot:text-[var(--ag-text-accent)] transition-colors duration-150" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[var(--ag-text-muted)] group-hover/cbot:text-[var(--ag-text-accent)] transition-colors duration-150" />
        )}
      </button>

      {/* ── Expandable body ── */}
      <AnimatePresence initial={false}>
        {customBotExpanded && (
          <motion.div variants={slideDown} initial="hidden" animate="show" exit="exit" className="overflow-hidden">
            <div
              className="mt-3 p-4 rounded-xl space-y-4"
              style={{ background: 'var(--ag-bg-deep)', boxShadow: '0 0 0 1px rgba(167,139,250,0.12)' }}
            >
              {customBotStatus === 'connected' && customBotInfo ? (
                /* ── Connected state ── */
                <div className="space-y-3">
                  <div
                    className="flex items-center gap-3 p-3 rounded-lg"
                    style={{ background: 'rgba(0,255,136,0.05)', boxShadow: '0 0 0 1px rgba(0,255,136,0.15)' }}
                  >
                    <CheckCircle2 className="w-5 h-5 text-[var(--ag-green)] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--ag-text-primary)]">{customBotInfo.botName}</p>
                      <p className="text-xs text-[var(--ag-text-muted)]">@{customBotInfo.botUsername}</p>
                    </div>
                    <a
                      href={`https://t.me/${customBotInfo.botUsername}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[#0088cc] text-xs font-medium min-h-[36px] active:scale-[0.96] transition-[transform,opacity] duration-150"
                      style={{ background: 'rgba(0,136,204,0.12)' }}
                    >
                      <ExternalLink className="w-3 h-3" />Open
                    </a>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onDisconnect}
                    className="w-full min-h-[44px] active:scale-[0.96] transition-[transform,opacity] duration-150"
                    style={{ borderColor: 'rgba(255,97,97,0.3)', color: '#FF6161' }}
                  >
                    <Unplug className="w-3.5 h-3.5 mr-1.5" />Disconnect Custom Bot
                  </Button>
                </div>
              ) : (
                /* ── Idle / error state ── */
                <>
                  <div className="space-y-2">
                    <label className="flex items-center gap-1.5 text-xs text-[var(--ag-text-muted)]">
                      <Key className="w-3 h-3" />Paste your BotFather token
                    </label>
                    <Input
                      type="text"
                      placeholder="123456:ABC-DEF…"
                      value={customBotToken}
                      onChange={(e) => {
                        onTokenChange(e.target.value);
                        if (customBotStatus === 'error') {
                          onStatusChange('idle');
                          onErrorChange(null);
                        }
                      }}
                      className="bg-[var(--ag-bg-base)] border-[var(--ag-border-subtle)] text-[var(--ag-text-primary)] font-mono text-sm min-h-[44px] rounded-xl"
                    />
                  </div>

                  {customBotStatus === 'error' && customBotError && (
                    <div
                      className="flex items-start gap-2 p-3 rounded-lg"
                      style={{ background: 'rgba(255,97,97,0.06)', boxShadow: '0 0 0 1px rgba(255,97,97,0.2)' }}
                    >
                      <AlertTriangle className="w-4 h-4 text-[#FF6161] shrink-0 mt-0.5" />
                      <p className="text-xs text-[#FF6161]">{customBotError}</p>
                    </div>
                  )}

                  <Button
                    onClick={onConnect}
                    disabled={customBotStatus === 'verifying' || !customBotToken.trim()}
                    className="w-full min-h-[44px] font-semibold text-white active:scale-[0.96] transition-[transform,opacity] duration-150 disabled:opacity-50"
                    style={{
                      background: 'linear-gradient(135deg, var(--ag-violet), var(--ag-amber))',
                      boxShadow: '0 2px 10px rgba(139,92,246,0.25)',
                    }}
                  >
                    {customBotStatus === 'verifying' ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying…</>
                    ) : (
                      <><CheckCircle2 className="w-4 h-4 mr-2" />Verify & Connect</>
                    )}
                  </Button>

                  <p className="text-[11px] text-[var(--ag-text-muted)] leading-relaxed">
                    Open{' '}
                    <a
                      href="https://t.me/BotFather"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--ag-text-accent)] hover:underline"
                    >
                      @BotFather
                    </a>
                    {' '}in Telegram → /newbot → copy the token
                  </p>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
