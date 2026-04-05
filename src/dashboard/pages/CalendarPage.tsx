// CalendarPage.tsx — Full Redesign
// Glass calendar grid · violet today glow · colored event dots · animated month transitions
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageShell, PageHeader, SectionCard } from '@/components/agentin';
import { DashboardPageWrapper } from '@/components/agentin';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';
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
  CalendarDays,
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

// ── Category config using actual CSS tokens ───────────────────────────────────

const CATEGORY_CONFIG: Record<EventCategory, { dot: string; bg: string; text: string; label: string }> = {
  work:     { dot: 'var(--ag-violet)',  bg: 'rgba(139,92,246,0.12)',  text: 'var(--ag-violet)',  label: 'Work'     },
  personal: { dot: 'var(--ag-cyan)',    bg: 'rgba(167,139,250,0.12)', text: 'var(--ag-cyan)',    label: 'Personal' },
  health:   { dot: 'var(--ag-green)',   bg: 'rgba(16,185,129,0.12)',  text: 'var(--ag-green)',   label: 'Health'   },
  social:   { dot: 'var(--ag-pink)',    bg: 'rgba(255,45,120,0.12)',  text: 'var(--ag-pink)',    label: 'Social'   },
};

const REMINDER_COLOR = 'var(--ag-amber)';

const DAY_NAMES_SHORT = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES_FULL  = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

  const durMatch = input.match(/\bfor\s+(\d+)\s*(min|minute|minutes|hr|hour|hours|h|m)\b/i);
  if (durMatch) {
    const val = parseInt(durMatch[1]);
    const unit = durMatch[2].toLowerCase();
    if (unit.startsWith("h")) durationMinutes = val * 60;
    else durationMinutes = val;
    title = title.replace(durMatch[0], "").trim();
  }

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
      const targetDay = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"].indexOf(dayMatch[1].toLowerCase());
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

  title = title.replace(/\s{2,}/g, " ").trim();
  return { title, date, durationMinutes };
}

// ── Animation variants ────────────────────────────────────────────────────────

const monthVariants = {
  enterNext:  { opacity: 0, x:  40 },
  enterPrev:  { opacity: 0, x: -40 },
  center:     { opacity: 1, x:   0 },
  exitNext:   { opacity: 0, x: -40 },
  exitPrev:   { opacity: 0, x:  40 },
};

const panelVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0,  transition: { type: "spring" as const, duration: 0.4, bounce: 0 } },
  exit:   { opacity: 0, y:  8,  transition: { duration: 0.18 } },
};

// ── Component ────────────────────────────────────────────────────────────────

