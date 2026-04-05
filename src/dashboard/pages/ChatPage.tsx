import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  MessageSquare, ChevronDown, WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { type VirtuosoHandle } from 'react-virtuoso';
import { agentService, memoryService } from '@/services/api';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useAuthStore } from '@/stores/authStore';
import { useVoice } from '@/hooks/useVoice';
import { useTTS } from '@/hooks/useTTS';

import { type ChatMessage, type ToolStep } from '@/components/ChatMessageBubble';
import type { AgentPersonality } from '@/types';
import type { MentionAgent } from '@/components/AgentMentionPopup';
import { timeAgo as luxonTimeAgo, formatDateTime as luxonFormatDateTime, formatDate as luxonFormatDate } from '@/utils/dateFormat';
import { DashboardPageWrapper, PageHeader } from '@/components/agentin';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';
import { useChatActions } from '@/hooks/useChatActions';
import { useAgentState } from '@/hooks/useAgentState';

// Import the new components
import { ChatSidebar } from './chat/ChatSidebar';
import { ChatHeader } from './chat/ChatHeader';
import { ChatEmptyState } from './chat/ChatEmptyState';
import { ChatInput } from './chat/ChatInput';
import { ChatMessageList } from './chat/ChatMessageList';

// ── Types ──

type StreamHealth = 'connected' | 'slow' | 'disconnected';

