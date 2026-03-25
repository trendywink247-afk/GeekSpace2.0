// src/dashboard/pages/office/OfficeHomePage.tsx
// Merged Office canvas + Overview data — the new homepage.
// Layout: header greeting -> office canvas (60%) + enhanced sidebar (40%) -> suggestion strip.
// Polished with atmospheric effects, glass morphism, BlurFade entrance animations.

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor, Bell, CheckCircle2, Calendar, BarChart3, Clock, Send, Flame, ChevronRight } from 'lucide-react';
import OfficeStage from './OfficeStage';
import { SpotlightHUD } from './SpotlightHUD';
import { AgentProfileFlyout } from './AgentProfileFlyout';
import { InsightToast } from './InsightToast';
import { useOfficeData } from './useOfficeData';
import { useOverviewData } from '@/hooks/useOverviewData';
import type { OverviewReminder, OverviewHabit, OverviewCalendarEvent, OverviewWeeklyStats } from '@/hooks/useOverviewData';
import {
  CELL, AGENT_META, AGENT_COLORS,
  CORE_DESK_POSITIONS, SPECIALIST_POSITIONS,
  CORE_AGENTS,
} from './constants';
import type { CanvasAgent, AgentId, CoreAgentId, SpecialistId, InsightCard, SSEEvent } from './types';
import type { OfficeData } from './useOfficeData';
import { agentService, agentTasksService } from '@/services/api';
import { useAuthStore } from '@/stores/authStore';
import SmartSidebar from './SmartSidebar';
import { BlurFade } from '@/components/magicui/blur-fade';

// ---------------------------------------------------------------------------
// Atmospheric background layer (matches AuthPageBackground, uses absolute)
// ---------------------------------------------------------------------------

function AtmosphericBackground() {
  return (
    <>
      {/* Aurora gradient orbs */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: [
            'radial-gradient(ellipse at 20% 50%, rgba(139,92,246,0.08) 0%, transparent 50%)',
            'radial-gradient(ellipse at 80% 20%, rgba(16,185,129,0.06) 0%, transparent 40%)',
            'radial-gradient(ellipse at 50% 80%, rgba(245,158,11,0.04) 0%, transparent 50%)',
          ].join(', '),
        }}
      />

      {/* Noise texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          opacity: 0.035,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'repeat',
          backgroundSize: '256px 256px',
        }}
      />

      {/* Dot grid */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          WebkitMaskImage:
            'radial-gradient(ellipse 60% 50% at 50% 40%, black 30%, transparent 100%)',
          maskImage:
            'radial-gradient(ellipse 60% 50% at 50% 40%, black 30%, transparent 100%)',
        }}
      />

      {/* Depth blob */}
      <div
        className="absolute inset-0 pointer-events-none flex items-center justify-center z-0"
      >
        <div
          className="animate-pulse"
          style={{
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: 'rgba(139,92,246,0.025)',
            filter: 'blur(140px)',
            flexShrink: 0,
          }}
        />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Helper: build a CanvasAgent for SpotlightHUD from an agentId
// (copied from OfficePage.tsx to avoid modifying it)
// ---------------------------------------------------------------------------

