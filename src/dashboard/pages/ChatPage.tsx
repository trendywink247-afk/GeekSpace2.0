import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Send, Volume2, VolumeX, RotateCcw, Sparkles, Square,
  Pin, Search, Plus, Trash2,
  ChevronDown, X, PanelLeftClose, PanelLeft,
  Wifi, WifiOff, Clock, Star,
} from 'lucide-react';
import { toast } from 'sonner';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { Button } from '@/components/ui/button';
import { agentService, memoryService } from '@/services/api';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useAuthStore } from '@/stores/authStore';
import { useVoice } from '@/hooks/useVoice';
import { useTTS } from '@/hooks/useTTS';
import { VoiceButton } from '@/components/VoiceButton';
import { ToolStepIndicator, type ToolStep as SSEToolStep } from '@/components/ToolStepIndicator';
import { ChatMessageBubble, type ChatMessage, type ToolStep, type FeedbackValue } from '@/components/ChatMessageBubble';
import type { AgentPersonality } from '@/types';
import { AgentMentionPopup } from '@/components/AgentMentionPopup';
import type { MentionAgent } from '@/components/AgentMentionPopup';
import { timeAgo as luxonTimeAgo, formatDateTime as luxonFormatDateTime, formatDate as luxonFormatDate } from '@/utils/dateFormat';
import { PageShell } from '@/components/agentin';
import { DashboardPageWrapper } from '@/components/agentin';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';
import { SessionContinuityBanner } from '@/components/SessionContinuityBanner';
import { AgentCapabilityBadge } from '@/components/AgentCapabilityBadge';
import { DelegationLiveIndicator } from '@/components/DelegationLiveIndicator';

// ── Types ──

type StreamHealth = 'connected' | 'slow' | 'disconnected';

// ── Constants ──

const TOOL_LABELS: Record<string, { running: string; done: string; icon: string }> = {
  web_search: { running: 'Searching the web...', done: 'Search complete', icon: 'search' },
  create_reminder: { running: 'Creating reminder...', done: 'Reminder set', icon: 'clock' },
  create_note: { running: 'Saving note...', done: 'Note saved', icon: 'note' },
  generate_code: { running: 'Generating code...', done: 'Code ready', icon: 'code' },
  generate_image: { running: 'Generating image...', done: 'Image ready', icon: 'image' },
  send_telegram: { running: 'Sending message...', done: 'Message sent', icon: 'send' },
  browse_url: { running: 'Loading page...', done: 'Page loaded', icon: 'globe' },
  take_screenshot: { running: 'Taking screenshot...', done: 'Screenshot taken', icon: 'camera' },
  track_expense: { running: 'Tracking expense...', done: 'Expense logged', icon: 'dollar' },
  create_habit: { running: 'Creating habit...', done: 'Habit created', icon: 'target' },
  log_habit: { running: 'Logging habit...', done: 'Habit logged', icon: 'check' },
  start_focus: { running: 'Starting focus session...', done: 'Focus started', icon: 'focus' },
};

const VOICE_SETTINGS_KEY = 'agentin_voice_settings';

const RECONNECT_DELAYS = [1000, 3000, 9000]; // exponential backoff

// ── Helpers ──

/** Generate default content for SSE tool step events */
function getDefaultContent(type: string, tool?: string, agentName?: string, targetAgent?: string): string {
  switch (type) {
    case 'thinking': return 'Analyzing your request...';
    case 'tool_call': return TOOL_LABELS[tool || '']?.running || `Running ${tool || 'tool'}...`;
    case 'tool_result': return TOOL_LABELS[tool || '']?.done || `${tool || 'Tool'} complete`;
    case 'delegating': return `Delegating to ${targetAgent || 'another agent'}`;
    case 'comm_sent': return `${agentName || 'Agent'} sent a message`;
    case 'task_started': return 'Working on task...';
    case 'task_completed': return 'Task completed';
    case 'task_failed': return 'Task failed';
    case 'responding': return 'Composing response...';
    case 'done': return 'Finished';
    default: return 'Processing...';
  }
}

function withinMs(a: Date, b: Date, ms: number): boolean {
  return Math.abs(a.getTime() - b.getTime()) < ms;
}

/** Format a date as a human-readable relative time string */
function formatRelativeTime(date: Date): string {
  return luxonTimeAgo(date);
}

function buildTimestampVisibility(msgs: ChatMessage[]): Set<string> {
  const visible = new Set<string>();
  if (msgs.length === 0) return visible;
  const TWO_MIN = 2 * 60 * 1000;
  let clusterEnd = 0;
  for (let i = 0; i < msgs.length; i++) {
    clusterEnd = i;
    while (
      clusterEnd + 1 < msgs.length &&
      withinMs(msgs[clusterEnd].timestamp, msgs[clusterEnd + 1].timestamp, TWO_MIN)
    ) {
      clusterEnd++;
    }
    visible.add(msgs[clusterEnd].id);
    i = clusterEnd;
  }
  return visible;
}

function getVoiceMode(): boolean {
  try {
    const raw = localStorage.getItem(VOICE_SETTINGS_KEY);
    if (!raw) return false;
    const cfg = JSON.parse(raw) as Record<string, unknown>;
    return Boolean(cfg.enabled);
  } catch {
    return false;
  }
}

/** Get time-of-day greeting and context-aware starter prompts */
function getTimeOfDayContext(userName: string): { greeting: string; prompts: { text: string; icon: string }[] } {
  const hour = new Date().getHours();
  const firstName = userName?.split(' ')[0] || 'there';

  if (hour >= 6 && hour < 12) {
    return {
      greeting: `Good morning, ${firstName}!`,
      prompts: [
        { text: "What's on my agenda today?", icon: 'calendar' },
        { text: 'Give me a morning briefing', icon: 'sunrise' },
        { text: 'Help me plan my day', icon: 'list' },
        { text: 'Set a reminder for my first meeting', icon: 'bell' },
      ],
    };
  } else if (hour >= 12 && hour < 17) {
    return {
      greeting: `Good afternoon, ${firstName}!`,
      prompts: [
        { text: 'Summarize my day so far', icon: 'clipboard' },
        { text: 'Help me focus on my next task', icon: 'target' },
        { text: 'Draft a professional email', icon: 'mail' },
        { text: 'Quick web search for...', icon: 'search' },
      ],
    };
  } else if (hour >= 17 && hour < 22) {
    return {
      greeting: `Good evening, ${firstName}!`,
      prompts: [
        { text: 'What did I accomplish today?', icon: 'trophy' },
        { text: 'Plan for tomorrow', icon: 'calendar-plus' },
        { text: 'Track an expense', icon: 'wallet' },
        { text: 'Help me write something', icon: 'pen' },
      ],
    };
  } else {
    return {
      greeting: `Hey ${firstName}, burning the midnight oil?`,
      prompts: [
        { text: 'Quick note before bed', icon: 'sticky-note' },
        { text: 'Set a morning reminder', icon: 'alarm' },
        { text: 'Remind me to drink water every 2 hours', icon: 'droplet' },
        { text: 'What can you help me with?', icon: 'help' },
      ],
    };
  }
}

/** Parse tool execution markers from streaming content.
 *  Format: [TOOL:tool_name:status:result] embedded in stream */
function parseToolSteps(content: string): { cleanContent: string; steps: ToolStep[] } {
  const steps: ToolStep[] = [];
  // Match <<<ACTION>>> blocks or [TOOL:...] markers in content
  const toolRegex = /\[TOOL:(\w+):(running|done|error)(?::([^\]]*))?\]/g;
  let match: RegExpExecArray | null;
  let cleanContent = content;

  while ((match = toolRegex.exec(content)) !== null) {
    const toolName = match[1];
    const status = match[2] as 'running' | 'done' | 'error';
    const result = match[3] || undefined;
    steps.push({
      id: `tool-${toolName}-${steps.length}`,
      tool: toolName,
      label: TOOL_LABELS[toolName]?.[status === 'running' ? 'running' : 'done'] || `${toolName}...`,
      status,
      result,
    });
    cleanContent = cleanContent.replace(match[0], '');
  }

  return { cleanContent: cleanContent.trim(), steps };
}

