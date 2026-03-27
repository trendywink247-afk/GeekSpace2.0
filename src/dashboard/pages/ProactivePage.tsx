// ProactivePage.tsx -- Overhauled Proactive AI dashboard
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Bell,
  BellOff,
  Clock,
  MessageSquare,
  RefreshCw,
  Sunrise,
  AlertTriangle,
  Moon,
  ThumbsUp,
  ThumbsDown,
  Settings2,
  X,
  Sparkles,
  TrendingUp,
  Lightbulb,
  Trophy,
  CalendarClock,
  Shield,
  Zap,
  Gauge,
  ChevronRight,
  Bot,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import api from "@/services/api";
import { PageShell } from "@/components/agentin";

// ---- Types ---------------------------------------------------------------

interface ProactiveMessage {
  id: number;
  type: string;
  sent_at: number;
  message: string;
}

interface ProactiveSettings {
  enabled: boolean;
}

interface FeedbackRecord {
  messageId: number;
  helpful: boolean;
}

type MessageCategory = "urgent" | "upcoming" | "insights" | "suggestions" | "celebrations";

type AutonomyLevel = "manual" | "assisted" | "proactive" | "autonomous";

interface QuietHours {
  start: string; // "22:00"
  end: string;   // "07:00"
}

interface TypeToggles {
  reminders: boolean;
  insights: boolean;
  suggestions: boolean;
  celebrations: boolean;
}

interface PlannedMessage {
  time: string;
  label: string;
  type: MessageCategory;
}

// ---- Constants -----------------------------------------------------------

const CATEGORY_CONFIG: Record<MessageCategory, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: typeof Bell;
}> = {
  urgent: {
    label: "Urgent",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/20",
    icon: AlertTriangle,
  },
  upcoming: {
    label: "Upcoming",
    color: "text-violet-400",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/20",
    icon: CalendarClock,
  },
  insights: {
    label: "Insights",
    color: "text-green-400",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/20",
    icon: TrendingUp,
  },
  suggestions: {
    label: "Suggestions",
    color: "text-violet-400",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/20",
    icon: Lightbulb,
  },
  celebrations: {
    label: "Celebrations",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
    icon: Trophy,
  },
};

// Map backend types to display categories
function categorize(type: string): MessageCategory {
  if (type === "overdue_alert" || type === "expense_spike") return "urgent";
  if (type === "daily_briefing") return "upcoming";
  if (type === "weekly_report") return "insights";
  if (type === "idle_check_in") return "suggestions";
  if (type === "streak_milestone") return "celebrations";
  // Fallback heuristics
  if (type.includes("alert") || type.includes("overdue")) return "urgent";
  if (type.includes("streak") || type.includes("milestone") || type.includes("celebrate")) return "celebrations";
  if (type.includes("insight") || type.includes("report") || type.includes("digest")) return "insights";
  if (type.includes("suggest") || type.includes("nudge") || type.includes("check")) return "suggestions";
  return "upcoming";
}

const BACKEND_TYPE_LABEL: Record<string, string> = {
  daily_briefing: "Daily Briefing",
  overdue_alert: "Overdue Alert",
  idle_check_in: "Idle Check-in",
  weekly_report: "Weekly Report",
  streak_milestone: "Streak Milestone",
  expense_spike: "Expense Spike",
};

function formatDate(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString(navigator.language, { dateStyle: "medium", timeStyle: "short" });
}

function formatRelativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(ms);
}

// Persistence helpers for client-side settings (quiet hours, frequency, type toggles, feedback)
const STORAGE_PREFIX = "proactive_";

function loadLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (raw) return JSON.parse(raw) as T;
  } catch { /* ignore */ }
  return fallback;
}

function saveLocal<T>(key: string, value: T): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch { /* ignore */ }
}

// ---- Subcomponents -------------------------------------------------------

