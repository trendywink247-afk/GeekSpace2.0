import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { type VirtuosoHandle } from 'react-virtuoso';

import { useDashboardStore } from '@/stores/dashboard-store';
import { useAuthStore } from '@/stores/auth-store';
import { useVoice } from '@/hooks/useVoice';
import { useTTS } from '@/hooks/useTTS';
import { useChatStream } from '@/hooks/useChatStream';
import { memoryService } from '@/services/api';

import { type ChatMessage } from '@/components/ChatMessageBubble';
import type { AgentPersonality } from '@/types';
import type { MentionAgent } from '@/components/AgentMentionPopup';
import { timeAgo as luxonTimeAgo, formatDateTime as luxonFormatDateTime, formatDate as luxonFormatDate } from '@/utils/date-format';

import { useAgentCanvas } from '@/hooks/useAgentCanvas';
import { useChatActions } from '@/hooks/useChatActions';
import { useAgentState } from '@/hooks/useAgentState';
import { feedbackService, conversationThreadsService } from '@/services/api';
import { AgentTheaterPanel, type TheaterEvent } from '@/components/AgentTheaterPanel';

// Import the new components
import { ChatSidebar } from './chat/ChatSidebar';
import { ChatHeader } from './chat/ChatHeader';
import { ChatEmptyState } from './chat/ChatEmptyState';
import { ChatInput } from './chat/ChatInput';
import { ChatMessageList } from './chat/ChatMessageList';

// ── Types ──

interface Conversation {
  id: string;
  title: string;
  timestamp: string;
  pinned: boolean;
}

// ── Constants ──

const VOICE_SETTINGS_KEY = 'agentin_voice_settings';

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



// ── Main Component ──