export function CalendarPage() {
  const { notifyDone, notifyFail } = useAgentCanvas({ agent: 'cal', page: 'calendar' });

  const [status, setStatus]               = useState<CalendarStatus | null>(null);
  const [events, setEvents]               = useState<CalendarEvent[]>([]);
  const [reminders, setReminders]         = useState<ReminderItem[]>([]);
  const [localEvents, setLocalEvents]     = useState<LocalEvent[]>(() => {
    try {
      const saved = localStorage.getItem("agentin_local_events");
      return saved ? (JSON.parse(saved) as LocalEvent[]) : [];
    } catch { return []; }
  });
  const [loading, setLoading]             = useState(true);
  const [syncing, setSyncing]             = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [refreshing, setRefreshing]       = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  // Calendar grid state
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear]           = useState(today.getFullYear());
  const [viewMonth, setViewMonth]         = useState(today.getMonth());
  const [selectedDate, setSelectedDate]   = useState<Date>(today);
  const [navDir, setNavDir]               = useState<"next" | "prev">("next");

  // Add event dialog
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [nlInput, setNlInput]             = useState("");
  const [manualTitle, setManualTitle]     = useState("");
  const [manualDate, setManualDate]       = useState("");
  const [manualTime, setManualTime]       = useState("09:00");
  const [manualDuration, setManualDuration] = useState("60");
  const [manualCategory, setManualCategory] = useState<EventCategory>("work");
  const [addMode, setAddMode]             = useState<"natural" | "manual">("natural");

  // Expanded event
  const [expandedEventId, setExpandedEventId] = useState<string | number | null>(null);

  // AI Assistant
  const [showAI, setShowAI]       = useState(false);
  const [aiInput, setAiInput]     = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const aiResponseRef             = useRef<HTMLDivElement>(null);

  // Persist local events
  useEffect(() => {
    localStorage.setItem("agentin_local_events", JSON.stringify(localEvents));
  }, [localEvents]);

  const fetchData = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const statusRes  = await api.get("/calendar/status");
      const statusData = statusRes.data as CalendarStatus;
      setStatus(statusData);
      setError(null);

      if (statusData.connected) {
        const eventsRes  = await api.get("/calendar/events", { params: { days: 30 } });
        const eventsData = eventsRes.data as { events: CalendarEvent[] };
        setEvents(eventsData.events ?? []);
      } else {
        setEvents([]);
      }

      try {
        const remindersRes  = await api.get("/reminders");
        const remindersData = remindersRes.data as ReminderItem[];
        setReminders(
          Array.isArray(remindersData)
            ? remindersData.filter((r) => !r.completed)
            : []
        );
      } catch { /* non-critical */ }
    } catch {
      setError("Failed to load calendar data. Please try again.");
      void notifyFail("Calendar data fetch failed");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [notifyFail]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const askCalendarAI = useCallback(async (prompt: string) => {
    setAiLoading(true);
    setAiResponse("");
    try {
      const res  = await agentService.chat(prompt, "web");
      const data = res.data;
      setAiResponse(data.text || JSON.stringify(data));
      void fetchData();
    } catch {
      setAiResponse("Could not reach AI assistant. Please try again.");
    } finally {
      setAiLoading(false);
    }
  }, [fetchData]);

  useEffect(() => {
    if (aiResponse && aiResponseRef.current) {
      aiResponseRef.current.scrollTop = aiResponseRef.current.scrollHeight;
    }
  }, [aiResponse]);

  const handleConnect = useCallback(async () => {
    try {
      const token = localStorage.getItem("gs_token");
      const res   = await fetch("/api/calendar/auth", {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      const data = await res.json();
      if (data?.url) window.location.href = data.url;
    } catch { /* ignore */ }
  }, []);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await api.post("/calendar/sync");
      await fetchData();
    } catch {
      setError("Sync failed. Please try again.");
      void notifyFail("Calendar sync failed");
    } finally { setSyncing(false); }
  }, [fetchData, notifyFail]);

  const handleDisconnect = useCallback(async () => {
    setDisconnecting(true);
    try {
      await api.post("/calendar/disconnect");
      await fetchData();
    } catch {
      setError("Disconnect failed. Please try again.");
      void notifyFail("Calendar disconnect failed");
    } finally { setDisconnecting(false); }
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

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of allEvents) {
      const d   = new Date(toMs(ev.start_time));
      const key = dateKey(d);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return map;
  }, [allEvents]);

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

  const selectedDayEvents = useMemo(() => {
    const key = dateKey(selectedDate);
    return eventsByDate.get(key) ?? [];
  }, [selectedDate, eventsByDate]);

  const selectedDayReminders = useMemo(() => {
    const key = dateKey(selectedDate);
    return remindersByDate.get(key) ?? [];
  }, [selectedDate, remindersByDate]);

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
    const firstDay    = getFirstDayOfMonth(viewYear, viewMonth);
    const cells: Array<{ day: number; date: Date; isCurrentMonth: boolean }> = [];

    const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
    const prevYear  = viewMonth === 0 ? viewYear - 1 : viewYear;
    const prevDays  = getDaysInMonth(prevYear, prevMonth);
    for (let i = firstDay - 1; i >= 0; i--) {
      cells.push({ day: prevDays - i, date: new Date(prevYear, prevMonth, prevDays - i), isCurrentMonth: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, date: new Date(viewYear, viewMonth, d), isCurrentMonth: true });
    }

    const remaining = 42 - cells.length;
    const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
    const nextYear  = viewMonth === 11 ? viewYear + 1 : viewYear;
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: d, date: new Date(nextYear, nextMonth, d), isCurrentMonth: false });
    }

    return cells;
  }, [viewYear, viewMonth]);

  // ── Navigation ─────────────────────────────────────────────────────────────

  function goToPrevMonth() {
    setNavDir("prev");
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  }

  function goToNextMonth() {
    setNavDir("next");
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  }

  function goToToday() {
    const t = new Date();
    setNavDir("prev");
    setViewYear(t.getFullYear());
    setViewMonth(t.getMonth());
    setSelectedDate(t);
  }

  // ── Add event ──────────────────────────────────────────────────────────────

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

  const monthLabel = DateTime.local(viewYear, viewMonth + 1, 1).toFormat("MMMM yyyy");
  const monthKey   = `${viewYear}-${viewMonth}`;
  const isCurrentMonthView = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  return (
    <DashboardPageWrapper>
    <PageShell maxWidth="6xl">
    <div className="space-y-6 pb-24 md:pb-6">

      {/* ── Header ────────────────────────────────────────────── */}
      <PageHeader
        icon={Calendar}
        title="Calendar"
        subtitle="View upcoming events and keep Weebo in sync with your schedule."
        badge={
          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-[var(--ag-cal)]/10 border border-[var(--ag-cal)]/30 text-[var(--ag-cal)]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--ag-cal)] opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--ag-cal)]" />
            </span>
            Cal
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setShowAddDialog(true)}
              className="gap-1.5 min-h-[44px] bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-cyan)] text-white hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50 transition-all duration-300"
              style={{ transition: "opacity 200ms, transform 150ms" }}
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
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        }
      />

      {/* ── Error ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400 flex items-center gap-2"
          >
            <X className="h-4 w-4 shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Connection status ──────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.05 }}>
        <div
          className="rounded-xl p-4 border"
          style={{
            background: 'var(--ag-bg-surface)',
            backdropFilter: 'blur(16px)',
            borderColor: 'var(--ag-border-subtle)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.25), 0 0 0 1px var(--ag-border-subtle)',
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
                <p className="text-xs text-[var(--ag-text-secondary)]">Contact your administrator to enable Google Calendar integration.</p>
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
                <Button variant="outline" size="sm" onClick={() => void handleSync()} disabled={syncing}
                  className="gap-1.5 min-h-[44px] border-[var(--ag-border-default)] focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50">
                  <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "Syncing…" : "Sync Now"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => void handleDisconnect()} disabled={disconnecting}
                  className="gap-1.5 text-red-400 hover:text-red-300 border-red-500/30 hover:border-red-500/50 min-h-[44px] focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50">
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
                  <p className="text-xs text-[var(--ag-text-secondary)]">Connect your Google account to see upcoming events.</p>
                </div>
              </div>
              <Button size="sm" onClick={() => void handleConnect()}
                className="gap-1.5 shrink-0 min-h-[44px] bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-cyan)] text-white hover:opacity-90 font-semibold focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50">
                <Link2 className="h-3.5 w-3.5" />
                Connect Google Calendar
                <ExternalLink className="h-3 w-3 opacity-60" />
              </Button>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Main layout ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">

        {/* ── Left: Calendar grid + selected day panel ──────── */}
        <div className="space-y-4">

          {/* Calendar glass container */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: 'var(--ag-bg-surface)',
                backdropFilter: 'blur(20px)',
                boxShadow: [
                  '0 0 0 1px var(--ag-border-subtle)',
                  '0 8px 32px rgba(0,0,0,0.35)',
                  '0 0 60px rgba(139,92,246,0.05)',
                  'inset 0 1px 0 rgba(255,255,255,0.04)',
                ].join(', '),
              }}
            >
              {/* Month navigation */}
              <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--ag-border-subtle)' }}>
                <button
                  onClick={goToPrevMonth}
                  aria-label="Previous month"
                  className="flex items-center justify-center rounded-lg transition-all duration-150 hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50 focus-visible:outline-none"
                  style={{ width: 44, height: 44, background: 'transparent' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ag-bg-elevated)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <ChevronLeft className="h-5 w-5 text-[var(--ag-text-secondary)]" />
                </button>

                <div className="flex items-center gap-3">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.h2
                      key={monthKey}
                      initial={navDir === "next" ? { opacity: 0, x: 20 } : { opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={navDir === "next" ? { opacity: 0, x: -20 } : { opacity: 0, x: 20 }}
                      transition={{ type: "spring", duration: 0.3, bounce: 0 }}
                      className="font-heading font-semibold text-[var(--ag-text-primary)] select-none"
                      style={{ fontSize: '1.0625rem', fontVariantNumeric: 'tabular-nums' }}
                    >
                      {monthLabel}
                    </motion.h2>
                  </AnimatePresence>
                  {!isCurrentMonthView && (
                    <button
                      onClick={goToToday}
                      className="text-xs px-2.5 py-1 rounded-md border transition-all duration-150 hover:scale-105 active:scale-95"
                      style={{
                        borderColor: 'var(--ag-border-default)',
                        color: 'var(--ag-text-secondary)',
                        background: 'var(--ag-bg-elevated)',
                        minHeight: '28px',
                      }}
                    >
                      Today
                    </button>
                  )}
                </div>

                <button
                  onClick={goToNextMonth}
                  aria-label="Next month"
                  className="flex items-center justify-center rounded-lg transition-all duration-150 hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50 focus-visible:outline-none"
                  style={{ width: 44, height: 44, background: 'transparent' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ag-bg-elevated)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <ChevronRight className="h-5 w-5 text-[var(--ag-text-secondary)]" />
                </button>
              </div>

              {/* Day-of-week headers */}
              <div className="grid grid-cols-7 px-2 pt-2 pb-1">
                {DAY_NAMES_SHORT.map((d, i) => (
                  <div key={i} className="flex items-center justify-center"
                    style={{ height: 28 }}>
                    <span className="hidden sm:block text-xs font-medium text-[var(--ag-text-muted)] uppercase tracking-wide select-none">
                      {DAY_NAMES_FULL[i]}
                    </span>
                    <span className="sm:hidden text-xs font-medium text-[var(--ag-text-muted)] uppercase tracking-wide select-none">
                      {d}
                    </span>
                  </div>
                ))}
              </div>

              {/* Grid with animated month transition */}
              <div className="px-2 pb-3 overflow-hidden">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={monthKey}
                    initial={navDir === "next" ? monthVariants.enterNext : monthVariants.enterPrev}
                    animate={monthVariants.center}
                    exit={navDir === "next" ? monthVariants.exitNext : monthVariants.exitPrev}
                    transition={{ type: "spring", duration: 0.35, bounce: 0 }}
                    className="grid grid-cols-7 gap-0.5"
                  >
                    {gridCells.map((cell, idx) => {
                      const key          = dateKey(cell.date);
                      const isToday      = isSameDay(cell.date, today);
                      const isSelected   = isSameDay(cell.date, selectedDate);
                      const dayEvs       = eventsByDate.get(key) ?? [];
                      const dayRems      = remindersByDate.get(key) ?? [];
                      const totalDots    = dayEvs.length + dayRems.length;
                      const showDots     = totalDots > 0;

                      // Collect dot colors (max 3 before overflow)
                      const dotItems: Array<{ color: string }> = [];
                      for (const ev of dayEvs) {
                        const cat = (ev.category ?? 'personal') as EventCategory;
                        const cfg = CATEGORY_CONFIG[cat] ?? CATEGORY_CONFIG.personal;
                        dotItems.push({ color: cfg.dot });
                      }
                      for (const _r of dayRems) {
                        dotItems.push({ color: REMINDER_COLOR });
                      }
                      const visibleDots = dotItems.slice(0, 3);
                      const overflow    = totalDots > 3 ? totalDots - 3 : 0;

                      return (
                        <button
                          key={idx}
                          onClick={() => setSelectedDate(cell.date)}
                          aria-label={`${cell.day} ${monthLabel}`}
                          aria-pressed={isSelected}
                          className="relative flex flex-col items-center justify-start rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/60 transition-all duration-150 group"
                          style={{
                            minHeight: 44,
                            paddingTop: 6,
                            paddingBottom: 6,
                            background: isToday
                              ? 'rgba(139,92,246,0.08)'
                              : isSelected
                              ? 'var(--ag-active-bg)'
                              : 'transparent',
                            boxShadow: isToday
                              ? '0 0 0 1.5px rgba(139,92,246,0.5), 0 0 12px rgba(139,92,246,0.15)'
                              : isSelected && !isToday
                              ? '0 0 0 1px var(--ag-border-active)'
                              : 'none',
                          }}
                          onMouseEnter={(e) => {
                            if (!isToday && !isSelected) {
                              e.currentTarget.style.background = 'var(--ag-bg-elevated)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isToday && !isSelected) {
                              e.currentTarget.style.background = 'transparent';
                            }
                          }}
                        >
                          {/* Date number */}
                          <span
                            className="leading-none select-none"
                            style={{
                              fontSize: '0.8125rem',
                              fontWeight: isToday ? 700 : isSelected ? 600 : 500,
                              fontVariantNumeric: 'tabular-nums',
                              color: isToday
                                ? 'var(--ag-violet)'
                                : cell.isCurrentMonth
                                ? isSelected
                                  ? 'var(--ag-text-primary)'
                                  : 'var(--ag-text-primary)'
                                : 'var(--ag-text-muted)',
                              opacity: cell.isCurrentMonth ? 1 : 0.3,
                            }}
                          >
                            {cell.day}
                          </span>

                          {/* Event dots */}
                          {showDots && (
                            <div className="flex items-center gap-0.5 mt-1">
                              {visibleDots.map((dot, di) => (
                                <span
                                  key={di}
                                  className="rounded-full shrink-0"
                                  style={{
                                    width: 4,
                                    height: 4,
                                    background: dot.color,
                                    opacity: cell.isCurrentMonth ? 1 : 0.3,
                                  }}
                                />
                              ))}
                              {overflow > 0 && (
                                <span
                                  className="leading-none"
                                  style={{
                                    fontSize: '0.5rem',
                                    color: 'var(--ag-text-muted)',
                                    opacity: cell.isCurrentMonth ? 0.8 : 0.3,
                                  }}
                                >
                                  +{overflow}
                                </span>
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Legend */}
              <div
                className="flex items-center gap-5 px-4 py-2.5 border-t text-xs text-[var(--ag-text-muted)]"
                style={{ borderColor: 'var(--ag-border-subtle)' }}
              >
                {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                  <div key={key} className="flex items-center gap-1.5 select-none">
                    <span className="rounded-full shrink-0" style={{ width: 6, height: 6, background: cfg.dot }} />
                    <span>{cfg.label}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1.5 select-none">
                  <span className="rounded-full shrink-0" style={{ width: 6, height: 6, background: REMINDER_COLOR }} />
                  <span>Reminders</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── Selected day detail panel ───────────────────── */}
          <AnimatePresence mode="wait">
            <motion.div
              key={dateKey(selectedDate)}
              variants={panelVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <div
                className="rounded-xl overflow-hidden"
                style={{
                  background: 'var(--ag-bg-surface)',
                  backdropFilter: 'blur(16px)',
                  boxShadow: [
                    '0 0 0 1px var(--ag-border-subtle)',
                    '0 4px 16px rgba(0,0,0,0.25)',
                  ].join(', '),
                }}
              >
                {/* Panel header */}
                <div
                  className="flex items-center gap-2.5 px-4 py-3 border-b"
                  style={{ borderColor: 'var(--ag-border-subtle)' }}
                >
                  <div
                    className="flex items-center justify-center rounded-lg shrink-0"
                    style={{ width: 32, height: 32, background: 'rgba(139,92,246,0.1)' }}
                  >
                    <Clock className="h-4 w-4 text-[var(--ag-violet)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-heading font-semibold text-[var(--ag-text-primary)] text-sm">
                      {isSameDay(selectedDate, today)
                        ? "Today"
                        : DateTime.fromJSDate(selectedDate).toLocaleString({ weekday: 'long', month: 'long', day: 'numeric' })}
                    </h3>
                    <p className="text-xs text-[var(--ag-text-muted)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {DateTime.fromJSDate(selectedDate).toLocaleString({ year: 'numeric', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  {(selectedDayEvents.length + selectedDayReminders.length) > 0 && (
                    <Badge
                      variant="secondary"
                      className="text-xs font-medium"
                      style={{
                        background: 'rgba(139,92,246,0.12)',
                        color: 'var(--ag-violet)',
                        border: '1px solid rgba(139,92,246,0.25)',
                      }}
                    >
                      {selectedDayEvents.length + selectedDayReminders.length}
                    </Badge>
                  )}
                </div>

                {/* Panel body */}
                <div className="p-3">
                  {selectedDayEvents.length === 0 && selectedDayReminders.length === 0 ? (
                    <div className="py-8 flex flex-col items-center gap-3 text-center">
                      <div
                        className="flex items-center justify-center rounded-xl"
                        style={{ width: 48, height: 48, background: 'var(--ag-bg-elevated)' }}
                      >
                        <CalendarDays className="h-5 w-5 text-[var(--ag-text-muted)]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[var(--ag-text-secondary)]">Nothing scheduled</p>
                        <p className="text-xs text-[var(--ag-text-muted)] mt-0.5">Free day — no events or reminders.</p>
                      </div>
                      <button
                        onClick={() => {
                          setManualDate(dateKey(selectedDate));
                          setAddMode("manual");
                          setShowAddDialog(true);
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 transition-all duration-150 hover:scale-105 active:scale-95"
                        style={{
                          minHeight: 36,
                          border: '1px solid var(--ag-border-default)',
                          color: 'var(--ag-text-secondary)',
                          background: 'var(--ag-bg-elevated)',
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Event
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {/* Events */}
                      {selectedDayEvents
                        .sort((a, b) => toMs(a.start_time) - toMs(b.start_time))
                        .map((ev) => {
                          const isExpanded = expandedEventId === ev.id;
                          const cat        = (ev.category ?? 'personal') as EventCategory;
                          const cfg        = CATEGORY_CONFIG[cat] ?? CATEGORY_CONFIG.personal;

                          return (
                            <div key={ev.id}>
                              <button
                                onClick={() => setExpandedEventId(isExpanded ? null : ev.id)}
                                className="w-full rounded-lg flex items-start gap-3 text-left transition-all duration-150 focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50 focus-visible:outline-none"
                                style={{
                                  padding: '10px 12px',
                                  background: isExpanded ? 'var(--ag-active-bg)' : 'var(--ag-bg-elevated)',
                                  border: `1px solid ${isExpanded ? 'var(--ag-border-active)' : 'var(--ag-border-subtle)'}`,
                                  minHeight: 44,
                                }}
                                onMouseEnter={(e) => {
                                  if (!isExpanded) e.currentTarget.style.borderColor = 'var(--ag-border-default)';
                                }}
                                onMouseLeave={(e) => {
                                  if (!isExpanded) e.currentTarget.style.borderColor = 'var(--ag-border-subtle)';
                                }}
                              >
                                {/* Category color strip */}
                                <span
                                  className="shrink-0 rounded-full mt-0.5"
                                  style={{ width: 3, height: 36, background: cfg.dot, minHeight: 36 }}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium leading-snug truncate text-[var(--ag-text-primary)]">
                                      {ev.title}
                                    </p>
                                    {ev.isLocal && (
                                      <span
                                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0"
                                        style={{ background: cfg.bg, color: cfg.text }}
                                      >
                                        {cfg.label}
                                      </span>
                                    )}
                                  </div>
                                  <p
                                    className="text-xs mt-0.5"
                                    style={{ color: 'var(--ag-text-secondary)', fontVariantNumeric: 'tabular-nums' }}
                                  >
                                    {formatTime(ev.start_time)}
                                    {ev.end_time ? ` – ${formatTime(ev.end_time)}` : ""}
                                  </p>
                                </div>
                                <ChevronRight
                                  className="h-3.5 w-3.5 shrink-0 mt-1 transition-transform duration-200"
                                  style={{
                                    color: 'var(--ag-text-muted)',
                                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                  }}
                                />
                              </button>

                              {/* Expanded details */}
                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                  >
                                    <div
                                      className="ml-[19px] mt-1 rounded-lg p-3 space-y-2 text-sm"
                                      style={{
                                        background: 'var(--ag-bg-elevated)',
                                        border: '1px solid var(--ag-border-subtle)',
                                        borderRadius: 8, // concentric: parent 12px - parent padding ~4px
                                      }}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span style={{ color: 'var(--ag-text-muted)', fontSize: '0.75rem' }}>Time</span>
                                        <span
                                          className="text-xs text-[var(--ag-text-primary)]"
                                          style={{ fontVariantNumeric: 'tabular-nums' }}
                                        >
                                          {formatTime(ev.start_time)}
                                          {ev.end_time ? ` – ${formatTime(ev.end_time)}` : ""}
                                        </span>
                                      </div>
                                      {ev.end_time && (
                                        <div className="flex items-center gap-2">
                                          <span style={{ color: 'var(--ag-text-muted)', fontSize: '0.75rem' }}>Duration</span>
                                          <span
                                            className="text-xs text-[var(--ag-text-primary)]"
                                            style={{ fontVariantNumeric: 'tabular-nums' }}
                                          >
                                            {Math.round((toMs(ev.end_time) - toMs(ev.start_time)) / 60000)}m
                                          </span>
                                        </div>
                                      )}
                                      {ev.category && (
                                        <div className="flex items-center gap-2">
                                          <span style={{ color: 'var(--ag-text-muted)', fontSize: '0.75rem' }}>Category</span>
                                          <span
                                            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                                            style={{ background: cfg.bg, color: cfg.text }}
                                          >
                                            {cfg.label}
                                          </span>
                                        </div>
                                      )}
                                      {ev.isLocal && (
                                        <button
                                          onClick={() => handleDeleteLocalEvent(ev.id)}
                                          className="inline-flex items-center gap-1.5 text-xs font-medium rounded-md px-3 transition-all duration-150 hover:scale-105 active:scale-95"
                                          style={{
                                            minHeight: 32,
                                            color: '#f87171',
                                            border: '1px solid rgba(239,68,68,0.3)',
                                            background: 'transparent',
                                          }}
                                        >
                                          <X className="h-3 w-3" />
                                          Delete Event
                                        </button>
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}

                      {/* Reminders */}
                      {selectedDayReminders.map((r) => (
                        <div
                          key={r.id}
                          className="rounded-lg flex items-start gap-3"
                          style={{
                            padding: '10px 12px',
                            background: 'var(--ag-bg-elevated)',
                            border: '1px solid var(--ag-border-subtle)',
                            minHeight: 44,
                          }}
                        >
                          <span
                            className="shrink-0 rounded-full mt-0.5"
                            style={{ width: 3, height: 36, background: REMINDER_COLOR, minHeight: 36 }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium leading-snug truncate text-[var(--ag-text-primary)]">{r.text}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-xs" style={{ color: 'var(--ag-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                                {r.datetime ? formatTime(new Date(r.datetime).getTime()) : "All day"}
                              </p>
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-1.5 py-0.5"
                                style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--ag-amber)' }}>
                                <Bell className="h-2.5 w-2.5" />
                                Reminder
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Right sidebar ────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Upcoming events */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <SectionCard className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)] rounded-xl">
              <div className="flex items-center gap-2 mb-4">
                <div
                  className="flex items-center justify-center rounded-lg"
                  style={{ width: 28, height: 28, background: 'rgba(139,92,246,0.1)' }}
                >
                  <CalendarDays className="h-3.5 w-3.5 text-[var(--ag-violet)]" />
                </div>
                <h2 className="text-sm font-heading font-semibold text-[var(--ag-text-primary)]">Upcoming</h2>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-14 rounded-lg animate-pulse" style={{ background: 'var(--ag-bg-elevated)' }} />
                  ))}
                </div>
              ) : upcomingEvents.length === 0 ? (
                <div className="py-6 text-center">
                  <Calendar className="mx-auto h-6 w-6 mb-2" style={{ color: 'var(--ag-text-muted)', opacity: 0.3 }} />
                  <p className="text-sm text-[var(--ag-text-secondary)]">No upcoming events.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {upcomingEvents.map((ev, i) => {
                    const ms  = toMs(ev.start_time);
                    const cat = (ev.category ?? 'personal') as EventCategory;
                    const cfg = CATEGORY_CONFIG[cat] ?? CATEGORY_CONFIG.personal;

                    return (
                      <motion.div
                        key={ev.id}
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.25 + i * 0.06, duration: 0.3 }}
                        className="rounded-lg flex items-start gap-3 transition-all duration-150"
                        style={{
                          padding: '10px 12px',
                          background: 'var(--ag-bg-elevated)',
                          border: '1px solid var(--ag-border-subtle)',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--ag-border-default)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--ag-border-subtle)'; }}
                      >
                        <span
                          className="shrink-0 rounded-full mt-0.5"
                          style={{ width: 3, height: 32, background: cfg.dot, minHeight: 32 }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-snug truncate text-[var(--ag-text-primary)]">{ev.title}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <p className="text-xs text-[var(--ag-text-secondary)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {DateTime.fromMillis(ms).toLocaleString({ month: 'short', day: 'numeric' })} · {formatTime(ms)}
                            </p>
                            <span className="text-xs font-medium" style={{ color: cfg.dot }}>
                              {relativeCountdown(ms)}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </motion.div>

          {/* How it works (when not connected) */}
          {!loading && !status?.connected && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              <SectionCard className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)] rounded-xl">
                <div className="flex items-center gap-2 mb-4">
                  <div
                    className="flex items-center justify-center rounded-lg"
                    style={{ width: 28, height: 28, background: 'rgba(139,92,246,0.1)' }}
                  >
                    <Sparkles className="h-3.5 w-3.5 text-[var(--ag-violet)]" />
                  </div>
                  <h2 className="text-sm font-heading font-semibold text-[var(--ag-text-primary)]">How It Works</h2>
                </div>
                <div className="space-y-3">
                  {[
                    { title: "Connect your Google account", desc: "Click \"Connect Google Calendar\" above to authorise read-only access via OAuth." },
                    { title: "Events are pulled automatically", desc: "Weebo syncs your upcoming events so they appear in your dashboard." },
                    { title: "Context-aware responses",         desc: "Weebo uses your calendar context to give smarter briefings and reminders." },
                    { title: "You stay in control",             desc: "Disconnect at any time. Only read access is requested — Weebo never modifies your calendar." },
                  ].map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.35 + i * 0.05, duration: 0.25 }}
                      className="flex items-start gap-3"
                    >
                      <div
                        className="flex items-center justify-center rounded-full shrink-0 mt-0.5"
                        style={{ width: 20, height: 20, background: 'rgba(139,92,246,0.1)' }}
                      >
                        <CheckCircle className="h-3 w-3 text-[var(--ag-violet)]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[var(--ag-text-primary)]">{item.title}</p>
                        <p className="text-xs text-[var(--ag-text-secondary)] mt-0.5">{item.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </SectionCard>
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Add Event Dialog ──────────────────────────────────── */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Event</DialogTitle>
            <DialogDescription>
              Create a local calendar event with natural language or manual fields.
            </DialogDescription>
          </DialogHeader>

          <div
            className="flex gap-1.5 p-1 rounded-xl"
            style={{ background: 'var(--ag-bg-elevated)' }}
          >
            {(["natural", "manual"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setAddMode(mode)}
                className="flex-1 text-sm py-2.5 rounded-lg transition-all duration-150 font-medium capitalize focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50 focus-visible:outline-none"
                style={{
                  minHeight: 44,
                  background: addMode === mode ? 'var(--ag-bg-surface)' : 'transparent',
                  color: addMode === mode ? 'var(--ag-text-primary)' : 'var(--ag-text-muted)',
                  boxShadow: addMode === mode ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
                }}
              >
                {mode === "natural" ? "Natural Language" : "Manual"}
              </button>
            ))}
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
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddEvent(); } }}
                  autoFocus
                />
                <p className="text-xs text-[var(--ag-text-muted)]">
                  Supports: "tomorrow", "today", "next Monday", "at 2pm", "for 30 min"
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="event-title">Title</Label>
                <Input id="event-title" placeholder="Event title" value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="event-date">Date</Label>
                  <Input id="event-date" type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event-time">Time</Label>
                  <Input id="event-time" type="time" value={manualTime} onChange={(e) => setManualTime(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="event-duration">Duration (min)</Label>
                  <Input id="event-duration" type="number" min="5" max="480" value={manualDuration} onChange={(e) => setManualDuration(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={manualCategory} onValueChange={(v) => setManualCategory(v as EventCategory)}>
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                        <SelectItem key={key} value={key}>
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ background: cfg.dot }} />
                            {cfg.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)} className="min-h-[44px]">Cancel</Button>
            <Button
              onClick={handleAddEvent}
              disabled={addMode === "natural" ? !nlInput.trim() : !manualTitle.trim() || !manualDate}
              className="min-h-[44px] bg-gradient-to-r from-[var(--ag-violet)] to-[var(--ag-cyan)] text-white hover:opacity-90"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── AI Assistant FAB ──────────────────────────────────── */}
      <motion.button
        onClick={() => setShowAI((v) => !v)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.94 }}
        className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-50 flex items-center justify-center rounded-full"
        style={{
          width: 56, height: 56,
          background: 'linear-gradient(135deg, var(--ag-violet), var(--ag-cyan))',
          boxShadow: '0 4px 20px rgba(139,92,246,0.35), 0 0 0 1px rgba(139,92,246,0.2)',
          transition: 'box-shadow 200ms',
        }}
        aria-label={showAI ? "Close AI assistant" : "Open AI assistant"}
      >
        <AnimatePresence mode="wait" initial={false}>
          {showAI ? (
            <motion.span key="x" initial={{ opacity: 0, scale: 0.5, rotate: -90 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} exit={{ opacity: 0, scale: 0.5, rotate: 90 }} transition={{ type: "spring", duration: 0.3, bounce: 0 }}>
              <X className="h-6 w-6 text-white" />
            </motion.span>
          ) : (
            <motion.span key="spark" initial={{ opacity: 0, scale: 0.5, rotate: 90 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} exit={{ opacity: 0, scale: 0.5, rotate: -90 }} transition={{ type: "spring", duration: 0.3, bounce: 0 }}>
              <Sparkles className="h-6 w-6 text-white" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* ── AI Assistant Panel ────────────────────────────────── */}
      <AnimatePresence>
        {showAI && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0 }}
            className="fixed z-40 flex flex-col overflow-hidden
              bottom-0 left-0 right-0 h-[80vh] rounded-t-2xl
              md:bottom-6 md:left-auto md:right-24 md:top-auto md:w-[400px] md:h-[560px] md:rounded-2xl"
            style={{
              background: 'var(--ag-bg-surface)',
              backdropFilter: 'blur(24px)',
              boxShadow: [
                '0 -8px 40px rgba(0,0,0,0.5)',
                '0 0 60px rgba(139,92,246,0.08)',
                '0 0 0 1px var(--ag-border-default)',
              ].join(', '),
            }}
          >
            {/* Panel header */}
            <div
              className="flex items-center gap-2.5 px-4 py-3 border-b shrink-0"
              style={{ borderColor: 'var(--ag-border-subtle)' }}
            >
              <div
                className="flex items-center justify-center rounded-lg shrink-0"
                style={{ width: 32, height: 32, background: 'rgba(139,92,246,0.1)' }}
              >
                <Sparkles className="h-4 w-4 text-[var(--ag-violet)]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-heading font-semibold text-[var(--ag-text-primary)]">Calendar AI</h3>
                <p className="text-xs text-[var(--ag-text-secondary)] truncate">Ask about your schedule</p>
              </div>
              <button
                onClick={() => setShowAI(false)}
                className="flex items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50 focus-visible:outline-none"
                style={{ width: 44, height: 44 }}
                aria-label="Close AI panel"
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <X className="h-4 w-4 text-[var(--ag-text-secondary)]" />
              </button>
            </div>

            {/* Quick actions */}
            <div className="flex flex-wrap gap-2 px-4 py-3 border-b shrink-0" style={{ borderColor: 'rgba(139,92,246,0.08)' }}>
              {[
                { label: "Find free time",  prompt: "Find me some free time slots this week for a 1-hour meeting" },
                { label: "Block focus time", prompt: "Block 2 hours of focus time tomorrow morning on my calendar" },
                { label: "What's next?",    prompt: "What's my next upcoming event on my calendar?" },
              ].map((action) => (
                <button
                  key={action.label}
                  onClick={() => void askCalendarAI(action.prompt)}
                  disabled={aiLoading}
                  className="px-3 rounded-full text-xs font-medium border transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                  style={{
                    minHeight: 36,
                    background: 'rgba(139,92,246,0.06)',
                    borderColor: 'rgba(139,92,246,0.15)',
                    color: 'var(--ag-violet)',
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>

            {/* Response area */}
            <div ref={aiResponseRef} className="flex-1 overflow-y-auto px-4 py-3 text-sm leading-relaxed">
              {aiLoading ? (
                <div className="flex items-center gap-2 text-[var(--ag-text-secondary)] py-8 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-[var(--ag-violet)]" />
                  <span>Thinking…</span>
                </div>
              ) : aiResponse ? (
                <div className="text-[var(--ag-text-primary)] whitespace-pre-wrap">{aiResponse}</div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center py-8 gap-3">
                  <div
                    className="flex items-center justify-center rounded-xl"
                    style={{ width: 48, height: 48, background: 'rgba(139,92,246,0.08)' }}
                  >
                    <Calendar className="h-6 w-6" style={{ color: 'rgba(139,92,246,0.6)' }} />
                  </div>
                  <p className="text-[var(--ag-text-secondary)] text-xs max-w-[240px]">
                    Ask me to find free slots, schedule meetings, or check what is coming up.
                  </p>
                </div>
              )}
            </div>

            {/* Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = aiInput.trim();
                if (!trimmed || aiLoading) return;
                setAiInput("");
                void askCalendarAI(trimmed);
              }}
              className="flex items-center gap-2 px-3 py-3 border-t shrink-0"
              style={{ borderColor: 'var(--ag-border-subtle)', background: 'var(--ag-bg-surface)' }}
            >
              <input
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="Ask about your calendar…"
                disabled={aiLoading}
                className="flex-1 rounded-lg px-3 py-2.5 text-sm outline-none transition-colors disabled:opacity-50"
                style={{
                  minHeight: 44,
                  background: 'var(--ag-bg-elevated)',
                  border: '1px solid var(--ag-border-subtle)',
                  color: 'var(--ag-text-primary)',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--ag-border-subtle)'; }}
              />
              <button
                type="submit"
                disabled={!aiInput.trim() || aiLoading}
                className="flex items-center justify-center rounded-lg transition-all duration-150 disabled:opacity-30 hover:scale-105 active:scale-95"
                style={{
                  width: 44, height: 44,
                  background: aiInput.trim()
                    ? 'linear-gradient(135deg, var(--ag-violet), var(--ag-cyan))'
                    : 'rgba(139,92,246,0.08)',
                }}
                aria-label="Send message"
              >
                <Send className="h-4 w-4 text-white" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
    </PageShell>
    </DashboardPageWrapper>
  );
}
