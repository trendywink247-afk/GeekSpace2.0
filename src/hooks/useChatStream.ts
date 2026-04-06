import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { agentService, memoryService, confirmService } from '@/services/api';
import { type ChatMessage, type ToolStep } from '@/components/ChatMessageBubble';
import type { MentionAgent } from '@/components/AgentMentionPopup';

// ── Types ──

type StreamHealth = 'connected' | 'slow' | 'disconnected';

interface UseChatStreamOptions {
  personality: string;
  selectedAgent: string;
  mentionedAgent: MentionAgent | null;
  voiceMode: boolean;
  tts: { isSupported: boolean; speak: (text: string) => void };
  connectAgentStateSSE: () => void;
  disconnectAgentStateSSE: () => void;
  notifyStart: (msg: string) => void;
  notifyDone: (msg: string) => void;
  notifyFail: (msg: string) => void;
  conversationId?: string | null;
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

const RECONNECT_DELAYS = [1000, 3000, 9000]; // exponential backoff

// ── Helpers ──

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

// ── Hook ──

export function useChatStream(options: UseChatStreamOptions) {
  const {
    personality,
    selectedAgent,
    mentionedAgent,
    voiceMode,
    tts,
    connectAgentStateSSE,
    disconnectAgentStateSSE,
    notifyStart,
    notifyDone,
    notifyFail,
    conversationId,
  } = options;

  // State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isStreamActive, setIsStreamActive] = useState(false);
  const [streamHealth, setStreamHealth] = useState<StreamHealth>('connected');
  const [pendingConfirmations, setPendingConfirmations] = useState<Array<{
    id: string; tool: string; params: Record<string, unknown>; expiresAt: string;
  }>>([]);

  // Refs
  const streamBufferRef = useRef('');
  const rafRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastChunkTimeRef = useRef<number>(Date.now());
  const reconnectCountRef = useRef(0);
  const mountedRef = useRef(true);

  // Cleanup on unmount
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

  // Clear chat function
  const clearChat = useCallback(() => {
    if (tts.isSupported) tts.speak(''); // Stop TTS
    setMessages([]);
  }, [tts]);

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
      setIsTyping(true);
      notifyStart(`message: ${text.slice(0, 60)}`);

      setMessages((prev) => [
        ...prev,
        { id: assistantMsgId, role: 'agent', content: '', timestamp: new Date() },
      ]);
    }

    abortControllerRef.current?.abort();
    const ac = new AbortController();
    abortControllerRef.current = ac;

    if (retryCount === 0) {
      streamBufferRef.current = '';
      // Start SSE agent-state subscription for real-time tool steps
      connectAgentStateSSE();
    }
    lastChunkTimeRef.current = Date.now();
    let responseTimeout: number | null = null;

    try {
      const response = await agentService.chatStream(text, 'web', ac.signal, selectedAgent || undefined, conversationId || undefined);

      if (!response.ok || !response.body) {
        // 401 = token expired → redirect to login
        if (response.status === 401) {
          localStorage.removeItem('gs_token');
          localStorage.removeItem('gs-auth');
          window.location.href = '/login';
          return;
        }
        throw new Error(`Stream request failed: ${response.status}`);
      }

      setIsStreamActive(true);
      setStreamHealth('connected');
      reconnectCountRef.current = 0;

      // Response timeout — abort if no complete response in 60s
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
      }, 60_000);

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
            const parsed = JSON.parse(data) as {
              text?: string;
              done?: boolean;
              newBubble?: boolean;
              agentId?: string;
              agentName?: string;
              agentEmoji?: string;
              confirm_needed?: boolean;
              confirmId?: string;
              tool?: string;
              params?: Record<string, unknown>;
              expiresAt?: string;
            };

            // Human-in-the-loop confirmation request
            if (parsed.confirm_needed && parsed.confirmId && parsed.tool && parsed.params && parsed.expiresAt) {
              setPendingConfirmations((prev) => [
                ...prev,
                { id: parsed.confirmId!, tool: parsed.tool!, params: parsed.params!, expiresAt: parsed.expiresAt! },
              ]);
              continue;
            }

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
      notifyDone('response complete');

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
        });
        setTimeout(() => {
          void sendMessage(text, retryCount + 1);
        }, delay);
        return;
      }

      // All retries exhausted — fall back to sync
      setStreamHealth('disconnected');
      notifyFail('stream failed, falling back to sync');
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
  }, [messages, personality, voiceMode, tts, selectedAgent, mentionedAgent, connectAgentStateSSE, disconnectAgentStateSSE, notifyStart, notifyDone, notifyFail, conversationId]);

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
        }
      } catch {
        // Fresh start
      }
    };
    void loadHistory();
  }, []);

  const resolvePendingConfirmation = useCallback(async (
    confirmId: string,
    approved: boolean,
    editedParams?: Record<string, unknown>,
    rejectReason?: string,
  ) => {
    try {
      await confirmService.resolve(confirmId, approved, editedParams, rejectReason);
    } catch (err) {
      toast.error('Failed to resolve confirmation');
      console.error(err);
    }
    // Remove from pending list locally (the ReAct loop will see it resolved via DB poll)
    setPendingConfirmations((prev) => prev.filter(c => c.id !== confirmId));
  }, []);

  return {
    messages,
    setMessages,
    sendMessage,
    isTyping,
    isStreamActive,
    streamHealth,
    clearChat,
    pendingConfirmations,
    resolvePendingConfirmation,
  };
}