// CalendarPage.tsx -- Phase 95 + Enhanced Calendar Grid + AI Assistant Panel
// Revamped: design tokens, SectionCard, PageHeader, cal ownership, useAgentCanvas
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { PageShell, PageHeader, SectionCard } from '@/components/agentin';
import { DashboardPageWrapper } from '@/components/agentin';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';
import { BlurFade } from '@/components/magicui/blur-fade';
import {
  Calendar,
  Link2,
  RefreshCw,
  Unlink,
  ExternalLink,
  Clock,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Plus,
  Bell,
  X,
  Sparkles,
  Send,
  Loader2,
} from "lucide-react";
import { DateTime } from 'luxon';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api, { agentService } from "@/services/api";

// ── Types ────────────────────────────────────────────────────────────────────

interface CalendarStatus {
  available: boolean;
  connected: boolean;
  email: string | null;
  lastSync: number | null;
}

interface CalendarEvent {
  id: string | number;
  title: string;
  start_time: string | number;
  end_time?: string | number | null;
  category?: string;
  isLocal?: boolean;
}

interface ReminderItem {
  id: string;
  text: string;
  datetime: string;
  category?: string;
  completed?: number | boolean;
}

type EventCategory = "work" | "personal" | "health" | "social";

interface LocalEvent {
  id: string;
  title: string;
  start_time: number;
  end_time: number | null;
  category: EventCategory;
  isLocal: true;
}

const CATEGORY_COLORS: Record<EventCategory, string> = {
  work: "bg-[var(--ag-violet)]",
  personal: "bg-[var(--ag-violet-light)]",
  health: "bg-[var(--ag-accent)]",
  social: "bg-[var(--ag-violet-soft)]",
};

const CATEGORY_LABELS: Record<EventCategory, string> = {
  work: "Work",
  personal: "Personal",
  health: "Health",
  social: "Social",
};

const CATEGORY_TEXT_COLORS: Record<EventCategory, string> = {
  work: "text-[var(--ag-violet)]",
  personal: "text-[var(--ag-violet-light)]",
  health: "text-[var(--ag-accent)]",
  social: "text-[var(--ag-violet-soft)]",
};