export function ChatPage() {
  const agent = useDashboardStore((s) => s.agent);
  const user = useAuthStore((s) => s.user);
  const [input, setInput] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [voiceMode] = useState<boolean>(getVoiceMode);
  const [interimText, setInterimText] = useState('');
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [councilMode, setCouncilMode] = useState(false);
  const userScrolledUpRef = useRef(false);



  // Rating state
  const [ratingNudgeDismissed, setRatingNudgeDismissed] = useState(false);
  const [sessionRating, setSessionRating] = useState<number | null>(null);
  const [ratingHover, setRatingHover] = useState(0);

  // @mention autocomplete state
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionedAgent, setMentionedAgent] = useState<MentionAgent | null>(null);
  const mentionStartRef = useRef<number>(-1);

  // Conversation threading
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Agent theater events
  const [theaterEvents, setTheaterEvents] = useState<TheaterEvent[]>([]);

  // File upload state
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);

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
  } = agentState;

  // Track delegation events for Agent Theater (use ref to avoid setState-in-effect)
  const prevDelegationRef = useRef(activeDelegation);
  if (activeDelegation && activeDelegation !== prevDelegationRef.current) {
    prevDelegationRef.current = activeDelegation;
    const evt: TheaterEvent = {
      id: `deleg-${Date.now()}`,
      type: activeDelegation.status === 'done' ? 'done' : 'delegation',
      fromAgent: activeDelegation.from,
      toAgent: activeDelegation.to,
      content: activeDelegation.reason || `Delegating to ${activeDelegation.to}`,
      timestamp: new Date().toISOString(),
      status: activeDelegation.status === 'done' ? 'done' : 'active',
    };
    // Schedule state update for next render to avoid cascading
    queueMicrotask(() => setTheaterEvents(prev => [...prev.slice(-20), evt]));
  }

  // Clear theater events on new conversation (use ref comparison)
  const prevConvIdRef = useRef(conversationId);
  if (conversationId !== prevConvIdRef.current) {
    prevConvIdRef.current = conversationId;
    queueMicrotask(() => setTheaterEvents([]));
  }

  // Feedback handler
  const handleMessageFeedback = useCallback((messageId: string, rating: 'up' | 'down', comment?: string) => {
    feedbackService.record(messageId, rating, comment).catch(() => {});
  }, []);
  
  // Chat streaming hook
  const {
    messages,
    setMessages,
    sendMessage,
    isTyping,
    isStreamActive,
    streamHealth,
    clearChat,
    pendingConfirmations,
    resolvePendingConfirmation,
  } = useChatStream({
    personality,
    selectedAgent,
    mentionedAgent,
    voiceMode,
    tts,
    connectAgentStateSSE: agentState.connectAgentStateSSE,
    disconnectAgentStateSSE: agentState.disconnectAgentStateSSE,
    notifyStart,
    notifyDone,
    notifyFail,
    conversationId,
  });
  
  const chatActions = useChatActions({ messages, sendMessage });
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
        // Load real conversation threads from API
        const threadsRes = await conversationThreadsService.list(30).catch(() => null);
        if (threadsRes?.data?.conversations?.length) {
          const threads = threadsRes.data.conversations;
          setConversations(threads.map(t => ({
            id: t.id,
            title: t.title || 'New conversation',
            timestamp: t.updated_at ? luxonFormatDate(new Date(t.updated_at)) : '',
            pinned: false,
          })));
          // Set current conversation to most recent
          setConversationId(threads[0].id);
        }

        // Load recent messages
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

          // Fallback: build conversation list from messages if threads API unavailable
          if (!conversations.length) {
            buildConversationList(entries);
          }

          const lastEntry = entries[0] as { conversationId?: string };
          if (lastEntry?.conversationId && !conversationId) {
            setConversationId(lastEntry.conversationId);
          }
        }
      } catch {
        // Fresh start
      }
    };
    void loadHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildConversationList]);



  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || isTyping) return;
    // Council mode: prefix triggers multi-agent orchestration
    const finalText = councilMode ? `agent council: ${text}` : text;
    if (councilMode) setCouncilMode(false); // auto-off after sending
    await sendMessage(finalText);
  }, [input, isTyping, sendMessage, councilMode]);




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

  const handleSelectConversation = useCallback(async (convId: string) => {
    try {
      setConversationId(convId);
      const res = await conversationThreadsService.getMessages(convId, 50);
      if (res.data?.messages) {
        setMessages(res.data.messages.map(m => ({
          id: m.id,
          role: m.role === 'assistant' ? 'agent' as const : 'user' as const,
          content: m.content,
          timestamp: new Date(m.created_at),
        })));
      }
      setSidebarOpen(false);
    } catch {
      toast.error('Failed to load conversation');
    }
  }, [setMessages]);

  const handleNewConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setSidebarOpen(false);
  }, [setMessages]);

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
    <div className='flex flex-col h-[calc(100dvh-60px)] md:h-[calc(100vh-60px)] bg-[var(--ag-bg-base)]'>
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
              onSelectConversation={handleSelectConversation}
              activeConversationId={conversationId}
              onNewConversation={handleNewConversation}
            />

            {/* ── Main Chat Area ── */}
            <div className='flex-1 flex flex-col min-w-0 relative'>
              {/* Header */}
              <div className='flex-shrink-0'>
                <div className='max-w-3xl mx-auto w-full'>
                <ChatHeader
                  agentName={agentName}
                  meta={meta}
                  isTyping={isTyping}
                  isStreamActive={isStreamActive}
                  streamHealth={streamHealth}
                  onClear={clearChat}
                  sidebarOpen={sidebarOpen}
                  onToggleSidebar={() => setSidebarOpen(true)}
                  tts={tts}
                  selectedAgent={selectedAgent}
                  onAgentSelect={setSelectedAgent}
                />
                </div>
              </div>

              {/* Messages — Virtualized or Empty State */}
              <div className='flex-1 overflow-y-auto min-h-0 max-w-3xl mx-auto w-full'>
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
                    reconnectCount={0}
                    reconnectDelaysLength={3}
                    interimText={interimText}
                    onStopGeneration={() => {
                      // Stop generation handled by the hook
                    }}
                    onMessageFeedback={handleMessageFeedback}
                    pendingConfirmations={pendingConfirmations}
                    onResolveConfirmation={resolvePendingConfirmation}
                  />
                )}
              </div>

              {/* Agent Theater Panel — floating, shows during delegation */}
              <AgentTheaterPanel
                events={theaterEvents}
                isActive={activeDelegation?.status === 'delegating' || activeDelegation?.status === 'working'}
                onClose={() => setTheaterEvents([])}
              />
              
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
              <div className='flex-shrink-0'>
                <div className='max-w-3xl mx-auto w-full px-4'>
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
                  textareaRef={textareaRef}
                  formRef={formRef}
                  files={attachedFiles}
                  onFilesChange={setAttachedFiles}
                />
                </div>
              </div>
            </div>
    </div>
  );
}