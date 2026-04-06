// ─── IntegrationCard ──────────────────────────────────────────────────────────
// Single integration card with connect/disconnect, health bar, test-connection,
// ping, and (for Telegram) the custom-bot sub-panel.
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plug,
  Loader2,
  CheckCircle2,
  Wifi,
  WifiOff,
  Bell,
  Send,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import type { Integration } from '@/types';
import type { IntegrationType } from '@/types';
import { notify } from '@/services/notifications';
import {
  SHADOW,
  fadeUp,
  slideDown,
  timeAgo,
  getIcon,
  getColor,
  type CustomBotStatus,
  type CustomBotInfo,
  type TestResultEntry,
} from './helpers';
import { CustomBotSection } from './CustomBotSection';

// ─── Status badge helper (local — only used in this component) ────────────────
function StatusBadge({
  status,
  health,
}: {
  status: string;
  health?: 'healthy' | 'unhealthy' | 'checking';
}) {
  if (status === 'connected') {
    const isUnhealthy = health === 'unhealthy';
    const dotColor = isUnhealthy ? '#FF6161' : '#00FF88';
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span
            className="absolute inset-0 rounded-full animate-ping opacity-60"
            style={{ backgroundColor: dotColor }}
          />
          <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: dotColor }} />
        </span>
        <span className="text-xs font-medium tabular-nums" style={{ color: dotColor }}>
          {isUnhealthy ? 'Degraded' : 'Connected'}
        </span>
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-[#FF6161]" />
        <span className="text-xs font-medium text-[#FF6161]">Error — reconnect</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full bg-[var(--ag-text-muted)]" />
      <span className="text-xs text-[var(--ag-text-muted)]">Not connected</span>
    </span>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
export interface IntegrationCardProps {
  connection: Integration;
  index: number;
  isMobile: boolean;
  connectingId: string | null;
  expandedId: string | null;
  healthStatus: Record<string, 'healthy' | 'unhealthy' | 'checking'>;
  pingLatency: Record<string, number | null>;
  pinging: Record<string, boolean>;
  testing: Record<string, boolean>;
  testResult: Record<string, TestResultEntry | null>;
  telegramUsername: string | null;
  telegramLastPing: string | null;
  customBotExpanded: boolean;
  customBotStatus: CustomBotStatus;
  customBotInfo: CustomBotInfo | null;
  customBotToken: string;
  customBotError: string | null;
  onConnect: (type: IntegrationType) => void;
  onDisconnect: (id: string) => void;
  onPing: (type: string) => void;
  onTestConnection: (type: string) => void;
  onToggleExpand: (id: string) => void;
  onSetCustomBotExpanded: (v: boolean) => void;
  onSetCustomBotToken: (v: string) => void;
  onSetCustomBotStatus: (v: CustomBotStatus) => void;
  onSetCustomBotError: (v: string | null) => void;
  onCustomBotConnect: () => void;
  onCustomBotDisconnect: () => void;
}

export function IntegrationCard({
  connection,
  index,
  isMobile,
  connectingId,
  expandedId,
  healthStatus,
  pingLatency,
  pinging,
  testing,
  testResult,
  telegramUsername,
  telegramLastPing,
  customBotExpanded,
  customBotStatus,
  customBotInfo,
  customBotToken,
  customBotError,
  onConnect,
  onDisconnect,
  onPing,
  onTestConnection,
  onToggleExpand,
  onSetCustomBotExpanded,
  onSetCustomBotToken,
  onSetCustomBotStatus,
  onSetCustomBotError,
  onCustomBotConnect,
  onCustomBotDisconnect,
}: IntegrationCardProps) {
  const Icon = getIcon(connection.type);
  const color = getColor(connection.type);
  const isTelegram = connection.type === 'telegram';
  const isExpanded = !isMobile || expandedId === connection.id;

  const cardShadow = isTelegram
    ? SHADOW.cardTelegram
    : connection.status === 'connected'
    ? SHADOW.cardConnected
    : SHADOW.card;

  return (
    <motion.div key={connection.id} custom={index + 6} variants={fadeUp} initial="hidden" animate="show" className="h-full">
      <div
        className="relative group h-full rounded-2xl overflow-hidden bg-[var(--ag-bg-surface)] backdrop-blur-xl transition-[box-shadow] duration-300"
        style={{ boxShadow: cardShadow }}
      >
        {/* Top edge color accent */}
        <div
          className="absolute inset-x-0 top-0 h-px opacity-50"
          style={{ background: `linear-gradient(90deg, transparent 10%, ${color}40, transparent 90%)` }}
        />

        <div className="p-4 md:p-5">
          {/* Telegram recommended badge */}
          {isTelegram && (
            <div className="flex items-center gap-2 mb-3">
              <span
                className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full text-[var(--ag-text-accent)]"
                style={{ background: 'rgba(167,139,250,0.1)', boxShadow: '0 0 0 1px rgba(167,139,250,0.25)' }}
              >
                Recommended
              </span>
              <span className="text-[10px] text-[var(--ag-text-muted)]">Primary channel</span>
            </div>
          )}

          {/* Card header row */}
          <div
            className={`flex items-start justify-between gap-3 ${isExpanded ? 'mb-4' : ''} ${isMobile ? 'cursor-pointer' : ''}`}
            onClick={isMobile ? () => onToggleExpand(connection.id) : undefined}
          >
            <div className="flex items-center gap-3 min-w-0">
              {/* Icon */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-[transform] duration-200 group-hover:scale-105"
                style={{ background: `${color}18`, boxShadow: `0 0 0 1px ${color}25` }}
              >
                <Icon className="w-6 h-6" style={{ color }} />
              </div>

              <div className="min-w-0">
                <h3 className="font-heading font-semibold text-[var(--ag-text-primary)] leading-tight text-wrap-balance">
                  {connection.name}
                </h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {connection.type === 'whatsapp' && connection.status !== 'connected' ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-[var(--ag-amber)]" />
                      <span className="text-xs text-[var(--ag-amber)] font-medium">Not yet available</span>
                    </span>
                  ) : (
                    <StatusBadge status={connection.status} health={healthStatus[connection.type]} />
                  )}
                  {connection.status === 'connected' && healthStatus[connection.type] === 'checking' && (
                    <span className="w-2 h-2 rounded-full bg-[var(--ag-amber)] animate-pulse" title="Checking health…" />
                  )}
                  {connection.status === 'connected' && pingLatency[connection.type] != null && (
                    <span className="text-xs text-[var(--ag-text-accent)] font-mono tabular-nums">
                      {pingLatency[connection.type]}ms
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Action button */}
            <div className="shrink-0 flex flex-col items-end gap-1.5">
              {connection.status === 'connected' ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-[var(--ag-border-subtle)] text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:border-[var(--ag-border-default)] min-h-[40px] active:scale-[0.96] transition-[transform,opacity] duration-150"
                  onClick={(e) => e.stopPropagation()}
                >
                  Manage
                </Button>
              ) : connection.type === 'whatsapp' ? (
                <>
                  <Badge
                    className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5"
                    style={{
                      background: 'rgba(245,158,11,0.12)',
                      color: 'var(--ag-amber)',
                      boxShadow: '0 0 0 1px rgba(245,158,11,0.25)',
                    }}
                  >
                    Coming Soon
                  </Badge>
                  <Button size="sm" disabled className="opacity-40 min-h-[40px] cursor-not-allowed">
                    <Plug className="w-3.5 h-3.5 mr-1.5" />Connect
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={() => onConnect(connection.type)}
                  disabled={connectingId === connection.type}
                  className="min-h-[40px] font-semibold text-white active:scale-[0.96] transition-[transform,opacity] duration-150 disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(135deg, var(--ag-violet), var(--ag-amber))',
                    boxShadow: '0 2px 10px rgba(139,92,246,0.25)',
                  }}
                >
                  {connectingId === connection.type ? (
                    <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Connecting…</>
                  ) : (
                    <><Plug className="w-3.5 h-3.5 mr-1.5" />Connect</>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Expanded content */}
          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div variants={slideDown} initial="hidden" animate="show" exit="exit" className="overflow-hidden">
                <p className="text-sm text-[var(--ag-text-secondary)] mb-4 text-wrap-pretty">
                  {connection.description}
                </p>

                {/* Health bar */}
                {connection.status === 'connected' && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-[var(--ag-text-muted)]">Health</span>
                      <div className="flex items-center gap-3">
                        <span className="text-[var(--ag-text-primary)] font-medium tabular-nums">{connection.health}%</span>
                        <button
                          onClick={() => void onPing(connection.type)}
                          disabled={pinging[connection.type]}
                          className="text-xs text-[var(--ag-text-accent)] hover:text-[var(--ag-violet)] disabled:opacity-50 min-h-[28px] active:scale-[0.96] transition-[transform,color] duration-150"
                          title="Test latency"
                        >
                          {pinging[connection.type] ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <span>Ping{pingLatency[connection.type] != null ? ` · ${pingLatency[connection.type]}ms` : ''}</span>
                          )}
                        </button>
                      </div>
                    </div>
                    <div
                      className="h-2 rounded-full overflow-hidden"
                      style={{ background: 'rgba(0,0,0,0.25)', boxShadow: '0 0 0 1px rgba(255,255,255,0.04) inset' }}
                    >
                      <div
                        className="h-full rounded-full transition-[width] duration-700"
                        style={{
                          width: `${connection.health}%`,
                          background:
                            connection.health > 80
                              ? 'linear-gradient(90deg, #00CC6A, #00FF88)'
                              : connection.health > 50
                              ? 'linear-gradient(90deg, #D97706, #F59E0B)'
                              : 'linear-gradient(90deg, #DC2626, #FF6161)',
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Feature badges */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {connection.features.map((feature, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-0.5 rounded-full text-[var(--ag-text-muted)]"
                      style={{ boxShadow: '0 0 0 1px rgba(139,92,246,0.1)' }}
                    >
                      {feature}
                    </span>
                  ))}
                </div>

                {/* WhatsApp: interest capture */}
                {connection.type === 'whatsapp' && connection.status !== 'connected' && (
                  <div
                    className="mb-4 p-3 rounded-xl"
                    style={{ background: 'rgba(245,158,11,0.05)', boxShadow: '0 0 0 1px rgba(245,158,11,0.15)' }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-[var(--ag-text-secondary)]">WhatsApp integration is under development.</p>
                      <button
                        onClick={() => notify("We'll notify you when WhatsApp is available!", 'success')}
                        className="flex items-center gap-1.5 text-xs text-[var(--ag-amber)] hover:opacity-80 font-medium whitespace-nowrap min-h-[44px] active:scale-[0.96] transition-[transform,opacity] duration-150"
                      >
                        <Bell className="w-3.5 h-3.5" />Notify me
                      </button>
                    </div>
                  </div>
                )}

                {/* Test connection */}
                {connection.status === 'connected' && (
                  <div className="mb-4 flex items-center gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void onTestConnection(connection.type)}
                      disabled={testing[connection.type]}
                      className="border-[var(--ag-border-subtle)] text-[var(--ag-text-accent)] hover:border-[var(--ag-border-default)] hover:bg-[var(--ag-active-bg)] text-xs min-h-[40px] active:scale-[0.96] transition-[transform,opacity] duration-150"
                      data-testid={`test-connection-${connection.type}`}
                    >
                      {testing[connection.type] ? (
                        <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Testing…</>
                      ) : (
                        <><Wifi className="w-3 h-3 mr-1.5" />Test Connection</>
                      )}
                    </Button>
                    {testResult[connection.type] && (
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium ${
                          testResult[connection.type]!.status === 'pass' ? 'text-[var(--ag-green)]' : 'text-[#FF6161]'
                        }`}
                      >
                        {testResult[connection.type]!.status === 'pass' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <WifiOff className="w-3 h-3" />
                        )}
                        {testResult[connection.type]!.message}
                        <span className="text-[var(--ag-text-muted)] font-normal ml-0.5">
                          at {testResult[connection.type]!.at}
                        </span>
                      </span>
                    )}
                  </div>
                )}

                {/* Telegram: linked username row */}
                {isTelegram && connection.status === 'connected' && telegramUsername && (
                  <div
                    className="mb-4 p-3 rounded-xl flex items-center gap-3"
                    style={{ background: 'rgba(0,136,204,0.06)', boxShadow: '0 0 0 1px rgba(0,136,204,0.15)' }}
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(0,136,204,0.15)' }}
                    >
                      <Send className="w-4 h-4 text-[#0088cc]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--ag-text-primary)]">@{telegramUsername}</p>
                      <p className="text-xs text-[var(--ag-text-secondary)]">Open in Telegram to chat with your agent</p>
                    </div>
                    <a
                      href={`https://t.me/${telegramUsername}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-medium min-h-[40px] active:scale-[0.96] transition-[transform,opacity] duration-150"
                      style={{ background: '#0088cc', boxShadow: '0 2px 8px rgba(0,136,204,0.25)' }}
                    >
                      <ExternalLink className="w-3 h-3" />Open
                    </a>
                  </div>
                )}

                {/* Custom Telegram Bot */}
                {isTelegram && (
                  <CustomBotSection
                    customBotToken={customBotToken}
                    customBotStatus={customBotStatus}
                    customBotInfo={customBotInfo}
                    customBotError={customBotError}
                    customBotExpanded={customBotExpanded}
                    onToggleExpand={() => onSetCustomBotExpanded(!customBotExpanded)}
                    onTokenChange={onSetCustomBotToken}
                    onStatusChange={onSetCustomBotStatus}
                    onErrorChange={onSetCustomBotError}
                    onConnect={onCustomBotConnect}
                    onDisconnect={onCustomBotDisconnect}
                  />
                )}

                {/* Footer: last sync + disconnect switch */}
                <div
                  className="flex items-center justify-between pt-4 text-xs text-[var(--ag-text-muted)]"
                  style={{ borderTop: '1px solid rgba(139,92,246,0.06)' }}
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    {connection.lastSync ? (
                      <span>Last synced: {timeAgo(connection.lastSync)}</span>
                    ) : (
                      <span>Never synced</span>
                    )}
                    {isTelegram && connection.status === 'connected' && telegramUsername && (
                      <span className="text-[#0088cc] font-medium">@{telegramUsername}</span>
                    )}
                    {isTelegram && connection.status === 'connected' && telegramLastPing && (
                      <span className="text-[var(--ag-text-accent)]">Last message: {timeAgo(telegramLastPing)}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {connection.status === 'connected' && (
                      <span className="tabular-nums">{connection.requestsToday} req today</span>
                    )}
                    {connection.status === 'connected' && (
                      <Switch checked={true} onCheckedChange={() => onDisconnect(connection.id)} />
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
