import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Send, Volume2, VolumeX, RotateCcw, Sparkles, Copy, Check, Square, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { agentService, memoryService } from '@/services/api';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useVoice } from '@/hooks/useVoice';
import { useTTS } from '@/hooks/useTTS';
import { VoiceButton } from '@/components/VoiceButton';
import type { AgentPersonality } from '@/types';

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
}

// ── Feedback type for thumbs up/down ──
type FeedbackValue = 'up' | 'down' | null;

// ── Language display names + badge colors for code blocks ──
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

/** Check if two dates are within `ms` milliseconds of each other */
function withinMs(a: Date, b: Date, ms: number): boolean {
  return Math.abs(a.getTime() - b.getTime()) < ms;
}

/** Determine which messages in a list should show their timestamp.
 *  Cluster rule: if consecutive messages are within 2 min, only the last one in the cluster shows it. */
function buildTimestampVisibility(msgs: ChatMessage[]): Set<string> {
  const visible = new Set<string>();
  if (msgs.length === 0) return visible;
  const TWO_MIN = 2 * 60 * 1000;
  let clusterEnd = 0;
  for (let i = 0; i < msgs.length; i++) {
    // Find end of cluster starting at i
    clusterEnd = i;
    while (
      clusterEnd + 1 < msgs.length &&
      withinMs(msgs[clusterEnd].timestamp, msgs[clusterEnd + 1].timestamp, TWO_MIN)
    ) {
      clusterEnd++;
    }
    // Only the last message in the cluster shows the timestamp
    visible.add(msgs[clusterEnd].id);
    i = clusterEnd;
  }
  return visible;
}

const VOICE_SETTINGS_KEY = 'agentin_voice_settings';

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

