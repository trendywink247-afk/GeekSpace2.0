// src/dashboard/pages/office/SmartSidebar.tsx
// Sidebar shell with 3 tabs: Timeline (default), Tasks, Metrics.
// Bottom chat input always visible — sends to /api/agent/chat.

import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { SSEEvent, TimelineEntry, SidebarTab, AgentId } from '../entities/types';
import type { OfficeData } from '../state/use-office-data';
import { AGENT_COLORS } from '../constants';
import TimelineCard from './TimelineCard';
import TasksTab from './TasksTab';
import MetricsTab from './MetricsTab';
import { GoalsTab } from './GoalsTab';

// ---------------------------------------------------------------------------
// Helpers (mirror what useOfficeData uses)
// ---------------------------------------------------------------------------
function apiBase(): string {
  return import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');
}

function getToken(): string | null {
  return (
    localStorage.getItem('gs_token') ||
    localStorage.getItem('token') ||
    sessionStorage.getItem('token')
  );
}

// ---------------------------------------------------------------------------
// Extract agent identity from action text (e.g. "Jarvis replied", "Weebo → Forge: ...")
// ---------------------------------------------------------------------------
function extractAgent(action: string): { agentId?: AgentId; agentName?: string; agentColor?: string } {
  const agents: AgentId[] = ['weebo', 'edith', 'jarvis', 'aria', 'forge', 'pulse', 'echo', 'cal', 'nova'];
  const lower = action.toLowerCase();
  for (const id of agents) {
    const name = id.charAt(0).toUpperCase() + id.slice(1);
    if (lower.includes(name.toLowerCase())) {
      return { agentId: id, agentName: name, agentColor: AGENT_COLORS[id] };
    }
  }
  // "Geek replied" maps to default agent Weebo
  if (lower.includes('geek')) {
    return { agentId: 'weebo', agentName: 'Weebo', agentColor: AGENT_COLORS.weebo };
  }
  return {};
}

// ---------------------------------------------------------------------------
// Icon → TimelineEntry type mapping
// ---------------------------------------------------------------------------
function iconToEntryType(icon: string): TimelineEntry['type'] {
  const lower = icon.toLowerCase();
  if (lower === 'bot' || lower === 'sparkles' || lower === 'sparkle' || lower === 'star') return 'reply';
  if (lower === 'zap' || lower === 'automation') return 'automation';
  if (lower === 'clock' || lower === 'bell' || lower === 'alarm' || lower === 'reminder') return 'reminder';
  if (lower === 'wrench' || lower === 'tool' || lower === 'gear' || lower === 'settings') return 'tool_call';
  if (lower === 'lightbulb' || lower === 'bulb' || lower === 'insight') return 'insight';
  if (lower === 'users' || lower === 'multi' || lower === 'group' || lower === 'network') return 'multi_agent';
  if (lower === 'flame' || lower === 'fire' || lower === 'habit') return 'habit';
  if (lower === 'message' || lower === 'chat' || lower === 'comm') return 'comm';
  // Default: treat as a reply
  return 'reply';
}

// Convert a raw timeline item (from officeData.timeline) into a TimelineEntry
function rawToEntry(
  item: { action: string; details: string; icon: string; created_at: string },
  _index: number,
): TimelineEntry {
  const agent = extractAgent(item.action);
  return {
    id: `poll-${item.action.slice(0, 20).replace(/\s+/g, '-')}-${item.created_at}`,
    type: iconToEntryType(item.icon),
    agentId: agent.agentId,
    agentName: agent.agentName,
    agentColor: agent.agentColor,
    action: item.action,
    details: item.details ?? undefined,
    icon: item.icon,
    timestamp: item.created_at,
  };
}

