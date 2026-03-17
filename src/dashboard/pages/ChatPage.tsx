import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Send, Volume2, VolumeX, RotateCcw, Sparkles, Copy, Check, Square,
  ThumbsUp, ThumbsDown, RefreshCw, Pencil, Pin, Search, Plus, Trash2,
  MessageSquare, ChevronDown, ChevronRight, X, PanelLeftClose, PanelLeft,
  Wifi, WifiOff, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { agentService, memoryService } from '@/services/api';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useAuthStore } from '@/stores/authStore';
import { useVoice } from '@/hooks/useVoice';
import { useTTS } from '@/hooks/useTTS';
import { VoiceButton } from '@/components/VoiceButton';
import type { AgentPersonality } from '@/types';

// ── Types ──

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
  /** Tool execution steps parsed from the AI response */
  toolSteps?: ToolStep[];
}

interface ToolStep {
  id: string;
  tool: string;
  label: string;
  status: 'running' | 'done' | 'error';
  result?: string;
  durationMs?: number;
}

type FeedbackValue = 'up' | 'down' | null;

type StreamHealth = 'connected' | 'slow' | 'disconnected';

// ── Constants ──

const LANG_COLORS: Record<string, { label: string; bg: string; text: string }> = {
  javascript: { label: 'JavaScript', bg: 'bg-cyan-500/15', text: 'text-cyan-400' },
  js: { label: 'JavaScript', bg: 'bg-cyan-500/15', text: 'text-cyan-400' },
  typescript: { label: 'TypeScript', bg: 'bg-blue-500/15', text: 'text-blue-400' },
  ts: { label: 'TypeScript', bg: 'bg-blue-500/15', text: 'text-blue-400' },
  tsx: { label: 'TSX', bg: 'bg-blue-500/15', text: 'text-blue-400' },
  jsx: { label: 'JSX', bg: 'bg-cyan-500/15', text: 'text-cyan-400' },
  python: { label: 'Python', bg: 'bg-yellow-500/15', text: 'text-yellow-400' },
  py: { label: 'Python', bg: 'bg-yellow-500/15', text: 'text-yellow-400' },
  html: { label: 'HTML', bg: 'bg-orange-500/15', text: 'text-orange-400' },
  css: { label: 'CSS', bg: 'bg-pink-500/15', text: 'text-pink-400' },
  json: { label: 'JSON', bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  bash: { label: 'Bash', bg: 'bg-green-500/15', text: 'text-green-400' },
  sh: { label: 'Shell', bg: 'bg-green-500/15', text: 'text-green-400' },
  sql: { label: 'SQL', bg: 'bg-violet-500/15', text: 'text-violet-400' },
  rust: { label: 'Rust', bg: 'bg-orange-600/15', text: 'text-orange-300' },
  go: { label: 'Go', bg: 'bg-sky-500/15', text: 'text-sky-400' },
  java: { label: 'Java', bg: 'bg-red-500/15', text: 'text-red-400' },
  c: { label: 'C', bg: 'bg-gray-500/15', text: 'text-gray-400' },
  cpp: { label: 'C++', bg: 'bg-gray-500/15', text: 'text-gray-400' },
  yaml: { label: 'YAML', bg: 'bg-rose-500/15', text: 'text-rose-400' },
  yml: { label: 'YAML', bg: 'bg-rose-500/15', text: 'text-rose-400' },
  markdown: { label: 'Markdown', bg: 'bg-slate-500/15', text: 'text-slate-400' },
  md: { label: 'Markdown', bg: 'bg-slate-500/15', text: 'text-slate-400' },
  dockerfile: { label: 'Dockerfile', bg: 'bg-blue-600/15', text: 'text-blue-300' },
};

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

function withinMs(a: Date, b: Date, ms: number): boolean {
  return Math.abs(a.getTime() - b.getTime()) < ms;
}

/** Format a date as a human-readable relative time string */
function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);

  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
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