const CATEGORY_BG_FAINT: Record<EventCategory, string> = {
  work: "bg-[var(--ag-violet)]/10",
  personal: "bg-[var(--ag-violet-light)]/10",
  health: "bg-[var(--ag-accent)]/10",
  social: "bg-[var(--ag-violet-soft)]/10",
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ── Helpers ──────────────────────────────────────────────────────────────────

function toMs(t: string | number): number {
  if (typeof t === "number") return t;
  const n = Number(t);
  if (!isNaN(n) && n > 1e12) return n;
  return new Date(t).getTime();
}

function formatTime(t: string | number): string {
  const d = new Date(toMs(t));
  return DateTime.fromJSDate(d).toLocaleString(DateTime.TIME_SIMPLE);
}

function formatLastSync(ms: number): string {
  return DateTime.fromMillis(ms).toLocaleString(DateTime.DATETIME_MED);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function relativeCountdown(ms: number): string {
  const now = Date.now();
  const diff = ms - now;
  if (diff < 0) return "past";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `in ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) {
    const d = new Date(ms);
    return `tomorrow ${DateTime.fromJSDate(d).toLocaleString(DateTime.TIME_SIMPLE)}`;
  }
  if (days < 7) return `in ${days} days`;
  return `in ${Math.floor(days / 7)}w`;
}

function parseNaturalLanguage(input: string): {
  title: string;
  date: Date | null;
  durationMinutes: number;
} {
  let title = input;
  let date: Date | null = null;
  let durationMinutes = 60;

  // Duration patterns
  const durMatch = input.match(/\bfor\s+(\d+)\s*(min|minute|minutes|hr|hour|hours|h|m)\b/i);
  if (durMatch) {
    const val = parseInt(durMatch[1]);
    const unit = durMatch[2].toLowerCase();
    if (unit.startsWith("h")) durationMinutes = val * 60;
    else durationMinutes = val;
    title = title.replace(durMatch[0], "").trim();
  }

  // Time patterns
  const timeMatch = input.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  let hour = 0;
  let minute = 0;
  let hasTime = false;
  if (timeMatch) {
    hour = parseInt(timeMatch[1]);
    minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const meridiem = timeMatch[3]?.toLowerCase();
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    hasTime = true;
    title = title.replace(timeMatch[0], "").trim();
  }

  // Date patterns
  const today = new Date();
  if (/\btomorrow\b/i.test(input)) {
    date = new Date(today);
    date.setDate(date.getDate() + 1);
    title = title.replace(/\btomorrow\b/i, "").trim();
  } else if (/\btoday\b/i.test(input)) {
    date = new Date(today);
    title = title.replace(/\btoday\b/i, "").trim();
  } else if (/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(input)) {
    const dayMatch = input.match(/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
    if (dayMatch) {
      const targetDay = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].indexOf(dayMatch[1].toLowerCase());
      date = new Date(today);
      const currentDay = date.getDay();
      let daysToAdd = targetDay - currentDay;
      if (daysToAdd <= 0) daysToAdd += 7;
      date.setDate(date.getDate() + daysToAdd);
      title = title.replace(dayMatch[0], "").trim();
    }
  }

  if (date && hasTime) {
    date.setHours(hour, minute, 0, 0);
  } else if (date) {
    date.setHours(9, 0, 0, 0);
  }

  // Clean up stray words
  title = title.replace(/\s{2,}/g, " ").trim();

  return { title, date, durationMinutes };
}

// ── Component ────────────────────────────────────────────────────────────────

export function CalendarPage() {
  const { notifyDone, notifyFail } = useAgentCanvas({ agent: 'cal', page: 'calendar' });

  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [localEvents, setLocalEvents] = useState<LocalEvent[]>(() => {
    try {
      const saved = localStorage.getItem("agentin_local_events");
      return saved ? (JSON.parse(saved) as LocalEvent[]) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calendar grid state
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  // Add event dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [nlInput, setNlInput] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualDate, setManualDate] = useState("");
  const [manualTime, setManualTime] = useState("09:00");
  const [manualDuration, setManualDuration] = useState("60");
  const [manualCategory, setManualCategory] = useState<EventCategory>("work");
  const [addMode, setAddMode] = useState<"natural" | "manual">("natural");

  // Expanded event
  const [expandedEventId, setExpandedEventId] = useState<string | number | null>(null);

  // AI Assistant panel state
  const [showAI, setShowAI] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const aiResponseRef = useRef<HTMLDivElement>(null);

  // Persist local events
  useEffect(() => {
    localStorage.setItem("agentin_local_events", JSON.stringify(localEvents));
  }, [localEvents]);

  const fetchData = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const statusRes = await api.get("/calendar/status");
      const statusData = statusRes.data as CalendarStatus;
      setStatus(statusData);
      setError(null);

      if (statusData.connected) {
        const eventsRes = await api.get("/calendar/events", { params: { days: 30 } });
        const eventsData = eventsRes.data as { events: CalendarEvent[] };
        setEvents(eventsData.events ?? []);
      } else {
        setEvents([]);
      }

      // Always fetch reminders for dots
      try {
        const remindersRes = await api.get("/reminders");
        const remindersData = remindersRes.data as ReminderItem[];
        setReminders(
          Array.isArray(remindersData)
            ? remindersData.filter((r) => !r.completed)
            : []
        );
      } catch {
        // Reminders fetch is non-critical
      }
    } catch {
      setError("Failed to load calendar data. Please try again.");
      void notifyFail("Calendar data fetch failed");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [notifyFail]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const askCalendarAI = useCallback(
    async (prompt: string) => {
      setAiLoading(true);
      setAiResponse("");
      try {
        const res = await agentService.chat(prompt, "web");
        const data = res.data;
        setAiResponse(data.text || JSON.stringify(data));
        // Refresh calendar after AI may have created/modified events
        void fetchData();
      } catch {
        setAiResponse("Could not reach AI assistant. Please try again.");
      } finally {
        setAiLoading(false);
      }
    },
    [fetchData]
  );

  // Scroll AI response into view when it changes
  useEffect(() => {
    if (aiResponse && aiResponseRef.current) {
      aiResponseRef.current.scrollTop = aiResponseRef.current.scrollHeight;
    }
  }, [aiResponse]);

  const handleConnect = useCallback(async () => {
    try {
      const token = localStorage.getItem("gs_token");
      const res = await fetch("/api/calendar/auth", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      const data = await res.json();
      if (data?.url) window.location.href = data.url;
    } catch (err) {
      console.error("Calendar connect failed:", err);
    }
  }, []);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await api.post("/calendar/sync");
      await fetchData();
    } catch {
      setError("Sync failed. Please try again.");
      void notifyFail("Calendar sync failed");
    } finally {
      setSyncing(false);
    }
  }, [fetchData, notifyFail]);

  const handleDisconnect = useCallback(async () => {
    setDisconnecting(true);
    try {
      await api.post("/calendar/disconnect");
      await fetchData();
    } catch {
      setError("Disconnect failed. Please try again.");
      void notifyFail("Calendar disconnect failed");
    } finally {
      setDisconnecting(false);
    }
  }, [fetchData, notifyFail]);

  // ── Calendar grid data ─────────────────────────────────────────────────────

  const allEvents = useMemo(() => {
    const combined: CalendarEvent[] = [
      ...events.map((e) => ({ ...e, isLocal: false })),
      ...localEvents.map((e) => ({
        ...e,
        id: e.id,
        title: e.title,
        start_time: e.start_time,
        end_time: e.end_time,
        category: e.category,
        isLocal: true,
      })),
    ];
    return combined;
  }, [events, localEvents]);

  // Map: dateKey -> events
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of allEvents) {
      const d = new Date(toMs(ev.start_time));
      const key = dateKey(d);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return map;
  }, [allEvents]);

  // Map: dateKey -> reminders
  const remindersByDate = useMemo(() => {
    const map = new Map<string, ReminderItem[]>();
    for (const r of reminders) {
      if (!r.datetime) continue;
      const d = new Date(r.datetime);
      if (isNaN(d.getTime())) continue;
      const key = dateKey(d);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return map;
  }, [reminders]);

  // Events for selected day
  const selectedDayEvents = useMemo(() => {
    const key = dateKey(selectedDate);
    return eventsByDate.get(key) ?? [];
  }, [selectedDate, eventsByDate]);

  const selectedDayReminders = useMemo(() => {
    const key = dateKey(selectedDate);
    return remindersByDate.get(key) ?? [];
  }, [selectedDate, remindersByDate]);

  // Upcoming events (next 3)
  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    return allEvents
      .filter((e) => toMs(e.start_time) > now)
      .sort((a, b) => toMs(a.start_time) - toMs(b.start_time))
      .slice(0, 3);
  }, [allEvents]);

  // ── Calendar grid cells ────────────────────────────────────────────────────

  const gridCells = useMemo(() => {
    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
    const cells: Array<{ day: number; date: Date; isCurrentMonth: boolean }> = [];

    // Previous month padding
    const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
    const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
    const prevDays = getDaysInMonth(prevYear, prevMonth);
    for (let i = firstDay - 1; i >= 0; i--) {
      cells.push({
        day: prevDays - i,
        date: new Date(prevYear, prevMonth, prevDays - i),
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        day: d,
        date: new Date(viewYear, viewMonth, d),
        isCurrentMonth: true,
      });
    }

    // Next month padding
    const remaining = 42 - cells.length;
    const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
    const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
    for (let d = 1; d <= remaining; d++) {
      cells.push({
        day: d,
        date: new Date(nextYear, nextMonth, d),
        isCurrentMonth: false,
      });
    }

    return cells;
  }, [viewYear, viewMonth]);

  // ── Navigation ─────────────────────────────────────────────────────────────

  function goToPrevMonth() {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }

  function goToNextMonth() {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }

  function goToToday() {
    const t = new Date();
    setViewYear(t.getFullYear());
    setViewMonth(t.getMonth());
    setSelectedDate(t);
  }

  // ── Add event handler ──────────────────────────────────────────────────────

  function handleAddEvent() {
    if (addMode === "natural") {
      if (!nlInput.trim()) return;
      const parsed = parseNaturalLanguage(nlInput.trim());
      if (!parsed.title) return;
      const start = parsed.date ?? new Date();
      const ev: LocalEvent = {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: parsed.title,
        start_time: start.getTime(),
        end_time: start.getTime() + parsed.durationMinutes * 60000,
        category: "work",
        isLocal: true,
      };
      setLocalEvents((prev) => [...prev, ev]);
      setNlInput("");
      void notifyDone(`Event created: ${ev.title}`);
    } else {
      if (!manualTitle.trim() || !manualDate) return;
      const [year, month, day] = manualDate.split("-").map(Number);
      const [hr, min] = manualTime.split(":").map(Number);
      const start = new Date(year, month - 1, day, hr, min);
      const dur = parseInt(manualDuration) || 60;
      const ev: LocalEvent = {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: manualTitle.trim(),
        start_time: start.getTime(),
        end_time: start.getTime() + dur * 60000,
        category: manualCategory,
        isLocal: true,
      };
      setLocalEvents((prev) => [...prev, ev]);
      setManualTitle("");
      setManualDate("");
      setManualTime("09:00");
      setManualDuration("60");
      setManualCategory("work");
      void notifyDone(`Event created: ${ev.title}`);
    }
    setShowAddDialog(false);
  }

  function handleDeleteLocalEvent(id: string | number) {
    setLocalEvents((prev) => prev.filter((e) => e.id !== id));
    setExpandedEventId(null);
  }

  const spinCls = refreshing ? "animate-spin" : "";
  const monthLabel = DateTime.local(viewYear, viewMonth + 1, 1).toLocaleString({ month: 'long', year: 'numeric' });

  return (
    <DashboardPageWrapper>
    <PageShell maxWidth="6xl">
    <div className="space-y-6 pb-24 md:pb-6">
      {/* Header -- Cal ownership */}
      <PageHeader
        icon={Calendar}
        title="Calendar"
        subtitle="View upcoming events and keep Weebo in sync with your schedule."
        badge={
          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-[#84CC16]/10 border border-[#84CC16]/30 text-[#84CC16]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#84CC16] opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#84CC16]" />
            </span>
            Cal
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setShowAddDialog(true)}
              className="gap-1.5 min-h-[44px] bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-accent)] text-white hover:from-[var(--ag-violet)]/90 hover:to-[var(--ag-accent)]/90 focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50 transition-all duration-300"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Event</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void fetchData(true)}
              disabled={refreshing}
              aria-label="Refresh"
              className="min-w-[44px] min-h-[44px] focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50 hover:bg-[var(--ag-bg-surface)]"
            >
              <RefreshCw className={"h-4 w-4 " + spinCls} />
            </Button>
          </div>
        }
      />

      {error && (
        <BlurFade delay={0}>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
        </BlurFade>
      )}

      {/* Connection status card */}
      <BlurFade delay={0.1}>
      <SectionCard className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)] rounded-xl">
          {loading ? (
            <div className="h-12 rounded-lg bg-[var(--ag-bg-subtle)] animate-pulse" />
          ) : status?.available === false ? (
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-amber-400/10 p-2">
                <Calendar className="h-5 w-5 text-amber-400" />
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
                <div className="rounded-full bg-green-400/10 p-2">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="font-medium text-[var(--ag-text-primary)]">Connected</p>
                  <p className="text-xs text-[var(--ag-text-secondary)]">
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
                  className="gap-1.5 min-h-[44px] border-[rgba(139,92,246,0.15)] focus-visible:ring-2 focus-visible:ring-[#A78BFA]/50"
                >
                  <RefreshCw
                    className={
                      "h-3.5 w-3.5" + (syncing ? " animate-spin" : "")
                    }
                  />
                  {syncing ? "Syncing..." : "Sync Now"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleDisconnect()}
                  disabled={disconnecting}
                  className="gap-1.5 text-red-400 hover:text-red-300 border-red-500/30 hover:border-red-500/50 min-h-[44px] focus-visible:ring-2 focus-visible:ring-[#A78BFA]/50"
                >
                  <Unlink className="h-3.5 w-3.5" />
                  {disconnecting ? "Disconnecting..." : "Disconnect"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-[#F4F6FF]/5 p-2">
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
                onClick={handleConnect}
                className="gap-1.5 shrink-0 min-h-[44px] bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-accent)] text-white hover:from-[var(--ag-violet)]/90 hover:to-[var(--ag-accent)]/90 font-semibold focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50 transition-all duration-300"
              >
                <Link2 className="h-3.5 w-3.5" />
                Connect Google Calendar
                <ExternalLink className="h-3 w-3 opacity-60" />
              </Button>
            </div>
          )}
      </SectionCard>
      </BlurFade>

      {/* Main content: calendar grid + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* Left: Calendar grid + selected day panel */}
        <div className="space-y-4">
          {/* Calendar grid */}
          <BlurFade delay={0.15}>
          <SectionCard className="overflow-hidden bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)] rounded-xl">
              {/* Month navigation */}
              <div className="flex items-center justify-between mb-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToPrevMonth}
                  aria-label="Previous month"
                  className="min-w-[44px] min-h-[44px] focus-visible:ring-2 focus-visible:ring-[#A78BFA]/50"
                >
                  <ChevronLeft className="h-5 w-5 text-[var(--ag-text-secondary)]" />
                </Button>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-heading font-semibold text-[var(--ag-text-primary)]">{monthLabel}</h2>
                  {!(
                    viewYear === today.getFullYear() &&
                    viewMonth === today.getMonth()
                  ) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToToday}
                      className="text-xs min-h-[44px] px-3 border-[var(--ag-border-subtle)] text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:bg-[var(--ag-bg-surface)]"
                    >
                      Today
                    </Button>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToNextMonth}
                  aria-label="Next month"
                  className="min-w-[44px] min-h-[44px] focus-visible:ring-2 focus-visible:ring-[#A78BFA]/50"
                >
                  <ChevronRight className="h-5 w-5 text-[var(--ag-text-secondary)]" />
                </Button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 mb-1">
                {DAY_NAMES.map((d) => (
                  <div
                    key={d}
                    className="text-center text-xs font-medium text-[var(--ag-text-muted)] py-2"
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-px bg-[var(--ag-border-subtle)] rounded-lg overflow-hidden">
                {gridCells.map((cell, idx) => {
                  const key = dateKey(cell.date);
                  const isToday = isSameDay(cell.date, today);
                  const isSelected = isSameDay(cell.date, selectedDate);
                  const dayEvents = eventsByDate.get(key);
                  const dayReminders = remindersByDate.get(key);
                  const hasEvents = !!dayEvents && dayEvents.length > 0;
                  const hasReminders =
                    !!dayReminders && dayReminders.length > 0;

                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedDate(cell.date)}
                      className={[
                        "relative flex flex-col items-center py-2 sm:py-3 min-h-[44px] sm:min-h-[56px] bg-[var(--ag-bg-surface)] transition-colors",
                        cell.isCurrentMonth
                          ? "text-[var(--ag-text-primary)]"
                          : "text-[var(--ag-text-muted)]/40",
                        isToday ? "ring-1 ring-inset ring-[var(--ag-accent)] bg-[var(--ag-accent)]/5" : "",
                        isSelected && !isToday ? "bg-[var(--ag-violet)]/10" : "",
                        isSelected && isToday ? "bg-[var(--ag-accent)]/15 ring-2 ring-[var(--ag-accent)]" : "",
                        "hover:bg-[var(--ag-violet)]/8 focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50 focus-visible:outline-none",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "text-sm font-medium leading-none",
                          isToday ? "text-[var(--ag-accent)] font-bold" : "",
                        ].join(" ")}
                      >
                        {cell.day}
                      </span>

                      {/* Event indicators */}
                      {(hasEvents || hasReminders) ? (
                        <div className="flex items-center gap-0.5 mt-1">
                          {hasEvents && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--ag-violet)]" />
                          )}
                          {hasReminders && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--ag-accent)]" />
                          )}
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 mt-3 text-xs text-[var(--ag-text-muted)]">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--ag-violet)]" />
                  Events
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--ag-accent)]" />
                  Reminders
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--ag-accent)]" />
                  Today
                </div>
              </div>
          </SectionCard>
          </BlurFade>

          {/* Selected day event list */}
          <BlurFade delay={0.2}>
          <SectionCard className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)] rounded-xl">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-4 w-4 text-[var(--ag-violet)]" />
                <h2 className="text-base font-heading font-semibold text-[var(--ag-text-primary)]">
                {isSameDay(selectedDate, today)
                  ? "Today"
                  : DateTime.fromJSDate(selectedDate).toLocaleString({ weekday: 'long', month: 'short', day: 'numeric' })}
                </h2>
                {(selectedDayEvents.length > 0 ||
                  selectedDayReminders.length > 0) && (
                  <Badge variant="secondary" className="ml-1 text-xs bg-[var(--ag-violet)]/10 text-[var(--ag-violet)] border-[var(--ag-violet)]/30">
                    {selectedDayEvents.length + selectedDayReminders.length}
                  </Badge>
                )}
              </div>
              {selectedDayEvents.length === 0 &&
              selectedDayReminders.length === 0 ? (
                <div className="py-6 text-center text-[var(--ag-text-muted)]">
                  <Calendar className="mx-auto h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm text-[var(--ag-text-secondary)]">No events or reminders for this day.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setManualDate(dateKey(selectedDate));
                      setAddMode("manual");
                      setShowAddDialog(true);
                    }}
                    className="mt-3 gap-1.5 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Event
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Events */}
                  {selectedDayEvents
                    .sort(
                      (a, b) => toMs(a.start_time) - toMs(b.start_time)
                    )
                    .map((ev) => {
                      const isExpanded = expandedEventId === ev.id;
                      const cat = (
                        ev.category || "personal"
                      ) as EventCategory;
                      const catColor =
                        CATEGORY_COLORS[cat] || "bg-cyan-400";
                      const catTextColor =
                        CATEGORY_TEXT_COLORS[cat] || "text-cyan-400";
                      const catBg =
                        CATEGORY_BG_FAINT[cat] || "bg-cyan-400/10";
                      const catLabel =
                        CATEGORY_LABELS[cat] || cat;

                      return (
                        <div key={ev.id}>
                          <button
                            onClick={() =>
                              setExpandedEventId(isExpanded ? null : ev.id)
                            }
                            className="w-full rounded-lg border border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)] p-3 flex items-start gap-3 text-left hover:border-[var(--ag-violet)]/30 hover:bg-[var(--ag-bg-subtle)] transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50 focus-visible:outline-none"
                          >
                            <div
                              className={`rounded-full ${catBg} p-1.5 mt-0.5 shrink-0`}
                            >
                              <Calendar
                                className={`h-3.5 w-3.5 ${catTextColor}`}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium leading-snug truncate text-[var(--ag-text-primary)]">
                                  {ev.title}
                                </p>
                                {ev.isLocal && (
                                  <span
                                    className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${catBg} ${catTextColor}`}
                                  >
                                    {catLabel}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[var(--ag-text-secondary)] mt-0.5">
                                {formatTime(ev.start_time)}
                                {ev.end_time
                                  ? " \u2013 " + formatTime(ev.end_time)
                                  : ""}
                              </p>
                            </div>
                            <span
                              className={`w-2 h-2 rounded-full mt-2 shrink-0 ${catColor}`}
                            />
                          </button>

                          {/* Expanded details */}
                          {isExpanded && (
                            <div className="ml-9 mt-1 mb-2 rounded-lg border border-[var(--ag-border-subtle)] bg-[var(--ag-bg-subtle)] p-3 space-y-2 text-sm">
                              <div className="flex items-center gap-2">
                                <span className="text-[var(--ag-text-muted)]">
                                  Time:
                                </span>
                                <span>
                                  {formatTime(ev.start_time)}
                                  {ev.end_time
                                    ? " \u2013 " + formatTime(ev.end_time)
                                    : ""}
                                </span>
                              </div>
                              {ev.end_time && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[var(--ag-text-muted)]">
                                    Duration:
                                  </span>
                                  <span>
                                    {Math.round(
                                      (toMs(ev.end_time) -
                                        toMs(ev.start_time)) /
                                        60000
                                    )}
                                    m
                                  </span>
                                </div>
                              )}
                              {ev.category && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[var(--ag-text-muted)]">
                                    Category:
                                  </span>
                                  <span
                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${catBg} ${catTextColor}`}
                                  >
                                    {catLabel}
                                  </span>
                                </div>
                              )}
                              {ev.isLocal && (
                                <div className="pt-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      handleDeleteLocalEvent(ev.id)
                                    }
                                    className="gap-1.5 text-xs text-red-400 hover:text-red-300 border-red-500/30 hover:border-red-500/50 h-8"
                                  >
                                    <X className="h-3 w-3" />
                                    Delete
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                  {/* Reminders */}
                  {selectedDayReminders.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-lg border border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)] p-3 flex items-start gap-3"
                    >
                      <div className="rounded-full bg-[var(--ag-accent)]/10 p-1.5 mt-0.5 shrink-0">
                        <Bell className="h-3.5 w-3.5 text-[var(--ag-accent)]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug truncate text-[var(--ag-text-primary)]">
                          {r.text}
                        </p>
                        <p className="text-xs text-[var(--ag-text-secondary)] mt-0.5">
                          {r.datetime
                            ? formatTime(new Date(r.datetime).getTime())
                            : "All day"}
                          <span className="ml-2 text-[var(--ag-accent)]/70">
                            Reminder
                          </span>
                        </p>
                      </div>
                      <span className="w-2 h-2 rounded-full mt-2 shrink-0 bg-[var(--ag-accent)]" />
                    </div>
                  ))}
                </div>
              )}
          </SectionCard>
          </BlurFade>
        </div>

        {/* Right sidebar: upcoming events widget */}
        <div className="space-y-4">
          <BlurFade delay={0.2}>
          <SectionCard title="Upcoming" className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)] rounded-xl">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-14 rounded-lg bg-[var(--ag-bg-subtle)] animate-pulse"
                    />
                  ))}
                </div>
              ) : upcomingEvents.length === 0 ? (
                <div className="py-6 text-center text-[var(--ag-text-muted)]">
                  <Calendar className="mx-auto h-6 w-6 mb-2 opacity-30" />
                  <p className="text-sm text-[var(--ag-text-secondary)]">No upcoming events.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map((ev) => {
                    const ms = toMs(ev.start_time);
                    const cat = (
                      ev.category || "personal"
                    ) as EventCategory;
                    const catColor =
                      CATEGORY_COLORS[cat] || "bg-cyan-400";
                    const catTextColor =
                      CATEGORY_TEXT_COLORS[cat] || "text-cyan-400";
                    const catBg =
                      CATEGORY_BG_FAINT[cat] || "bg-cyan-400/10";

                    return (
                      <div
                        key={ev.id}
                        className="rounded-lg border border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)] p-3 flex items-start gap-3 hover:border-[var(--ag-violet)]/30 transition-all duration-300"
                      >
                        <div
                          className={`rounded-full ${catBg} p-1.5 mt-0.5 shrink-0`}
                        >
                          <Calendar
                            className={`h-3.5 w-3.5 ${catTextColor}`}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-snug truncate text-[var(--ag-text-primary)]">
                            {ev.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-[var(--ag-text-secondary)]">
                              {DateTime.fromMillis(ms).toLocaleString({ month: 'short', day: 'numeric' })}{" "}
                              {formatTime(ms)}
                            </p>
                            <span className="text-xs text-[var(--ag-violet)] font-medium">
                              {relativeCountdown(ms)}
                            </span>
                          </div>
                        </div>
                        <span
                          className={`w-2 h-2 rounded-full mt-2 shrink-0 ${catColor}`}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
          </SectionCard>
          </BlurFade>

          {/* How it works -- shown when not connected */}
          {!loading && !status?.connected && (
            <BlurFade delay={0.25}>
            <SectionCard title="How It Works" className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)] rounded-xl">
                <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-4 w-4 mt-0.5 text-[var(--ag-violet)] shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-[var(--ag-text-primary)]">
                      Connect your Google account
                    </p>
                    <p className="text-xs text-[var(--ag-text-secondary)]">
                      Click &quot;Connect Google Calendar&quot; above to
                      authorise read-only access via OAuth.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-4 w-4 mt-0.5 text-[var(--ag-violet)] shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-[var(--ag-text-primary)]">
                      Events are pulled automatically
                    </p>
                    <p className="text-xs text-[var(--ag-text-secondary)]">
                      Weebo syncs your upcoming events so they appear in your
                      dashboard.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-4 w-4 mt-0.5 text-[var(--ag-violet)] shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-[var(--ag-text-primary)]">
                      Context-aware responses
                    </p>
                    <p className="text-xs text-[var(--ag-text-secondary)]">
                      Weebo uses your calendar context to give smarter
                      briefings and reminders.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-4 w-4 mt-0.5 text-[var(--ag-violet)] shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-[var(--ag-text-primary)]">
                      You stay in control
                    </p>
                    <p className="text-xs text-[var(--ag-text-secondary)]">
                      Disconnect at any time. Only read access is requested --
                      Weebo never modifies your calendar.
                    </p>
                  </div>
                </div>
                </div>
            </SectionCard>
            </BlurFade>
          )}
        </div>
      </div>

      {/* Add Event Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Event</DialogTitle>
            <DialogDescription>
              Create a local calendar event with natural language or manual
              fields.
            </DialogDescription>
          </DialogHeader>

          {/* Mode toggle */}
          <div className="flex gap-2 p-1 bg-[var(--ag-bg-subtle)] rounded-lg">
            <button
              onClick={() => setAddMode("natural")}
              className={[
                "flex-1 text-sm py-2.5 min-h-[44px] rounded-md transition-colors font-medium focus-visible:ring-2 focus-visible:ring-[#A78BFA]/50 focus-visible:outline-none",
                addMode === "natural"
                  ? "bg-[var(--ag-bg-surface)] text-[var(--ag-text-primary)] shadow-sm"
                  : "text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)]",
              ].join(" ")}
            >
              Natural Language
            </button>
            <button
              onClick={() => setAddMode("manual")}
              className={[
                "flex-1 text-sm py-2.5 min-h-[44px] rounded-md transition-colors font-medium focus-visible:ring-2 focus-visible:ring-[#A78BFA]/50 focus-visible:outline-none",
                addMode === "manual"
                  ? "bg-[var(--ag-bg-surface)] text-[var(--ag-text-primary)] shadow-sm"
                  : "text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)]",
              ].join(" ")}
            >
              Manual
            </button>
          </div>

          {addMode === "natural" ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="nl-input">Describe your event</Label>
                <Input
                  id="nl-input"
                  placeholder='e.g. "Team standup tomorrow 10am for 30 min"'
                  value={nlInput}
                  onChange={(e) => setNlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddEvent();
                    }
                  }}
                  autoFocus
                />
                <p className="text-xs text-[var(--ag-text-muted)]">
                  Supports: &quot;tomorrow&quot;, &quot;today&quot;, &quot;next
                  Monday&quot;, &quot;at 2pm&quot;, &quot;for 30 min&quot;
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="event-title">Title</Label>
                <Input
                  id="event-title"
                  placeholder="Event title"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="event-date">Date</Label>
                  <Input
                    id="event-date"
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event-time">Time</Label>
                  <Input
                    id="event-time"
                    type="time"
                    value={manualTime}
                    onChange={(e) => setManualTime(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="event-duration">Duration (min)</Label>
                  <Input
                    id="event-duration"
                    type="number"
                    min="5"
                    max="480"
                    value={manualDuration}
                    onChange={(e) => setManualDuration(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={manualCategory}
                    onValueChange={(v) =>
                      setManualCategory(v as EventCategory)
                    }
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="work">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[var(--ag-violet)]" />
                          Work
                        </span>
                      </SelectItem>
                      <SelectItem value="personal">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[var(--ag-violet-light)]" />
                          Personal
                        </span>
                      </SelectItem>
                      <SelectItem value="health">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[var(--ag-accent)]" />
                          Health
                        </span>
                      </SelectItem>
                      <SelectItem value="social">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[var(--ag-violet-soft)]" />
                          Social
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddDialog(false)}
              className="min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddEvent}
              disabled={
                addMode === "natural"
                  ? !nlInput.trim()
                  : !manualTitle.trim() || !manualDate
              }
              className="min-h-[44px] bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-accent)] text-white hover:from-[var(--ag-violet)]/90 hover:to-[var(--ag-accent)]/90 transition-all duration-300"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── AI Assistant FAB ─────────────────────────────────── */}
      <button
        onClick={() => setShowAI((v) => !v)}
        className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
        style={{
          background: showAI
            ? "linear-gradient(135deg, #8B5CF6, #A78BFA)"
            : "linear-gradient(135deg, #A78BFA, #8B5CF6)",
          boxShadow: "0 4px 20px rgba(139,92,246,0.3)",
        }}
        aria-label={showAI ? "Close AI assistant" : "Open AI assistant"}
      >
        {showAI ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <Sparkles className="h-6 w-6 text-white" />
        )}
      </button>

      {/* ── AI Assistant Panel ────────────────────────────────── */}
      {showAI && (
        <div
          className="fixed z-40 bg-[var(--ag-bg-surface)] backdrop-blur-xl border border-[var(--ag-border-subtle)] rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300
            bottom-0 left-0 right-0 h-[80vh]
            md:bottom-6 md:left-auto md:right-24 md:top-auto md:w-[400px] md:h-[560px]"
          style={{
            boxShadow: "0 -8px 40px rgba(0,0,0,0.5), 0 0 60px rgba(139,92,246,0.08)",
          }}
        >
          {/* Panel header */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)] shrink-0">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-lg"
              style={{ background: "linear-gradient(135deg, #A78BFA20, #8B5CF620)" }}
            >
              <Sparkles className="h-4 w-4 text-[var(--ag-violet)]" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-heading font-semibold text-[var(--ag-text-primary)]">Calendar AI</h3>
              <p className="text-xs text-[var(--ag-text-secondary)] truncate">Ask about your schedule</p>
            </div>
            <button
              onClick={() => setShowAI(false)}
              className="flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-lg hover:bg-white/5 transition-colors"
              aria-label="Close AI panel"
            >
              <X className="h-4 w-4 text-[var(--ag-text-secondary)]" />
            </button>
          </div>

          {/* Quick actions */}
          <div className="flex flex-wrap gap-2 px-4 py-3 border-b border-[var(--ag-border-subtle)]/50 shrink-0">
            {[
              { label: "Find free time", prompt: "Find me some free time slots this week for a 1-hour meeting" },
              { label: "Block focus time", prompt: "Block 2 hours of focus time tomorrow morning on my calendar" },
              { label: "What's next?", prompt: "What's my next upcoming event on my calendar?" },
            ].map((action) => (
              <button
                key={action.label}
                onClick={() => void askCalendarAI(action.prompt)}
                disabled={aiLoading}
                className="px-3 py-1.5 min-h-[44px] rounded-full text-xs font-medium border transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 bg-[var(--ag-violet)]/6 border-[var(--ag-violet)]/15 text-[var(--ag-violet)]"
              >
                {action.label}
              </button>
            ))}
          </div>

          {/* Response area */}
          <div
            ref={aiResponseRef}
            className="flex-1 overflow-y-auto px-4 py-3 text-sm leading-relaxed"
          >
            {aiLoading ? (
              <div className="flex items-center gap-2 text-[var(--ag-text-secondary)] py-8 justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-[var(--ag-violet)]" />
                <span>Thinking...</span>
              </div>
            ) : aiResponse ? (
              <div className="text-[var(--ag-text-primary)] whitespace-pre-wrap">{aiResponse}</div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-8 gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(139,92,246,0.08)" }}
                >
                  <Calendar className="h-6 w-6 text-[var(--ag-violet)]/60" />
                </div>
                <p className="text-[var(--ag-text-secondary)] text-xs max-w-[240px]">
                  Ask me to find free slots, schedule meetings, or check what is coming up.
                </p>
              </div>
            )}
          </div>

          {/* Input area */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = aiInput.trim();
              if (!trimmed || aiLoading) return;
              setAiInput("");
              void askCalendarAI(trimmed);
            }}
            className="flex items-center gap-2 px-3 py-3 border-t border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)] shrink-0"
          >
            <input
              type="text"
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="Ask about your calendar..."
              disabled={aiLoading}
              className="flex-1 bg-[var(--ag-bg-surface)] border border-[var(--ag-border-subtle)] rounded-lg px-3 py-2.5 min-h-[44px] text-sm text-[var(--ag-text-primary)] placeholder:text-[var(--ag-text-secondary)]/60 outline-none focus:border-[var(--ag-violet)]/40 transition-colors disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!aiInput.trim() || aiLoading}
              className="flex items-center justify-center w-11 h-11 rounded-lg transition-all duration-150 disabled:opacity-30 hover:scale-105 active:scale-95"
              style={{
                background: aiInput.trim()
                  ? "linear-gradient(135deg, var(--ag-violet), var(--ag-accent))"
                  : "rgba(139,92,246,0.08)",
              }}
              aria-label="Send message"
            >
              <Send className="h-4 w-4 text-white" />
            </button>
          </form>
        </div>
      )}
    </div>
    </PageShell>
    </DashboardPageWrapper>
  );
}