function getAgentForHUD(id: string): CanvasAgent | null {
  const meta = AGENT_META[id as AgentId];
  if (!meta) return null;
  const pos =
    CORE_DESK_POSITIONS[id as CoreAgentId] ??
    SPECIALIST_POSITIONS[id as SpecialistId] ??
    { x: 0, y: 0 };
  return {
    id: id as AgentId,
    name: meta.emoji + ' ' + id.charAt(0).toUpperCase() + id.slice(1),
    color: AGENT_COLORS[id as AgentId],
    emoji: meta.emoji,
    role: meta.role,
    x: pos.x,
    y: pos.y,
    targetX: pos.x,
    targetY: pos.y,
    renderX: pos.x * CELL + CELL / 2,
    renderY: pos.y * CELL + CELL / 2,
    speed: 5,
    state: 'idle',
    isSpecialist: !CORE_AGENTS.includes(id as CoreAgentId),
    isDormant: false,
    path: [],
    pathIndex: 0,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function formatEventTime(epoch: number): string {
  return new Date(epoch).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

// ---------------------------------------------------------------------------
// Enhanced sidebar tab type
// ---------------------------------------------------------------------------

type EnhancedTab = 'today' | 'timeline' | 'tasks' | 'insights';

const ENHANCED_TABS: { key: EnhancedTab; label: string; shortLabel: string }[] = [
  { key: 'today',    label: 'Today',    shortLabel: 'Today' },
  { key: 'timeline', label: 'Timeline', shortLabel: 'Feed' },
  { key: 'tasks',    label: 'Tasks',    shortLabel: 'Tasks' },
  { key: 'insights', label: 'Insights', shortLabel: 'Stats' },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TodayTab({
  reminders,
  habits,
  calendarEvents,
  onCompleteReminder,
  onDismissReminder,
}: {
  reminders: OverviewReminder[];
  habits: OverviewHabit[];
  calendarEvents: OverviewCalendarEvent[];
  onCompleteReminder: (id: string) => void;
  onDismissReminder: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Reminders */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Bell className="w-3.5 h-3.5 text-[var(--ag-pink)]" />
          <span className="text-xs font-semibold text-[var(--ag-text-primary)] tracking-wide uppercase">
            Reminders
          </span>
          {reminders.length > 0 && (
            <span className="ml-auto text-[10px] font-bold text-[var(--ag-pink)] bg-[var(--ag-pink)]/10 px-1.5 py-0.5 rounded-full">
              {reminders.length}
            </span>
          )}
        </div>
        {reminders.length === 0 ? (
          <p className="text-xs text-[var(--ag-text-secondary)] pl-5">All clear for today</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {reminders.slice(0, 5).map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-2 rounded-lg px-3 py-2 group backdrop-blur-sm transition-all duration-200 hover:shadow-[var(--ag-glow-sm)]"
                style={{
                  background: r.overdue ? 'rgba(255,45,120,0.06)' : 'rgba(0,240,255,0.04)',
                  border: `1px solid ${r.overdue ? 'rgba(255,45,120,0.15)' : 'var(--ag-border-subtle)'}`,
                }}
              >
                <button
                  onClick={() => onCompleteReminder(r.id)}
                  className="w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 hover:bg-[var(--ag-lime)]/20 transition-colors"
                  style={{ borderColor: 'rgba(173,255,47,0.3)' }}
                  title="Complete"
                >
                  <CheckCircle2 className="w-3 h-3 text-[var(--ag-lime)] opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[var(--ag-text-primary)] truncate">{r.text}</p>
                  <p className="text-[10px] text-[var(--ag-text-secondary)]">
                    {new Date(r.datetime).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    {r.overdue && <span className="text-[var(--ag-pink)] ml-1">overdue</span>}
                  </p>
                </div>
                <button
                  onClick={() => onDismissReminder(r.id)}
                  className="text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] text-xs opacity-0 group-hover:opacity-100 transition-opacity px-1"
                  title="Dismiss"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Habits */}
      {habits.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Flame className="w-3.5 h-3.5 text-[var(--ag-lime)]" />
            <span className="text-xs font-semibold text-[var(--ag-text-primary)] tracking-wide uppercase">
              Habits
            </span>
            <span className="ml-auto text-[10px] text-[var(--ag-text-secondary)]">
              {habits.filter((h) => h.loggedToday).length}/{habits.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {habits.map((h) => (
              <div
                key={h.id}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs backdrop-blur-sm transition-all duration-200 hover:shadow-[var(--ag-glow-sm)]"
                style={{
                  background: h.loggedToday ? 'rgba(173,255,47,0.08)' : 'rgba(139,92,246,0.06)',
                  border: `1px solid ${h.loggedToday ? 'rgba(173,255,47,0.15)' : 'rgba(139,92,246,0.1)'}`,
                  color: h.loggedToday ? 'var(--ag-lime)' : 'var(--ag-text-secondary)',
                }}
              >
                <span className="text-sm">{h.icon === 'star' ? '\u2B50' : h.icon}</span>
                <span className="truncate max-w-[80px]">{h.name}</span>
                {h.streak > 0 && (
                  <span className="text-[10px] font-mono opacity-60">{h.streak}d</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Calendar events */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-3.5 h-3.5 text-[var(--ag-violet)]" />
          <span className="text-xs font-semibold text-[var(--ag-text-primary)] tracking-wide uppercase">
            Calendar
          </span>
        </div>
        {calendarEvents.length === 0 ? (
          <p className="text-xs text-[var(--ag-text-secondary)] pl-5">No events today</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {calendarEvents.slice(0, 4).map((ev) => (
              <div
                key={ev.id}
                className="flex items-center gap-2 rounded-lg px-3 py-2 backdrop-blur-sm transition-all duration-200 hover:shadow-[var(--ag-glow-sm)]"
                style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.1)' }}
              >
                <Clock className="w-3.5 h-3.5 text-[var(--ag-violet)] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[var(--ag-text-primary)] truncate">{ev.title}</p>
                  <p className="text-[10px] text-[var(--ag-text-secondary)]">
                    {formatEventTime(ev.start_time)}
                    {ev.end_time ? ` - ${formatEventTime(ev.end_time)}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function InsightsTab({ weeklyStats }: { weeklyStats: OverviewWeeklyStats | null }) {
  if (!weeklyStats) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-xs text-[var(--ag-text-secondary)]">Loading stats...</p>
      </div>
    );
  }

  const cards = [
    { label: 'Messages', value: weeklyStats.messagesThisWeek, color: 'var(--ag-cyan)', icon: '\uD83D\uDCAC' },
    { label: 'Reminders Done', value: weeklyStats.remindersCompleted, color: 'var(--ag-lime)', icon: '\u2705' },
    { label: 'Habits Logged', value: weeklyStats.habitsLogged, color: 'var(--ag-violet)', icon: '\uD83D\uDD25' },
  ];

  return (
    <div className="flex flex-col gap-3 p-3">
      <span className="text-xs font-semibold text-[var(--ag-text-primary)] tracking-wide uppercase flex items-center gap-2">
        <BarChart3 className="w-3.5 h-3.5 text-[var(--ag-cyan)]" />
        This Week
      </span>
      <div className="grid grid-cols-3 gap-2">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl p-3 text-center backdrop-blur-sm transition-all duration-200 hover:shadow-[var(--ag-glow-sm)]"
            style={{ background: `color-mix(in srgb, ${c.color} 5%, transparent)`, border: `1px solid color-mix(in srgb, ${c.color} 12%, transparent)` }}
          >
            <span className="text-lg block mb-1">{c.icon}</span>
            <span className="text-lg font-bold block" style={{ color: c.color }}>
              {c.value}
            </span>
            <span className="text-[10px] text-[var(--ag-text-secondary)] block">{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chat input bar (always at sidebar bottom) -- glass morphism polish
// ---------------------------------------------------------------------------

function ChatInputBar() {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasText = input.trim().length > 0;

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await agentService.chat(text, 'web');
      setInput('');
      inputRef.current?.focus();
    } catch {
      // SSE stream surfaces the response
    } finally {
      setSending(false);
    }
  }, [input, sending]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 flex-shrink-0 border-t pb-4 md:pb-2 backdrop-blur-xl"
      style={{
        borderColor: 'var(--ag-border-subtle)',
        background: 'var(--ag-bg-surface)',
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask an agent..."
        disabled={sending}
        className="flex-1 text-xs rounded-lg px-3 py-2 outline-none placeholder:text-[var(--ag-text-muted)] disabled:opacity-50 min-h-[36px] transition-shadow duration-200 focus:shadow-[0_0_0_1px_var(--ag-cyan),var(--ag-glow-sm)]"
        style={{
          background: 'rgba(12, 12, 30, 0.8)',
          color: 'var(--ag-text-primary)',
          border: '1px solid var(--ag-border-subtle)',
        }}
      />
      <button
        onClick={() => void handleSend()}
        disabled={!hasText || sending}
        className="flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200 disabled:opacity-40 flex-shrink-0"
        style={{
          background: hasText && !sending ? 'rgba(0,240,255,0.15)' : 'rgba(0,240,255,0.08)',
          color: 'var(--ag-cyan)',
          boxShadow: hasText && !sending ? 'var(--ag-glow-sm)' : 'none',
        }}
        aria-label="Send message"
      >
        {sending ? (
          <div className="w-3.5 h-3.5 border-2 border-[var(--ag-cyan)]/30 border-t-[var(--ag-cyan)] rounded-full animate-spin" />
        ) : (
          <Send className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Enhanced sidebar -- glass morphism, tab glow, BlurFade wrapping
// ---------------------------------------------------------------------------

function EnhancedSidebar({
  officeData,
  sseEvents,
  overviewReminders,
  overviewHabits,
  overviewCalendarEvents,
  weeklyStats,
  onCreateTask,
  onCompleteReminder,
  onDismissReminder,
}: {
  officeData: OfficeData | null;
  sseEvents: SSEEvent[];
  overviewReminders: OverviewReminder[];
  overviewHabits: OverviewHabit[];
  overviewCalendarEvents: OverviewCalendarEvent[];
  weeklyStats: OverviewWeeklyStats | null;
  onCreateTask: (agentId: string, title: string) => void;
  onCompleteReminder: (id: string) => void;
  onDismissReminder: (id: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<EnhancedTab>('today');

  return (
    <div
      className="flex flex-col h-full backdrop-blur-xl"
      style={{
        background: 'var(--ag-bg-surface)',
        borderLeft: '1px solid var(--ag-border-subtle)',
      }}
    >
      {/* Tab bar -- glass morphism tabs */}
      <div
        className="flex items-center gap-1 px-2 py-2 flex-shrink-0 border-b overflow-x-auto backdrop-blur-md"
        style={{
          borderColor: 'var(--ag-border-subtle)',
          background: 'rgba(12, 12, 30, 0.4)',
        }}
      >
        {ENHANCED_TABS.map(({ key, label, shortLabel }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className="px-2.5 py-1.5 rounded-full font-medium transition-all duration-200 min-h-[32px] text-[11px] sm:text-xs whitespace-nowrap"
              style={{
                background: active ? 'rgba(0,240,255,0.1)' : 'transparent',
                color: active ? 'var(--ag-cyan)' : 'var(--ag-text-secondary)',
                border: active ? '1px solid var(--ag-border-glow)' : '1px solid transparent',
                boxShadow: active ? 'var(--ag-glow-sm)' : 'none',
              }}
            >
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{shortLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {activeTab === 'today' && (
          <TodayTab
            reminders={overviewReminders}
            habits={overviewHabits}
            calendarEvents={overviewCalendarEvents}
            onCompleteReminder={onCompleteReminder}
            onDismissReminder={onDismissReminder}
          />
        )}

        {activeTab === 'insights' && <InsightsTab weeklyStats={weeklyStats} />}

        {/* Timeline and Tasks delegate to SmartSidebar internals.
            We render SmartSidebar only for these tabs, hiding its own tab bar. */}
        {(activeTab === 'timeline' || activeTab === 'tasks') && (
          <div className="h-full [&>div>div:first-child]:hidden">
            <SmartSidebar
              officeData={officeData}
              sseEvents={sseEvents}
              onCreateTask={onCreateTask}
            />
          </div>
        )}
      </div>

      {/* Chat input -- always visible */}
      <ChatInputBar />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Suggestion strip -- glass background, hover glow chips, shimmer on first
// ---------------------------------------------------------------------------

const SUGGESTIONS = [
  'Set a reminder',
  'Generate an image',
  'Summarize my day',
  'Check my habits',
  'Draft an email',
];

function SuggestionStrip({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-2 overflow-x-auto flex-shrink-0 border-t backdrop-blur-xl"
      style={{
        borderColor: 'var(--ag-border-subtle)',
        background: 'var(--ag-bg-surface)',
      }}
    >
      {SUGGESTIONS.map((s, i) => (
        <button
          key={s}
          onClick={() => onSelect(s)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] whitespace-nowrap transition-all duration-200 hover:shadow-[var(--ag-glow-sm)]"
          style={{
            color: 'var(--ag-text-secondary)',
            border: '1px solid var(--ag-border-subtle)',
            background: i === 0 ? 'rgba(139,92,246,0.06)' : 'transparent',
            animation: i === 0 ? 'shimmer 3s ease-in-out infinite' : undefined,
          }}
        >
          {s}
          <ChevronRight className="w-3 h-3 opacity-40" />
        </button>
      ))}
      {/* Shimmer keyframe injected via style tag */}
      <style>{`
        @keyframes shimmer {
          0%, 100% { border-color: var(--ag-border-subtle); }
          50% { border-color: var(--ag-border-default); }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header bar -- glass morphism with gradient border glow
// ---------------------------------------------------------------------------

function HeaderBar({ weeklyStats }: { weeklyStats: OverviewWeeklyStats | null }) {
  const user = useAuthStore((s) => s.user);
  const name = user?.name || user?.username || 'there';

  return (
    <div
      className="relative flex items-center justify-between px-4 py-2.5 flex-shrink-0 backdrop-blur-xl z-10"
      style={{
        background: 'var(--ag-bg-surface)',
      }}
    >
      {/* Bottom border glow line */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, var(--ag-violet) 30%, var(--ag-cyan) 70%, transparent 100%)',
          opacity: 0.3,
        }}
      />

      <div className="flex items-center gap-3 min-w-0">
        <div>
          <h1 className="text-sm font-bold text-[var(--ag-text-primary)] truncate" style={{ fontFamily: 'Syne, sans-serif' }}>
            {getGreeting()}, {name}
          </h1>
          <p className="text-[10px] text-[var(--ag-text-secondary)]">{formatDate()}</p>
        </div>
      </div>
      {weeklyStats && (
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-center">
            <span className="text-xs font-bold text-[var(--ag-cyan)] block">{weeklyStats.messagesThisWeek}</span>
            <span className="text-[9px] text-[var(--ag-text-secondary)]">msgs</span>
          </div>
          <div className="w-px h-5" style={{ background: 'var(--ag-border-subtle)' }} />
          <div className="text-center">
            <span className="text-xs font-bold text-[var(--ag-lime)] block">{weeklyStats.remindersCompleted}</span>
            <span className="text-[9px] text-[var(--ag-text-secondary)]">done</span>
          </div>
          <div className="w-px h-5" style={{ background: 'var(--ag-border-subtle)' }} />
          <div className="text-center">
            <span className="text-xs font-bold text-[var(--ag-violet)] block">{weeklyStats.habitsLogged}</span>
            <span className="text-[9px] text-[var(--ag-text-secondary)]">habits</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// OfficeHomePage -- main component
// ---------------------------------------------------------------------------

type OfficeTheme = 'day' | 'night' | 'auto';

export function OfficeHomePage() {
  const navigate = useNavigate();
  const { sseEvents, officeData, connectionMode, sessionExpired } = useOfficeData();
  const {
    reminders, habits, calendarEvents, weeklyStats,
    completeReminder, dismissReminder,
  } = useOverviewData();

  // Canvas state
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [flyoutAgentId, setFlyoutAgentId] = useState<string | null>(null);
  const [taskCount, setTaskCount] = useState(0);
  const [dismissedInsights, setDismissedInsights] = useState<string[]>([]);

  // Day/Night theme
  const [officeTheme, setOfficeTheme] = useState<OfficeTheme>(() => {
    return (localStorage.getItem('office_theme') as OfficeTheme) || 'auto';
  });
  const resolvedTheme: 'day' | 'night' = officeTheme === 'auto'
    ? (new Date().getHours() >= 6 && new Date().getHours() < 18 ? 'day' : 'night')
    : officeTheme;

  // Insight cards from timeline
  const insightCards = useMemo<InsightCard[]>(() => {
    const timeline = officeData?.timeline ?? [];
    const keywords = ['insight', 'suggest', 'tip', 'notice', 'pattern', 'trend', 'alert', 'recommendation'];
    return timeline
      .filter((item) => {
        const lower = (item.action + ' ' + (item.details ?? '') + ' ' + (item.icon ?? '')).toLowerCase();
        return keywords.some((kw) => lower.includes(kw));
      })
      .filter((item, index) => {
        const id = `insight-${index}-${item.created_at}`;
        return !dismissedInsights.includes(id);
      })
      .slice(0, 5)
      .map((item, index) => ({
        id: `insight-${index}-${item.created_at}`,
        agentId: (item as { agentId?: AgentId }).agentId ?? 'weebo',
        agentName: (item as { agentName?: string }).agentName ?? 'Weebo',
        text: item.action,
        category: 'general' as const,
        timestamp: item.created_at,
        dismissed: false,
      }));
  }, [officeData?.timeline, dismissedInsights]);

  // Fetch task count when agent selected
  useEffect(() => {
    if (!selectedAgentId) { setTaskCount(0); return; }
    let cancelled = false;
    agentTasksService.stats(selectedAgentId)
      .then((res) => { if (!cancelled) setTaskCount(res.data.completedToday ?? 0); })
      .catch(() => { if (!cancelled) setTaskCount(0); });
    return () => { cancelled = true; };
  }, [selectedAgentId]);

  const spotlightAgent = useMemo(
    () => (selectedAgentId ? getAgentForHUD(selectedAgentId) : null),
    [selectedAgentId],
  );

  const handleCreateTask = useCallback(async (agentId: string, title: string) => {
    await agentTasksService.create({ agent_id: agentId, title });
  }, []);

  const handleSuggestion = useCallback((text: string) => {
    navigate(`/dashboard/chat?message=${encodeURIComponent(text)}`);
  }, [navigate]);

  return (
    <div
      className="relative flex flex-col h-[calc(100dvh-64px)] md:h-dvh overflow-hidden"
      style={{ background: 'var(--ag-bg-deep)' }}
    >
      {/* Atmospheric background layer */}
      <AtmosphericBackground />

      {/* Session expired banner */}
      {sessionExpired && (
        <div
          className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between gap-3 px-4 py-3 backdrop-blur-md"
          style={{ backgroundColor: 'rgba(255,45,120,0.12)', borderBottom: '1px solid rgba(255,45,120,0.35)' }}
        >
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--ag-pink)' }}>
            Session expired -- live feed paused
          </div>
          <button
            onClick={() => { localStorage.removeItem('gs_token'); localStorage.removeItem('token'); navigate('/login'); }}
            className="px-3 py-1.5 rounded-md text-xs font-semibold"
            style={{ backgroundColor: 'var(--ag-pink)', color: '#fff' }}
          >
            Re-login
          </button>
        </div>
      )}

      {/* Header bar with BlurFade entrance */}
      <BlurFade delay={0} inView>
        <HeaderBar weeklyStats={weeklyStats} />
      </BlurFade>

      {/* Main content: canvas + sidebar */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden relative z-[1]">
        {/* Office Stage -- 60% desktop, 45vh mobile */}
        <BlurFade delay={0.1} inView className="relative w-full md:w-[60%] h-[45vh] md:h-full flex-shrink-0">
          {/* Canvas wrapper glow */}
          <div
            className="absolute inset-0 pointer-events-none z-[2]"
            style={{
              boxShadow: 'inset 0 0 60px rgba(139,92,246,0.05)',
            }}
          />
          {/* Top depth gradient */}
          <div
            className="absolute top-0 left-0 right-0 h-16 pointer-events-none z-[1]"
            style={{
              background: 'linear-gradient(to bottom, var(--ag-bg-deep), transparent)',
              opacity: 0.6,
            }}
          />
          {/* Bottom depth gradient */}
          <div
            className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none z-[1]"
            style={{
              background: 'linear-gradient(to top, var(--ag-bg-deep), transparent)',
              opacity: 0.4,
            }}
          />

          {/* Canvas header overlay */}
          <div
            className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 backdrop-blur-md"
            style={{ background: 'linear-gradient(to bottom, rgba(5,5,10,0.85) 0%, transparent 100%)' }}
          >
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-[var(--ag-cyan)]" />
              <span className="text-xs font-bold text-[var(--ag-text-primary)] tracking-wide" style={{ fontFamily: 'Syne, sans-serif' }}>
                Mission Control
              </span>
              <span
                className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider"
                style={{ background: 'rgba(139,92,246,0.12)', color: 'var(--ag-violet)', border: '1px solid var(--ag-border-default)' }}
              >
                9 AGENTS
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Day/Night toggle */}
              <div
                className="flex items-center gap-0.5 rounded-lg p-0.5 backdrop-blur-sm"
                style={{ background: 'var(--ag-bg-surface)', border: '1px solid var(--ag-border-subtle)' }}
              >
                {(['day', 'night', 'auto'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => { setOfficeTheme(mode); localStorage.setItem('office_theme', mode); }}
                    className="px-1.5 py-0.5 rounded-md text-[10px] transition-all duration-200"
                    style={{
                      background: officeTheme === mode ? 'rgba(0,240,255,0.15)' : 'transparent',
                      color: officeTheme === mode ? 'var(--ag-cyan)' : 'var(--ag-text-secondary)',
                    }}
                  >
                    {mode === 'day' ? '\u2600\uFE0F' : mode === 'night' ? '\uD83C\uDF19' : '\u26A1'}
                  </button>
                ))}
              </div>
              {/* Connection badge */}
              <span
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider ${
                  connectionMode === 'live'
                    ? 'bg-[var(--ag-lime)]/10 text-[var(--ag-lime)]'
                    : connectionMode === 'reconnecting'
                      ? 'bg-[var(--ag-amber)]/10 text-[var(--ag-amber)]'
                      : 'bg-[var(--ag-pink)]/10 text-[var(--ag-pink)]'
                }`}
              >
                <span className="relative flex h-1.5 w-1.5">
                  {connectionMode === 'live' && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--ag-lime)] opacity-50" />
                  )}
                  <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                    connectionMode === 'live' ? 'bg-[var(--ag-lime)]' : connectionMode === 'reconnecting' ? 'bg-[var(--ag-amber)]' : 'bg-[var(--ag-pink)]'
                  }`} />
                </span>
                {connectionMode === 'live' ? 'LIVE' : connectionMode === 'reconnecting' ? 'RECONNECTING' : 'POLLING'}
              </span>
            </div>
          </div>

          {/* Canvas */}
          <OfficeStage
            events={sseEvents}
            selectedAgentId={selectedAgentId}
            onAgentSelect={setSelectedAgentId}
            onAgentDoubleClick={(id) => setFlyoutAgentId(id)}
            theme={resolvedTheme}
          />

          {/* Insight toasts */}
          <InsightToast
            insights={insightCards}
            onDismiss={(id) => setDismissedInsights((prev) => [...prev, id])}
          />

          {/* Spotlight HUD */}
          {spotlightAgent && (
            <SpotlightHUD
              agent={spotlightAgent}
              taskCount={taskCount}
              onChat={(message) => {
                if (message) {
                  agentService.chat(message, 'web').catch(() => {});
                } else {
                  navigate(`/dashboard/chat?agent=${selectedAgentId}`);
                }
              }}
              onAssignTask={(title) => {
                if (title && selectedAgentId) {
                  agentTasksService.create({ agent_id: selectedAgentId, title }).catch(() => {});
                } else {
                  setSelectedAgentId(null);
                }
              }}
              onDismiss={() => setSelectedAgentId(null)}
            />
          )}
        </BlurFade>

        {/* Enhanced Sidebar -- 40% desktop, rest of viewport on mobile */}
        <BlurFade delay={0.15} inView className="flex-1 md:w-[40%] min-h-0">
          <div
            className="h-full border-t md:border-t-0 md:border-l"
            style={{ borderColor: 'var(--ag-border-subtle)' }}
          >
            <EnhancedSidebar
              officeData={officeData}
              sseEvents={sseEvents}
              overviewReminders={reminders}
              overviewHabits={habits}
              overviewCalendarEvents={calendarEvents}
              weeklyStats={weeklyStats}
              onCreateTask={handleCreateTask}
              onCompleteReminder={completeReminder}
              onDismissReminder={dismissReminder}
            />
          </div>
        </BlurFade>
      </div>

      {/* Suggestion strip at bottom with BlurFade */}
      <BlurFade delay={0.2} inView>
        <SuggestionStrip onSelect={handleSuggestion} />
      </BlurFade>

      {/* Agent Profile Flyout (double-click) */}
      <AgentProfileFlyout
        agentId={flyoutAgentId}
        onClose={() => setFlyoutAgentId(null)}
        onNavigateToChat={(id) => { setFlyoutAgentId(null); navigate(`/dashboard/chat?agent=${id}`); }}
      />
    </div>
  );
}
