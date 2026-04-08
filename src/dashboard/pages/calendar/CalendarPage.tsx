// CalendarPage.tsx — state, data fetching, view orchestration
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageShell, PageHeader, SectionCard } from '@/components/agentin';
import { DashboardPageWrapper } from '@/components/agentin';
import { useAgentCanvas } from '@/hooks/use-agent-canvas';
import {
  Calendar,
  RefreshCw,
  Plus,
  X,
  Sparkles,
  Send,
  Loader2,
  CalendarDays,
  CheckCircle,
} from "lucide-react";
import { DateTime } from 'luxon';
import api, { agentService } from "@/services/api";

import type {
  CalendarStatus,
  CalendarEvent,
  ReminderItem,
  LocalEvent,
  EventCategory,
} from "./helpers";
import {
  CATEGORY_CONFIG,
  toMs,
  formatTime,
  dateKey,
} from "./helpers";
import { MonthGrid }      from "./MonthGrid";
import { AgendaView }     from "./AgendaView";
import { AddEventDialog } from "./AddEventDialog";
import { SyncBar }        from "./SyncBar";

export function CalendarPage() {
  const { notifyDone, notifyFail } = useAgentCanvas({ agent: 'cal', page: 'calendar' });

  const [status,       setStatus]       = useState<CalendarStatus | null>(null);
  const [events,       setEvents]       = useState<CalendarEvent[]>([]);
  const [reminders,    setReminders]    = useState<ReminderItem[]>([]);
  const [localEvents,  setLocalEvents]  = useState<LocalEvent[]>(() => {
    try {
      const saved = localStorage.getItem("agentin_local_events");
      return saved ? (JSON.parse(saved) as LocalEvent[]) : [];
    } catch { return []; }
  });

  const [loading,       setLoading]       = useState(true);
  const [syncing,       setSyncing]       = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [refreshing,    setRefreshing]    = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  const today                            = useMemo(() => new Date(), []);
  const [viewYear,     setViewYear]      = useState(today.getFullYear());
  const [viewMonth,    setViewMonth]     = useState(today.getMonth());
  const [selectedDate, setSelectedDate]  = useState<Date>(today);
  const [navDir,       setNavDir]        = useState<"next" | "prev">("next");

  const [showAddDialog,       setShowAddDialog]       = useState(false);
  const [addEventInitialDate, setAddEventInitialDate] = useState("");
  const [expandedEventId,     setExpandedEventId]     = useState<string | number | null>(null);

  const [showAI,     setShowAI]     = useState(false);
  const [aiInput,    setAiInput]    = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading,  setAiLoading]  = useState(false);
  const aiResponseRef               = useRef<HTMLDivElement>(null);

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
        setReminders(Array.isArray(remindersData) ? remindersData.filter((r) => !r.completed) : []);
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
    if (aiResponse && aiResponseRef.current)
      aiResponseRef.current.scrollTop = aiResponseRef.current.scrollHeight;
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

  function handleAddEvent(ev: LocalEvent) {
    setLocalEvents((prev) => [...prev, ev]);
    void notifyDone(`Event created: ${ev.title}`);
  }

  function handleDeleteLocalEvent(id: string | number) {
    setLocalEvents((prev) => prev.filter((e) => e.id !== id));
    setExpandedEventId(null);
  }

  const allEvents = useMemo<CalendarEvent[]>(() => [
    ...events.map((e) => ({ ...e, isLocal: false })),
    ...localEvents,
  ], [events, localEvents]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of allEvents) {
      const key = dateKey(new Date(toMs(ev.start_time)));
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

  const selectedDayEvents    = useMemo(() => eventsByDate.get(dateKey(selectedDate))    ?? [], [selectedDate, eventsByDate]);
  const selectedDayReminders = useMemo(() => remindersByDate.get(dateKey(selectedDate)) ?? [], [selectedDate, remindersByDate]);

  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    return allEvents
      .filter((e) => toMs(e.start_time) > now)
      .sort((a, b) => toMs(a.start_time) - toMs(b.start_time))
      .slice(0, 3);
  }, [allEvents]);

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

  const monthLabel         = DateTime.local(viewYear, viewMonth + 1, 1).toFormat("MMMM yyyy");
  const monthKey           = `${viewYear}-${viewMonth}`;
  const isCurrentMonthView = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  return (
    <DashboardPageWrapper>
    <PageShell maxWidth="6xl">
    <div className="space-y-6 pb-24 md:pb-6">

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
            <button
              onClick={() => { setAddEventInitialDate(""); setShowAddDialog(true); }}
              className="inline-flex items-center gap-1.5 px-3 rounded-lg font-medium text-sm text-white hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50 transition-all duration-300"
              style={{ minHeight: 44, background: 'linear-gradient(to right, var(--ag-violet), var(--ag-cyan))' }}
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Event</span>
            </button>
            <button
              onClick={() => void fetchData(true)}
              disabled={refreshing}
              aria-label="Refresh"
              className="flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--ag-bg-surface)] focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50"
              style={{ minWidth: 44, minHeight: 44 }}
            >
              <RefreshCw className={`h-4 w-4 text-[var(--ag-text-secondary)] ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        }
      />

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400 flex items-center gap-2"
          >
            <X className="h-4 w-4 shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.05 }}>
        <SyncBar
          status={status}
          loading={loading}
          syncing={syncing}
          disconnecting={disconnecting}
          onSync={() => void handleSync()}
          onDisconnect={() => void handleDisconnect()}
          onConnect={() => void handleConnect()}
        />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">

        <div className="space-y-4">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
            <MonthGrid
              viewYear={viewYear}
              viewMonth={viewMonth}
              navDir={navDir}
              today={today}
              selectedDate={selectedDate}
              eventsByDate={eventsByDate}
              remindersByDate={remindersByDate}
              monthLabel={monthLabel}
              monthKey={monthKey}
              isCurrentMonthView={isCurrentMonthView}
              onPrevMonth={goToPrevMonth}
              onNextMonth={goToNextMonth}
              onToday={goToToday}
              onSelectDate={setSelectedDate}
            />
          </motion.div>

          <AgendaView
            selectedDate={selectedDate}
            today={today}
            selectedDayEvents={selectedDayEvents}
            selectedDayReminders={selectedDayReminders}
            expandedEventId={expandedEventId}
            onToggleExpand={(id) => setExpandedEventId(expandedEventId === id ? null : id)}
            onDeleteLocalEvent={handleDeleteLocalEvent}
            onOpenAddEvent={(dateStr) => {
              setAddEventInitialDate(dateStr);
              setShowAddDialog(true);
            }}
          />
        </div>

        <div className="space-y-4">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
            <SectionCard className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)] rounded-xl">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center justify-center rounded-lg" style={{ width: 28, height: 28, background: 'rgba(139,92,246,0.1)' }}>
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
                        initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.25 + i * 0.06, duration: 0.3 }}
                        className="rounded-lg flex items-start gap-3 transition-all duration-150"
                        style={{ padding: '10px 12px', background: 'var(--ag-bg-elevated)', border: '1px solid var(--ag-border-subtle)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--ag-border-default)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--ag-border-subtle)'; }}
                      >
                        <span className="shrink-0 rounded-full mt-0.5" style={{ width: 3, height: 32, background: cfg.dot, minHeight: 32 }} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-snug truncate text-[var(--ag-text-primary)]">{ev.title}</p>
                          <p className="text-xs text-[var(--ag-text-secondary)] mt-0.5" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {DateTime.fromMillis(ms).toLocaleString({ month: 'short', day: 'numeric' })} · {formatTime(ms)}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </motion.div>

          {!loading && !status?.connected && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}>
              <SectionCard className="bg-[var(--ag-bg-surface)] backdrop-blur-xl border-[var(--ag-border-subtle)] rounded-xl">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex items-center justify-center rounded-lg" style={{ width: 28, height: 28, background: 'rgba(139,92,246,0.1)' }}>
                    <Sparkles className="h-3.5 w-3.5 text-[var(--ag-violet)]" />
                  </div>
                  <h2 className="text-sm font-heading font-semibold text-[var(--ag-text-primary)]">How It Works</h2>
                </div>
                <div className="space-y-3">
                  {[
                    { title: "Connect your Google account",    desc: 'Click "Connect Google Calendar" above to authorise read-only access via OAuth.' },
                    { title: "Events are pulled automatically", desc: "Weebo syncs your upcoming events so they appear in your dashboard." },
                    { title: "Context-aware responses",         desc: "Weebo uses your calendar context to give smarter briefings and reminders." },
                    { title: "You stay in control",             desc: "Disconnect at any time. Only read access is requested — Weebo never modifies your calendar." },
                  ].map((item, i) => (
                    <motion.div key={i} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 + i * 0.05, duration: 0.25 }} className="flex items-start gap-3">
                      <div className="flex items-center justify-center rounded-full shrink-0 mt-0.5" style={{ width: 20, height: 20, background: 'rgba(139,92,246,0.1)' }}>
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

      <AddEventDialog
        key={addEventInitialDate}
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        initialDate={addEventInitialDate || undefined}
        onAdd={handleAddEvent}
      />

      <motion.button
        onClick={() => setShowAI((v) => !v)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.94 }}
        className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-50 flex items-center justify-center rounded-full"
        style={{
          width: 56, height: 56,
          background: 'linear-gradient(135deg, var(--ag-violet), var(--ag-cyan))',
          boxShadow: '0 4px 20px rgba(139,92,246,0.35), 0 0 0 1px rgba(139,92,246,0.2)',
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

      <AnimatePresence>
        {showAI && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0 }}
            className="fixed z-40 flex flex-col overflow-hidden bottom-0 left-0 right-0 h-[80vh] rounded-t-2xl md:bottom-6 md:left-auto md:right-24 md:top-auto md:w-[400px] md:h-[560px] md:rounded-2xl"
            style={{
              background: 'var(--ag-bg-surface)',
              backdropFilter: 'blur(24px)',
              boxShadow: '0 -8px 40px rgba(0,0,0,0.5), 0 0 60px rgba(139,92,246,0.08), 0 0 0 1px var(--ag-border-default)',
            }}
          >
            <div className="flex items-center gap-2.5 px-4 py-3 border-b shrink-0" style={{ borderColor: 'var(--ag-border-subtle)' }}>
              <div className="flex items-center justify-center rounded-lg shrink-0" style={{ width: 32, height: 32, background: 'rgba(139,92,246,0.1)' }}>
                <Sparkles className="h-4 w-4 text-[var(--ag-violet)]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-heading font-semibold text-[var(--ag-text-primary)]">Calendar AI</h3>
                <p className="text-xs text-[var(--ag-text-secondary)] truncate">Ask about your schedule</p>
              </div>
              <button onClick={() => setShowAI(false)} aria-label="Close AI panel"
                className="flex items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/50 focus-visible:outline-none"
                style={{ width: 44, height: 44 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <X className="h-4 w-4 text-[var(--ag-text-secondary)]" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2 px-4 py-3 border-b shrink-0" style={{ borderColor: 'rgba(139,92,246,0.08)' }}>
              {[
                { label: "Find free time",   prompt: "Find me some free time slots this week for a 1-hour meeting" },
                { label: "Block focus time", prompt: "Block 2 hours of focus time tomorrow morning on my calendar" },
                { label: "What's next?",     prompt: "What's my next upcoming event on my calendar?" },
              ].map((action) => (
                <button key={action.label} onClick={() => void askCalendarAI(action.prompt)} disabled={aiLoading}
                  className="px-3 rounded-full text-xs font-medium border transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                  style={{ minHeight: 36, background: 'rgba(139,92,246,0.06)', borderColor: 'rgba(139,92,246,0.15)', color: 'var(--ag-violet)' }}>
                  {action.label}
                </button>
              ))}
            </div>

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
                  <div className="flex items-center justify-center rounded-xl" style={{ width: 48, height: 48, background: 'rgba(139,92,246,0.08)' }}>
                    <Calendar className="h-6 w-6" style={{ color: 'rgba(139,92,246,0.6)' }} />
                  </div>
                  <p className="text-[var(--ag-text-secondary)] text-xs max-w-[240px]">
                    Ask me to find free slots, schedule meetings, or check what is coming up.
                  </p>
                </div>
              )}
            </div>

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
                style={{ minHeight: 44, background: 'var(--ag-bg-elevated)', border: '1px solid var(--ag-border-subtle)', color: 'var(--ag-text-primary)' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--ag-border-subtle)'; }}
              />
              <button
                type="submit"
                disabled={!aiInput.trim() || aiLoading}
                aria-label="Send message"
                className="flex items-center justify-center rounded-lg transition-all duration-150 disabled:opacity-30 hover:scale-105 active:scale-95"
                style={{
                  width: 44, height: 44,
                  background: aiInput.trim() ? 'linear-gradient(135deg, var(--ag-violet), var(--ag-cyan))' : 'rgba(139,92,246,0.08)',
                }}
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