/** Agent color from conversation title hash */
const AGENT_COLORS = ['#00F0FF', '#8B5CF6', '#ADFF2F', '#FF6B9D', '#F59E0B', '#10B981', '#6366F1', '#84CC16', '#EC4899'];

function getAgentColor(id: string): string {
  const hash = id.charCodeAt(0) + (id.charCodeAt(1) || 0);
  return AGENT_COLORS[hash % AGENT_COLORS.length];
}

/** Conversation sidebar item */
function ConversationItem({
  title,
  timestamp,
  isActive,
  pinned,
  convId,
  onClick,
  onPin,
  onDelete,
}: {
  title: string;
  timestamp?: string;
  isActive: boolean;
  pinned: boolean;
  convId: string;
  onClick: () => void;
  onPin: () => void;
  onDelete: () => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const dotColor = getAgentColor(convId);

  return (
    <div
      className={[
        'group/conv flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all text-sm min-h-[44px] backdrop-blur-md',
        isActive
          ? 'text-[var(--ag-text-primary)]'
          : 'text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)]',
      ].join(' ')}
      style={{
        background: isActive ? 'var(--ag-active-bg)' : 'transparent',
        border: isActive ? '1px solid var(--ag-active-border)' : '1px solid transparent',
      }}
      onClick={onClick}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Agent color dot */}
      <span
        className='w-2 h-2 rounded-full shrink-0'
        style={{ backgroundColor: dotColor }}
      />
      {pinned && <Pin className='w-3 h-3 text-[var(--ag-cyan)] shrink-0 rotate-45' />}
      <div className='flex-1 min-w-0'>
        <p className='truncate text-xs'>{title || 'New conversation'}</p>
        {timestamp && (
          <p className='text-[10px] text-[var(--ag-text-muted)] mt-0.5'>{timestamp}</p>
        )}
      </div>
      {showActions && (
        <div className='flex items-center gap-0.5 shrink-0'>
          <button
            onClick={(e) => { e.stopPropagation(); onPin(); }}
            className='p-1 rounded hover:bg-[var(--ag-active-bg)] text-[var(--ag-text-muted)] hover:text-[var(--ag-cyan)] min-w-[24px] min-h-[24px] flex items-center justify-center'
            title={pinned ? 'Unpin' : 'Pin'}
            aria-label={pinned ? 'Unpin conversation' : 'Pin conversation'}
          >
            <Pin className='w-3 h-3' />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className='p-1 rounded hover:bg-[var(--ag-pink)]/10 text-[var(--ag-text-muted)] hover:text-[var(--ag-pink)] min-w-[24px] min-h-[24px] flex items-center justify-center'
            title='Delete conversation'
            aria-label='Delete conversation'
          >
            <Trash2 className='w-3 h-3' />
          </button>
        </div>
      )}
    </div>
  );
}

/** Stream health indicator dot */
function StreamHealthDot({ health }: { health: StreamHealth }) {
  const colors: Record<StreamHealth, string> = {
    connected: 'bg-[var(--ag-lime)]',
    slow: 'bg-[var(--ag-amber)]',
    disconnected: 'bg-[var(--ag-pink)]',
  };
  const labels: Record<StreamHealth, string> = {
    connected: 'Connected',
    slow: 'Slow connection',
    disconnected: 'Disconnected',
  };

  return (
    <div className='flex items-center gap-1.5' title={labels[health]}>
      <span className={`w-2 h-2 rounded-full ${colors[health]} ${health === 'slow' ? 'animate-pulse' : ''}`} />
      {health !== 'connected' && (
        <span className='text-[10px] text-[var(--ag-text-secondary)]'>{labels[health]}</span>
      )}
    </div>
  );
}

// ── Main Component ──

