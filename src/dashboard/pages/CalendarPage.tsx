// CalendarPage.tsx -- Phase 95
import { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  Link2,
  RefreshCw,
  Unlink,
  ExternalLink,
  Clock,
  CheckCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import api from "@/services/api";

interface CalendarStatus {
  available: boolean;
  connected: boolean;
  email: string | null;
  lastSync: number | null;
}

interface CalendarEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function formatDateHeading(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(d, today)) return "Today";
  if (sameDay(d, tomorrow)) return "Tomorrow";
  return d.toLocaleDateString("en-IN", { weekday: "long", month: "short", day: "numeric" });
}

function formatLastSync(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function groupEventsByDate(events: CalendarEvent[]): { heading: string; events: CalendarEvent[] }[] {
  const map = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    const key = ev.start_time.slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ev);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, evs]) => ({ heading: formatDateHeading(evs[0].start_time), events: evs }));
}

export function CalendarPage() {
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const statusRes = await api.get("/calendar/status");
      const statusData = statusRes.data as CalendarStatus;
      setStatus(statusData);
      setError(null);

      if (statusData.connected) {
        const eventsRes = await api.get("/calendar/events");
        const eventsData = eventsRes.data as { events: CalendarEvent[] };
        setEvents(eventsData.events ?? []);
      } else {
        setEvents([]);
      }
    } catch {
      setError("Failed to load calendar data. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleConnect = useCallback(async () => {
    try {
      const token = localStorage.getItem('gs_token');
      const res = await fetch('/api/calendar/auth', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      const data = await res.json();
      if (data?.url) window.location.href = data.url;
    } catch (err) {
      console.error('Calendar connect failed:', err);
    }
  }, []);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await api.post("/calendar/sync");
      await fetchData();
    } catch {
      setError("Sync failed. Please try again.");
    } finally {
      setSyncing(false);
    }
  }, [fetchData]);

  const handleDisconnect = useCallback(async () => {
    setDisconnecting(true);
    try {
      await api.post("/calendar/disconnect");
      await fetchData();
    } catch {
      setError("Disconnect failed. Please try again.");
    } finally {
      setDisconnecting(false);
    }
  }, [fetchData]);

  const spinCls = refreshing ? "animate-spin" : "";
  const groups = groupEventsByDate(events);

  return (
    <div className="p-4 md:p-6 space-y-6 pb-24 md:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Google Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View upcoming events and keep Weebo in sync with your schedule.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void fetchData(true)}
          disabled={refreshing}
          aria-label="Refresh"
          className="min-w-[44px] min-h-[44px] focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50"
        >
          <RefreshCw className={"h-4 w-4 " + spinCls} />
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Connection status card */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="h-12 rounded-lg bg-muted animate-pulse" />
          ) : status?.available === false ? (
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-amber-400/10 p-2">
                <Calendar className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="font-medium">Google Calendar Not Configured</p>
                <p className="text-xs text-muted-foreground">
                  Contact your administrator to enable Google Calendar integration.
                </p>
              </div>
            </div>
          ) : status?.connected ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-green-400/10 p-2">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="font-medium">Connected</p>
                  <p className="text-xs text-muted-foreground">
                    {status.email ?? "Google account linked"}
                    {status.lastSync ? (
                      <span className="ml-2">
                        &middot; Last synced {formatLastSync(status.lastSync)}
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleSync()}
                  disabled={syncing}
                  className="gap-1.5 min-h-[44px] focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50"
                >
                  <RefreshCw className={"h-3.5 w-3.5" + (syncing ? " animate-spin" : "")} />
                  {syncing ? "Syncing..." : "Sync Now"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleDisconnect()}
                  disabled={disconnecting}
                  className="gap-1.5 text-red-400 hover:text-red-300 border-red-500/30 hover:border-red-500/50 min-h-[44px] focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50"
                >
                  <Unlink className="h-3.5 w-3.5" />
                  {disconnecting ? "Disconnecting..." : "Disconnect"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-muted p-2">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">Not Connected</p>
                  <p className="text-xs text-muted-foreground">
                    Connect your Google account to see upcoming events.
                  </p>
                </div>
              </div>
              <Button size="sm" onClick={handleConnect} className="gap-1.5 shrink-0 min-h-[44px] focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50">
                <Link2 className="h-3.5 w-3.5" />
                Connect Google Calendar
                <ExternalLink className="h-3 w-3 opacity-60" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming events */}
      {status?.connected && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-cyan-400" />
              Upcoming Events
              {events.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {events.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : groups.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Calendar className="mx-auto h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">No upcoming events found.</p>
                <p className="text-xs mt-1">
                  Try syncing to pull the latest events from your calendar.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {groups.map((group) => (
                  <div key={group.heading}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      {group.heading}
                    </p>
                    <div className="space-y-2">
                      {group.events.map((ev) => (
                        <div
                          key={ev.id}
                          className="rounded-lg border bg-muted/30 p-3 flex items-start gap-3"
                        >
                          <div className="rounded-full bg-cyan-400/10 p-1.5 mt-0.5 shrink-0">
                            <Calendar className="h-3.5 w-3.5 text-cyan-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium leading-snug truncate">
                              {ev.title}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatTime(ev.start_time)}
                              {ev.end_time ? " \u2013 " + formatTime(ev.end_time) : ""}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* How it works -- shown when not connected */}
      {!loading && !status?.connected && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4 text-purple-400" />
              How It Works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-4 w-4 mt-0.5 text-cyan-400 shrink-0" />
              <div>
                <p className="text-sm font-medium">Connect your Google account</p>
                <p className="text-xs text-muted-foreground">
                  Click "Connect Google Calendar" above to authorise read-only access via OAuth.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-4 w-4 mt-0.5 text-cyan-400 shrink-0" />
              <div>
                <p className="text-sm font-medium">Events are pulled automatically</p>
                <p className="text-xs text-muted-foreground">
                  Weebo syncs your upcoming events so they appear in your dashboard.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-4 w-4 mt-0.5 text-cyan-400 shrink-0" />
              <div>
                <p className="text-sm font-medium">Context-aware responses</p>
                <p className="text-xs text-muted-foreground">
                  Weebo uses your calendar context to give smarter briefings and reminders.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-4 w-4 mt-0.5 text-cyan-400 shrink-0" />
              <div>
                <p className="text-sm font-medium">You stay in control</p>
                <p className="text-xs text-muted-foreground">
                  Disconnect at any time. Only read access is requested -- Weebo never modifies your calendar.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
