// ProactivePage.tsx -- Phase 90
import { useState, useEffect, useCallback } from "react";
import { Bell, BellOff, Clock, MessageSquare, RefreshCw, Sunrise, AlertTriangle, Moon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/services/api";

interface ProactiveMessage {
  id: number;
  type: string;
  sent_at: number;
  message: string;
}

interface ProactiveSettings {
  enabled: boolean;
}

const TYPE_LABEL: Record<string, string> = {};
TYPE_LABEL["daily_briefing"] = "Daily Briefing";
TYPE_LABEL["overdue_alert"] = "Overdue Alert";
TYPE_LABEL["idle_check_in"] = "Idle Check-in";

const TYPE_COLOR: Record<string, string> = {};
TYPE_COLOR["daily_briefing"] = "text-cyan-400";
TYPE_COLOR["overdue_alert"] = "text-amber-400";
TYPE_COLOR["idle_check_in"] = "text-purple-400";

function getMsgIcon(type: string): typeof Bell {
  if (type === "overdue_alert") return AlertTriangle;
  if (type === "idle_check_in") return Moon;
  return Sunrise;
}

function formatDate(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function ProactivePage() {
  const [messages, setMessages] = useState([] as ProactiveMessage[]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null as string | null);

  const fetchData = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const [logRes, settingsRes] = await Promise.all([
        api.get("/proactive/log"),
        api.get("/proactive/settings"),
      ]);
      const logData = logRes.data as { log: ProactiveMessage[] };
      const settingsData = settingsRes.data as ProactiveSettings;
      setMessages(logData.log ?? []);
      setEnabled(settingsData.enabled ?? true);
      setError(null);
    } catch {
      setError("Failed to load proactive data. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleToggle = useCallback(async () => {
    setToggling(true);
    try {
      const res = await api.patch("/proactive/toggle", { enabled: !enabled });
      const data = res.data as ProactiveSettings;
      setEnabled(data.enabled);
    } catch {
      setError("Failed to update setting. Please try again.");
    } finally {
      setToggling(false);
    }
  }, [enabled]);

  const toggleBg = enabled ? "bg-cyan-400" : "bg-gray-600";
  const knobPos = enabled ? "translate-x-5" : "translate-x-0";
  const spinCls = refreshing ? "animate-spin" : "";

  return (
    <div className="p-4 md:p-6 space-y-6 pb-24 md:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Proactive AI</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Weebo sends morning briefings, overdue alerts, and idle check-ins.
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => void fetchData(true)} disabled={refreshing} aria-label="Refresh">
          <RefreshCw className={"h-4 w-4 " + spinCls} />
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-cyan-400/10 p-2">
                {enabled ? <Bell className="h-5 w-5 text-cyan-400" /> : <BellOff className="h-5 w-5 text-muted-foreground" />}
              </div>
              <div>
                <p className="font-medium">Proactive Messages</p>
                <p className="text-xs text-muted-foreground">
                  {enabled ? "Weebo will send scheduled messages via Telegram." : "Proactive messages are paused."}
                </p>
              </div>
            </div>
            <button onClick={handleToggle} disabled={toggling || loading}
              aria-label={enabled ? "Disable proactive messages" : "Enable proactive messages"}
              className={"relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 " + toggleBg}
            >
              <span className={"pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out " + knobPos} />
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-purple-400" />
            Message Schedule (IST)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <Sunrise className="h-4 w-4 mt-0.5 text-cyan-400 shrink-0" />
            <div>
              <p className="text-sm font-medium">8:00 AM -- Daily Briefing</p>
              <p className="text-xs text-muted-foreground">Summary of your reminders and pending tasks.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-medium">10:00 AM -- Overdue Alert</p>
              <p className="text-xs text-muted-foreground">Sent only if you have overdue reminders needing attention.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Moon className="h-4 w-4 mt-0.5 text-purple-400 shrink-0" />
            <div>
              <p className="text-sm font-medium">8:00 AM -- Idle Check-in</p>
              <p className="text-xs text-muted-foreground">Sent only if you have been inactive for 3 or more days.</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            Messages are delivered via Telegram. Connect Telegram in Connections to receive them.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-cyan-400" />
            Recent Messages
            {messages.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">{messages.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <MessageSquare className="mx-auto h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">No proactive messages sent yet.</p>
              <p className="text-xs mt-1">
                {enabled ? "Messages will appear here once Weebo starts sending them." : "Enable proactive messages above to get started."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => {
                const label = TYPE_LABEL[msg.type] ?? "Message";
                const color = TYPE_COLOR[msg.type] ?? "text-muted-foreground";
                const MsgIcon = getMsgIcon(msg.type);
                return (
                  <div key={msg.id} className="rounded-lg border bg-muted/30 p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <MsgIcon className={"h-3.5 w-3.5 " + color} />
                        <span className={"text-xs font-medium " + color}>{label}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDate(msg.sent_at)}</span>
                    </div>
                    <p className="text-sm leading-relaxed">{msg.message}</p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
