// calendar/SyncBar.tsx — Google Calendar connection status + sync controls
import { Calendar, CheckCircle, RefreshCw, Unlink, Link2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CalendarStatus } from "./helpers";
import { formatLastSync } from "./helpers";

interface SyncBarProps {
  status: CalendarStatus | null;
  loading: boolean;
  syncing: boolean;
  disconnecting: boolean;
  onSync: () => void;
  onDisconnect: () => void;
  onConnect: () => void;
}

export function SyncBar({
  status,
  loading,
  syncing,
  disconnecting,
  onSync,
  onDisconnect,
  onConnect,
}: SyncBarProps) {
  return (
    <div
      className="rounded-xl p-4 border"
      style={{
        background:    'var(--ag-bg-surface)',
        backdropFilter:'blur(16px)',
        borderColor:   'var(--ag-border-subtle)',
        boxShadow:     '0 4px 20px rgba(0,0,0,0.25), 0 0 0 1px var(--ag-border-subtle)',
      }}
    >
      {loading ? (
        <div className="h-12 rounded-lg animate-pulse" style={{ background: 'var(--ag-bg-elevated)' }} />

      ) : status?.available === false ? (
        <div className="flex items-center gap-3">
          <div className="rounded-full p-2" style={{ background: 'rgba(245,158,11,0.1)' }}>
            <Calendar className="h-5 w-5 text-[var(--ag-amber)]" />
          </div>
          <div>
            <p className="font-medium text-[var(--ag-text-primary)]">Google Calendar Not Configured</p>
            <p className="text-xs text-[var(--ag-text-secondary)]">
              Contact your administrator to enable Google Calendar integration.
            </p>
          </div>
        </div>

      ) : status?.connected ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full p-2" style={{ background: 'rgba(16,185,129,0.1)' }}>
              <CheckCircle className="h-5 w-5 text-[var(--ag-green)]" />
            </div>
            <div>
              <p className="font-medium text-[var(--ag-text-primary)]">Connected</p>
              <p className="text-xs text-[var(--ag-text-secondary)]">
                {status.email ?? "Google account linked"}
                {status.lastSync && (
                  <span className="ml-2 text-[var(--ag-text-muted)]">
                    · Last synced {formatLastSync(status.lastSync)}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onSync}
              disabled={syncing}
              className="gap-1.5 min-h-[44px] border-[var(--ag-border-default)] focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync Now"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDisconnect}
              disabled={disconnecting}
              className="gap-1.5 text-red-400 hover:text-red-300 border-red-500/30 hover:border-red-500/50 min-h-[44px] focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50"
            >
              <Unlink className="h-3.5 w-3.5" />
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </Button>
          </div>
        </div>

      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full p-2" style={{ background: 'var(--ag-bg-elevated)' }}>
              <Calendar className="h-5 w-5 text-[var(--ag-text-muted)]" />
            </div>
            <div>
              <p className="font-medium text-[var(--ag-text-primary)]">Not Connected</p>
              <p className="text-xs text-[var(--ag-text-secondary)]">
                Connect your Google account to see upcoming events.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={onConnect}
            className="gap-1.5 shrink-0 min-h-[44px] bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-cyan)] text-white hover:opacity-90 font-semibold focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50"
          >
            <Link2 className="h-3.5 w-3.5" />
            Connect Google Calendar
            <ExternalLink className="h-3 w-3 opacity-60" />
          </Button>
        </div>
      )}
    </div>
  );
}