// ── Components ──

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const langKey = (lang || '').toLowerCase();
  const langMeta = LANG_COLORS[langKey];
  return (
    <div className="relative my-2 rounded-lg overflow-hidden border border-[#00F0FF]/20">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#0A0A1A]">
        {langMeta ? (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase ${langMeta.bg} ${langMeta.text}`}>
            {langMeta.label}
          </span>
        ) : (
          <span className="text-xs text-[#9CA3AF]">{lang || 'code'}</span>
        )}
        <button
          onClick={handleCopy}
          className={[
            'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all min-h-[44px] focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50',
            copied
              ? 'text-[#00FF88] bg-[#00FF88]/10'
              : 'text-[#9CA3AF] hover:text-[#E8E8F0] hover:bg-[#00F0FF]/10',
          ].join(' ')}
          title="Copy code"
          aria-label="Copy code"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-xs text-[#E8E8F0] bg-[#06060B] leading-relaxed whitespace-pre"><code>{code}</code></pre>
    </div>
  );
}

function renderMessageContent(content: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const fenceRegex = /```(\w*)?\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;
  while ((match = fenceRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={keyIdx++} style={{ whiteSpace: 'pre-wrap' }}>{content.slice(lastIndex, match.index)}</span>);
    }
    parts.push(<CodeBlock key={keyIdx++} lang={match[1] || ''} code={match[2] || ''} />);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    parts.push(<span key={keyIdx++} style={{ whiteSpace: 'pre-wrap' }}>{content.slice(lastIndex)}</span>);
  }
  return parts.length > 0 ? <>{parts}</> : content;
}

/** Collapsible tool execution step card */
function ToolStepCard({ step }: { step: ToolStep }) {
  const [expanded, setExpanded] = useState(false);
  const isRunning = step.status === 'running';
  const isDone = step.status === 'done';

  return (
    <div className='my-1.5'>
      <button
        onClick={() => setExpanded(!expanded)}
        className='flex items-center gap-2 w-full text-left px-2.5 py-1.5 rounded-lg bg-[#0A0A16] border border-[#00F0FF]/10 hover:border-[#00F0FF]/20 transition-colors text-xs'
      >
        {isRunning ? (
          <RefreshCw className='w-3 h-3 text-[#00F0FF] animate-spin shrink-0' />
        ) : isDone ? (
          <Check className='w-3 h-3 text-[#ADFF2F] shrink-0' />
        ) : (
          <X className='w-3 h-3 text-[#FF2D78] shrink-0' />
        )}
        <span className={isRunning ? 'text-[#00F0FF]' : isDone ? 'text-[#9CA3AF]' : 'text-[#FF2D78]'}>
          {step.label}
        </span>
        {step.durationMs != null && (
          <span className='text-[#4B5563] ml-auto mr-1 tabular-nums'>
            {(step.durationMs / 1000).toFixed(1)}s
          </span>
        )}
        {step.result && (
          expanded
            ? <ChevronDown className='w-3 h-3 text-[#4B5563] shrink-0' />
            : <ChevronRight className='w-3 h-3 text-[#4B5563] shrink-0' />
        )}
      </button>
      {expanded && step.result && (
        <div className='mt-1 px-3 py-2 rounded-lg bg-[#06060B] border border-[#00F0FF]/5 text-xs text-[#8892A4] whitespace-pre-wrap'>
          {step.result}
        </div>
      )}
    </div>
  );
}

/** Conversation sidebar item */
function ConversationItem({
  title,
  timestamp,
  isActive,
  pinned,
  onClick,
  onPin,
  onDelete,
}: {
  title: string;
  timestamp?: string;
  isActive: boolean;
  pinned: boolean;
  onClick: () => void;
  onPin: () => void;
  onDelete: () => void;
}) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className={[
        'group/conv flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm min-h-[44px]',
        isActive
          ? 'bg-[#00F0FF]/10 text-[#E8E8F0] border border-[#00F0FF]/20'
          : 'text-[#9CA3AF] hover:bg-[#0C0C18] hover:text-[#E8E8F0]',
      ].join(' ')}
      onClick={onClick}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {pinned && <Pin className='w-3 h-3 text-[#00F0FF] shrink-0 rotate-45' />}
      <MessageSquare className='w-3.5 h-3.5 shrink-0 opacity-50' />
      <div className='flex-1 min-w-0'>
        <p className='truncate text-xs'>{title || 'New conversation'}</p>
        {timestamp && (
          <p className='text-[10px] text-[#4B5563] mt-0.5'>{timestamp}</p>
        )}
      </div>
      {showActions && (
        <div className='flex items-center gap-0.5 shrink-0'>
          <button
            onClick={(e) => { e.stopPropagation(); onPin(); }}
            className='p-1 rounded hover:bg-[#00F0FF]/10 text-[#8892A4] hover:text-[#00F0FF] min-w-[24px] min-h-[24px] flex items-center justify-center'
            title={pinned ? 'Unpin' : 'Pin'}
            aria-label={pinned ? 'Unpin conversation' : 'Pin conversation'}
          >
            <Pin className='w-3 h-3' />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className='p-1 rounded hover:bg-[#FF2D78]/10 text-[#8892A4] hover:text-[#FF2D78] min-w-[24px] min-h-[24px] flex items-center justify-center'
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
    connected: 'bg-[#ADFF2F]',
    slow: 'bg-yellow-400',
    disconnected: 'bg-[#FF2D78]',
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
        <span className='text-[10px] text-[#9CA3AF]'>{labels[health]}</span>
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const userScrolledUpRef = useRef(false);

  // Streaming
  const streamBufferRef = useRef('');
  const rafRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isStreamActive, setIsStreamActive] = useState(false);
  const [streamHealth, setStreamHealth] = useState<StreamHealth>('connected');
  const lastChunkTimeRef = useRef<number>(Date.now());
  const reconnectCountRef = useRef(0);

  // Feedback state
  const [feedback, setFeedback] = useState<Record<string, FeedbackValue>>({});

  // Message editing state
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollToBottom(false);
    setUnreadCount(0);
    userScrolledUpRef.current = false;
  }, []);

  // Track scroll position to show/hide scroll-to-bottom button
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      const isScrolledUp = distanceFromBottom > 120;
      setShowScrollToBottom(isScrolledUp);
      userScrolledUpRef.current = isScrolledUp;
      if (!isScrolledUp) {
        setUnreadCount(0);
      }
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
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

  // Auto-scroll to bottom on new messages — only when user hasn't scrolled up
  useEffect(() => {
    if (!userScrolledUpRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      abortControllerRef.current?.abort();
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
          timestamp: entry.createdAt ? new Date(entry.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '',
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
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setIsTyping(true);

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

      // RAF flush loop
      const targetMsgId = retryCount === 0 ? assistantMsgId : messages[messages.length - 1]?.id || assistantMsgId;
      const flushBuffer = () => {
        const buffered = streamBufferRef.current;
        if (buffered) {
          const { cleanContent, steps } = parseToolSteps(buffered);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === targetMsgId ? { ...m, content: cleanContent, toolSteps: steps.length > 0 ? steps : m.toolSteps } : m,
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
            const parsed = JSON.parse(data) as { text?: string; done?: boolean };
            if (parsed.done) continue;
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
        const { cleanContent, steps } = parseToolSteps(finalContent);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === targetMsgId ? { ...m, content: cleanContent, toolSteps: steps.length > 0 ? steps : m.toolSteps } : m,
          ),
        );
      }

      setIsStreamActive(false);
      setStreamHealth('connected');

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
  }, [messages, personality, voiceMode, tts, selectedAgent]);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || isTyping) return;
    await sendMessage(text);
  }, [input, isTyping, sendMessage]);

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
  }, [tts]);

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
    edith: { emoji: 'E', color: '#8B5CF6', glow: '0 0 12px rgba(139,92,246,0.4)', initial: 'E' },
    jarvis: { emoji: 'J', color: '#ADFF2F', glow: '0 0 12px rgba(173,255,47,0.4)', initial: 'J' },
    weebo: { emoji: 'W', color: '#00F0FF', glow: '0 0 12px rgba(0,240,255,0.4)', initial: 'W' },
    aria: { emoji: 'A', color: '#FF6B9D', glow: '0 0 12px rgba(255,107,157,0.4)', initial: 'A' },
    forge: { emoji: 'F', color: '#F59E0B', glow: '0 0 12px rgba(245,158,11,0.4)', initial: 'F' },
    pulse: { emoji: 'P', color: '#10B981', glow: '0 0 12px rgba(16,185,129,0.4)', initial: 'P' },
    echo: { emoji: 'E', color: '#6366F1', glow: '0 0 12px rgba(99,102,241,0.4)', initial: 'E' },
    cal: { emoji: 'C', color: '#84CC16', glow: '0 0 12px rgba(132,204,22,0.4)', initial: 'C' },
    nova: { emoji: 'N', color: '#EC4899', glow: '0 0 12px rgba(236,72,153,0.4)', initial: 'N' },
  };
  const meta = personalityMeta[personality];

  return (
    <div className='flex h-[calc(100dvh-184px)] md:h-[calc(100vh-130px)]'>
      {/* ── Conversation Sidebar ── */}
      {sidebarOpen && (
        <div className='w-64 md:w-72 flex-shrink-0 bg-[#06060B] border-r border-[#00F0FF]/10 flex flex-col rounded-l-xl overflow-hidden'>
          {/* Sidebar Header */}
          <div className='flex items-center justify-between px-3 py-3 border-b border-[#00F0FF]/10'>
            <h3 className='text-xs font-semibold text-[#E8E8F0] uppercase tracking-wider'>Conversations</h3>
            <button
              onClick={() => setSidebarOpen(false)}
              className='p-1 rounded hover:bg-[#00F0FF]/10 text-[#9CA3AF] hover:text-[#E8E8F0] min-w-[28px] min-h-[28px] flex items-center justify-center'
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
              className='flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-[#00F0FF]/10 text-[#00F0FF] hover:bg-[#00F0FF]/20 transition-colors text-xs font-medium min-h-[40px]'
            >
              <Plus className='w-3.5 h-3.5' />
              New Chat
            </button>
          </div>

          {/* Search conversations */}
          <div className='px-3 pb-2'>
            <div className='relative'>
              <Search className='w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#4B5563]' />
              <input
                type='text'
                value={conversationSearch}
                onChange={(e) => setConversationSearch(e.target.value)}
                placeholder='Search conversations...'
                className='w-full pl-8 pr-3 py-2 rounded-lg bg-[#0C0C18] border border-[#00F0FF]/10 text-[#E8E8F0] placeholder:text-[#4B5563] text-xs focus:outline-none focus:border-[#00F0FF]/30 min-h-[36px]'
              />
            </div>
          </div>

          {/* Conversation list */}
          <div className='flex-1 overflow-y-auto px-2 pb-2 space-y-0.5 scrollbar-hide'>
            {filteredConversations.length === 0 ? (
              <p className='text-xs text-[#4B5563] text-center py-8'>No conversations yet</p>
            ) : (
              filteredConversations.map((conv) => (
                <ConversationItem
                  key={conv.id}
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
      <div className='flex-1 flex flex-col bg-[#06060B] rounded-xl border border-[#00F0FF]/10 min-w-0 relative'>
        {/* Header */}
        <div className='flex items-center justify-between px-4 py-3 border-b border-[#00F0FF]/10 flex-shrink-0'>
          <div className='flex items-center gap-3'>
            {/* Sidebar toggle */}
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className='p-1.5 rounded-lg hover:bg-[#00F0FF]/10 text-[#9CA3AF] hover:text-[#E8E8F0] min-h-[36px] min-w-[36px] flex items-center justify-center'
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
                <h2 className='text-sm font-semibold text-[#E8E8F0]'>{agentName}</h2>
                {/* Stream health indicator */}
                {isStreamActive && <StreamHealthDot health={streamHealth} />}
              </div>
              <p className='text-xs text-[#9CA3AF]'>
                {isTyping ? <span className='text-shimmer'>Thinking...</span> : 'AI Assistant'}
              </p>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            {tts.isSpeaking && (
              <button
                onClick={() => tts.stop()}
                className='p-1.5 rounded-lg hover:bg-[#00F0FF]/10 text-[#00F0FF] min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50'
                title='Stop speaking'
                aria-label='Stop speaking'
              >
                <VolumeX className='w-4 h-4' />
              </button>
            )}
            <button
              onClick={toggleVoiceMode}
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all min-h-[44px] focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50',
                voiceMode
                  ? 'bg-[#00F0FF]/20 text-[#00F0FF] ring-1 ring-[#00F0FF]/40'
                  : 'hover:bg-[#00F0FF]/10 text-[#9CA3AF]',
              ].join(' ')}
              title={voiceMode ? 'Voice mode on' : 'Enable voice mode'}
            >
              <Volume2 className='w-3.5 h-3.5' />
              <span className='hidden sm:inline'>Voice {voiceMode ? 'On' : 'Off'}</span>
            </button>
            <button
              onClick={clearChat}
              className='p-1.5 rounded-lg hover:bg-[#00F0FF]/10 text-[#9CA3AF] hover:text-[#E8E8F0] min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50'
              title='Clear chat'
              aria-label='Clear chat'
            >
              <RotateCcw className='w-4 h-4' />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={messagesContainerRef} className='flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-hide relative'>
          {messages.length === 0 && (
            <div className='flex flex-col items-center justify-center h-full gap-4 text-center py-12'>
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
                <p className='text-lg font-semibold text-[#E8E8F0]'>{timeContext.greeting}</p>
                <p className='text-sm text-[#9CA3AF] mt-1 max-w-xs'>
                  {voice.isSupported ? 'Type, speak, or try a suggestion below' : 'Type a message or try a suggestion below'}
                </p>
              </div>
              {voiceMode && voice.isSupported && (
                <div className='flex items-center gap-1.5 text-xs text-[#00F0FF]'>
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
                    className='flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#0C0C18] border border-[#00F0FF]/10 text-left text-sm text-[#9CA3AF] hover:text-[#E8E8F0] hover:border-[#00F0FF]/30 hover:bg-[#0C0C18]/80 hover:shadow-[0_0_16px_rgba(0,240,255,0.08)] transition-all duration-200 min-h-[44px]'
                  >
                    <Clock className='w-4 h-4 text-[#00F0FF]/50 shrink-0' />
                    <span className='line-clamp-2'>{prompt.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg) => {
            const showTimestamp = timestampVisible.has(msg.id);
            const isStreaming = isStreamActive && msg.role === 'agent' && msg.id === messages[messages.length - 1]?.id;
            const msgFeedback = feedback[msg.id] ?? null;
            const isEditing = editingMsgId === msg.id;

            return (
              <div
                key={msg.id}
                id={`msg-${msg.id}`}
                className={['flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start'].join(' ')}
              >
                {/* Agent avatar */}
                {msg.role === 'agent' && (
                  <div className='relative shrink-0 self-start mt-0.5'>
                    <div
                      className='w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-black relative z-10'
                      style={{ background: meta.color, boxShadow: isStreaming ? meta.glow : 'none' }}
                    >
                      {meta.initial}
                    </div>
                    {isStreaming && (
                      <span
                        className='absolute inset-0 rounded-full animate-ping'
                        style={{ border: `1.5px solid ${meta.color}`, opacity: 0.35 }}
                      />
                    )}
                  </div>
                )}
                <div
                  className={[
                    'max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed group/msg relative',
                    msg.role === 'user'
                      ? 'bg-[#00F0FF]/15 text-[#E8E8F0] rounded-tr-sm'
                      : 'bg-[#0C0C18] text-[#E8E8F0] border border-[#00F0FF]/10 rounded-tl-sm',
                  ].join(' ')}
                >
                  {/* Editing mode for user messages */}
                  {isEditing ? (
                    <div className='space-y-2'>
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className='w-full bg-[#0A0A16] border border-[#00F0FF]/20 rounded-lg px-3 py-2 text-sm text-[#E8E8F0] resize-none focus:outline-none focus:border-[#00F0FF]/40 min-h-[60px]'
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleConfirmEdit();
                          }
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                      />
                      <div className='flex items-center gap-2 justify-end'>
                        <button
                          onClick={handleCancelEdit}
                          className='px-2.5 py-1 rounded text-xs text-[#9CA3AF] hover:text-[#E8E8F0] min-h-[28px]'
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleConfirmEdit}
                          className='px-2.5 py-1 rounded text-xs bg-[#00F0FF]/20 text-[#00F0FF] hover:bg-[#00F0FF]/30 min-h-[28px]'
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Tool execution steps */}
                      {msg.toolSteps && msg.toolSteps.length > 0 && (
                        <div className='mb-2'>
                          {msg.toolSteps.map((step) => (
                            <ToolStepCard key={step.id} step={step} />
                          ))}
                        </div>
                      )}
                      {msg.role === 'agent' ? renderMessageContent(msg.content) : <p style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</p>}
                    </>
                  )}

                  {/* Footer: timestamp + action buttons */}
                  {!isEditing && (
                    <div className='flex items-center justify-between mt-1 gap-2'>
                      {showTimestamp ? (
                        <p className='text-[10px] text-[#9CA3AF]/70' title={msg.timestamp.toLocaleString()}>
                          {formatRelativeTime(msg.timestamp)}
                        </p>
                      ) : (
                        <span />
                      )}

                      {/* Action buttons on AGENT messages */}
                      {msg.role === 'agent' && msg.content && (
                        <div className='flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 focus-within:opacity-100 transition-opacity'>
                          {/* Regenerate */}
                          <button
                            onClick={() => handleRegenerate(msg.id)}
                            className='p-1 rounded transition-colors text-[#8892A4] hover:text-[#00F0FF] min-w-[28px] min-h-[28px] flex items-center justify-center'
                            title='Regenerate response'
                            aria-label='Regenerate response'
                            disabled={isTyping}
                          >
                            <RefreshCw className='w-3 h-3' />
                          </button>
                          {/* Pin to notes */}
                          <button
                            onClick={() => handlePinToNotes(msg.id, msg.content)}
                            className='p-1 rounded transition-colors text-[#8892A4] hover:text-[#00F0FF] min-w-[28px] min-h-[28px] flex items-center justify-center'
                            title='Pin to notes'
                            aria-label='Pin to notes'
                          >
                            <Pin className='w-3 h-3' />
                          </button>
                          {/* Thumbs up */}
                          <button
                            onClick={() => handleFeedback(msg.id, 'up')}
                            className={[
                              'p-1 rounded transition-colors min-w-[28px] min-h-[28px] flex items-center justify-center',
                              msgFeedback === 'up' ? 'text-[#ADFF2F]' : 'text-[#8892A4] hover:text-[#ADFF2F]',
                            ].join(' ')}
                            title='Helpful'
                            aria-label='Mark as helpful'
                          >
                            <ThumbsUp className='w-3 h-3' />
                          </button>
                          {/* Thumbs down */}
                          <button
                            onClick={() => handleFeedback(msg.id, 'down')}
                            className={[
                              'p-1 rounded transition-colors min-w-[28px] min-h-[28px] flex items-center justify-center',
                              msgFeedback === 'down' ? 'text-[#FF2D78]' : 'text-[#8892A4] hover:text-[#FF2D78]',
                            ].join(' ')}
                            title='Not helpful'
                            aria-label='Mark as not helpful'
                          >
                            <ThumbsDown className='w-3 h-3' />
                          </button>
                          {/* Copy */}
                          <button
                            onClick={() => handleCopyMessage(msg.id, msg.content)}
                            className='p-1 rounded transition-colors text-[#8892A4] hover:text-[#00F0FF] min-w-[28px] min-h-[28px] flex items-center justify-center'
                            title='Copy message'
                            aria-label='Copy message'
                          >
                            {copiedMsgId === msg.id ? <Check className='w-3 h-3 text-[#ADFF2F]' /> : <Copy className='w-3 h-3' />}
                          </button>
                        </div>
                      )}

                      {/* Action buttons on USER messages */}
                      {msg.role === 'user' && msg.content && (
                        <div className='flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 focus-within:opacity-100 transition-opacity'>
                          {/* Edit */}
                          <button
                            onClick={() => handleStartEdit(msg.id)}
                            className='p-1 rounded transition-colors text-[#8892A4] hover:text-[#00F0FF] min-w-[28px] min-h-[28px] flex items-center justify-center'
                            title='Edit message'
                            aria-label='Edit message'
                            disabled={isTyping}
                          >
                            <Pencil className='w-3 h-3' />
                          </button>
                          {/* Copy */}
                          <button
                            onClick={() => handleCopyMessage(msg.id, msg.content)}
                            className='p-1 rounded transition-colors text-[#8892A4] hover:text-[#00F0FF] min-w-[28px] min-h-[28px] flex items-center justify-center'
                            title='Copy message'
                            aria-label='Copy message'
                          >
                            {copiedMsgId === msg.id ? <Check className='w-3 h-3 text-[#ADFF2F]' /> : <Copy className='w-3 h-3' />}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
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
              <div className='bg-[#0C0C18] border border-[#00F0FF]/10 rounded-xl rounded-tl-sm px-3 py-2.5 flex items-center gap-1.5'>
                <span className='text-xs text-[#8892A4] mr-1'>{agentName} is typing</span>
                <span
                  className='w-1.5 h-1.5 rounded-full bg-[#00F0FF]/60'
                  style={{ animation: 'typing-dot 1.2s ease-in-out infinite', animationDelay: '0ms' }}
                />
                <span
                  className='w-1.5 h-1.5 rounded-full bg-[#00F0FF]/60'
                  style={{ animation: 'typing-dot 1.2s ease-in-out infinite', animationDelay: '200ms' }}
                />
                <span
                  className='w-1.5 h-1.5 rounded-full bg-[#00F0FF]/60'
                  style={{ animation: 'typing-dot 1.2s ease-in-out infinite', animationDelay: '400ms' }}
                />
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
                className='flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#0C0C18] border border-[#00F0FF]/20 text-[#9CA3AF] hover:text-[#E8E8F0] hover:border-[#00F0FF]/40 transition-all min-h-[36px]'
              >
                <Square className='w-3 h-3' />
                Stop generating
              </button>
            </div>
          )}
          {/* Reconnecting indicator */}
          {streamHealth === 'disconnected' && !isStreamActive && isTyping && (
            <div className='flex justify-center py-2'>
              <div className='flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#FF2D78]/10 border border-[#FF2D78]/20 text-xs text-[#FF2D78]'>
                <Wifi className='w-3 h-3 animate-pulse' />
                Reconnecting... (attempt {reconnectCountRef.current}/{RECONNECT_DELAYS.length})
              </div>
            </div>
          )}
          {interimText && (
            <div className='flex justify-end'>
              <div className='max-w-[80%] px-3 py-2 rounded-xl text-sm bg-[#00F0FF]/5 text-[#9CA3AF] border border-dashed border-[#00F0FF]/20 italic'>
                {interimText}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        {/* Scroll to bottom button */}
        {showScrollToBottom && (
          <div className='absolute bottom-20 right-4 z-10'>
            <button
              onClick={scrollToBottom}
              className='flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#0C0C18] border border-[#00F0FF]/30 text-[#00F0FF] hover:bg-[#00F0FF]/10 transition-all shadow-lg shadow-[#00F0FF]/10 min-h-[44px] min-w-[44px] justify-center'
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
        <div className='px-4 py-3 border-t border-[#00F0FF]/10 flex-shrink-0'>
          {/* Agent Picker */}
          <div className='flex gap-1.5 pb-2 overflow-x-auto' style={{ scrollbarWidth: 'none' }}>
            {[
              { id: '', name: 'Auto', emoji: '🤖', color: '#8892A4' },
              { id: 'weebo', name: 'Weebo', emoji: '✨', color: '#00F0FF' },
              { id: 'edith', name: 'Edith', emoji: '⚡', color: '#8B5CF6' },
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
            <p className='text-xs text-red-400 mb-2'>{voice.error}</p>
          )}
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className='flex items-end gap-2'
          >
            <div className='flex-1 relative'>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    formRef.current?.requestSubmit();
                  }
                }}
                placeholder={voice.isListening ? 'Listening...' : 'Message ' + agentName + '...'}
                disabled={isTyping}
                rows={1}
                enterKeyHint='send'
                inputMode='text'
                autoCapitalize='sentences'
                className='w-full resize-none bg-[#0C0C18] border border-[#00F0FF]/20 text-[#E8E8F0] placeholder:text-[#4B5563] focus:border-[#00F0FF]/40 focus:outline-none focus:ring-2 focus:ring-[#00F0FF]/20 rounded-lg px-3 py-2.5 text-sm leading-relaxed min-h-[40px] max-h-[120px] scrollbar-hide touch-manipulation'
              />
              {input.length > 200 && (
                <span className='absolute right-2 bottom-1.5 text-[10px] text-[#4B5563] tabular-nums pointer-events-none'>
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
            <Button
              type='submit'
              disabled={!input.trim() || isTyping}
              className='bg-[#00F0FF] hover:bg-[#00D4B0] text-black h-10 px-3 min-w-[44px] min-h-[44px] focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50 shrink-0'
              aria-label='Send message'
            >
              <Send className='w-4 h-4' />
            </Button>
          </form>
          <div className='flex items-center justify-between mt-1.5 px-0.5'>
            <p className='text-[10px] text-[#4B5563]'>
              Shift+Enter for new line
            </p>
            <p className='text-[10px] text-[#4B5563]'>
              Alt+V for voice
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