// Convert a live SSEEvent into a TimelineEntry for card rendering
function sseToEntry(ev: SSEEvent, _index: number): TimelineEntry {
  let type: TimelineEntry['type'] = 'reply';
  if (ev.state === 'tool_call' || ev.state === 'tool_result') type = 'tool_call';
  else if (ev.state === 'comm_sent' || ev.state === 'comm_received') type = 'comm';
  else if (ev.state === 'delegating') type = 'multi_agent';
  else if (ev.state === 'task_started' || ev.state === 'task_completed' || ev.state === 'task_failed') type = 'automation';
  else if (ev.state === 'thinking' || ev.state === 'responding' || ev.state === 'typing' || ev.state === 'done') type = 'reply';

  return {
    id: `sse-${ev.agentId || 'sys'}-${ev.state}-${ev.timestamp}`,
    type,
    agentId: (ev.agentId as AgentId) || undefined,
    agentName: ev.agentName || undefined,
    agentColor: ev.agentId ? AGENT_COLORS[ev.agentId as AgentId] : undefined,
    action: ev.content ?? ev.tool ?? ev.state,
    details: ev.tool && ev.content ? ev.tool : undefined,
    timestamp: ev.timestamp,
    relatedAgents: ev.targetAgent ? [ev.targetAgent as AgentId] : undefined,
  };
}