function MessageCard({
  msg,
  feedback,
  onFeedback,
}: {
  msg: ProactiveMessage;
  feedback: boolean | null;
  onFeedback: (messageId: number, helpful: boolean) => void;
}) {
  const category = categorize(msg.type);
  const config = CATEGORY_CONFIG[category];
  const CategoryIcon = config.icon;
  const backendLabel = BACKEND_TYPE_LABEL[msg.type] ?? msg.type.replace(/_/g, " ");

  return (
    <div
      className={
        "rounded-xl border p-4 space-y-3 transition-colors hover:bg-white/[0.02] " +
        config.borderColor
      }
      style={{
        background: "linear-gradient(135deg, rgba(12, 12, 24, 0.6), rgba(16, 16, 30, 0.4))",
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className={"rounded-lg p-1.5 " + config.bgColor}>
            <CategoryIcon className={"h-3.5 w-3.5 " + config.color} />
          </div>
          <Badge
            className={
              config.bgColor + " " + config.color +
              " border-0 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5"
            }
          >
            {config.label}
          </Badge>
          <span className="text-[10px] text-muted-foreground hidden sm:inline">
            {backendLabel}
          </span>
        </div>
        <span className="text-xs text-muted-foreground" title={formatDate(msg.sent_at)}>
          {formatRelativeTime(msg.sent_at)}
        </span>
      </div>

      {/* Message body */}
      <p className="text-sm leading-relaxed text-[#F4F6FF]/90">{msg.message}</p>

      {/* Feedback row */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => onFeedback(msg.id, true)}
          className={
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all min-w-[44px] min-h-[44px] " +
            "focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50 " +
            (feedback === true
              ? "bg-green-500/20 text-green-400 border border-green-500/30"
              : "bg-white/[0.03] text-muted-foreground hover:bg-green-500/10 hover:text-green-400 border border-transparent")
          }
          aria-label="Mark as helpful"
        >
          <ThumbsUp className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Helpful</span>
        </button>
        <button
          onClick={() => onFeedback(msg.id, false)}
          className={
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all min-w-[44px] min-h-[44px] " +
            "focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50 " +
            (feedback === false
              ? "bg-red-500/20 text-red-400 border border-red-500/30"
              : "bg-white/[0.03] text-muted-foreground hover:bg-red-500/10 hover:text-red-400 border border-transparent")
          }
          aria-label="Mark as not helpful"
        >
          <ThumbsDown className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Not helpful</span>
        </button>
      </div>
    </div>
  );
}

function FrequencyCard({
  level,
  label,
  description,
  icon: Icon,
  selected,
  onSelect,
}: {
  level: AutonomyLevel;
  label: string;
  description: string;
  icon: typeof Shield;
  selected: boolean;
  onSelect: (level: AutonomyLevel) => void;
}) {
  return (
    <button
      onClick={() => onSelect(level)}
      className={
        "w-full text-left rounded-xl border p-3 transition-all min-h-[44px] " +
        "focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50 " +
        (selected
          ? "border-[#00F0FF]/40 bg-[#00F0FF]/5"
          : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]")
      }
    >
      <div className="flex items-start gap-3">
        <div className={
          "rounded-lg p-2 shrink-0 " +
          (selected ? "bg-[#00F0FF]/10 text-[#00F0FF]" : "bg-white/[0.05] text-muted-foreground")
        }>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={"text-sm font-medium " + (selected ? "text-[#00F0FF]" : "text-[#F4F6FF]")}>
              {label}
            </p>
            {selected && (
              <div className="h-2 w-2 rounded-full bg-[#00F0FF] shrink-0" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
    </button>
  );
}

function TypeToggleRow({
  label,
  icon: Icon,
  color,
  enabled,
  onToggle,
}: {
  label: string;
  icon: typeof Bell;
  color: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex items-center gap-3">
        <Icon className={"h-4 w-4 shrink-0 " + color} />
        <span className="text-sm">{label}</span>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={onToggle}
        className="data-[state=checked]:bg-[#00F0FF] min-w-[44px] min-h-[44px] flex items-center"
      />
    </div>
  );
}

function PlannedMessageRow({ planned }: { planned: PlannedMessage }) {
  const config = CATEGORY_CONFIG[planned.type];
  const PlanIcon = config.icon;
  return (
    <div className="flex items-center gap-3 py-2">
      <div className={"rounded-lg p-1.5 shrink-0 " + config.bgColor}>
        <PlanIcon className={"h-3.5 w-3.5 " + config.color} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{planned.label}</p>
      </div>
      <span className="text-xs text-muted-foreground font-mono shrink-0">{planned.time}</span>
    </div>
  );
}

function HelpfulnessBar({ feedbackMap }: { feedbackMap: Map<number, boolean> }) {
  const entries = Array.from(feedbackMap.values());
  if (entries.length === 0) return null;
  const positive = entries.filter(Boolean).length;
  const pct = Math.round((positive / entries.length) * 100);
  const barColor = pct >= 75 ? "bg-green-400" : pct >= 50 ? "bg-amber-400" : "bg-red-400";
  const textColor = pct >= 75 ? "text-green-400" : pct >= 50 ? "text-amber-400" : "text-red-400";

  return (
    <div className="rounded-xl border border-white/[0.06] p-4" style={{
      background: "linear-gradient(135deg, rgba(12, 12, 24, 0.6), rgba(16, 16, 30, 0.4))",
    }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#00F0FF]" />
          <span className="text-sm font-medium">Weebo's helpfulness</span>
        </div>
        <span className={"text-sm font-semibold " + textColor}>{pct}% positive</span>
      </div>
      <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className={"h-full rounded-full transition-all duration-500 " + barColor}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground mt-1.5">
        Based on {entries.length} {entries.length === 1 ? "rating" : "ratings"}
      </p>
    </div>
  );
}

// ---- Main Component ------------------------------------------------------

export function ProactivePage() {
  const [messages, setMessages] = useState<ProactiveMessage[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);

  // Settings: server-persisted (quiet hours, autonomy) + client-side (type toggles, feedback)
  const [quietHours, setQuietHours] = useState<QuietHours>({ start: "22:00", end: "07:00" });
  const [autonomyLevel, setAutonomyLevel] = useState<AutonomyLevel>("proactive");
  const [typeToggles, setTypeToggles] = useState<TypeToggles>(() =>
    loadLocal("type_toggles", { reminders: true, insights: true, suggestions: true, celebrations: true })
  );
  const [feedbackMap, setFeedbackMap] = useState<Map<number, boolean>>(() => {
    const stored = loadLocal<FeedbackRecord[]>("feedback", []);
    return new Map(stored.map(r => [r.messageId, r.helpful]));
  });

  // Debounce timer ref for saving settings to server
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Data fetching ---

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

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // ---- Handlers ---

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

  const handleFeedback = useCallback((messageId: number, helpful: boolean) => {
    setFeedbackMap(prev => {
      const next = new Map(prev);
      // Toggle off if clicking same value
      if (next.get(messageId) === helpful) {
        next.delete(messageId);
      } else {
        next.set(messageId, helpful);
      }
      // Persist
      const records: FeedbackRecord[] = Array.from(next.entries()).map(([id, h]) => ({
        messageId: id,
        helpful: h,
      }));
      saveLocal("feedback", records);
      return next;
    });
  }, []);

  // Debounced save to server for proactive settings
  const debouncedSaveSettings = useCallback((payload: Record<string, string>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      api.patch("/proactive/settings", payload).catch(() => {
        // Non-fatal: settings will be re-sent on next change
      });
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

  // ---- Derived state ---

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => b.sent_at - a.sent_at),
    [messages]
  );

  const plannedMessages = useMemo((): PlannedMessage[] => {
    // Build a realistic "today's plan" based on current settings
    const plans: PlannedMessage[] = [];
    if (!enabled || autonomyLevel === "manual") return plans;
    if (typeToggles.reminders) {
      plans.push({ time: "8:00 AM", label: "Morning briefing -- tasks, habits, calendar", type: "upcoming" });
      plans.push({ time: "10:00 AM", label: "Overdue reminder check", type: "urgent" });
    }
    if (typeToggles.suggestions && autonomyLevel !== "assisted") {
      plans.push({ time: "11:00 AM", label: "Habit nudge (if needed)", type: "suggestions" });
    }
    if (typeToggles.insights) {
      const today = new Date();
      if (today.getDay() === 0) {
        plans.push({ time: "7:00 PM", label: "Weekly report and expense digest", type: "insights" });
      }
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
    for (const msg of messages) {
      const cat = categorize(msg.type);
      counts[cat]++;
    }
    return counts;
  }, [messages]);

  const spinCls = refreshing ? "animate-spin" : "";

  // ---- Render ---

  return (
    <PageShell>
    <div className="pb-24 md:pb-6 overflow-x-hidden">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* ===== Main Feed Column ===== */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Page header */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1
                className="text-2xl md:text-3xl font-bold"
                style={{ fontFamily: "Syne, sans-serif" }}
              >
                Proactive AI <span className="text-[10px] text-[#4B5563] font-medium ml-1.5">🤖 Your agents at work</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Weebo reaches out with briefings, alerts, insights, and celebrations.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Mobile config toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowConfig(!showConfig)}
                className="lg:hidden min-w-[44px] min-h-[44px]"
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
                className="min-w-[44px] min-h-[44px]"
              >
                <RefreshCw className={"h-4 w-4 " + spinCls} />
              </Button>
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400 flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="ml-2 p-1" aria-label="Dismiss error">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Global toggle card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={
                    "rounded-xl p-2.5 transition-colors " +
                    (enabled ? "bg-[#00F0FF]/10" : "bg-white/[0.05]")
                  }>
                    {enabled
                      ? <Bell className="h-5 w-5 text-[#00F0FF]" />
                      : <BellOff className="h-5 w-5 text-muted-foreground" />
                    }
                  </div>
                  <div>
                    <p className="font-medium">Proactive Messages</p>
                    <p className="text-xs text-muted-foreground">
                      {enabled
                        ? "Weebo will send scheduled messages via Telegram."
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
                    "transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50 " +
                    "disabled:opacity-50 min-w-[44px] min-h-[44px] items-center " +
                    (enabled ? "bg-[#00F0FF]" : "bg-gray-600")
                  }
                >
                  <span
                    className={
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out " +
                      (enabled ? "translate-x-5" : "translate-x-0")
                    }
                  />
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Category stat badges */}
          {!loading && messages.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {(Object.keys(CATEGORY_CONFIG) as MessageCategory[]).map(cat => {
                const cfg = CATEGORY_CONFIG[cat];
                const count = categoryStats[cat];
                if (count === 0) return null;
                const CatIcon = cfg.icon;
                return (
                  <div
                    key={cat}
                    className={
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium " +
                      cfg.bgColor + " " + cfg.borderColor + " " + cfg.color
                    }
                  >
                    <CatIcon className="h-3 w-3" />
                    <span>{count}</span>
                    <span className="hidden sm:inline">{cfg.label}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Helpfulness bar */}
          {feedbackMap.size > 0 && <HelpfulnessBar feedbackMap={feedbackMap} />}

          {/* Today's preview */}
          {enabled && plannedMessages.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-[#00F0FF]" />
                  Today's Plan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">
                  Here's what Weebo plans to send today
                </p>
                <div className="divide-y divide-white/[0.06]">
                  {plannedMessages.map((p, i) => (
                    <PlannedMessageRow key={i} planned={p} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Message feed */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="h-4 w-4 text-[#00F0FF]" />
              <h2 className="text-base font-semibold">Message Feed</h2>
              {messages.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">{messages.length}</Badge>
              )}
            </div>

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-28 rounded-xl bg-muted/30 animate-pulse" />
                ))}
              </div>
            ) : sortedMessages.length === 0 ? (
              <EmptyState enabled={enabled} />
            ) : (
              <div className="space-y-3">
                {sortedMessages.map(msg => (
                  <MessageCard
                    key={msg.id}
                    msg={msg}
                    feedback={feedbackMap.get(msg.id) ?? null}
                    onFeedback={handleFeedback}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ===== Config Sidebar (desktop: always visible, mobile: toggle) ===== */}
        <ConfigPanel
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
      </div>
    </div>
    </PageShell>
  );
}

// ---- Empty State ---------------------------------------------------------

function EmptyState({ enabled }: { enabled: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-2xl bg-[#00F0FF]/5 p-6 mb-6">
        <Bot className="h-12 w-12 text-[#00F0FF]/40" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No proactive messages yet</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        {enabled
          ? "Weebo will start reaching out as you use the app more. Expect morning briefings, overdue alerts, and streak celebrations."
          : "Enable proactive messages above to let Weebo send you helpful updates throughout the day."}
      </p>
      {enabled && (
        <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>First message usually arrives with your morning briefing</span>
        </div>
      )}
    </div>
  );
}

// ---- Config Panel --------------------------------------------------------

function ConfigPanel({
  show,
  onClose,
  enabled,
  quietHours,
  autonomyLevel,
  typeToggles,
  onQuietHoursChange,
  onAutonomyChange,
  onTypeToggle,
}: {
  show: boolean;
  onClose: () => void;
  enabled: boolean;
  quietHours: QuietHours;
  autonomyLevel: AutonomyLevel;
  typeToggles: TypeToggles;
  onQuietHoursChange: (field: "start" | "end", value: string) => void;
  onAutonomyChange: (level: AutonomyLevel) => void;
  onTypeToggle: (key: keyof TypeToggles) => void;
}) {
  return (
    <>
      {/* Mobile overlay */}
      {show && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={
          // Mobile: slide-in from right
          "fixed top-0 right-0 bottom-0 z-50 w-[320px] max-w-[85vw] overflow-y-auto " +
          "bg-[var(--ag-bg-surface)] border-l border-[var(--ag-border-subtle)] transition-transform duration-300 ease-in-out " +
          "lg:static lg:z-auto lg:w-[340px] lg:shrink-0 lg:border-l-0 lg:border-0 lg:bg-transparent " +
          "lg:translate-x-0 lg:transition-none " +
          (show ? "translate-x-0" : "translate-x-full lg:translate-x-0")
        }
      >
        <div className="p-4 space-y-5 lg:space-y-6">
          {/* Mobile close header */}
          <div className="flex items-center justify-between lg:hidden">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-[#00F0FF]" />
              Configuration
            </h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="min-w-[44px] min-h-[44px]">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Desktop heading */}
          <h2 className="text-base font-semibold items-center gap-2 hidden lg:flex">
            <Settings2 className="h-4 w-4 text-[#00F0FF]" />
            Configuration
          </h2>

          {/* Quiet hours */}
          <Card>
            <CardContent className="pt-5 pb-5 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Moon className="h-4 w-4 text-purple-400" />
                <p className="text-sm font-medium">Quiet Hours</p>
              </div>
              <p className="text-xs text-muted-foreground">
                No messages during these hours
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">
                    Start
                  </label>
                  <input
                    type="time"
                    value={quietHours.start}
                    onChange={e => onQuietHoursChange("start", e.target.value)}
                    disabled={!enabled}
                    className={
                      "w-full rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-sm " +
                      "focus:outline-none focus:ring-2 focus:ring-[#00F0FF]/50 " +
                      "disabled:opacity-40 min-h-[44px] " +
                      "[color-scheme:dark]"
                    }
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">
                    End
                  </label>
                  <input
                    type="time"
                    value={quietHours.end}
                    onChange={e => onQuietHoursChange("end", e.target.value)}
                    disabled={!enabled}
                    className={
                      "w-full rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-sm " +
                      "focus:outline-none focus:ring-2 focus:ring-[#00F0FF]/50 " +
                      "disabled:opacity-40 min-h-[44px] " +
                      "[color-scheme:dark]"
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Autonomy Level */}
          <Card>
            <CardContent className="pt-5 pb-5 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Gauge className="h-4 w-4 text-[#00F0FF]" />
                <p className="text-sm font-medium">Autonomy Level</p>
              </div>
              <div className="space-y-2">
                <FrequencyCard
                  level="manual"
                  label="Manual"
                  description="No proactive messages, you control everything"
                  icon={Shield}
                  selected={autonomyLevel === "manual"}
                  onSelect={onAutonomyChange}
                />
                <FrequencyCard
                  level="assisted"
                  label="Assisted"
                  description="Only critical alerts and morning briefing"
                  icon={Shield}
                  selected={autonomyLevel === "assisted"}
                  onSelect={onAutonomyChange}
                />
                <FrequencyCard
                  level="proactive"
                  label="Proactive"
                  description="Briefings, alerts, nudges, and celebrations"
                  icon={Zap}
                  selected={autonomyLevel === "proactive"}
                  onSelect={onAutonomyChange}
                />
                <FrequencyCard
                  level="autonomous"
                  label="Autonomous"
                  description="Full AI autonomy with all message types"
                  icon={Sparkles}
                  selected={autonomyLevel === "autonomous"}
                  onSelect={onAutonomyChange}
                />
              </div>
            </CardContent>
          </Card>

          {/* Per-type toggles */}
          <Card>
            <CardContent className="pt-5 pb-5 space-y-1">
              <div className="flex items-center gap-2 mb-2">
                <ChevronRight className="h-4 w-4 text-[#00F0FF]" />
                <p className="text-sm font-medium">Message Types</p>
              </div>
              <div className="divide-y divide-white/[0.06]">
                <TypeToggleRow
                  label="Reminders"
                  icon={Sunrise}
                  color="text-blue-400"
                  enabled={typeToggles.reminders}
                  onToggle={() => onTypeToggle("reminders")}
                />
                <TypeToggleRow
                  label="Insights"
                  icon={TrendingUp}
                  color="text-green-400"
                  enabled={typeToggles.insights}
                  onToggle={() => onTypeToggle("insights")}
                />
                <TypeToggleRow
                  label="Suggestions"
                  icon={Lightbulb}
                  color="text-violet-400"
                  enabled={typeToggles.suggestions}
                  onToggle={() => onTypeToggle("suggestions")}
                />
                <TypeToggleRow
                  label="Celebrations"
                  icon={Trophy}
                  color="text-amber-400"
                  enabled={typeToggles.celebrations}
                  onToggle={() => onTypeToggle("celebrations")}
                />
              </div>
            </CardContent>
          </Card>

          {/* Schedule reference */}
          <Card>
            <CardContent className="pt-5 pb-5 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-purple-400" />
                <p className="text-sm font-medium">Schedule ({Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop()?.replace(/_/g, ' ') ?? 'Local'})</p>
              </div>
              <div className="space-y-2.5 text-xs">
                <div className="flex items-start gap-2.5">
                  <Sunrise className="h-3.5 w-3.5 mt-0.5 text-violet-400 shrink-0" />
                  <div>
                    <p className="font-medium text-[#F4F6FF]">8:00 AM -- Daily Briefing</p>
                    <p className="text-muted-foreground">Tasks, habits, and calendar</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-amber-400 shrink-0" />
                  <div>
                    <p className="font-medium text-[#F4F6FF]">10:00 AM -- Overdue Alert</p>
                    <p className="text-muted-foreground">Only if items need attention</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Moon className="h-3.5 w-3.5 mt-0.5 text-purple-400 shrink-0" />
                  <div>
                    <p className="font-medium text-[#F4F6FF]">9:00 PM -- Habit Nudge</p>
                    <p className="text-muted-foreground">Gentle reminder if habits are at risk</p>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground pt-1 border-t border-white/[0.06]">
                Messages delivered via Telegram. Connect in Connections to receive them.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
