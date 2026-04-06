// ─── IntegrationList ──────────────────────────────────────────────────────────
// Renders the grid of IntegrationCards plus the empty state. All card state and
// handlers are passed in from ConnectionsPage.
import { motion } from 'framer-motion';
import { Plug } from 'lucide-react';
import type { Integration } from '@/types';
import type { IntegrationType } from '@/types';
import { SHADOW, fadeUp, type CustomBotStatus, type CustomBotInfo, type TestResultEntry } from './helpers';
import { IntegrationCard } from './IntegrationCard';

interface IntegrationListProps {
  filteredIntegrations: Integration[];
  statusFilter: string;
  connectingId: string | null;
  expandedId: string | null;
  isMobile: boolean;
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

export function IntegrationList({
  filteredIntegrations,
  statusFilter,
  connectingId,
  expandedId,
  isMobile,
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
}: IntegrationListProps) {
  return (
    <div id="integration-grid" className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Empty state */}
      {filteredIntegrations.length === 0 && (
        <motion.div
          custom={6}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="md:col-span-2 text-center py-16"
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(139,92,246,0.06)', boxShadow: SHADOW.stat }}
          >
            <Plug className="w-7 h-7 text-[var(--ag-text-muted)]" />
          </div>
          <p className="text-base font-medium text-[var(--ag-text-primary)] mb-2">
            {statusFilter === 'all' ? 'No integrations yet' : `No ${statusFilter} integrations`}
          </p>
          <p className="text-sm text-[var(--ag-text-secondary)] max-w-sm mx-auto text-wrap-balance">
            Connect Telegram, WhatsApp, or webhooks to receive notifications and automate workflows.
          </p>
        </motion.div>
      )}

      {/* Cards */}
      {filteredIntegrations.map((connection, idx) => (
        <IntegrationCard
          key={connection.id}
          connection={connection}
          index={idx}
          isMobile={isMobile}
          connectingId={connectingId}
          expandedId={expandedId}
          healthStatus={healthStatus}
          pingLatency={pingLatency}
          pinging={pinging}
          testing={testing}
          testResult={testResult}
          telegramUsername={telegramUsername}
          telegramLastPing={telegramLastPing}
          customBotExpanded={customBotExpanded}
          customBotStatus={customBotStatus}
          customBotInfo={customBotInfo}
          customBotToken={customBotToken}
          customBotError={customBotError}
          onConnect={onConnect}
          onDisconnect={onDisconnect}
          onPing={onPing}
          onTestConnection={onTestConnection}
          onToggleExpand={onToggleExpand}
          onSetCustomBotExpanded={onSetCustomBotExpanded}
          onSetCustomBotToken={onSetCustomBotToken}
          onSetCustomBotStatus={onSetCustomBotStatus}
          onSetCustomBotError={onSetCustomBotError}
          onCustomBotConnect={onCustomBotConnect}
          onCustomBotDisconnect={onCustomBotDisconnect}
        />
      ))}

    </div>
  );
}