// ---------------------------------------------------------------------------
// Tab config (full label + compact label for mobile)
// ---------------------------------------------------------------------------
const TABS: { key: SidebarTab; label: string; shortLabel: string }[] = [
  { key: 'timeline', label: 'Timeline', shortLabel: 'Feed' },
  { key: 'tasks',    label: 'Tasks',    shortLabel: 'Tasks' },
  { key: 'goals',    label: 'Goals',    shortLabel: 'Goals' },
  { key: 'metrics',  label: 'Metrics',  shortLabel: 'Stats' },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface SmartSidebarProps {
  officeData: OfficeData | null;
  sseEvents: SSEEvent[];
  onCreateTask?: (agentId: string, title: string) => void;
  /** When true (mobile), hide the bottom chat input since SpotlightHUD is showing */
  spotlightActive?: boolean;
  /** When true, hide the bottom chat input completely */
  hideInput?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function SmartSidebar({ officeData, sseEvents, onCreateTask, spotlightActive, hideInput }: SmartSidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>('timeline');
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build timeline entries: SSE events first (live, newest at top), then polled
  // Cross-dedup: skip polled items that overlap with SSE events (within 5s window)
  const sseEntries = sseEvents
    .slice()
    .reverse()
    .map((ev, i) => sseToEntry(ev, i));

  // Build a set of SSE fingerprints: agentId + timestamp bucket (5s)
  const sseFingerprintSet = new Set<string>();
  for (const ev of sseEvents) {
    if (ev.agentId && ev.timestamp) {
      const bucket = Math.floor(new Date(ev.timestamp).getTime() / 5000);
      sseFingerprintSet.add(`${ev.agentId}:${bucket}`);
      sseFingerprintSet.add(`${ev.agentId}:${bucket - 1}`); // +-5s tolerance
      sseFingerprintSet.add(`${ev.agentId}:${bucket + 1}`);
    }
  }

  const pollEntries = (officeData?.timeline ?? [])
    .map((item, i) => rawToEntry(item, i))
    .filter(entry => {
      // Skip polled "Agent reply" entries that already appear in SSE
      if (entry.agentId && entry.timestamp && (entry.type === 'reply' || entry.type === 'tool_call')) {
        const bucket = Math.floor(new Date(entry.timestamp).getTime() / 5000);
        if (sseFingerprintSet.has(`${entry.agentId}:${bucket}`)) return false;
      }
      return true;
    });

  const timelineEntries: TimelineEntry[] = [...sseEntries, ...pollEntries];

  // Handle card actions (reminder Done/Snooze, habit Log/Skip)
  const handleCardAction = useCallback((entryId: string, action: string) => {
    // Fire-and-forget; actual handling can be wired up later via props
    console.debug('[SmartSidebar] card action', { entryId, action });
  }, []);

  // Chat send
  const handleSend = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const token = getToken();
      await fetch(`${apiBase()}/agent/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: text }),
      });
      setChatInput('');
      inputRef.current?.focus();
    } catch {
      // silent — SSE stream will surface the response anyway
    } finally {
      setSending(false);
    }
  }, [chatInput, sending]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'var(--ag-bg-base, #06061a)' }}
    >
      {/* ── Tab bar — glassmorphism ────────────────────────────────── */}
      <div
        className="flex items-center gap-1 px-2 py-2 flex-shrink-0 relative"
        style={{
          background: 'rgba(6,6,26,0.5)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(139,92,246,0.1)',
        }}
      >
        {TABS.map(({ key, label, shortLabel }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className="relative px-3 py-1.5 rounded-lg font-medium transition-all duration-150 min-h-[44px] text-[11px] sm:text-xs"
              style={{
                background: active ? 'rgba(139,92,246,0.1)' : 'transparent',
                color: active ? '#E8E8F0' : '#6B7280',
              }}
            >
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{shortLabel}</span>
              {active && (
                <span
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-0.5 rounded-full"
                  style={{
                    background: '#8B5CF6',
                    boxShadow: '0 0 8px rgba(139,92,246,0.5)',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Scrollable tab content ────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {activeTab === 'timeline' && (
          <div className="flex flex-col gap-1.5 p-2">
            {timelineEntries.length === 0 ? (
              <motion.div
                className="flex flex-col items-center justify-center py-12 gap-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <span className="text-3xl opacity-40">🤖</span>
                <p className="text-xs text-center" style={{ color: '#6B7280' }}>
                  No activity yet — agents are warming up
                </p>
                <p className="text-[10px]" style={{ color: '#4B5563' }}>
                  Send a message to see agent activity
                </p>
              </motion.div>
            ) : (
              timelineEntries.map((entry, i) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.3) }}
                >
                  <TimelineCard
                    entry={entry}
                    onAction={handleCardAction}
                  />
                </motion.div>
              ))
            )}
          </div>
        )}

        {activeTab === 'tasks' && (
          <TasksTab
            taskBoard={officeData?.taskBoard}
            onCreateTask={onCreateTask ?? (() => {})}
          />
        )}

        {activeTab === 'metrics' && (
          <MetricsTab
            taskStats={
              officeData?.taskStats as {
                total: number;
                pending: number;
                running: number;
                completed: number;
                failed: number;
                completedToday: number;
              } | undefined
            }
            commStats={
              officeData?.commStats as {
                total: number;
                unacknowledged: number;
                byAgent: Record<string, number>;
                byType: Record<string, number>;
              } | undefined
            }
            delegationStatus={officeData?.delegationStatus}
          />
        )}

        {activeTab === 'goals' && <GoalsTab />}
      </div>

      {/* ── Chat input — hidden when hideInput is true or on mobile when SpotlightHUD is active ── */}
      {!hideInput && (
        <div
          className={`flex items-center gap-2 px-3 py-2.5 flex-shrink-0 pb-4 md:pb-2.5 ${spotlightActive ? 'hidden sm:flex' : ''}`}
          style={{
            background: 'rgba(6,6,26,0.7)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderTop: '1px solid rgba(139,92,246,0.1)',
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask any agent..."
            disabled={sending}
            className="flex-1 text-xs rounded-xl px-3.5 py-2.5 outline-none placeholder:text-[#4B5563] disabled:opacity-50 min-h-[44px] transition-all"
            style={{
              background: 'rgba(12,12,30,0.5)',
              color: '#F4F6FF',
              border: chatInput.trim()
                ? '1px solid rgba(139,92,246,0.3)'
                : '1px solid rgba(139,92,246,0.08)',
              boxShadow: chatInput.trim() ? '0 0 12px rgba(139,92,246,0.08)' : 'none',
            }}
          />
          <button
            onClick={() => void handleSend()}
            disabled={!chatInput.trim() || sending}
            className="flex items-center justify-center w-11 h-11 rounded-xl transition-all disabled:opacity-30 flex-shrink-0"
            style={{
              background: chatInput.trim()
                ? 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(139,92,246,0.2))'
                : 'rgba(139,92,246,0.08)',
              color: chatInput.trim() ? '#E8E8F0' : '#4B5563',
              border: chatInput.trim()
                ? '1px solid rgba(139,92,246,0.3)'
                : '1px solid rgba(139,92,246,0.06)',
            }}
            aria-label="Send message"
          >
            {sending ? (
              <div className="w-3.5 h-3.5 border-2 border-[#8B5CF6]/30 border-t-[#8B5CF6] rounded-full animate-spin" />
            ) : (
              <span className="text-sm">▶</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