interface Conversation {
  id: string;
  title: string;
  timestamp: string;
  pinned: boolean;
}

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

  // Rating state
  const [ratingNudgeDismissed, setRatingNudgeDismissed] = useState(false);
  const [sessionRating, setSessionRating] = useState<number | null>(null);
  const [ratingHover, setRatingHover] = useState(0);

  // @mention autocomplete state
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionedAgent, setMentionedAgent] = useState<MentionAgent | null>(null);
  const mentionStartRef = useRef<number>(-1);

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversationSearch, setConversationSearch] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
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

  // Custom hooks for actions and state management
  const agentState = useAgentState();
  const {
    sseToolSteps,
    sseActive, 
    activeDelegation,
    connectAgentStateSSE,
    disconnectAgentStateSSE,
    clearSSEToolSteps,
  } = agentState;
  
  const chatActions = useChatActions({ messages, sendMessage: async (text: string) => sendMessage(text) });
  const {
    feedback,
    copiedMsgId,
    editingMsgId,
    editText,
    handleRegenerate,
    handleStartEdit,
    handleConfirmEdit,
    handleCancelEdit,
    handlePinToNotes,
    handleCopyMessage,
    handleFeedback,
    setEditText,
  } = chatActions;

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
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      abortControllerRef.current?.abort();
      setIsTyping(false);
      setIsStreamActive(false);
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
        setIsTyping(false);
        setIsStreamActive(false);
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
    const convos: Conversation[] = [];
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
      clearSSEToolSteps();
      connectAgentStateSSE();
    }
    lastChunkTimeRef.current = Date.now();
    let responseTimeout: number | null = null;

    try {
      const response = await agentService.chatStream(text, 'web', ac.signal, selectedAgent || undefined);

      if (!response.ok || !response.body) {
        throw new Error(`Stream request failed: ${response.status}`);
      }

      setIsStreamActive(true);
      setStreamHealth('connected');
      reconnectCountRef.current = 0;

      // Response timeout — abort if no complete response in 30s
      responseTimeout = setTimeout(() => {
        abortControllerRef.current?.abort();
        setIsTyping(false);
        setIsStreamActive(false);
        setStreamHealth('disconnected');
        disconnectAgentStateSSE();
        // Replace the empty streaming message with an error
        setMessages((prev) => prev.map((m) => 
          m.role === 'agent' && !m.content 
            ? { ...m, content: 'Response timed out. Tap to retry.', failed: true }
            : m
        ));
      }, 30_000);

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

      if (responseTimeout) clearTimeout(responseTimeout);
      setIsStreamActive(false);
      setStreamHealth('connected');
      disconnectAgentStateSSE();
      void notifyDone('response complete');

      if (voiceMode && tts.isSupported && finalContent) {
        const { cleanContent } = parseToolSteps(finalContent);
        tts.speak(cleanContent);
      }
    } catch (err) {
      if (responseTimeout) clearTimeout(responseTimeout);
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
      if (mountedRef.current) {
        setIsTyping(false);
      }
      abortControllerRef.current = null;
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
    clearSSEToolSteps();
    disconnectAgentStateSSE();
  }, [tts, disconnectAgentStateSSE, clearSSEToolSteps]);

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
    jarvis: { emoji: 'J', color: 'var(--ag-lime)', glow: '0 0 12px rgba(173,255,47,0.4)', initial: 'J' },
    weebo: { emoji: 'W', color: 'var(--ag-cyan)', glow: '0 0 12px rgba(139,92,246,0.4)', initial: 'W' },
    aria: { emoji: 'A', color: 'var(--ag-pink)', glow: '0 0 12px rgba(255,107,157,0.4)', initial: 'A' },
    forge: { emoji: 'F', color: 'var(--ag-amber)', glow: '0 0 12px rgba(245,158,11,0.4)', initial: 'F' },
    pulse: { emoji: 'P', color: 'var(--ag-green)', glow: '0 0 12px rgba(16,185,129,0.4)', initial: 'P' },
    echo: { emoji: 'E', color: 'var(--ag-indigo)', glow: '0 0 12px rgba(99,102,241,0.4)', initial: 'E' },
    cal: { emoji: 'C', color: 'var(--ag-lime)', glow: '0 0 12px rgba(132,204,22,0.4)', initial: 'C' },
    nova: { emoji: 'N', color: 'var(--ag-nova)', glow: '0 0 12px rgba(236,72,153,0.4)', initial: 'N' },
  };
  const meta = personalityMeta[personality];

  return (
    <DashboardPageWrapper>
      <div className="hidden md:block">
        <PageHeader 
          title="AI Chat"
          subtitle="Chat with your AI assistant"
          icon={MessageSquare}
        />
      </div>
      <div className='flex flex-col h-[calc(100dvh-60px)] md:h-[calc(100vh-60px)]'>
            {/* ── Conversation Sidebar ── */}
            <ChatSidebar
              conversations={conversations}
              conversationSearch={conversationSearch}
              onSearchChange={setConversationSearch}
              onPin={handlePinConversation}
              onDelete={handleDeleteConversation}
              deleteConfirmId={deleteConfirmId}
              onClearChat={clearChat}
              isOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
            />

            {/* ── Main Chat Area ── */}
            <div className='flex-1 flex flex-col min-w-0 relative'>
              {/* Header */}
              <div className='flex-shrink-0'>
                <ChatHeader
                  agentName={agentName}
                  meta={meta}
                  isTyping={isTyping}
                  isStreamActive={isStreamActive}
                  streamHealth={streamHealth}
                  voiceMode={voiceMode}
                  onToggleVoice={toggleVoiceMode}
                  onClear={clearChat}
                  sidebarOpen={sidebarOpen}
                  onToggleSidebar={() => setSidebarOpen(true)}
                  tts={tts}
                />
              </div>

              {/* Messages — Virtualized or Empty State */}
              <div className='flex-1 overflow-y-auto min-h-0'>
                {messages.length === 0 ? (
                  <ChatEmptyState
                    meta={meta}
                    timeContext={timeContext}
                    onStarterPrompt={handleStarterPrompt}
                    onResume={(text) => { setInput(text); setTimeout(() => formRef.current?.requestSubmit(), 100); }}
                    personality={personality}
                    voiceMode={voiceMode}
                  />
                ) : (
                  <ChatMessageList
                    ref={virtuosoRef}
                    messages={messages}
                    timestampVisible={timestampVisible}
                    feedback={feedback}
                    copiedMsgId={copiedMsgId}
                    editingMsgId={editingMsgId}
                    editText={editText}
                    isTyping={isTyping}
                    isStreamActive={isStreamActive}
                    meta={meta}
                    personalityMeta={personalityMeta}
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
                    onAtBottomStateChange={handleAtBottomStateChange}
                    sseToolSteps={sseToolSteps}
                    sseActive={sseActive}
                    activeDelegation={activeDelegation}
                    agentName={agentName}
                    ratingNudgeDismissed={ratingNudgeDismissed}
                    sessionRating={sessionRating}
                    ratingHover={ratingHover}
                    onSetRatingHover={setRatingHover}
                    onSetSessionRating={setSessionRating}
                    onSetRatingNudgeDismissed={setRatingNudgeDismissed}
                    streamHealth={streamHealth}
                    reconnectCount={reconnectCountRef.current}
                    reconnectDelaysLength={RECONNECT_DELAYS.length}
                    interimText={interimText}
                    onStopGeneration={() => {
                      abortControllerRef.current?.abort();
                      abortControllerRef.current = null;
                      setIsStreamActive(false);
                      if (rafRef.current) {
                        cancelAnimationFrame(rafRef.current);
                        rafRef.current = 0;
                      }
                    }}
                  />
                )}
              </div>
              
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
              <div className='flex-shrink-0 pb-16 md:pb-0'>
                <ChatInput
                  input={input}
                  onInputChange={handleInputChange}
                  onSubmit={handleSubmit}
                  isTyping={isTyping}
                  voice={voice}
                  showMentionPopup={showMentionPopup}
                  mentionQuery={mentionQuery}
                  onMentionSelect={handleMentionSelect}
                  mentionedAgent={mentionedAgent}
                  onClearMention={clearMention}
                  councilMode={councilMode}
                  onToggleCouncil={() => setCouncilMode(!councilMode)}
                  textareaRef={textareaRef}
                  formRef={formRef}
                  selectedAgent={selectedAgent}
                  onAgentSelect={setSelectedAgent}
                  onTranscript={handleTranscript}
                />
              </div>
            </div>
          </div>
    </DashboardPageWrapper>
  );
}