export function ChatPage() {
  const agent = useDashboardStore((s) => s.agent);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [voiceMode, setVoiceMode] = useState<boolean>(getVoiceMode);
  const [interimText, setInterimText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Keep a hidden input ref for voice auto-submit via form
  const formRef = useRef<HTMLFormElement>(null);

  // Streaming perf: buffer tokens in a ref, flush to state via RAF
  const streamBufferRef = useRef('');
  const rafRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isStreamActive, setIsStreamActive] = useState(false);

  // Feedback state: track thumbs up/down per message
  const [feedback, setFeedback] = useState<Record<string, FeedbackValue>>({});

  const personality: AgentPersonality = agent?.personality ?? 'weebo';
  const agentName = personality === 'edith' ? 'Edith' : personality === 'jarvis' ? 'Jarvis' : 'Weebo';

  const tts = useTTS();

  const handleTranscript = useCallback((text: string) => {
    setInterimText('');
    setInput(text);
    // Auto-submit after transcript
    setTimeout(() => {
      formRef.current?.requestSubmit();
    }, 100);
  }, []);

  const voice = useVoice({
    onTranscript: handleTranscript,
    onInterim: setInterimText,
  });

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Cleanup: cancel RAF loop and abort in-flight stream on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      abortControllerRef.current?.abort();
    };
  }, []);

  // Load conversation history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await memoryService.conversations(30);
        const entries = res.data;
        if (Array.isArray(entries) && entries.length > 0) {
          // Server returns newest-first; reverse to show oldest-first in chat
          const reversed = [...entries].reverse();
          setMessages(reversed.map((entry) => ({
            id: entry.id,
            role: entry.role === 'assistant' ? 'agent' : 'user',
            content: entry.content,
            timestamp: entry.createdAt ? new Date(entry.createdAt) : new Date(),
          })));
        }
      } catch {
        // Fresh start — no history available
      }
    };
    void loadHistory();
  }, []);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || isTyping) return;

    const userMsgId = `u-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Placeholder for streaming assistant response
    const assistantMsgId = `a-${Date.now() + 1}`;
    setMessages((prev) => [
      ...prev,
      { id: assistantMsgId, role: 'agent', content: '', timestamp: new Date() },
    ]);

    // Abort any in-flight stream before starting a new one
    abortControllerRef.current?.abort();
    const ac = new AbortController();
    abortControllerRef.current = ac;

    // Reset stream buffer
    streamBufferRef.current = '';

    try {
      const response = await agentService.chatStream(text, 'web', ac.signal);

      if (!response.ok || !response.body) {
        throw new Error(`Stream request failed: ${response.status}`);
      }

      setIsStreamActive(true);

      // RAF flush loop: reads from mutable ref, writes to state at most once per frame
      const flushBuffer = () => {
        const buffered = streamBufferRef.current;
        if (buffered) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId ? { ...m, content: buffered } : m,
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
              // Accumulate into mutable ref — zero renders per token
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

      // Final flush with complete content
      const finalContent = streamBufferRef.current;
      if (finalContent) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, content: finalContent } : m,
          ),
        );
      }

      setIsStreamActive(false);

      // Auto-read if voice mode is on and TTS is supported
      if (voiceMode && tts.isSupported && finalContent) {
        tts.speak(finalContent);
      }
    } catch (err) {
      // Stop RAF loop on error
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      setIsStreamActive(false);

      // If aborted by user, keep whatever was streamed so far
      if (err instanceof DOMException && err.name === 'AbortError') {
        const partial = streamBufferRef.current;
        if (partial) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId ? { ...m, content: partial } : m,
            ),
          );
        }
        return;
      }

      // Streaming failed — fall back to synchronous call
      setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
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
      setIsTyping(false);
      abortControllerRef.current = null;
    }
  }, [input, isTyping, personality, voiceMode, tts]);

  const toggleVoiceMode = useCallback(() => {
    setVoiceMode((prev) => {
      const next = !prev;
      try {
        const raw = localStorage.getItem('agentin_voice_settings');
        const cfg: Record<string, unknown> = raw ? JSON.parse(raw) as Record<string, unknown> : {};
        cfg.enabled = next;
        localStorage.setItem('agentin_voice_settings', JSON.stringify(cfg));
      } catch {}
      if (!next && tts.isSpeaking) tts.stop();
      return next;
    });
  }, [tts]);

  const clearChat = useCallback(() => {
    tts.stop();
    setMessages([]);
  }, [tts]);

  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const handleCopyMessage = useCallback((msgId: string, content: string) => {
    navigator.clipboard.writeText(content).catch(() => {});
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 2000);
  }, []);

  // Feedback handler: thumbs up/down on agent messages
  const handleFeedback = useCallback((msgId: string, value: FeedbackValue) => {
    setFeedback((prev) => {
      const current = prev[msgId];
      // Toggle off if same button pressed again
      const next = current === value ? null : value;
      // Fire-and-forget API call
      if (next) {
        const reaction = next === 'up' ? 'like' : 'dislike';
        memoryService.addReaction(msgId, reaction).catch(() => {});
      }
      return { ...prev, [msgId]: next };
    });
  }, []);

  // Timestamp clustering: recompute when messages change
  const timestampVisible = useMemo(() => buildTimestampVisibility(messages), [messages]);

  const starterPrompts = [
    { text: 'Remind me to drink water every 2 hours', icon: '💧' },
    { text: 'What can you help me with?', icon: '🤔' },
    { text: 'Summarize my day so far', icon: '📋' },
    { text: 'Help me write a professional email', icon: '✉️' },
  ];

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
  };
  const meta = personalityMeta[personality];

  return (
    <div className='flex flex-col h-[calc(100dvh-180px)] md:h-[calc(100vh-130px)] bg-[#06060B] rounded-xl border border-[#00F0FF]/10'>
      {/* Header */}
      <div className='flex items-center justify-between px-4 py-3 border-b border-[#00F0FF]/10 flex-shrink-0'>
        <div className='flex items-center gap-3'>
          {/* Agent avatar with glow ring + thinking pulse */}
          <div className='relative'>
            <div
              className='w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-black relative z-10'
              style={{ background: meta.color, boxShadow: meta.glow }}
            >
              {meta.initial}
            </div>
            {/* Pulsing ring when thinking */}
            {isTyping && (
              <span
                className='absolute inset-0 rounded-full animate-ping'
                style={{ border: `2px solid ${meta.color}`, opacity: 0.4 }}
              />
            )}
          </div>
          <div>
            <h2 className='text-sm font-semibold text-[#E8E8F0]'>{agentName}</h2>
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
            title={voiceMode ? 'Voice mode on — responses will be read aloud' : 'Enable voice mode'}
          >
            <Volume2 className='w-3.5 h-3.5' />
            Voice {voiceMode ? 'On' : 'Off'}
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
      <div className='flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-hide'>
        {messages.length === 0 && (
          <div className='flex flex-col items-center justify-center h-full gap-4 text-center py-12'>
            {/* Hero avatar with glow */}
            <div className='relative'>
              <div
                className='w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-black relative z-10'
                style={{ background: meta.color, boxShadow: meta.glow }}
              >
                {meta.initial}
              </div>
              {/* Subtle outer glow ring */}
              <span
                className='absolute inset-[-4px] rounded-full'
                style={{ border: `1.5px solid ${meta.color}`, opacity: 0.25 }}
              />
            </div>
            <div>
              <p className='text-lg font-semibold text-[#E8E8F0]'>Hey! I&apos;m {agentName}</p>
              <p className='text-sm text-[#9CA3AF] mt-1 max-w-xs'>
                {voice.isSupported ? 'Type, speak, or try a suggestion below' : 'Type a message or try a suggestion below'}
              </p>
            </div>
            {voiceMode && voice.isSupported && (
              <div className='flex items-center gap-1.5 text-xs text-[#00F0FF]'>
                <Sparkles className='w-3.5 h-3.5' />
                Voice mode active — responses will be read aloud
              </div>
            )}
            {/* Greeting + starter prompts */}
            <p className='text-xs text-[#8892A4] max-w-sm'>
              I&apos;m {agentName}, your AI assistant. Here are some things I can help with:
            </p>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md'>
              {starterPrompts.map((prompt) => (
                <button
                  key={prompt.text}
                  onClick={() => handleStarterPrompt(prompt.text)}
                  className='flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#0C0C18] border border-[#00F0FF]/10 text-left text-sm text-[#9CA3AF] hover:text-[#E8E8F0] hover:border-[#00F0FF]/30 hover:bg-[#0C0C18]/80 hover:shadow-[0_0_16px_rgba(0,240,255,0.08)] transition-all duration-200 min-h-[44px]'
                >
                  <span className='text-base shrink-0'>{prompt.icon}</span>
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

          return (
            <div
              key={msg.id}
              className={['flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start'].join(' ')}
            >
              {/* Agent avatar beside message */}
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
                {msg.role === 'agent' ? renderMessageContent(msg.content) : <p style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</p>}
                {/* Footer: timestamp + action buttons */}
                <div className='flex items-center justify-between mt-1 gap-2'>
                  {/* Timestamp — only shown for the last message in a 2-min cluster */}
                  {showTimestamp ? (
                    <p className='text-[10px] text-[#9CA3AF]/70'>
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  ) : (
                    <span />
                  )}
                  {/* Action buttons on agent messages (copy + thumbs) */}
                  {msg.role === 'agent' && msg.content && (
                    <div className='flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 focus-within:opacity-100 transition-opacity'>
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
                </div>
              </div>
            </div>
          );
        })}
        {isTyping && !isStreamActive && (
          <div className='flex gap-2 justify-start'>
            {/* Avatar with pulse */}
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
            <div className='bg-[#0C0C18] border border-[#00F0FF]/10 rounded-xl rounded-tl-sm px-3 py-2'>
              <span className='text-shimmer text-xs font-medium'>{agentName} is thinking...</span>
            </div>
          </div>
        )}
        {/* Stop generating button — shown while SSE stream is active */}
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
        {interimText && (
          <div className='flex justify-end'>
            <div className='max-w-[80%] px-3 py-2 rounded-xl text-sm bg-[#00F0FF]/5 text-[#9CA3AF] border border-dashed border-[#00F0FF]/20 italic'>
              {interimText}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className='px-4 py-3 border-t border-[#00F0FF]/10 flex-shrink-0'>
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
              className='w-full resize-none bg-[#0C0C18] border border-[#00F0FF]/20 text-[#E8E8F0] placeholder:text-[#4B5563] focus:border-[#00F0FF]/40 focus:outline-none focus:ring-2 focus:ring-[#00F0FF]/20 rounded-lg px-3 py-2.5 text-sm leading-relaxed min-h-[40px] max-h-[120px] scrollbar-hide'
            />
            {/* Character count — appears when > 200 chars */}
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
  );
}
