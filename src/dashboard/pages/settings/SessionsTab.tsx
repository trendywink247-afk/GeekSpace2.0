import { Monitor, LogOut, Loader2, Globe, MapPin, Shield, Download, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { UserSession } from '@/services/api';

interface SessionsTabProps {
  sessions: UserSession[];
  setSessions: (s: UserSession[]) => void;
  sessionsLoading: boolean;
  detectedTimezone: string;
  isExportingGDPR: boolean;
  handleGDPRExport: () => void;
  handleRevokeSession: (id: string) => void;
  onRevokeAll: () => void;
}

export function SessionsTab({
  sessions,
  sessionsLoading,
  detectedTimezone,
  isExportingGDPR,
  handleGDPRExport,
  handleRevokeSession,
  onRevokeAll,
}: SessionsTabProps) {
  const currentSession =
    sessions.length > 0
      ? [...sessions].sort(
          (a, b) => new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime()
        )[0]
      : null;

  return (
    <div className="space-y-6">
      {/* Active Sessions */}
      <Card className="border-[var(--ag-cyan)]/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Active Sessions</CardTitle>
              <CardDescription className="text-[var(--ag-text-muted)]">
                Devices where you are currently signed in
              </CardDescription>
            </div>
            {sessions.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                className="border-[#FF6161]/40 text-[#FF6161] hover:bg-[#FF6161]/10"
                onClick={onRevokeAll}
              >
                <LogOut className="w-3 h-3 mr-1" />
                Revoke all
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {sessionsLoading ? (
            <div className="flex items-center gap-2 py-4 text-[var(--ag-text-muted)]">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading sessions...</span>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-6">
              <Monitor className="w-8 h-8 text-[var(--ag-cyan)]/30 mx-auto mb-2" />
              <p className="text-sm text-[var(--ag-text-muted)]">No active sessions found</p>
            </div>
          ) : (
            sessions.map((s) => {
              const isCurrent = currentSession?.id === s.id;
              return (
                <div
                  key={s.id}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    isCurrent
                      ? 'border-[var(--ag-cyan)]/50 ring-1 ring-[#A78BFA]/20'
                      : 'border-[var(--ag-cyan)]/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Monitor
                      className={`w-5 h-5 flex-shrink-0 ${
                        isCurrent ? 'text-[var(--ag-cyan)]' : 'text-[var(--ag-text-muted)]'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[var(--ag-text-primary)] truncate max-w-[200px]">
                          {s.user_agent.slice(0, 40) || 'Unknown browser'}
                        </span>
                        {isCurrent && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#A78BFA]/15 text-[var(--ag-cyan)] text-[10px] font-semibold uppercase tracking-wider flex-shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#A78BFA] animate-pulse" />
                            Current
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--ag-text-muted)]">
                        {s.ip || 'Unknown IP'} · Last seen{' '}
                        {new Date(s.last_seen).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  {!isCurrent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[#FF6161] hover:text-[#FF6161] hover:bg-[#FF6161]/10 flex-shrink-0"
                      onClick={() => handleRevokeSession(s.id)}
                    >
                      <LogOut className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              );
            })
          )}
          <p className="text-xs text-[var(--ag-text-muted)] pt-1">
            Note: Revoking a session marks it inactive in the database but existing tokens remain
            valid until they expire.
          </p>
        </CardContent>
      </Card>

      {/* Timezone */}
      <Card className="border-[var(--ag-cyan)]/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[var(--ag-cyan)]" />
            Timezone
          </CardTitle>
          <CardDescription className="text-[var(--ag-text-muted)]">Auto-detected from your browser</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--ag-cyan)]/20">
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-[var(--ag-cyan)]" />
              <div>
                <p className="text-sm font-medium text-[var(--ag-text-primary)]">{detectedTimezone}</p>
                <p className="text-xs text-[var(--ag-text-muted)]">
                  Current time:{' '}
                  {new Date().toLocaleTimeString('en-US', {
                    timeZone: detectedTimezone,
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="border-[#00FF88]/30 text-[#00FF88] text-xs">
              Auto-detected
            </Badge>
          </div>
          <p className="text-xs text-[var(--ag-text-muted)] mt-2">
            This timezone is used for reminders, daily briefings, and scheduling. It updates
            automatically based on your device settings.
          </p>
        </CardContent>
      </Card>

      {/* GDPR export */}
      <Card className="border-[var(--ag-cyan)]/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileDown className="w-4 h-4 text-[var(--ag-cyan)]" />
            Data Export (GDPR)
          </CardTitle>
          <CardDescription className="text-[var(--ag-text-muted)]">
            Download a copy of all your data stored in Agentin
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-[#A78BFA]/5 border border-[var(--ag-cyan)]/20">
            <Shield className="w-4 h-4 text-[var(--ag-cyan)] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[var(--ag-text-muted)]">
              Your export includes your profile, conversation history, memories, active sessions,
              and preferences. The file is downloaded directly to your device and is not stored on
              our servers.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleGDPRExport}
            disabled={isExportingGDPR}
            className="border-[var(--ag-cyan)]/30 text-[var(--ag-cyan)] hover:bg-[#A78BFA]/10"
            data-testid="gdpr-export-btn"
          >
            {isExportingGDPR ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Download All My Data
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
