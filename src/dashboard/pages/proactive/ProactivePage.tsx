// ProactivePage.tsx — Jarvis-owned Proactive AI dashboard
// State, data-fetching, and settings persistence live here.
// UI is delegated to src/dashboard/pages/proactive/ sub-components.
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Bell, BellOff, RefreshCw, Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import api from "@/services/api";
import { PageShell, PageHeader, SectionCard, DashboardPageWrapper } from "@/components/agentin";
import { BlurFade } from "@/components/magicui/blur-fade";
import { useAgentCanvas } from "@/hooks/use-agent-canvas";
import { MessageList } from "./MessageList";
import { SettingsPanel } from "./SettingsPanel";
import {
  loadLocal,
  saveLocal,
  categorize,
  type ProactiveMessage,
  type ProactiveSettings,
  type FeedbackRecord,
  type MessageCategory,
  type AutonomyLevel,
  type QuietHours,
  type TypeToggles,
  type PlannedMessage,
} from "./helpers";

export function ProactivePage() {
  const { notifyDone, notifyFail } = useAgentCanvas({ agent: "jarvis", page: "proactive" });

  // ---- State --------------------------------------------------------------

  const [messages, setMessages] = useState<ProactiveMessage[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);

  // Client-side + server-persisted settings
  const [quietHours, setQuietHours] = useState<QuietHours>({ start: "22:00", end: "07:00" });
  const [autonomyLevel, setAutonomyLevel] = useState<AutonomyLevel>("proactive");
  const [typeToggles, setTypeToggles] = useState<TypeToggles>(() =>
    loadLocal("type_toggles", { reminders: true, insights: true, suggestions: true, celebrations: true })
  );
  const [feedbackMap, setFeedbackMap] = useState<Map<number, boolean>>(() => {
    const stored = loadLocal<FeedbackRecord[]>("feedback", []);
    return new Map(stored.map(r => [r.messageId, r.helpful]));
  });

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Data fetching ------------------------------------------------------

  const fetchData = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const [logRes, settingsRes] = await Promise.all([
        api.get("/proactive/log"),
        api.get("/proactive/settings"),
      ]);
      const logData = logRes.data as { log: ProactiveMessage[] };
      const settingsData = settingsRes.data as ProactiveSettings & {
        autonomy_level?: AutonomyLevel;
        quiet_start?: string;
        quiet_end?: string;
      };
      setMessages(logData.log ?? []);
      setEnabled(settingsData.enabled ?? true);
      if (settingsData.autonomy_level) setAutonomyLevel(settingsData.autonomy_level);
      if (settingsData.quiet_start || settingsData.quiet_end) {
        setQuietHours({
          start: settingsData.quiet_start ?? "22:00",
          end: settingsData.quiet_end ?? "07:00",
        });
      }
      setError(null);
    } catch {
      setError("Failed to load proactive data. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  // ---- Handlers -----------------------------------------------------------

  const handleToggle = useCallback(async () => {
    setToggling(true);
    try {
      const res = await api.patch("/proactive/toggle", { enabled: !enabled });
      const data = res.data as ProactiveSettings;
      setEnabled(data.enabled);
      void notifyDone(data.enabled ? "Proactive messages enabled" : "Proactive messages disabled");
    } catch {
      setError("Failed to update setting. Please try again.");
      void notifyFail("Toggle proactive messages failed");
    } finally {
      setToggling(false);
    }
  }, [enabled, notifyDone, notifyFail]);

  const handleFeedback = useCallback((messageId: number, helpful: boolean) => {
    setFeedbackMap(prev => {
      const next = new Map(prev);
      if (next.get(messageId) === helpful) {
        next.delete(messageId);
      } else {
        next.set(messageId, helpful);
      }
      const records: FeedbackRecord[] = Array.from(next.entries()).map(([id, h]) => ({
        messageId: id,
        helpful: h,
      }));
      saveLocal("feedback", records);
      return next;
    });
  }, []);

  const debouncedSaveSettings = useCallback((payload: Record<string, string>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      api.patch("/proactive/settings", payload).catch(() => { /* non-fatal */ });
    }, 1000);
  }, []);

  const handleQuietHoursChange = useCallback((field: "start" | "end", value: string) => {
    setQuietHours(prev => {
      const next = { ...prev, [field]: value };
      debouncedSaveSettings(field === "start" ? { quiet_start: value } : { quiet_end: value });
      return next;
    });
  }, [debouncedSaveSettings]);

  const handleAutonomyChange = useCallback((level: AutonomyLevel) => {
    setAutonomyLevel(level);
    debouncedSaveSettings({ autonomy_level: level });
  }, [debouncedSaveSettings]);

  const handleTypeToggle = useCallback((key: keyof TypeToggles) => {
    setTypeToggles(prev => {
      const next = { ...prev, [key]: !prev[key] };
      saveLocal("type_toggles", next);
      return next;
    });
  }, []);

  // ---- Derived state ------------------------------------------------------

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => b.sent_at - a.sent_at),
    [messages]
  );

  const plannedMessages = useMemo((): PlannedMessage[] => {
    const plans: PlannedMessage[] = [];
    if (!enabled || autonomyLevel === "manual") return plans;
    if (typeToggles.reminders) {
      plans.push({ time: "8:00 AM", label: "Morning briefing — tasks, habits, calendar", type: "upcoming" });
      plans.push({ time: "10:00 AM", label: "Overdue reminder check", type: "urgent" });
    }
    if (typeToggles.suggestions && autonomyLevel !== "assisted") {
      plans.push({ time: "11:00 AM", label: "Habit nudge (if needed)", type: "suggestions" });
    }
    if (typeToggles.insights && new Date().getDay() === 0) {
      plans.push({ time: "7:00 PM", label: "Weekly report and expense digest", type: "insights" });
    }
    if (typeToggles.celebrations && autonomyLevel !== "assisted") {
      plans.push({ time: "Anytime", label: "Streak milestones (event-driven)", type: "celebrations" });
    }
    return plans;
  }, [enabled, typeToggles, autonomyLevel]);

  const categoryStats = useMemo(() => {
    const counts: Record<MessageCategory, number> = {
      urgent: 0, upcoming: 0, insights: 0, suggestions: 0, celebrations: 0,
    };
    for (const msg of messages) counts[categorize(msg.type)]++;
    return counts;
  }, [messages]);

  // ---- Render -------------------------------------------------------------

  return (
    <DashboardPageWrapper>
      <PageShell maxWidth="7xl">
        {/* Page header */}
        <PageHeader
          icon={Bell}
          title="Proactive AI"
          subtitle="Jarvis reaches out with briefings, alerts, insights, and celebrations."
          badge={
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-[var(--ag-jarvis)]/10 border border-[var(--ag-jarvis)]/30 text-[var(--ag-jarvis)]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--ag-jarvis)] opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--ag-jarvis)]" />
              </span>
              Jarvis
            </span>
          }
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowConfig(!showConfig)}
                className="lg:hidden min-w-[44px] min-h-[44px] transition-[transform,background-color] active:scale-[0.96]"
                aria-label="Toggle settings"
              >
                <Settings2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => void fetchData(true)}
                disabled={refreshing}
                aria-label="Refresh"
                className="min-w-[44px] min-h-[44px] transition-[transform,background-color] active:scale-[0.96]"
              >
                <RefreshCw className={"h-4 w-4 " + (refreshing ? "animate-spin" : "")} />
              </Button>
            </div>
          }
        />

        <div className="flex flex-col lg:flex-row gap-6">
          {/* ===== Main feed column ===== */}
          <div className="flex-1 min-w-0 space-y-6">

            {/* Error banner */}
            {error && (
              <BlurFade delay={0.1}>
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400 flex items-center justify-between">
                  <span>{error}</span>
                  <button
                    onClick={() => setError(null)}
                    className="ml-2 p-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
                    aria-label="Dismiss error"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </BlurFade>
            )}

            {/* Global enable/disable toggle */}
            <BlurFade delay={0.2}>
              <SectionCard>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={"rounded-xl p-2.5 transition-colors " + (enabled ? "bg-[var(--ag-jarvis)]/10" : "bg-white/[0.05]")}>
                      {enabled
                        ? <Bell className="h-5 w-5 text-[var(--ag-jarvis)]" />
                        : <BellOff className="h-5 w-5 text-[var(--ag-text-secondary)]" />
                      }
                    </div>
                    <div>
                      <p className="font-heading font-medium text-[var(--ag-text-primary)]">Proactive Messages</p>
                      <p className="text-xs text-[var(--ag-text-secondary)]">
                        {enabled
                          ? "Jarvis will send scheduled messages via Telegram."
                          : "Proactive messages are paused."}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => void handleToggle()}
                    disabled={toggling || loading}
                    aria-label={enabled ? "Disable proactive messages" : "Enable proactive messages"}
                    className={
                      "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent " +
                      "transition-[background-color,transform] duration-200 focus:outline-none " +
                      "focus-visible:ring-2 focus-visible:ring-[var(--ag-jarvis)]/50 " +
                      "disabled:opacity-50 active:scale-[0.96] min-w-[44px] min-h-[44px] items-center " +
                      (enabled ? "bg-[var(--ag-jarvis)]" : "bg-gray-600")
                    }
                  >
                    <span
                      className={
                        "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow " +
                        "transition duration-200 ease-in-out " +
                        (enabled ? "translate-x-5" : "translate-x-0")
                      }
                    />
                  </button>
                </div>
              </SectionCard>
            </BlurFade>

            {/* Message list — stats + helpfulness + today's plan + feed */}
            <MessageList
              messages={messages}
              sortedMessages={sortedMessages}
              categoryStats={categoryStats}
              feedbackMap={feedbackMap}
              onFeedback={handleFeedback}
              loading={loading}
              enabled={enabled}
              plannedMessages={plannedMessages}
            />
          </div>

          {/* ===== Config sidebar (desktop: always visible, mobile: slide-in) ===== */}
          <BlurFade delay={0.8}>
            <SettingsPanel
              show={showConfig}
              onClose={() => setShowConfig(false)}
              enabled={enabled}
              quietHours={quietHours}
              autonomyLevel={autonomyLevel}
              typeToggles={typeToggles}
              onQuietHoursChange={handleQuietHoursChange}
              onAutonomyChange={handleAutonomyChange}
              onTypeToggle={handleTypeToggle}
            />
          </BlurFade>
        </div>
      </PageShell>
    </DashboardPageWrapper>
  );
}