export function ChatPage() {
  const agent = useDashboardStore((s) => s.agent);
  const user = useAuthStore((s) => s.user);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [isTyping, setIsTyping] = useState(false);
  const [voiceMode, setVoiceMode] = useState<boolean>(getVoiceMode);
  const [interimText, setInterimText] = useState('');
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [councilMode, setCouncilMode] = useState(false);
  const userScrolledUpRef = useRef(false);

  // Streaming
  const streamBufferRef = useRef('');
  const rafRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isStreamActive, setIsStreamActive] = useState(false);
  const [streamHealth, setStreamHealth] = useState<StreamHealth>('connected');
  const lastChunkTimeRef = useRef<number>(Date.now());
  const reconnectCountRef = useRef(0);

  // SSE tool step tracking (agent-state-bus)
  const [sseToolSteps, setSSEToolSteps] = useState<SSEToolStep[]>([]);
  const [sseActive, setSSEActive] = useState(false);
  const [activeDelegation, setActiveDelegation] = useState<{
    from: string; to: string; reason?: string; status: 'delegating' | 'working' | 'done';
  } | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const sseStepTimersRef = useRef<Map<string, number>>(new Map());

  // Feedback state
  const [feedback, setFeedback] = useState<Record<string, FeedbackValue>>({});
  const [ratingNudgeDismissed, setRatingNudgeDismissed] = useState(false);
  const [sessionRating, setSessionRating] = useState<number | null>(null);
  const [ratingHover, setRatingHover] = useState(0);

  // Message editing state
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // @mention autocomplete state
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionedAgent, setMentionedAgent] = useState<MentionAgent | null>(null);
  const mentionStartRef = useRef<number>(-1);

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversationSearch, setConversationSearch] = useState('');
  const [conversations, setConversations] = useState<Array<{
    id: string;
    title: string;
    timestamp: string;
    pinned: boolean;
  }>>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Personality
  const personality: AgentPersonality = agent?.personality ?? 'weebo';
  const agentName = personality === 'edith' ? 'Edith' : personality === 'jarvis' ? 'Jarvis' : 'Weebo';

  // Agent canvas notifications
  const { notifyStart, notifyDone, notifyFail } = useAgentCanvas({ agent: 'weebo', page: 'chat' });

  const tts = useTTS();

  const handleTranscript = useCallback((text: string) => {
    setInterimText('');
    setInput(text);
    setTimeout(() => formRef.current?.requestSubmit(), 100);
  }, []);

  const voice = useVoice({
    onTranscript: handleTranscript,
    onInterim: setInterimText,
  });

  const scrollToBottom = useCallback(() => {
    virtuosoRef.current?.scrollToIndex({ index: 'LAST', behavior: 'smooth' });
    setShowScrollToBottom(false);
    setUnreadCount(0);
    userScrolledUpRef.current = false;
  }, []);

  // Track unread count when scrolled up and new messages arrive
  const prevMsgCountRef = useRef(0);
  useEffect(() => {
    if (userScrolledUpRef.current && messages.length > prevMsgCountRef.current) {
      const newCount = messages.length - prevMsgCountRef.current;
      setUnreadCount((c) => c + newCount);
    }
    prevMsgCountRef.current = messages.length;
  }, [messages.length]);

  // Virtuoso atBottom tracking callback
  const handleAtBottomStateChange = useCallback((atBottom: boolean) => {
    setShowScrollToBottom(!atBottom);
    userScrolledUpRef.current = !atBottom;
    if (atBottom) setUnreadCount(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      abortControllerRef.current?.abort();
      eventSourceRef.current?.close();
    };
  }, []);

  // Stream health monitor: check if chunks are arriving regularly
  useEffect(() => {
    if (!isStreamActive) {
      setStreamHealth('connected');
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastChunkTimeRef.current;
      if (elapsed > 15000) {
        setStreamHealth('disconnected');
      } else if (elapsed > 5000) {
        setStreamHealth('slow');
      } else {
        setStreamHealth('connected');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isStreamActive]);

  // ── SSE Agent State Subscription ──

  const connectAgentStateSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    const token = localStorage.getItem('gs_token');
    if (!token) return;
    const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');
    const sseUrl = `${apiBase}/agent-state/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;
    es.onopen = () => { setSSEActive(true); };
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as {
          agentId: string; agentName: string; state: string;
          tool?: string; content?: string; targetAgent?: string;
          taskId?: string; timestamp: string;
        };
        const stepId = `sse-${data.state}-${data.tool || ''}-${Date.now()}`;
        const typeMap: Record<string, SSEToolStep['type']> = {
          thinking: 'thinking', tool_call: 'tool_call', tool_result: 'tool_result',
          responding: 'responding', done: 'done', delegating: 'delegating',
          comm_sent: 'comm_sent', task_started: 'task_started',
          task_completed: 'task_completed', task_failed: 'task_failed',
        };
        const stepType = typeMap[data.state];
        if (!stepType) return;
        if (stepType === 'tool_result' || stepType === 'task_completed') {
          setSSEToolSteps((prev) => {
            const mt = stepType === 'tool_result' ? 'tool_call' : 'task_started';
            const idx = prev.findIndex((s) => s.status === 'active' && s.type === mt && s.tool === data.tool);
            if (idx >= 0) {
              const u = [...prev];
              const st = sseStepTimersRef.current.get(u[idx].id) || Date.now();
              u[idx] = { ...u[idx], status: 'done', content: data.content || u[idx].content, durationMs: Date.now() - st };
              return u;
            }
            return [...prev, { id: stepId, type: stepType, tool: data.tool, content: data.content || `${data.tool || 'Task'} complete`, status: 'done' as const, timestamp: data.timestamp }];
          });
          return;
        }
        if (stepType === 'task_failed') {
          setSSEToolSteps((prev) => {
            const idx = prev.findIndex((s) => s.status === 'active' && s.type === 'task_started');
            if (idx >= 0) {
              const u = [...prev];
              const st = sseStepTimersRef.current.get(u[idx].id) || Date.now();
              u[idx] = { ...u[idx], status: 'error', content: data.content || 'Task failed', durationMs: Date.now() - st };
              return u;
            }
            return [...prev, { id: stepId, type: stepType, content: data.content || 'Task failed', status: 'error' as const, timestamp: data.timestamp }];
          });
          return;
        }
        if (stepType === 'done') {
          setSSEToolSteps((prev) => prev.map((s) => s.status === 'active' ? { ...s, status: 'done' as const } : s));
          // Clear delegation indicator when agent is done
          setActiveDelegation((prev) => prev ? { ...prev, status: 'done' } : null);
          setTimeout(() => setActiveDelegation(null), 2000);
          return;
        }
        // Track delegation events for live indicator
        if (stepType === 'delegating' && data.targetAgent) {
          setActiveDelegation({ from: data.agentId, to: data.targetAgent, reason: data.content, status: 'delegating' });
        }
        if (stepType === 'comm_sent' && data.targetAgent) {
          setActiveDelegation((prev) => prev ? { ...prev, status: 'working' } : null);
        }
        if (stepType === 'responding') {
          setSSEToolSteps((prev) => prev.map((s) => s.status === 'active' && s.type === 'thinking' ? { ...s, status: 'done' as const } : s));
          return;
        }
        const defaultContent = data.content || getDefaultContent(stepType, data.tool, data.agentName, data.targetAgent);
        const newStep: SSEToolStep = { id: stepId, type: stepType, tool: data.tool, content: defaultContent, status: 'active', timestamp: data.timestamp };
        sseStepTimersRef.current.set(stepId, Date.now());
        if (stepType === 'thinking') {
          setSSEToolSteps((prev) => {
            const has = prev.some((s) => s.type === 'thinking' && s.status === 'active');
            if (has) return prev.map((s) => s.type === 'thinking' && s.status === 'active' ? { ...s, content: newStep.content } : s);
            return [...prev, newStep];
          });
          return;
        }
        if (stepType === 'tool_call') {
          setSSEToolSteps((prev) => [...prev.map((s) => s.type === 'thinking' && s.status === 'active' ? { ...s, status: 'done' as const } : s), newStep]);
          return;
        }
        setSSEToolSteps((prev) => [...prev, newStep]);
      } catch { /* ignore malformed SSE data */ }
    };
    es.onerror = () => { setSSEActive(false); };
  }, []);

  const disconnectAgentStateSSE = useCallback(() => {
    if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; }
    setSSEActive(false);
    sseStepTimersRef.current.clear();
  }, []);

  /** Build conversation list from entries for sidebar */
  const buildConversationList = useCallback((entries: Array<{ id: string; content: string; role: string; createdAt: string }>) => {
    // Group user messages as conversation starters
    const convos: Array<{ id: string; title: string; timestamp: string; pinned: boolean }> = [];
    const seen = new Set<string>();

    for (const entry of entries) {
      if (entry.role === 'user' && !seen.has(entry.id)) {
        seen.add(entry.id);
        convos.push({
          id: entry.id,
          title: entry.content.slice(0, 50) + (entry.content.length > 50 ? '...' : ''),
          timestamp: entry.createdAt ? luxonFormatDate(new Date(entry.createdAt)) : '',
          pinned: false,
        });
      }
    }

    // Load pinned state from localStorage
    try {
      const pinnedIds = JSON.parse(localStorage.getItem('agentin_pinned_convos') || '[]') as string[];
      for (const conv of convos) {
        if (pinnedIds.includes(conv.id)) conv.pinned = true;
      }
    } catch { /* ignore */ }

    setConversations(convos);
  }, []);

  // Load conversation history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await memoryService.conversations(30);
        const entries = res.data;
        if (Array.isArray(entries) && entries.length > 0) {
          const reversed = [...entries].reverse();
          setMessages(reversed.map((entry) => ({
            id: entry.id,
            role: entry.role === 'assistant' ? 'agent' : 'user',
            content: entry.content,
            timestamp: entry.createdAt ? new Date(entry.createdAt) : new Date(),
          })));

          buildConversationList(entries);
        }
      } catch {
        // Fresh start
      }
    };
    void loadHistory();
  }, [buildConversationList]);

  /** Core streaming chat with reconnect support */
  const sendMessage = useCallback(async (text: string, retryCount = 0) => {
    const userMsgId = `u-${Date.now()}`;
    const assistantMsgId = `a-${Date.now() + 1}`;

    // Only add user message on first attempt (not reconnects)
    if (retryCount === 0) {
      const userMsg: ChatMessage = {
        id: userMsgId,
        role: 'user',
        content: text,
        timestamp: new Date(),
        mentionedAgent: mentionedAgent ?? undefined,
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setMentionedAgent(null);
      setIsTyping(true);
      void notifyStart(`message: ${text.slice(0, 60)}`);

      setMessages((prev) => [
        ...prev,
        { id: assistantMsgId, role: 'agent', content: '', timestamp: new Date() },
      ]);

      // Update conversation list
      setConversations((prev) => [
        { id: userMsgId, title: text.slice(0, 50) + (text.length > 50 ? '...' : ''), timestamp: 'Just now', pinned: false },
        ...prev,
      ]);
    }

    abortControllerRef.current?.abort();
    const ac = new AbortController();
    abortControllerRef.current = ac;

    if (retryCount === 0) {
      streamBufferRef.current = '';
      // Start SSE agent-state subscription for real-time tool steps
      setSSEToolSteps([]);
      connectAgentStateSSE();
    }
    lastChunkTimeRef.current = Date.now();

    try {
      const response = await agentService.chatStream(text, 'web', ac.signal, selectedAgent || undefined);

      if (!response.ok || !response.body) {
        throw new Error(`Stream request failed: ${response.status}`);
      }

      setIsStreamActive(true);
      setStreamHealth('connected');
      reconnectCountRef.current = 0;

      // RAF flush loop — activeMsgId tracks which bubble we're streaming into
      let activeMsgId = retryCount === 0 ? assistantMsgId : messages[messages.length - 1]?.id || assistantMsgId;
      const flushBuffer = () => {
        const buffered = streamBufferRef.current;
        if (buffered) {
          const currentTarget = activeMsgId;
          const { cleanContent, steps } = parseToolSteps(buffered);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === currentTarget ? { ...m, content: cleanContent, toolSteps: steps.length > 0 ? steps : m.toolSteps } : m,
            ),
          );
        }
        rafRef.current = requestAnimationFrame(flushBuffer);
      };
      rafRef.current = requestAnimationFrame(flushBuffer);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        lastChunkTimeRef.current = Date.now();
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          try {
            const parsed = JSON.parse(data) as { text?: string; done?: boolean; newBubble?: boolean; agentId?: string; agentName?: string; agentEmoji?: string };
            if (parsed.done) continue;

            // Multi-agent: newBubble starts a new message bubble for a different agent
            if (parsed.newBubble) {
              // Flush current buffer to current message first
              const flushed = streamBufferRef.current;
              if (flushed) {
                const currentTarget = activeMsgId;
                const { cleanContent, steps } = parseToolSteps(flushed);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === currentTarget ? { ...m, content: cleanContent, toolSteps: steps.length > 0 ? steps : m.toolSteps } : m,
                  ),
                );
              }

              // Create new bubble for this agent
              const newMsgId = `a-${Date.now()}-${parsed.agentId || 'agent'}`;
              setMessages((prev) => [
                ...prev.filter((m) => m.id !== activeMsgId || m.content), // remove empty placeholder
                { id: newMsgId, role: 'agent' as const, content: '', timestamp: new Date(), agentId: parsed.agentId, agentName: parsed.agentName, agentEmoji: parsed.agentEmoji },
              ]);
              activeMsgId = newMsgId;
              streamBufferRef.current = '';
            }

            const chunk = parsed.text ?? '';
            if (chunk) {
              streamBufferRef.current += chunk;
            }
          } catch {
            // Ignore malformed SSE chunks
          }
        }
      }

      // Stop RAF loop
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }

      // Final flush
      const finalContent = streamBufferRef.current;
      if (finalContent) {
        const finalTarget = activeMsgId;
        const { cleanContent, steps } = parseToolSteps(finalContent);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === finalTarget ? { ...m, content: cleanContent, toolSteps: steps.length > 0 ? steps : m.toolSteps } : m,
          ),
        );
      }

      setIsStreamActive(false);
      setStreamHealth('connected');
      disconnectAgentStateSSE();
      void notifyDone('response complete');

      if (voiceMode && tts.isSupported && finalContent) {
        const { cleanContent } = parseToolSteps(finalContent);
        tts.speak(cleanContent);
      }
    } catch (err) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      setIsStreamActive(false);
      disconnectAgentStateSSE();

      // User abort — keep partial content
      if (err instanceof DOMException && err.name === 'AbortError') {
        const partial = streamBufferRef.current;
        if (partial) {
          const { cleanContent, steps } = parseToolSteps(partial);
          const targetId = retryCount === 0 ? assistantMsgId : messages[messages.length - 1]?.id || assistantMsgId;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === targetId ? { ...m, content: cleanContent, toolSteps: steps.length > 0 ? steps : m.toolSteps } : m,
            ),
          );
        }
        return;
      }

      // Reconnect with exponential backoff (3 retries: 1s, 3s, 9s)
      if (retryCount < RECONNECT_DELAYS.length) {
        const delay = RECONNECT_DELAYS[retryCount];
        setStreamHealth('disconnected');
        reconnectCountRef.current = retryCount + 1;
        toast.info(`Connection lost. Reconnecting in ${delay / 1000}s...`, {
          duration: delay,
          icon: <WifiOff className='w-4 h-4' />,
        });
        setTimeout(() => {
          void sendMessage(text, retryCount + 1);
        }, delay);
        return;
      }

      // All retries exhausted — fall back to sync
      setStreamHealth('disconnected');
      void notifyFail('stream failed, falling back to sync');
      const targetId = retryCount === 0 ? assistantMsgId : messages[messages.length - 1]?.id || assistantMsgId;
      setMessages((prev) => prev.filter((m) => m.id !== targetId));

      try {
        const res = await agentService.chat(text, personality);
        const reply = res.data.text ?? '';
        const fallbackMsg: ChatMessage = {
          id: `a-${Date.now()}`,
          role: 'agent',
          content: reply,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, fallbackMsg]);
        setStreamHealth('connected');
        if (voiceMode && tts.isSupported && reply) {
          tts.speak(reply);
        }
      } catch {
        setMessages((prev) => prev.filter((m) => m.id !== userMsgId));
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: 'agent',
            content: 'Sorry, something went wrong. Please try again.',
            timestamp: new Date(),
          },
        ]);
      }
    } finally {
      if (retryCount === 0 || retryCount >= RECONNECT_DELAYS.length) {
        setIsTyping(false);
        abortControllerRef.current = null;
      }
    }
  }, [messages, personality, voiceMode, tts, selectedAgent, mentionedAgent, connectAgentStateSSE, disconnectAgentStateSSE, notifyStart, notifyDone, notifyFail]);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || isTyping) return;
    // Council mode: prefix triggers multi-agent orchestration
    const finalText = councilMode ? `agent council: ${text}` : text;
    if (councilMode) setCouncilMode(false); // auto-off after sending
    await sendMessage(finalText);
  }, [input, isTyping, sendMessage, councilMode]);

  // ── Message Actions ──

  /** Regenerate: re-send the user prompt that preceded this AI message */
  const handleRegenerate = useCallback((msgId: string) => {
    const msgIndex = messages.findIndex((m) => m.id === msgId);
    if (msgIndex < 1) return;

    // Find the preceding user message
    let userMsg: ChatMessage | undefined;
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userMsg = messages[i];
        break;
      }
    }
    if (!userMsg) return;

    // Remove the AI message and re-send
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    void sendMessage(userMsg.content);
  }, [messages, sendMessage]);

  /** Edit user message: allow editing then re-send, replacing conversation from that point */
  const handleStartEdit = useCallback((msgId: string) => {
    const msg = messages.find((m) => m.id === msgId);
    if (!msg || msg.role !== 'user') return;
    setEditingMsgId(msgId);
    setEditText(msg.content);
  }, [messages]);

  const handleConfirmEdit = useCallback(() => {
    if (!editingMsgId || !editText.trim()) return;

    const editIndex = messages.findIndex((m) => m.id === editingMsgId);
    if (editIndex < 0) return;

    // Remove all messages from this point onwards
    setMessages((prev) => prev.slice(0, editIndex));
    setEditingMsgId(null);

    // Send the edited message
    setInput('');
    void sendMessage(editText.trim());
  }, [editingMsgId, editText, messages, sendMessage]);

  const handleCancelEdit = useCallback(() => {
    setEditingMsgId(null);
    setEditText('');
  }, []);

  /** Pin message as a note (saves to conversation with star) */
  const handlePinToNotes = useCallback((msgId: string, content: string) => {
    agentService.toggleStar(msgId).then(() => {
      toast.success('Message pinned to notes', { duration: 2000 });
    }).catch(() => {
      toast.error('Failed to pin message');
    });
    // Also copy to clipboard as fallback
    navigator.clipboard.writeText(content).catch(() => {});
  }, []);

  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const handleCopyMessage = useCallback((msgId: string, content: string) => {
    navigator.clipboard.writeText(content).catch(() => {});
    setCopiedMsgId(msgId);
    toast.success('Copied to clipboard', { duration: 1500 });
    setTimeout(() => setCopiedMsgId(null), 2000);
  }, []);

  const handleFeedback = useCallback((msgId: string, value: FeedbackValue) => {
    setFeedback((prev) => {
      const current = prev[msgId];
      const next = current === value ? null : value;
      if (next) {
        const reaction = next === 'up' ? 'like' : 'dislike';
        memoryService.addReaction(msgId, reaction).catch(() => {});
      }
      return { ...prev, [msgId]: next };
    });
  }, []);

  // ── Voice ──

  const toggleVoiceMode = useCallback(() => {
    setVoiceMode((prev) => {
      const next = !prev;
      try {
        const raw = localStorage.getItem('agentin_voice_settings');
        const cfg: Record<string, unknown> = raw ? JSON.parse(raw) as Record<string, unknown> : {};
        cfg.enabled = next;
        localStorage.setItem('agentin_voice_settings', JSON.stringify(cfg));
      } catch { /* ignore */ }
      if (!next && tts.isSpeaking) tts.stop();
      return next;
    });
  }, [tts]);

  const clearChat = useCallback(() => {
    tts.stop();
    setMessages([]);
    setSSEToolSteps([]);
    disconnectAgentStateSSE();
  }, [tts, disconnectAgentStateSSE]);

  // ── @mention handlers ──

  /** Detect "@" in input and manage the mention popup */
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);

    const cursorPos = e.target.selectionStart ?? val.length;
    // Find the last "@" before the cursor
    const textBeforeCursor = val.slice(0, cursorPos);
    const atIdx = textBeforeCursor.lastIndexOf('@');

    if (atIdx >= 0) {
      // Only trigger if "@" is at the start or preceded by whitespace
      const charBefore = atIdx > 0 ? val[atIdx - 1] : ' ';
      if (charBefore === ' ' || charBefore === '\n' || atIdx === 0) {
        const query = textBeforeCursor.slice(atIdx + 1);
        // No spaces in the query — once a space is typed, close the popup
        if (!query.includes(' ')) {
          mentionStartRef.current = atIdx;
          setMentionQuery(query);
          setShowMentionPopup(true);
          return;
        }
      }
    }

    setShowMentionPopup(false);
    setMentionQuery('');
  }, []);

  /** Insert agent mention into input and select the agent */
  const handleMentionSelect = useCallback((agent: MentionAgent) => {
    const atIdx = mentionStartRef.current;
    if (atIdx < 0) return;

    const before = input.slice(0, atIdx);
    const cursorPos = textareaRef.current?.selectionStart ?? input.length;
    const after = input.slice(cursorPos);
    const newInput = `${before}@${agent.name} ${after}`;
    setInput(newInput);
    setMentionedAgent(agent);
    setSelectedAgent(agent.id);
    setShowMentionPopup(false);
    setMentionQuery('');
    mentionStartRef.current = -1;

    // Refocus the textarea and place cursor after the mention
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        const pos = before.length + agent.name.length + 2; // +2 for "@" and " "
        el.setSelectionRange(pos, pos);
      }
    });
  }, [input]);

  /** Clear mention badge */
  const clearMention = useCallback(() => {
    setMentionedAgent(null);
  }, []);

  // ── Sidebar ──

  const handlePinConversation = useCallback((convId: string) => {
    setConversations((prev) => {
      const updated = prev.map((c) =>
        c.id === convId ? { ...c, pinned: !c.pinned } : c,
      );
      // Persist pinned state
      const pinnedIds = updated.filter((c) => c.pinned).map((c) => c.id);
      localStorage.setItem('agentin_pinned_convos', JSON.stringify(pinnedIds));
      return updated;
    });
  }, []);

  const handleDeleteConversation = useCallback((convId: string) => {
    if (deleteConfirmId === convId) {
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      setDeleteConfirmId(null);
      toast.success('Conversation removed', { duration: 1500 });
    } else {
      setDeleteConfirmId(convId);
      // Auto-clear confirm after 3 seconds
      setTimeout(() => setDeleteConfirmId(null), 3000);
    }
  }, [deleteConfirmId]);

  const filteredConversations = useMemo(() => {
    let convos = conversations;
    if (conversationSearch.trim()) {
      const q = conversationSearch.toLowerCase();
      convos = convos.filter((c) => c.title.toLowerCase().includes(q));
    }
    // Sort: pinned first, then by most recent
    return [...convos].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return 0;
    });
  }, [conversations, conversationSearch]);

  // ── Layout ──

  const timestampVisible = useMemo(() => buildTimestampVisibility(messages), [messages]);

  const timeContext = useMemo(() => getTimeOfDayContext(user?.name || ''), [user?.name]);

  const handleStarterPrompt = useCallback((prompt: string) => {
    setInput(prompt);
    setTimeout(() => formRef.current?.requestSubmit(), 100);
  }, []);

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  useEffect(() => {
    autoResize();
  }, [input, autoResize]);

  const personalityMeta: Record<AgentPersonality, { emoji: string; color: string; glow: string; initial: string }> = {
    edith: { emoji: 'E', color: 'var(--ag-violet)', glow: '0 0 12px rgba(139,92,246,0.4)', initial: 'E' },
    jarvis: { emoji: 'J', color: '#ADFF2F', glow: '0 0 12px rgba(173,255,47,0.4)', initial: 'J' },
    weebo: { emoji: 'W', color: 'var(--ag-cyan)', glow: '0 0 12px rgba(0,240,255,0.4)', initial: 'W' },
    aria: { emoji: 'A', color: '#FF6B9D', glow: '0 0 12px rgba(255,107,157,0.4)', initial: 'A' },
    forge: { emoji: 'F', color: '#F59E0B', glow: '0 0 12px rgba(245,158,11,0.4)', initial: 'F' },
    pulse: { emoji: 'P', color: '#10B981', glow: '0 0 12px rgba(16,185,129,0.4)', initial: 'P' },
    echo: { emoji: 'E', color: '#6366F1', glow: '0 0 12px rgba(99,102,241,0.4)', initial: 'E' },
    cal: { emoji: 'C', color: '#84CC16', glow: '0 0 12px rgba(132,204,22,0.4)', initial: 'C' },
    nova: { emoji: 'N', color: '#EC4899', glow: '0 0 12px rgba(236,72,153,0.4)', initial: 'N' },
  };
  const meta = personalityMeta[personality];

  return (
    <DashboardPageWrapper>
    <PageShell maxWidth="full" spacing={4} className="!p-0 md:!p-0 !pb-0 md:!pb-0">
    <div className='flex h-[calc(100dvh-184px)] md:h-[calc(100vh-130px)]'>
      {/* ── Conversation Sidebar ── */}
      {sidebarOpen && (
        <div className='w-64 md:w-72 flex-shrink-0 border-r flex flex-col rounded-l-xl overflow-hidden backdrop-blur-xl' style={{ background: 'var(--ag-glass-bg)', borderColor: 'var(--ag-glass-border)' }}>
          {/* Sidebar Header */}
          <div className='flex items-center justify-between px-3 py-3 border-b' style={{ borderColor: 'var(--ag-border-subtle)' }}>
            <h3 className='text-xs font-semibold text-[var(--ag-text-primary)] uppercase tracking-wider'>Conversations</h3>
            <button
              onClick={() => setSidebarOpen(false)}
              className='p-1 rounded hover:bg-[var(--ag-cyan)]/10 text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] min-w-[28px] min-h-[28px] flex items-center justify-center'
              title='Close sidebar'
              aria-label='Close sidebar'
            >
              <PanelLeftClose className='w-4 h-4' />
            </button>
          </div>

          {/* New Chat button */}
          <div className='px-3 py-2'>
            <button
              onClick={clearChat}
              className='flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-[var(--ag-cyan)]/10 text-[var(--ag-cyan)] hover:bg-[var(--ag-cyan)]/20 transition-colors text-xs font-medium min-h-[44px]'
            >
              <Plus className='w-3.5 h-3.5' />
              New Chat
            </button>
          </div>

          {/* Search conversations */}
          <div className='px-3 pb-2'>
            <div className='relative'>
              <Search className='w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ag-text-muted)]' />
              <input
                type='text'
                value={conversationSearch}
                onChange={(e) => setConversationSearch(e.target.value)}
                placeholder='Search conversations...'
                className='w-full pl-8 pr-3 py-2 rounded-lg bg-[var(--ag-bg-surface)] border border-[var(--ag-border-subtle)] text-[var(--ag-text-primary)] placeholder:text-[var(--ag-text-muted)] text-xs focus:outline-none focus:border-[var(--ag-border-default)] min-h-[36px]'
              />
            </div>
          </div>

          {/* Conversation list */}
          <div className='flex-1 overflow-y-auto px-2 pb-2 space-y-0.5 scrollbar-hide'>
            {filteredConversations.length === 0 ? (
              <p className='text-xs text-[var(--ag-text-muted)] text-center py-8'>No conversations yet</p>
            ) : (
              filteredConversations.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  convId={conv.id}
                  title={conv.title}
                  timestamp={conv.timestamp}
                  isActive={false}
                  pinned={conv.pinned}
                  onClick={() => {
                    // Scroll to message in current view
                    const el = document.getElementById(`msg-${conv.id}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  onPin={() => handlePinConversation(conv.id)}
                  onDelete={() => handleDeleteConversation(conv.id)}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Main Chat Area ── */}
      <div className='flex-1 flex flex-col rounded-xl border min-w-0 relative' style={{ background: 'var(--ag-bg-deep)', borderColor: 'var(--ag-border-subtle)' }}>
        {/* Header */}
        <div className='flex items-center justify-between px-4 py-3 border-b flex-shrink-0 backdrop-blur-md' style={{ borderColor: 'var(--ag-border-subtle)', background: 'var(--ag-glass-bg)' }}>
          <div className='flex items-center gap-3'>
            {/* Sidebar toggle */}
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className='p-1.5 rounded-lg hover:bg-[var(--ag-cyan)]/10 text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] min-h-[36px] min-w-[36px] flex items-center justify-center'
                title='Open conversation sidebar'
                aria-label='Open conversation sidebar'
              >
                <PanelLeft className='w-4 h-4' />
              </button>
            )}
            {/* Agent avatar */}
            <div className='relative'>
              <div
                className='w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-black relative z-10'
                style={{ background: meta.color, boxShadow: meta.glow }}
              >
                {meta.initial}
              </div>
              {isTyping && (
                <span
                  className='absolute inset-0 rounded-full animate-ping'
                  style={{ border: `2px solid ${meta.color}`, opacity: 0.4 }}
                />
              )}
            </div>
            <div>
              <div className='flex items-center gap-2'>
                {/* Agent ownership dot */}
                <span className='w-2 h-2 rounded-full shrink-0' style={{ backgroundColor: 'var(--ag-weebo)' }} title='Owned by Weebo' />
                <h2 className='text-sm font-semibold text-[var(--ag-text-primary)] font-heading'>{agentName}</h2>
                {/* Stream health indicator */}
                {isStreamActive && <StreamHealthDot health={streamHealth} />}
              </div>
              <p className='text-xs text-[var(--ag-text-secondary)]'>
                {isTyping ? <span className='text-shimmer'>Thinking...</span> : 'AI Assistant'}
              </p>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            {tts.isSpeaking && (
              <button
                onClick={() => tts.stop()}
                className='p-1.5 rounded-lg hover:bg-[var(--ag-cyan)]/10 text-[var(--ag-cyan)] min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-[var(--ag-cyan)]/50'
                title='Stop speaking'
                aria-label='Stop speaking'
              >
                <VolumeX className='w-4 h-4' />
              </button>
            )}
            <button
              onClick={toggleVoiceMode}
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all min-h-[44px] focus-visible:ring-2 focus-visible:ring-[var(--ag-cyan)]/50',
                voiceMode
                  ? 'bg-[var(--ag-cyan)]/20 text-[var(--ag-cyan)] ring-1 ring-[var(--ag-cyan)]/40'
                  : 'hover:bg-[var(--ag-cyan)]/10 text-[var(--ag-text-secondary)]',
              ].join(' ')}
              title={voiceMode ? 'Voice mode on' : 'Enable voice mode'}
            >
              <Volume2 className='w-3.5 h-3.5' />
              <span className='hidden sm:inline'>Voice {voiceMode ? 'On' : 'Off'}</span>
            </button>
            <button
              onClick={clearChat}
              className='p-1.5 rounded-lg hover:bg-[var(--ag-cyan)]/10 text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-[var(--ag-cyan)]/50'
              title='Clear chat'
              aria-label='Clear chat'
            >
              <RotateCcw className='w-4 h-4' />
            </button>
          </div>
        </div>

        {/* Messages — Virtualized */}
        {messages.length === 0 ? (
          <div className='flex-1 overflow-y-auto px-4 py-3 scrollbar-hide relative'>
            <div className='flex flex-col items-center justify-center h-full gap-4 text-center py-12'>
              {/* Session continuity — "Welcome back" banner */}
              <SessionContinuityBanner
                onResume={(text) => { setInput(text); setTimeout(() => formRef.current?.requestSubmit(), 100); }}
              />
              {/* Hero avatar */}
              <div className='relative'>
                <div
                  className='w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-black relative z-10'
                  style={{ background: meta.color, boxShadow: meta.glow }}
                >
                  {meta.initial}
                </div>
                <span
                  className='absolute inset-[-4px] rounded-full'
                  style={{ border: `1.5px solid ${meta.color}`, opacity: 0.25 }}
                />
              </div>
              <div>
                <p className='text-lg font-semibold text-[var(--ag-text-primary)] font-heading'>{timeContext.greeting}</p>
                <p className='text-sm text-[var(--ag-text-secondary)] mt-1 max-w-xs'>
                  {voice.isSupported ? 'Type, speak, or try a suggestion below' : 'Type a message or try a suggestion below'}
                </p>
                {/* Agent capabilities */}
                <AgentCapabilityBadge agentId={personality} className='mt-2 justify-center' />
              </div>
              {voiceMode && voice.isSupported && (
                <div className='flex items-center gap-1.5 text-xs text-[var(--ag-cyan)]'>
                  <Sparkles className='w-3.5 h-3.5' />
                  Voice mode active
                </div>
              )}
              {/* Context-aware starter prompts */}
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md'>
                {timeContext.prompts.map((prompt) => (
                  <button
                    key={prompt.text}
                    onClick={() => handleStarterPrompt(prompt.text)}
                    className='flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[var(--ag-bg-surface)] backdrop-blur-xl border border-[var(--ag-border-subtle)] text-left text-sm text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:border-[var(--ag-border-default)] hover:shadow-[var(--ag-glow-sm)] transition-all duration-200 min-h-[44px]'
                  >
                    <Clock className='w-4 h-4 text-[var(--ag-cyan)]/50 shrink-0' />
                    <span className='line-clamp-2'>{prompt.text}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            data={messages}
            className='flex-1 scrollbar-hide'
            style={{ overflowX: 'hidden' }}
            followOutput='smooth'
            alignToBottom
            atBottomThreshold={120}
            atBottomStateChange={handleAtBottomStateChange}
            increaseViewportBy={{ top: 200, bottom: 200 }}
            computeItemKey={(_index, msg) => msg.id}
            itemContent={(_index, msg) => {
              const showTimestamp = timestampVisible.has(msg.id);
              const isStreaming = isStreamActive && msg.role === 'agent' && msg.id === messages[messages.length - 1]?.id;
              const msgFeedback = feedback[msg.id] ?? null;
              const isEditingMsg = editingMsgId === msg.id;

              return (
                <div className='px-4 py-1.5'>
                  <ChatMessageBubble
                    msg={msg}
                    isStreaming={isStreaming}
                    showTimestamp={showTimestamp}
                    msgFeedback={msgFeedback}
                    isEditing={isEditingMsg}
                    editText={editText}
                    copiedMsgId={copiedMsgId}
                    isTyping={isTyping}
                    meta={msg.agentId && personalityMeta[msg.agentId as AgentPersonality] ? personalityMeta[msg.agentId as AgentPersonality] : meta}
                    formatRelativeTime={formatRelativeTime}
                    formatDateTime={luxonFormatDateTime}
                    onRegenerate={handleRegenerate}
                    onPinToNotes={handlePinToNotes}
                    onCopyMessage={handleCopyMessage}
                    onFeedback={handleFeedback}
                    onStartEdit={handleStartEdit}
                    onConfirmEdit={handleConfirmEdit}
                    onCancelEdit={handleCancelEdit}
                    onEditTextChange={setEditText}
                  />
                </div>
              );
            }}
            components={{
              Footer: () => (
                <div className='px-4 py-1.5'>
                  {/* Rating Nudge — show after 5+ agent messages */}
                  {(() => {
                    const agentMsgCount = messages.filter(m => m.role === 'agent').length;
                    if (agentMsgCount >= 5 && !ratingNudgeDismissed && sessionRating === null && !isTyping) {
                      return (
                        <div className="mx-2 mb-2 p-3 rounded-xl bg-[var(--ag-bg-surface)] backdrop-blur-xl border border-[var(--ag-border-subtle)] flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                          <span className="text-xs text-[var(--ag-text-secondary)] whitespace-nowrap">Rate this session:</span>
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                onMouseEnter={() => setRatingHover(star)}
                                onMouseLeave={() => setRatingHover(0)}
                                onClick={() => {
                                  setSessionRating(star);
                                  const lastAgentMsg = [...messages].reverse().find(m => m.role === 'agent');
                                  if (lastAgentMsg) {
                                    agentService.rateConversation(lastAgentMsg.id, star).catch(() => {});
                                  }
                                  toast.success(`Rated ${star} star${star > 1 ? 's' : ''}`, { duration: 1500 });
                                }}
                                className="p-0.5 min-w-[28px] min-h-[28px] flex items-center justify-center transition-transform hover:scale-110"
                              >
                                <Star
                                  className={`w-4 h-4 transition-colors ${
                                    star <= (ratingHover || sessionRating || 0)
                                      ? 'fill-yellow-400 text-yellow-400'
                                      : 'text-[var(--ag-text-primary)]/20'
                                  }`}
                                />
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => setRatingNudgeDismissed(true)}
                            className="ml-auto p-1 text-[var(--ag-text-muted)] hover:text-[var(--ag-text-secondary)] transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Delegation Live Indicator */}
                  {activeDelegation && (
                    <DelegationLiveIndicator
                      fromAgent={activeDelegation.from}
                      toAgent={activeDelegation.to}
                      reason={activeDelegation.reason}
                      status={activeDelegation.status}
                      showCapabilities={activeDelegation.status === 'delegating'}
                    />
                  )}

                  {/* SSE Tool Step Indicator */}
                  {sseToolSteps.length > 0 && (
                    <div className='flex gap-2 justify-start'>
                      <div className='relative shrink-0 self-start mt-0.5'>
                        <div
                          className='w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-black relative z-10'
                          style={{ background: meta.color, boxShadow: sseActive ? meta.glow : 'none' }}
                        >
                          {meta.initial}
                        </div>
                        {sseActive && (
                          <span
                            className='absolute inset-0 rounded-full animate-ping'
                            style={{ border: `1.5px solid ${meta.color}`, opacity: 0.35 }}
                          />
                        )}
                      </div>
                      <div className='max-w-[80%] min-w-[240px]'>
                        <ToolStepIndicator steps={sseToolSteps} isActive={isTyping || isStreamActive} />
                      </div>
                    </div>
                  )}

                  {isTyping && !isStreamActive && (
                    <div className='flex gap-2 justify-start'>
                      <div className='relative shrink-0 self-start mt-0.5'>
                        <div
                          className='w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-black relative z-10'
                          style={{ background: meta.color, boxShadow: meta.glow }}
                        >
                          {meta.initial}
                        </div>
                        <span
                          className='absolute inset-0 rounded-full animate-ping'
                          style={{ border: `1.5px solid ${meta.color}`, opacity: 0.35 }}
                        />
                      </div>
                      <div className='bg-[var(--ag-bg-surface)] backdrop-blur-xl border border-[var(--ag-border-subtle)] rounded-xl rounded-tl-sm px-3 py-2.5 flex items-center gap-1.5'>
                        <span className='text-xs text-[var(--ag-text-secondary)] mr-1'>{agentName} is typing</span>
                        <span className='w-1.5 h-1.5 rounded-full bg-[var(--ag-cyan)]/60' style={{ animation: 'typing-dot 1.2s ease-in-out infinite', animationDelay: '0ms' }} />
                        <span className='w-1.5 h-1.5 rounded-full bg-[var(--ag-cyan)]/60' style={{ animation: 'typing-dot 1.2s ease-in-out infinite', animationDelay: '200ms' }} />
                        <span className='w-1.5 h-1.5 rounded-full bg-[var(--ag-cyan)]/60' style={{ animation: 'typing-dot 1.2s ease-in-out infinite', animationDelay: '400ms' }} />
                      </div>
                    </div>
                  )}

                  {/* Stop generating */}
                  {isStreamActive && (
                    <div className='flex justify-center py-1'>
                      <button
                        onClick={() => {
                          abortControllerRef.current?.abort();
                          abortControllerRef.current = null;
                          setIsStreamActive(false);
                          if (rafRef.current) {
                            cancelAnimationFrame(rafRef.current);
                            rafRef.current = 0;
                          }
                        }}
                        className='flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--ag-bg-surface)] border border-[var(--ag-border-default)] text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:border-[var(--ag-cyan)]/40 transition-all min-h-[36px]'
                      >
                        <Square className='w-3 h-3' />
                        Stop generating
                      </button>
                    </div>
                  )}

                  {/* Reconnecting indicator */}
                  {streamHealth === 'disconnected' && !isStreamActive && isTyping && (
                    <div className='flex justify-center py-2'>
                      <div className='flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--ag-pink)]/10 border border-[var(--ag-pink)]/20 text-xs text-[var(--ag-pink)]'>
                        <Wifi className='w-3 h-3 animate-pulse' />
                        Reconnecting... (attempt {reconnectCountRef.current}/{RECONNECT_DELAYS.length})
                      </div>
                    </div>
                  )}

                  {interimText && (
                    <div className='flex justify-end'>
                      <div className='max-w-[80%] px-3 py-2 rounded-xl text-sm bg-[var(--ag-cyan)]/5 text-[var(--ag-text-secondary)] border border-dashed border-[var(--ag-cyan)]/20 italic'>
                        {interimText}
                      </div>
                    </div>
                  )}
                </div>
              ),
            }}
          />
        )}
        {/* Scroll to bottom button */}
        {showScrollToBottom && (
          <div className='absolute bottom-20 right-4 z-10'>
            <button
              onClick={scrollToBottom}
              className='flex items-center gap-1.5 px-3 py-2 rounded-full bg-[var(--ag-bg-surface)] backdrop-blur-xl border border-[var(--ag-cyan)]/30 text-[var(--ag-cyan)] hover:bg-[var(--ag-cyan)]/10 transition-all shadow-lg shadow-[var(--ag-cyan)]/10 min-h-[44px] min-w-[44px] justify-center'
              aria-label='Scroll to bottom'
              title='Scroll to bottom'
            >
              <ChevronDown className='w-4 h-4' />
              {unreadCount > 0 && (
                <span className='text-xs font-semibold tabular-nums'>{unreadCount}</span>
              )}
            </button>
          </div>
        )}

        {/* Input */}
        <div className='px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t flex-shrink-0 backdrop-blur-md' style={{ borderColor: 'var(--ag-border-subtle)', background: 'var(--ag-glass-bg)' }}>
          {/* Agent Picker */}
          <div className='flex gap-1.5 pb-2 overflow-x-auto' style={{ scrollbarWidth: 'none' }}>
            {[
              { id: '', name: 'Auto', emoji: '🤖', color: '#8892A4' },
              { id: 'weebo', name: 'Weebo', emoji: '✨', color: 'var(--ag-cyan)' },
              { id: 'edith', name: 'Edith', emoji: '⚡', color: 'var(--ag-violet)' },
              { id: 'jarvis', name: 'Jarvis', emoji: '🎩', color: '#ADFF2F' },
              { id: 'aria', name: 'Aria', emoji: '🎨', color: '#FF6B9D' },
              { id: 'forge', name: 'Forge', emoji: '🔧', color: '#F59E0B' },
              { id: 'pulse', name: 'Pulse', emoji: '📊', color: '#10B981' },
              { id: 'echo', name: 'Echo', emoji: '💙', color: '#6366F1' },
              { id: 'cal', name: 'Cal', emoji: '📅', color: '#84CC16' },
              { id: 'nova', name: 'Nova', emoji: '🔭', color: '#EC4899' },
            ].map(p => (
              <button
                key={p.id}
                type='button'
                onClick={() => setSelectedAgent(p.id)}
                className='flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium shrink-0 transition-all'
                style={{
                  border: `1px solid ${selectedAgent === p.id ? p.color + '60' : 'rgba(255,255,255,0.06)'}`,
                  background: selectedAgent === p.id ? p.color + '15' : 'transparent',
                  color: selectedAgent === p.id ? p.color : '#8892A4',
                }}
              >
                <span>{p.emoji}</span>
                <span>{p.name}</span>
              </button>
            ))}
          </div>
          {voice.error && (
            <p className='text-xs text-[var(--ag-pink)] mb-2'>{voice.error}</p>
          )}
          {/* Council mode banner */}
          {councilMode && (
            <div className='flex items-center gap-2 pb-1.5'>
              <span className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-[var(--ag-aria)]/10 border border-[var(--ag-aria)]/20 text-[var(--ag-aria)] animate-pulse'>
                <Sparkles className='w-3 h-3' />
                Council Mode — all agents will discuss your question
                <button
                  type='button'
                  onClick={() => setCouncilMode(false)}
                  className='ml-0.5 hover:text-white transition-colors'
                >
                  <X className='w-3 h-3' />
                </button>
              </span>
            </div>
          )}
          {/* Mentioned agent badge */}
          {mentionedAgent && (
            <div className='flex items-center gap-1 pb-1.5'>
              <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--ag-cyan)]/10 border border-[var(--ag-cyan)]/15 text-[var(--ag-cyan)]'>
                <span>{mentionedAgent.emoji}</span>
                <span>@{mentionedAgent.name}</span>
                <button
                  type='button'
                  onClick={clearMention}
                  className='ml-0.5 hover:text-[var(--ag-pink)] transition-colors'
                  aria-label={`Remove @${mentionedAgent.name} mention`}
                >
                  <X className='w-3 h-3' />
                </button>
              </span>
            </div>
          )}
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className='flex items-end gap-2'
          >
            <div className='flex-1 relative'>
              {/* @mention autocomplete popup */}
              <AgentMentionPopup
                query={mentionQuery}
                onSelect={handleMentionSelect}
                onClose={() => { setShowMentionPopup(false); setMentionQuery(''); }}
                visible={showMentionPopup}
                anchorRef={textareaRef}
              />
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  // Don't submit when mention popup is open — let popup handle Enter/Escape
                  if (showMentionPopup && (e.key === 'Enter' || e.key === 'Escape' || e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Tab')) {
                    return;
                  }
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    formRef.current?.requestSubmit();
                  }
                }}
                placeholder={voice.isListening ? 'Listening...' : 'Type @ to mention an agent...'}
                disabled={isTyping}
                rows={1}
                enterKeyHint='send'
                inputMode='text'
                autoCapitalize='sentences'
                className='w-full resize-none bg-[var(--ag-bg-surface)] border border-[var(--ag-border-default)] text-[var(--ag-text-primary)] placeholder:text-[var(--ag-text-muted)] focus:border-[var(--ag-violet)]/40 focus:outline-none focus:ring-2 focus:ring-[var(--ag-violet)]/15 focus:shadow-[0_0_20px_rgba(139,92,246,0.08)] rounded-xl px-3 py-2.5 text-sm leading-relaxed min-h-[44px] max-h-[120px] scrollbar-hide touch-manipulation transition-all duration-200'
              />
              {input.length > 200 && (
                <span className='absolute right-2 bottom-1.5 text-[10px] text-[var(--ag-text-muted)] tabular-nums pointer-events-none'>
                  {input.length}
                </span>
              )}
            </div>
            <VoiceButton
              onTranscript={handleTranscript}
              isListening={voice.isListening}
              isProcessing={isTyping && input === ''}
              isSupported={voice.isSupported}
              onClick={voice.startListening}
            />
            <button
              type='button'
              onClick={() => setCouncilMode(!councilMode)}
              title={councilMode ? 'Council mode ON — all agents will discuss your next message' : 'Council mode — get all agents\' perspectives'}
              className={[
                'h-10 px-2.5 min-w-[44px] min-h-[44px] rounded-md transition-all shrink-0 text-xs font-medium',
                councilMode
                  ? 'bg-[var(--ag-aria)]/20 text-[var(--ag-aria)] border border-[var(--ag-aria)]/40 ring-1 ring-[var(--ag-aria)]/30'
                  : 'bg-[var(--ag-bg-surface)] text-[var(--ag-text-muted)] border border-[var(--ag-border-subtle)] hover:text-[var(--ag-cyan)] hover:border-[var(--ag-border-default)]',
              ].join(' ')}
              aria-label='Toggle council mode'
            >
              <Sparkles className='w-4 h-4' />
            </button>
            <Button
              type='submit'
              disabled={!input.trim() || isTyping}
              className='bg-[var(--ag-cyan)] hover:bg-[var(--ag-cyan)]/80 text-black h-10 px-3 min-w-[44px] min-h-[44px] focus-visible:ring-2 focus-visible:ring-[var(--ag-cyan)]/50 shrink-0'
              aria-label='Send message'
            >
              <Send className='w-4 h-4' />
            </Button>
          </form>
          <div className='flex items-center justify-between mt-1.5 px-0.5'>
            <p className='text-[10px] text-[var(--ag-text-muted)]'>
              Shift+Enter for new line &middot; @ to mention &middot; <Sparkles className='w-2.5 h-2.5 inline' /> for council
            </p>
            <p className='text-[10px] text-[var(--ag-text-muted)]'>
              Alt+V for voice
            </p>
          </div>
        </div>
      </div>
    </div>
    </PageShell>
    </DashboardPageWrapper>
  );
}
