import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { notify } from '@/services/notifications';
import { X, Send, Sparkles, Mic, RotateCcw, Zap, Rocket, Square, Search, Download, CreditCard, ArrowDown, Copy, Check, Bookmark, BookmarkCheck, Volume2, Loader2, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useAuthStore } from '@/stores/authStore';
import { agentService, premiumAgentService, publicAgentService, memoryService, billingService, voiceService, jobsService, imageAsyncService } from '@/services/api';
import type { AgentPersonality, PremiumSession } from '@/types';
import { CodePreviewCard } from './CodePreviewCard';
import { ActionResultCard } from './ActionResultCard';
import { MessageReactions } from './MessageReactions';
import { useMobileDetect } from '@/hooks/useMobileDetect';
import { Skeleton } from '@/components/ui/skeleton';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Browser SpeechRecognition (Chrome/Edge — not in @types/dom by default)
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
  interface SpeechRecognition {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onend: (() => void) | null;
    onerror: (() => void) | null;
  }
  interface SpeechRecognitionEvent {
    results: SpeechRecognitionResultList;
  }
}

// 42.3: CodeBlock — renders a fenced code block with a Copy button
function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative my-2 rounded-lg overflow-hidden border border-[#00F0FF]/20">
      <div className="flex items-center justify-between px-3 py-1 bg-[#0A0A1A]">
        <span className="text-[10px] text-[#6B7280]">{lang || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] text-[#6B7280] hover:text-[#00F0FF] transition-colors"
          title="Copy code"
        >
          {copied ? <Check className="w-3 h-3 text-[#00FF88]" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-xs text-[#E8E8F0] bg-[#06060B] leading-relaxed whitespace-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// 42.3: Render message content with full markdown support
function renderMessageContent(content: string): React.ReactNode {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Code blocks with copy button
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          const codeStr = String(children).replace(/\n$/, '');
          // Inline code
          if (!match && !codeStr.includes('\n')) {
            return (
              <code className="px-1.5 py-0.5 rounded bg-[#1A1A2E] text-[#00F0FF] text-xs font-mono" {...props}>
                {children}
              </code>
            );
          }
          // Fenced code block
          return <CodeBlock lang={match?.[1] || ''} code={codeStr} />;
        },
        // Paragraphs
        p({ children }) {
          return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>;
        },
        // Bold
        strong({ children }) {
          return <strong className="font-semibold text-[#F4F6FF]">{children}</strong>;
        },
        // Links
        a({ href, children }) {
          return (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#00F0FF] hover:underline">
              {children}
            </a>
          );
        },
        // Lists
        ul({ children }) {
          return <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>;
        },
        li({ children }) {
          return <li className="text-sm">{children}</li>;
        },
        // Headings
        h1({ children }) {
          return <h1 className="text-lg font-bold text-[#F4F6FF] mb-2 mt-3">{children}</h1>;
        },
        h2({ children }) {
          return <h2 className="text-base font-bold text-[#F4F6FF] mb-1.5 mt-2">{children}</h2>;
        },
        h3({ children }) {
          return <h3 className="text-sm font-semibold text-[#F4F6FF] mb-1 mt-2">{children}</h3>;
        },
        // Blockquote
        blockquote({ children }) {
          return (
            <blockquote className="border-l-2 border-[#00F0FF]/30 pl-3 my-2 text-[#9CA3AF] italic">
              {children}
            </blockquote>
          );
        },
        // Table
        table({ children }) {
          return (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full text-xs border-collapse">{children}</table>
            </div>
          );
        },
        th({ children }) {
          return <th className="px-3 py-1.5 text-left font-semibold text-[#E8E8F0] bg-[#1A1A2E] border border-white/10">{children}</th>;
        },
        td({ children }) {
          return <td className="px-3 py-1.5 text-[#C0C0D0] border border-white/10">{children}</td>;
        },
        // Horizontal rule
        hr() {
          return <hr className="border-white/10 my-3" />;
        },
        // Task list items
        input({ checked, ...props }) {
          return (
            <input
              type="checkbox"
              checked={checked}
              readOnly
              className="mr-1.5 rounded border-gray-600 text-[#00F0FF]"
              {...props}
            />
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

const personalityMeta: Record<AgentPersonality, { emoji: string; name: string; greeting: string }> = {
  edith: { emoji: '🔷', name: 'Edith', greeting: "What do you need? I'm ready." },
  jarvis: { emoji: '🟣', name: 'Jarvis', greeting: "Good day. How may I assist you?" },
  weebo: { emoji: '💚', name: 'Weebo', greeting: "Hiii! What are we working on today?!" },
  aria: { emoji: '🎨', name: 'Aria', greeting: "Hey! Let's create something amazing." },
  forge: { emoji: '🔧', name: 'Forge', greeting: "Forge here. What are we building?" },
  pulse: { emoji: '📊', name: 'Pulse', greeting: "Pulse online. What data do you need?" },
  echo: { emoji: '💙', name: 'Echo', greeting: "Hey, Echo here. What are we working on?" },
  cal: { emoji: '📅', name: 'Cal', greeting: "Cal here. Let's get organized." },
  nova: { emoji: '🔭', name: 'Nova', greeting: "Nova here! Ready to explore." },
};

const providerLabels: Record<string, string> = {
  picoclaw: 'Weebo Engine',
  ollama: 'Local Engine',
  openrouter: 'Cloud Engine',
  'openrouter-free': 'Cloud Engine',
  edith: 'Premium Engine',
  builtin: 'Built-in',
};

function formatModelName(model: string): string {
  if (!model || model === 'builtin-fallback' || model === 'error-fallback' || model === 'picoclaw-haiku') return '';
  const base = model.replace(/:free$/, '').split('/').pop() || '';
  return base.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
}

interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: Date;
  provider?: string;
  model?: string;
  isStreaming?: boolean;
  retryContent?: string;
  actions?: Array<{
    tool: string;
    success: boolean;
    message: string;
    artifactId?: string;
    data?: Record<string, unknown>;
    receipt?: { icon: string; text: string; details?: string; link?: string };
  }>;
  receipts?: Array<{ icon: string; text: string; details?: string; link?: string }>;
  /** 81.7: URL of generated image to render as inline image bubble */
  imageUrl?: string;
  /** Visible thinking steps from ReAct loop */
  thinkingSteps?: Array<{ type: string; content: string; tool?: string; iteration: number }>;
  /** Multi-agent council responses */
  agentResponses?: Array<{ agent: string; role: string; text: string }>;
  isMultiAgent?: boolean;
}

interface AgentChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** Optional: agent belongs to another user (portfolio chat mode) */
  agentOwner?: string;
}

const PLAN_DISPLAY: Record<string, string> = {
  free: 'Free', pilot: 'Pilot', intro: 'Intro', monthly: 'Monthly',
  halfyear: 'Half-Year', yearly: 'Yearly', basic: 'Basic', pro: 'Pro',
};

const suggestedPrompts = [
  "What's on my schedule today?",
  "Show me my usage stats",
  "Create a reminder for tomorrow",
  "Help me with a code review",
];

const USE_CASE_TIPS: Record<string, string[]> = {
  creator: [
    '/image a futuristic city at sunset',
    'Write a YouTube script for [your topic]',
    'Remind me every day at 9am to post content',
  ],
  student: [
    'Explain quantum entanglement simply',
    'Quiz me on the French Revolution',
    'Remind me to review notes at 8pm',
  ],
  developer: [
    'Review this code: [paste snippet]',
    'Write a Python script to parse a CSV',
    'Remind me to push commits at 6pm',
  ],
  business: [
    'Draft a follow-up email to a client about [project]',
    'Summarize these meeting notes: [paste]',
    'Remind me about my 3pm standup',
  ],
};

export function AgentChatPanel({ isOpen, onClose, agentOwner }: AgentChatPanelProps) {
  const agent = useDashboardStore((s) => s.agent);
  const updateAgent = useDashboardStore((s) => s.updateAgent);
  const user = useAuthStore((s) => s.user);
  const isMobile = useMobileDetect();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [tipDismissed, setTipDismissed] = useState(() => {
    if (typeof window === 'undefined' || !user?.id) return true;
    return !!localStorage.getItem(`tip-shown-${user.id}`);
  });
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  // 62.5: ↑/↓ history navigation + Ctrl+K clear
  const inputHistoryRef = useRef<string[]>([]);
  const historyIdxRef = useRef<number>(-1);
  const [isListening, setIsListening] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const speechSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // 80.5/80.7: MediaRecorder voice recording states
  type VoiceRecordState = 'idle' | 'recording' | 'uploading' | 'transcribing';
  const [voiceRecordState, setVoiceRecordState] = useState<VoiceRecordState>('idle');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const mediaRecorderSupported = typeof window !== 'undefined' && 'MediaRecorder' in window;

  // 80.6: TTS playback state (per message id)
  const [ttsLoadingId, setTtsLoadingId] = useState<string | null>(null);
  const [ttsPlayingId, setTtsPlayingId] = useState<string | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

  // 81.8: Image cap error shown inline
  const [imageCapError, setImageCapError] = useState<string | null>(null);

  // Streaming perf: buffer tokens in a ref, flush to state via RAF (avoids re-render per token)
  const streamBufferRef = useRef('');
  const rafRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isStreamActive, setIsStreamActive] = useState(false);

  // 82.7: AI safety footer — dismissed per session via sessionStorage
  const [safetyDismissed, setSafetyDismissed] = useState(() =>
    typeof sessionStorage !== 'undefined' && sessionStorage.getItem('ai-disclaimer-dismissed') === '1'
  );
  // 82.2: Track which agent messages have been reported
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());

  // Swipe-down-to-close on mobile header
  const [touchStartY, setTouchStartY] = useState(0);
  const handleHeaderTouchStart = (e: React.TouchEvent) => setTouchStartY(e.touches[0].clientY);
  const handleHeaderTouchEnd = (e: React.TouchEvent) => {
    const diff = e.changedTouches[0].clientY - touchStartY;
    if (diff > 100) onClose(); // swipe down 100px+ to close
  };

  // Credits remaining from last successful regular chat
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null);
  const [creditsTotal, setCreditsTotal] = useState<number | null>(null);
  const [planLabel, setPlanLabel] = useState<string>('Free');
  const [planPrice, setPlanPrice] = useState<number | null>(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [chatRateLimitRemaining, setChatRateLimitRemaining] = useState<number | null>(null);
  const [chatRateLimitResetAt, setChatRateLimitResetAt] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  // 60.6: reply-to context
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  // 61.4: memory quick-add — tracks which message was just saved
  const [memorySavedId, setMemorySavedId] = useState<string | null>(null);

  // Premium session state
  const [premiumSession, setPremiumSession] = useState<PremiumSession | null>(null);
  const [showDeployDialog, setShowDeployDialog] = useState(false);
  const [deployTask, setDeployTask] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);

  const pMeta = personalityMeta[(agent.personality as AgentPersonality) || 'jarvis'] || personalityMeta.jarvis;

  // Initialize with greeting — prefer custom agent greeting if set
  const resolvedGreeting = agent.greeting?.trim() || pMeta.greeting;
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: 'greeting',
          role: 'agent',
          content: resolvedGreeting,
          timestamp: new Date(),
        },
      ]);
    }
  }, [isOpen, messages.length, resolvedGreeting]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 41.3 / 57.4: Track scroll position to show/hide scroll-to-bottom button + unread count
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      const isScrolledUp = distanceFromBottom > 200;
      setShowScrollToBottom(isScrolledUp);
      if (!isScrolledUp) setUnreadCount(0); // reset when user scrolls to bottom
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isOpen]);

  // 57.4: Track new messages while scrolled up
  const prevMessagesLenRef = useRef(0);
  useEffect(() => {
    if (showScrollToBottom && messages.length > prevMessagesLenRef.current) {
      const newCount = messages.length - prevMessagesLenRef.current;
      setUnreadCount((c) => c + newCount);
    }
    prevMessagesLenRef.current = messages.length;
  }, [messages.length, showScrollToBottom]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setUnreadCount(0);
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Fetch subscription plan to show credits progress bar
  useEffect(() => {
    if (isOpen) {
      billingService.getPlan().then(({ data }) => {
        setCreditsTotal(data.monthly_credits);
        setCreditsRemaining(data.credits_remaining);
        setPlanLabel(PLAN_DISPLAY[data.plan] ?? data.plan);
        setPlanPrice(data.price_usd > 0 ? data.price_usd : null);
      }).catch(() => { /* ignore billing fetch errors */ });
    }
  }, [isOpen]);

  // Fetch rate limit status on open and refresh every 60s (33.4)
  useEffect(() => {
    if (!isOpen || agentOwner) return;
    const fetchRL = () => {
      agentService.getRateLimitStatus().then(({ data }) => {
        setChatRateLimitRemaining(data.remaining);
        if (data.resetAt) setChatRateLimitResetAt(new Date(data.resetAt).getTime());
      }).catch(() => { /* ignore */ });
    };
    fetchRL();
    const rlTimer = setInterval(fetchRL, 60000);
    return () => clearInterval(rlTimer);
  }, [isOpen, agentOwner]);

  // Cleanup: cancel RAF loop and abort in-flight stream on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      abortControllerRef.current?.abort();
    };
  }, []);

  // Ctrl+F / Cmd+F to open search
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
        setSearchTerm('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, searchOpen]);

  // Auto-focus search input when search opens
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchMatchIndex(0);
    }
  }, [searchOpen]);

  // Show toast notification when a new agent message arrives while panel is closed
  const prevAgentMsgCountRef = useRef(0);
  useEffect(() => {
    const agentMsgs = messages.filter((m) => m.role === 'agent' && !m.isStreaming && m.id !== 'greeting');
    const count = agentMsgs.length;
    if (!isOpen && count > prevAgentMsgCountRef.current && count > 0) {
      const last = agentMsgs[agentMsgs.length - 1];
      const preview = last.content.slice(0, 60) + (last.content.length > 60 ? '…' : '');
      notify(`${pMeta.name}: ${preview}`, 'info');
    }
    prevAgentMsgCountRef.current = count;
  }, [messages, isOpen, pMeta.name]);

  // Deploy specialist
  const handleDeploy = useCallback(async () => {
    if (!deployTask.trim() || isDeploying) return;
    setIsDeploying(true);
    try {
      const { data } = await premiumAgentService.deploy(deployTask.trim());
      setPremiumSession({ ...data, task: deployTask.trim() });
      setShowDeployDialog(false);
      setDeployTask('');
      // Add personality intro message
      if (data.message) {
        const introContent = data.message;
        setMessages((prev) => [...prev, {
          id: `deploy-intro-${Date.now()}`,
          role: 'agent',
          content: introContent,
          timestamp: new Date(),
        }, {
          id: `deploy-system-${Date.now()}`,
          role: 'system',
          content: `${data.codename} deployed — 100 credits used`,
          timestamp: new Date(),
        }]);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to deploy specialist.';
      setMessages((prev) => [...prev, {
        id: `deploy-err-${Date.now()}`,
        role: 'system',
        content: msg,
        timestamp: new Date(),
      }]);
      setShowDeployDialog(false);
    } finally {
      setIsDeploying(false);
    }
  }, [deployTask, isDeploying]);

  // End session
  const handleEndSession = useCallback(async () => {
    if (!premiumSession) return;
    try {
      const { data } = await premiumAgentService.endSession(premiumSession.sessionId);
      setMessages((prev) => [...prev, {
        id: `session-end-${Date.now()}`,
        role: 'system',
        content: `${premiumSession.codename} session complete — ${data.creditsUsed} credits used, ${data.messagesCount} messages`,
        timestamp: new Date(),
      }]);
      setPremiumSession(null);
    } catch {
      setPremiumSession(null);
    }
  }, [premiumSession]);

  const sendMessage = useCallback((text?: string) => {
    const raw = text || input.trim();
    if (!raw || isTyping) return;
    // 60.6: prepend reply-to context if replying
    const content = replyTo
      ? `> Re: "${replyTo.content.slice(0, 80)}${replyTo.content.length > 80 ? '…' : ''}"\n\n${raw}`
      : raw;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    const agentMsgId = (Date.now() + 1).toString();

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setReplyTo(null);
    setIsTyping(true);
    // 62.5: push to input history (deduplicate consecutive identical messages)
    if (inputHistoryRef.current[0] !== raw) {
      inputHistoryRef.current = [raw, ...inputHistoryRef.current].slice(0, 50);
    }
    historyIdxRef.current = -1;

    // Helper: set agent message (create or update)
    const setAgentMsg = (update: Partial<ChatMessage>) => {
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === agentMsgId);
        if (exists) {
          return prev.map((m) => m.id === agentMsgId ? { ...m, ...update } : m);
        }
        return [...prev, { id: agentMsgId, role: 'agent' as const, content: '', timestamp: new Date(), ...update }];
      });
    };

    // 81.6: /image [prompt] command → async image generation (bypass chat)
    if (raw.startsWith('/image ')) {
      const imagePrompt = raw.slice(7).trim();
      if (imagePrompt) {
        setImageCapError(null);
        setAgentMsg({ content: '🎨 Generating image…', isStreaming: true });
        (async () => {
          try {
            const { jobId } = await imageAsyncService.generate(imagePrompt);
            const job = await jobsService.pollUntilDone(jobId, 60, 2000);
            const result = job.result as { imageUrl: string; imageId: string; prompt: string } | undefined;
            if (job.status === 'done' && result?.imageUrl) {
              setAgentMsg({ content: `Generated: "${imagePrompt}"`, imageUrl: result.imageUrl, isStreaming: false });
            } else {
              setAgentMsg({ content: 'Image generation failed. Please try again.', isStreaming: false });
            }
          } catch (err) {
            const e = err as { code?: string };
            if (e?.code === 'IMAGE_CAP') {
              const capMsg = `Image limit reached (${(err as { used?: number }).used ?? 5}/5) — upgrade for more`;
              setImageCapError(capMsg);
              setAgentMsg({ content: capMsg, isStreaming: false });
            } else {
              setAgentMsg({ content: 'Image generation failed. Please try again.', isStreaming: false });
            }
          } finally {
            setIsTyping(false);
          }
        })();
        return;
      }
    }

    // Premium session chat (non-streaming)
    if (premiumSession) {
      (async () => {
        try {
          const { data } = await premiumAgentService.chat(premiumSession.sessionId, content);
          setAgentMsg({ content: data.text, isStreaming: false, provider: data.provider, model: data.model });
          setPremiumSession((prev) => prev ? { ...prev, creditsUsed: data.sessionCreditsTotal, messagesCount: data.messagesCount } : prev);
        } catch {
          setAgentMsg({
            content: "Sorry, I couldn't process that right now. Please try again.",
            isStreaming: false,
          });
        } finally {
          setIsTyping(false);
        }
      })();
      return;
    }

    // Helper: non-streaming chat call
    const doRegularChat = async () => {
      if (agentOwner) {
        // Visitor mode: call the public portfolio endpoint with history
        const history = messages
          .filter(m => m.role !== 'system' && m.id !== 'greeting')
          .map(m => ({ role: m.role === 'agent' ? 'assistant' : 'user', content: m.content }));
        const count = messages.filter(m => m.role === 'user').length;
        const { data } = await publicAgentService.chat(agentOwner, content, history, count);
        const text = data.reply || '';
        if (!text) throw new Error('Empty response');
        setAgentMsg({ content: text, isStreaming: false, provider: 'ollama' });
        return;
      }
      const { data } = await agentService.chat(content);
      const text = data.text || '';
      if (!text && !data.actions?.length) throw new Error('Empty response');
      if (typeof (data as unknown as Record<string, unknown>).creditsRemaining === 'number') {
        const cr = (data as unknown as Record<string, unknown>).creditsRemaining as number;
        setCreditsRemaining(cr);
        if (cr === 0) setShowUpgradePrompt(true);
      }
      setAgentMsg({ content: text, isStreaming: false, provider: data.provider, model: data.model, actions: data.actions || undefined, receipts: data.receipts || undefined });
    };

    // Main chat logic: try streaming → fall back to regular → show error
    (async () => {
      try {
        // Visitor mode: no streaming endpoint for public chat
        if (agentOwner) {
          await doRegularChat();
          return;
        }

        // Abort any in-flight stream before starting a new one
        abortControllerRef.current?.abort();
        const ac = new AbortController();
        abortControllerRef.current = ac;

        // Attempt SSE streaming
        const res = await agentService.chatStream(content, 'web', ac.signal);

        // Capture rate limit remaining from response headers
        const rlRemaining = res.headers.get('RateLimit-Remaining') ?? res.headers.get('ratelimit-remaining');
        if (rlRemaining !== null) {
          setChatRateLimitRemaining(parseInt(rlRemaining, 10));
        }

        if (!res.ok || !res.body) {
          // Stream not available — use regular chat
          await doRegularChat();
          return;
        }

        // Add empty streaming message
        setAgentMsg({ content: '', isStreaming: true });
        setIsTyping(false);
        setIsStreamActive(true);

        // Reset stream buffer
        streamBufferRef.current = '';

        // RAF flush loop: reads from mutable ref, writes to state at most once per frame
        const flushBuffer = () => {
          const buffered = streamBufferRef.current;
          if (buffered) {
            setAgentMsg({ content: buffered });
          }
          rafRef.current = requestAnimationFrame(flushBuffer);
        };
        rafRef.current = requestAnimationFrame(flushBuffer);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let gotError = false;
        const thinkingSteps: Array<{ type: string; content: string; tool?: string; iteration: number }> = [];
        const agentResponses: Array<{ agent: string; role: string; text: string }> = [];
        let isMultiAgent = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const chunk = JSON.parse(jsonStr);

              if (chunk.error) {
                gotError = true;
              }

              // Visible thinking step from ReAct loop
              if (chunk.step) {
                thinkingSteps.push(chunk.step);
                // Show thinking step as streaming preview
                const stepIcon = chunk.step.type === 'thinking' ? '🧠' : chunk.step.type === 'tool_call' ? '🔧' : chunk.step.type === 'tool_result' ? '📊' : '✍️';
                const stepPreview = thinkingSteps.map((s: { type: string; content: string }) => {
                  const icon = s.type === 'thinking' ? '🧠' : s.type === 'tool_call' ? '🔧' : s.type === 'tool_result' ? '📊' : '✍️';
                  return `${icon} ${s.content}`;
                }).join('\n');
                setAgentMsg({ content: stepPreview, isStreaming: true, thinkingSteps: [...thinkingSteps] });
                void stepIcon; // used above in template
              }

              if (chunk.text) {
                // Accumulate into mutable ref — zero renders per token
                streamBufferRef.current += chunk.text;

                // Detect multi-agent response pattern: "**Role** (Agent):\n..."
                const agentMatch = chunk.text.match(/^\*\*(.+?)\*\*\s*\((\w+)\):\n([\s\S]*?)(?:\n---\n|$)/);
                if (agentMatch) {
                  isMultiAgent = true;
                  agentResponses.push({ role: agentMatch[1], agent: agentMatch[2], text: agentMatch[3].trim() });
                  setAgentMsg({ content: streamBufferRef.current, isStreaming: true, isMultiAgent: true, agentResponses: [...agentResponses] });
                }
              }

              if (chunk.done) {
                // Final flush: cancel RAF, push final content + clear streaming flag
                cancelAnimationFrame(rafRef.current);
                rafRef.current = 0;
                setAgentMsg({
                  content: streamBufferRef.current,
                  isStreaming: false,
                  provider: chunk.provider,
                  model: chunk.model,
                  thinkingSteps: thinkingSteps.length > 0 ? thinkingSteps : undefined,
                  agentResponses: isMultiAgent ? agentResponses : undefined,
                  isMultiAgent,
                });
              }
            } catch {
              // skip malformed chunks
            }
          }
        }

        // Stop RAF loop
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = 0;
        }

        // Streaming ended — check if we actually got content
        if (!streamBufferRef.current || gotError) {
          // Stream was empty or errored — fall back to regular chat
          setIsTyping(true);
          setIsStreamActive(false);
          await doRegularChat();
          return;
        }

        // Ensure streaming flag is cleared
        setAgentMsg({ content: streamBufferRef.current, isStreaming: false });
        setIsStreamActive(false);
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
            setAgentMsg({ content: partial, isStreaming: false });
          }
          return;
        }

        // Full fallback — try regular chat
        try {
          setIsTyping(true);
          await doRegularChat();
        } catch (innerErr: unknown) {
          const status = (innerErr as { response?: { status?: number } })?.response?.status;
          // 77.5: 429 / credit exhaustion → show upgrade prompt instead of raw error
          if (status === 429) {
            setShowUpgradePrompt(true);
            setAgentMsg({
              content: "You've reached your daily limit. Upgrade your plan to keep chatting.",
              isStreaming: false,
            });
          } else {
            const reqId = (innerErr as { response?: { headers?: Record<string, string>; data?: { requestId?: string } } })?.response?.data?.requestId
              ?? (innerErr as { response?: { headers?: Record<string, string> } })?.response?.headers?.['x-request-id'];
            setAgentMsg({
              content: "Sorry, I couldn't process that right now. Please try again." + (reqId ? ` (Error ID: ${reqId})` : ''),
              isStreaming: false,
              retryContent: content,
            });
          }
        }
      } finally {
        setIsTyping(false);
        abortControllerRef.current = null;
      }
    })();
  }, [input, isTyping, premiumSession, agentOwner, messages, replyTo]);

  // ---- 8.3: Export conversations ----
  // 61.4: Save message content to agent memory
  const handleSaveToMemory = async (msgId: string, content: string) => {
    try {
      const key = `chat-note:${Date.now()}`;
      const snippet = content.slice(0, 500);
      await memoryService.create({ category: 'note', key, value: snippet, confidence: 0.8 });
      setMemorySavedId(msgId);
      setTimeout(() => setMemorySavedId(null), 2500);
      toast.success('Saved to memory');
    } catch {
      toast.error('Failed to save to memory');
    }
  };

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const { data } = await memoryService.getConversationsExport(1000);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'conversations.json';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  // 62.3: Export current chat session as markdown text
  const handleExportChat = () => {
    const visibleMsgs = messages.filter((m) => !m.isStreaming && m.id !== 'greeting');
    if (visibleMsgs.length === 0) return;
    const lines: string[] = [`# Chat Export — ${new Date().toLocaleString()}`, ''];
    for (const msg of visibleMsgs) {
      const who = msg.role === 'user' ? '**You**' : `**${pMeta.name}**`;
      const ts = new Date(msg.timestamp).toLocaleTimeString();
      lines.push(`${who} · ${ts}`);
      lines.push(msg.content);
      lines.push('');
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (showDeployDialog) {
        handleDeploy();
      } else {
        sendMessage();
      }
    }
    // 62.5: ↑ to navigate back in input history
    if (e.key === 'ArrowUp' && !e.shiftKey && !isTyping) {
      const hist = inputHistoryRef.current;
      if (hist.length === 0) return;
      e.preventDefault();
      const nextIdx = Math.min(historyIdxRef.current + 1, hist.length - 1);
      historyIdxRef.current = nextIdx;
      setInput(hist[nextIdx]);
      // Move cursor to end on next tick
      setTimeout(() => {
        const el = inputRef.current;
        if (el) el.setSelectionRange(el.value.length, el.value.length);
      }, 0);
    }
    // 62.5: ↓ to navigate forward in input history
    if (e.key === 'ArrowDown' && !e.shiftKey && !isTyping) {
      e.preventDefault();
      if (historyIdxRef.current <= 0) {
        historyIdxRef.current = -1;
        setInput('');
        return;
      }
      const nextIdx = historyIdxRef.current - 1;
      historyIdxRef.current = nextIdx;
      setInput(inputHistoryRef.current[nextIdx]);
    }
    // 62.5: Ctrl+K / Cmd+K to clear chat
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      resetChat();
    }
  };

  const resetChat = () => {
    setMessages([]);
    setPremiumSession(null);
  };

  const handleVoiceInput = () => {
    if (!speechSupported) return;
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join('');
      setInput(transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  // 80.5/80.7: MediaRecorder-based voice recording → server Whisper transcription
  const handleMediaRecord = async () => {
    if (voiceRecordState === 'recording') {
      mediaRecorderRef.current?.stop();
      return;
    }
    if (voiceRecordState !== 'idle') return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/ogg') ? 'audio/ogg' : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recordingChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordingChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
        setRecordingDuration(0);

        const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size < 100) { setVoiceRecordState('idle'); return; }

        setVoiceRecordState('uploading');
        try {
          const { jobId } = await voiceService.transcribe(blob);
          setVoiceRecordState('transcribing');
          const job = await jobsService.pollUntilDone(jobId, 30, 1000);
          if (job.status === 'done' && job.result) {
            const result = job.result as { text: string };
            setInput(result.text);
            inputRef.current?.focus();
          } else {
            throw new Error(job.error || 'Transcription failed');
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Voice error';
          setVoiceError(msg.includes('Voice limit reached') ? 'Voice limit reached — upgrade for more' : msg);
          setTimeout(() => setVoiceError(null), 4000);
        } finally {
          setVoiceRecordState('idle');
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setVoiceRecordState('recording');
      setRecordingDuration(0);
      recordingIntervalRef.current = setInterval(() => setRecordingDuration(d => d + 1), 1000);
    } catch {
      setVoiceError('Microphone access denied');
      setTimeout(() => setVoiceError(null), 3000);
    }
  };

  // 80.6: TTS playback — click speaker icon to hear an agent message
  const handleTTS = async (messageId: string, text: string) => {
    if (ttsLoadingId === messageId) return;
    // Toggle off if already playing this message
    if (ttsPlayingId === messageId) {
      ttsAudioRef.current?.pause();
      setTtsPlayingId(null);
      return;
    }
    try {
      setTtsLoadingId(messageId);
      const { jobId } = await voiceService.speak(text.slice(0, 500));
      const job = await jobsService.pollUntilDone(jobId, 20, 1000);
      if (job.status === 'done' && job.result) {
        const result = job.result as { audioBase64: string; mimeType: string };
        const audio = new Audio(`data:${result.mimeType};base64,${result.audioBase64}`);
        ttsAudioRef.current = audio;
        audio.onended = () => setTtsPlayingId(null);
        audio.onerror = () => setTtsPlayingId(null);
        setTtsPlayingId(messageId);
        await audio.play();
      } else {
        throw new Error(job.error || 'TTS failed');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      toast.error(msg.includes('Voice limit reached') ? 'Voice limit reached — upgrade for more' : 'Text-to-speech unavailable');
    } finally {
      setTtsLoadingId(null);
    }
  };

  // Current avatar emoji — specialist uses a rocket
  const avatarEmoji = premiumSession ? '🚀' : pMeta.emoji;
  const headerName = premiumSession ? `${premiumSession.codename} — Specialist` : (agent.name || pMeta.name);

  return (
    <>
      {/* Backdrop — only on desktop (mobile chat is full-screen, no backdrop needed) */}
      {isOpen && !isMobile && (
        <div className="fixed inset-0 z-[60]" onClick={onClose} />
      )}

      {/* Panel */}
      <div
        className={`${
          isMobile
            ? 'fixed inset-0 z-[70] glass-card-v2 flex flex-col'
            : `fixed right-0 top-0 h-full w-full md:w-[420px] glass-card-v2 border-l border-[#00F0FF]/20 shadow-2xl shadow-[#00F0FF]/10 z-[61] flex flex-col`
        } transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 border-b border-[#00F0FF]/20 bg-[#06060B] safe-area-pt"
          onTouchStart={handleHeaderTouchStart}
          onTouchEnd={handleHeaderTouchEnd}
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                premiumSession
                  ? 'bg-gradient-to-br from-[#F59E0B] to-[#EF4444]'
                  : 'bg-gradient-to-br from-[#00F0FF] to-[#FF2D78]'
              }`}>
                {avatarEmoji}
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#06060B] ${
                premiumSession ? 'bg-[#F59E0B] animate-pulse' : 'bg-[#00FF88]'
              }`} />
            </div>
            <div>
              <div className="font-semibold text-sm text-[#E8E8F0]">{headerName}</div>
              {premiumSession ? (
                <div className="text-xs text-[#F59E0B] flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Session active &middot; {premiumSession.creditsUsed} credits
                </div>
              ) : (
                <div className="text-xs text-[#00FF88] flex items-center gap-1 flex-wrap">
                  <Sparkles className="w-3 h-3" /> Online
                  {creditsRemaining !== null && (
                    <span className="ml-1 text-[#6B7280]">· ⚡ {creditsRemaining} credits</span>
                  )}
                  {/* 42.6: Conversation turns indicator */}
                  {(() => {
                    const turns = Math.floor(messages.filter(m => m.role !== 'system').length / 2);
                    if (turns === 0) return null;
                    const color = turns >= 25 ? '#FF6161' : turns >= 15 ? '#F59E0B' : '#6B7280';
                    return (
                      <span className="ml-1 text-[10px]" style={{ color }} title={`${turns} conversation turns used`}>
                        · Turn {turns}
                      </span>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {premiumSession ? (
              <button
                onClick={handleEndSession}
                className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium transition-colors flex items-center gap-1"
                title="End specialist session"
              >
                <Square className="w-3 h-3" /> End Session
              </button>
            ) : (
              <button
                onClick={resetChat}
                className="p-2.5 rounded-lg hover:bg-[#00F0FF]/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                title="Reset chat"
                aria-label="Reset chat"
              >
                <RotateCcw className="w-4 h-4 text-[#6B7280]" />
              </button>
            )}
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="p-2.5 rounded-lg hover:bg-[#00F0FF]/10 active:bg-[#00F0FF]/20 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              title="Export all conversations (JSON)"
              aria-label="Download chat history"
            >
              <Download className={`w-4 h-4 ${isExporting ? 'text-[#00F0FF] animate-pulse' : 'text-[#6B7280]'}`} />
            </button>
            {/* 62.3: Export current chat as markdown */}
            {messages.filter((m) => !m.isStreaming && m.id !== 'greeting' && m.role !== 'system').length > 0 && (
              <button
                onClick={handleExportChat}
                className="p-2.5 rounded-lg hover:bg-[#00F0FF]/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                title="Export this chat (Markdown)"
              >
                <span className="text-xs text-[#6B7280] font-mono">MD</span>
              </button>
            )}
            <button
              onClick={() => { setSearchOpen(v => !v); setSearchTerm(''); }}
              className={`p-2.5 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center ${searchOpen ? 'bg-[#00F0FF]/20 text-[#00F0FF]' : 'hover:bg-[#00F0FF]/10 text-[#6B7280]'}`}
              title="Search messages"
              aria-label="Toggle search"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2.5 rounded-lg hover:bg-[#00F0FF]/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Close chat panel"
            >
              <X className="w-5 h-5 text-[#6B7280]" />
            </button>
          </div>
        </div>

        {/* Credits progress bar — skeleton while loading, real bar once data arrives (48.3) */}
        {creditsTotal === null
          ? <Skeleton className="h-1 w-full rounded-none" />
          : creditsTotal > 0 && creditsRemaining !== null && (
            <div
              className="h-1 w-full bg-[#0A0A12]"
              title={`${creditsRemaining} of ${creditsTotal} credits remaining`}
            >
              <div
                className={`h-full transition-all duration-500 ${
                  creditsRemaining / creditsTotal > 0.5
                    ? 'bg-[#00FF88]'
                    : creditsRemaining / creditsTotal > 0.2
                    ? 'bg-[#F59E0B]'
                    : 'bg-[#EF4444]'
                }`}
                style={{ width: `${Math.min(100, (creditsRemaining / creditsTotal) * 100)}%` }}
              />
            </div>
          )
        }

        {/* 63.9: Persona quick-switch pills — only for own agent (not portfolio mode) */}
        {!agentOwner && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-[#1A1A2E]">
            {(Object.entries(personalityMeta) as [AgentPersonality, { emoji: string; name: string }][]).map(([key, meta]) => {
              const isActive = (agent.personality || 'jarvis') === key;
              return (
                <button
                  key={key}
                  onClick={() => { void updateAgent({ personality: key }); }}
                  className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium border transition-all ${
                    isActive
                      ? 'bg-[#00F0FF]/15 border-[#00F0FF]/50 text-[#00F0FF]'
                      : 'border-[#1A1A2E] text-[#6B7280] hover:border-[#00F0FF]/20 hover:text-[#E8E8F0]'
                  }`}
                  title={`Switch to ${meta.name}`}
                >
                  {meta.emoji} {meta.name}
                </button>
              );
            })}
          </div>
        )}

        {/* Rate limit warning — shown when fewer than 10 chat requests remain in the window (33.4, 36.4) */}
        {chatRateLimitRemaining !== null && chatRateLimitRemaining < 10 && (
          <div className={`px-4 py-1.5 border-b flex items-center gap-2 ${chatRateLimitRemaining < 5 ? 'bg-[#EF4444]/10 border-[#EF4444]/20' : 'bg-[#F59E0B]/10 border-[#F59E0B]/20'}`}>
            <span className={`text-xs ${chatRateLimitRemaining < 5 ? 'text-[#EF4444]' : 'text-[#F59E0B]'}`}>
              ⚠ {chatRateLimitRemaining} chat request{chatRateLimitRemaining !== 1 ? 's' : ''} remaining
              {chatRateLimitResetAt && chatRateLimitResetAt > Date.now() && (
                <> · resets in {Math.ceil((chatRateLimitResetAt - Date.now()) / 60000)}m</>
              )}
            </span>
          </div>
        )}

        {/* Search bar — sticky at top of messages area */}
        {searchOpen && (
          <div className="sticky top-0 z-10 px-4 py-2 border-b border-[#00F0FF]/10 bg-[#06060B]">
            <div className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6B7280]" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setSearchMatchIndex(0); }}
                  onKeyDown={(e) => {
                    const matchCount = messages.filter(m => m.content.toLowerCase().includes(searchTerm.toLowerCase())).length;
                    if (e.key === 'Enter') {
                      e.shiftKey
                        ? setSearchMatchIndex(i => (i - 1 + matchCount) % Math.max(matchCount, 1))
                        : setSearchMatchIndex(i => (i + 1) % Math.max(matchCount, 1));
                    }
                  }}
                  placeholder="Search messages… (Enter to cycle)"
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#0A0A12] border border-[#00F0FF]/20 text-sm text-[#E8E8F0] placeholder-[#6B7280] focus:outline-none focus:border-[#00F0FF]/50"
                />
                {searchTerm && (() => {
                  const matchCount = messages.filter(m => m.content.toLowerCase().includes(searchTerm.toLowerCase())).length;
                  return matchCount > 0 ? (
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[#00F0FF]">
                      {Math.min(searchMatchIndex + 1, matchCount)} of {matchCount}
                    </span>
                  ) : (
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[#6B7280]">
                      0 results
                    </span>
                  );
                })()}
              </div>
              <button
                onClick={() => { setSearchOpen(false); setSearchTerm(''); }}
                className="p-1 rounded text-[#6B7280] hover:text-[#E8E8F0] transition-colors"
                title="Close search (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 relative">
          {/* 48.3 / 55.7: Empty state — skeleton while loading, suggestions once settled */}
          {messages.length === 0 && (
            <>
              <div className="flex justify-start gap-2">
                <Skeleton className="w-7 h-7 rounded-full flex-shrink-0 mt-1" />
                <div className="space-y-2 max-w-[75%]">
                  <Skeleton className="h-4 w-48 rounded-xl" />
                  <Skeleton className="h-4 w-36 rounded-xl" />
                </div>
              </div>
              {/* 55.7: Quick-start suggestions */}
              <div className="mt-6 px-2">
                <p className="text-[11px] text-[#6B7280] mb-3 text-center">Try asking…</p>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    'Summarize my reminders for today',
                    'What automations do I have running?',
                    'Generate a Python hello-world snippet',
                    'Check my Telegram connection status',
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => { setInput(suggestion); inputRef.current?.focus(); }}
                      className="text-left text-xs px-3 py-2 rounded-lg border border-[#00F0FF]/15 bg-[#00F0FF]/5 text-[#6B7280] hover:text-[#E8E8F0] hover:border-[#00F0FF]/30 hover:bg-[#00F0FF]/10 transition-all"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          {(searchOpen && searchTerm
            ? messages.filter(m => m.content.toLowerCase().includes(searchTerm.toLowerCase()))
            : messages
          ).map((msg) => (
            <div
              key={msg.id}
              className={`group flex ${msg.role === 'user' ? 'justify-end' : msg.role === 'system' ? 'justify-center' : 'justify-start'}`}
              style={{ animation: 'page-enter 0.2s ease-out' }}
            >
              {msg.role === 'system' ? (
                <div className="px-3 py-1.5 rounded-full bg-[#00F0FF]/10 border border-[#00F0FF]/20 text-[10px] text-[#6B7280]">
                  {msg.content}
                </div>
              ) : (
                <>
                  {msg.role === 'agent' && (
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center mr-2 flex-shrink-0 mt-1 text-sm ${
                      premiumSession ? 'bg-[#F59E0B]/20' : 'bg-[#00F0FF]/20'
                    }`}>
                      {avatarEmoji}
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed overflow-x-auto ${
                      msg.role === 'user'
                        ? 'bg-[#00F0FF] text-white rounded-br-md'
                        : 'bg-[#06060B] text-[#E8E8F0] border border-[#00F0FF]/20 rounded-bl-md'
                    }`}
                  >
                    {/* Thinking steps (collapsible when not streaming) */}
                    {msg.thinkingSteps && msg.thinkingSteps.length > 0 && !msg.isStreaming && (
                      <details className="mb-2 rounded-md" style={{ background: '#0C0C18', border: '1px solid rgba(0,240,255,0.1)' }}>
                        <summary className="cursor-pointer px-2 py-1 text-[11px] text-[#8892A4] select-none flex items-center gap-1">
                          <span>🧠</span> <span>{msg.thinkingSteps.length} thinking steps</span>
                        </summary>
                        <div className="px-2 pb-2 space-y-1">
                          {msg.thinkingSteps.map((s, i) => (
                            <div key={i} className="flex items-start gap-1.5 text-[11px]">
                              <span className="shrink-0">{s.type === 'thinking' ? '🧠' : s.type === 'tool_call' ? '🔧' : s.type === 'tool_result' ? '📊' : '✍️'}</span>
                              <span className="text-[#8892A4]">
                                {s.tool && <span className="text-[#00F0FF] mr-1">[{s.tool}]</span>}
                                {s.content}
                              </span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                    {/* Multi-agent council transcript */}
                    {msg.agentResponses && msg.agentResponses.length > 0 && !msg.isStreaming && (
                      <div className="space-y-2 mb-2">
                        {msg.agentResponses.map((ar, i) => {
                          const agentColors: Record<string, string> = {
                            Weebo: '#00F0FF', Edith: '#8B5CF6', Jarvis: '#ADFF2F', Aria: '#F59E0B',
                            Forge: '#FF2D78', Pulse: '#00F0FF', Echo: '#8B5CF6', Cal: '#ADFF2F', Nova: '#F59E0B',
                          };
                          const color = agentColors[ar.agent] || '#8892A4';
                          return (
                            <div key={i} className="rounded-lg p-2.5" style={{ background: color + '08', border: `1px solid ${color}25` }}>
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                                <span className="text-[11px] font-bold" style={{ color }}>{ar.agent}</span>
                                <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: color + '15', color: color + 'CC' }}>{ar.role}</span>
                              </div>
                              <div className="text-[11px] leading-relaxed" style={{ color: '#E8E8F0' }}>
                                {ar.text}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {searchOpen && searchTerm && msg.content.toLowerCase().includes(searchTerm.toLowerCase())
                      ? (() => {
                          const parts = msg.content.split(new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
                          return parts.map((part, i) =>
                            part.toLowerCase() === searchTerm.toLowerCase()
                              ? <mark key={i} className="bg-[#F59E0B]/40 text-[#F59E0B] rounded px-0.5">{part}</mark>
                              : part
                          );
                        })()
                      : (msg.role === 'agent'
                        ? (msg.isStreaming
                          ? <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                          : renderMessageContent(msg.content))
                        : msg.content)}
                    {msg.isStreaming && <span className="inline-block w-1.5 h-4 bg-[#00F0FF] ml-0.5 animate-pulse rounded-sm" />}
                    {msg.provider && !msg.isStreaming && (
                      <span className="block mt-1.5 text-[10px] text-[#6B7280]/60 flex items-center gap-1">
                        <Zap className="w-2.5 h-2.5" /> {providerLabels[msg.provider!] ?? msg.provider}
                        {msg.model && formatModelName(msg.model) && (
                          <span className="text-[#555]">· via {formatModelName(msg.model)}</span>
                        )}
                      </span>
                    )}
                    {msg.actions?.map((action, i) => (
                      action.tool === 'generate_code' && action.data ? (
                        <CodePreviewCard
                          key={i}
                          artifactId={action.artifactId || ''}
                          title={(action.data.title as string) || 'Project'}
                          html={action.data.html as string}
                          css={action.data.css as string}
                          js={action.data.js as string}
                        />
                      ) : (
                        <ActionResultCard key={i} tool={action.tool} success={action.success} message={action.message} />
                      )
                    ))}
                    {/* Receipts - Visual confirmation of actions */}
                    {msg.receipts && msg.receipts.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {msg.receipts.map((receipt, i) => (
                          <a
                            key={i}
                            href={receipt.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#00FF88]/10 border border-[#00FF88]/20 text-sm hover:bg-[#00FF88]/15 transition-colors"
                          >
                            <span className="text-lg">{receipt.icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-[#00FF88]">{receipt.text}</p>
                              {receipt.details && (
                                <p className="text-xs text-[#6B7280] truncate">{receipt.details}</p>
                              )}
                            </div>
                          </a>
                        ))}
                      </div>
                    )}
                    {/* 81.7: Inline generated image bubble */}
                    {msg.imageUrl && !msg.isStreaming && (
                      <div className="mt-3">
                        <img
                          src={msg.imageUrl}
                          alt={msg.content}
                          className="rounded-xl max-w-full border border-[#00F0FF]/20"
                          loading="lazy"
                        />
                        <a
                          href={msg.imageUrl}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 mt-1.5 text-xs text-[#00F0FF]/70 hover:text-[#00F0FF] transition-colors"
                        >
                          <Download className="w-3 h-3" /> Download
                        </a>
                      </div>
                    )}
                    {/* 81.7: Spinner while image job is in progress */}
                    {msg.isStreaming && msg.content.startsWith('🎨') && (
                      <div className="flex items-center gap-2 mt-2">
                        <Loader2 className="w-4 h-4 animate-spin text-[#A78BFA]" />
                        <span className="text-xs text-[#6B7280]">This may take 10–20s…</span>
                      </div>
                    )}
                    {/* Message Reactions for agent messages */}
                    {msg.role === 'agent' && !msg.isStreaming && (
                      <MessageReactions
                        messageId={msg.id}
                        content={msg.content}
                        onReact={(id, reaction) => {
                          memoryService.addReaction(id, reaction).catch(() => {});
                        }}
                        onCopy={(_id, text) => {
                          // 47.4: Show "Copied!" toast on copy
                          navigator.clipboard.writeText(text)
                            .then(() => toast.success('Copied!', { duration: 1500 }))
                            .catch(() => {});
                        }}
                      />
                    )}
                    {/* 80.6: TTS speaker icon for agent messages */}
                    {msg.role === 'agent' && !msg.isStreaming && (
                      <div className="flex justify-end mt-1">
                        <button
                          onClick={() => handleTTS(msg.id, msg.content)}
                          className={`p-1 rounded transition-colors ${
                            ttsPlayingId === msg.id
                              ? 'text-[#00F0FF] bg-[#00F0FF]/15'
                              : 'text-[#6B7280]/50 hover:text-[#6B7280] hover:bg-[#00F0FF]/5'
                          }`}
                          title={ttsPlayingId === msg.id ? 'Stop playback' : 'Listen to this message'}
                          data-testid="tts-button"
                        >
                          {ttsLoadingId === msg.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Volume2 className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    )}
                    {/* Retry button for failed messages */}
                    {msg.role === 'agent' && msg.retryContent && (
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={() => sendMessage(msg.retryContent)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#00F0FF]/10 hover:bg-[#00F0FF]/20 text-[#00F0FF] text-xs transition-colors"
                          title="Retry"
                        >
                          <RotateCcw className="w-3 h-3" /> Retry
                        </button>
                      </div>
                    )}
                    {/* 60.6: Reply + 61.4: Save to memory buttons */}
                    {!msg.isStreaming && (
                      <div className="flex justify-end gap-1 mt-1">
                        {/* 61.4: Save to memory */}
                        <button
                          onClick={() => void handleSaveToMemory(msg.id, msg.content)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded text-[#6B7280] hover:text-[#BF5FFF] text-[10px] transition-colors opacity-0 group-hover:opacity-100"
                          title="Save to agent memory"
                          data-testid={`save-memory-btn-${msg.id}`}
                        >
                          {memorySavedId === msg.id
                            ? <BookmarkCheck className="w-3 h-3 text-[#00FF88]" />
                            : <Bookmark className="w-3 h-3" />}
                          {memorySavedId === msg.id ? 'Saved!' : 'Save'}
                        </button>
                        <button
                          onClick={() => { setReplyTo(msg); inputRef.current?.focus(); }}
                          className="flex items-center gap-1 px-2 py-0.5 rounded text-[#6B7280] hover:text-[#00F0FF] text-[10px] transition-colors opacity-0 group-hover:opacity-100"
                          title="Reply to this message"
                          data-testid={`reply-btn-${msg.id}`}
                        >
                          ↩ Reply
                        </button>
                        {/* 82.2: Flag / Report this agent response */}
                        {msg.role === 'agent' && (
                          <button
                            onClick={async () => {
                              if (reportedIds.has(msg.id)) return;
                              try {
                                const token = localStorage.getItem('gs_token');
                                await fetch('/api/report', {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                                  },
                                  body: JSON.stringify({ messageContent: msg.content.slice(0, 500), reason: 'inappropriate' }),
                                });
                                setReportedIds(prev => new Set([...prev, msg.id]));
                                toast.success('Response flagged — thank you', { duration: 2000 });
                              } catch {
                                toast.error('Failed to submit report');
                              }
                            }}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors opacity-0 group-hover:opacity-100 ${
                              reportedIds.has(msg.id) ? 'text-[#FF6161]' : 'text-[#6B7280] hover:text-[#FF6161]'
                            }`}
                            title="Flag this response"
                            data-testid={`report-btn-${msg.id}`}
                          >
                            <Flag className="w-3 h-3" />
                            {reportedIds.has(msg.id) ? 'Flagged' : 'Flag'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex justify-start">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center mr-2 flex-shrink-0 mt-1 text-sm ${
                premiumSession ? 'bg-[#F59E0B]/20' : 'bg-[#00F0FF]/20'
              }`}>
                {avatarEmoji}
              </div>
              <div className="bg-[#06060B] border border-[#00F0FF]/20 px-4 py-3 rounded-2xl rounded-bl-md">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full bg-[#00F0FF]/60"
                      style={{ animation: `typing-dot 1.2s ease-in-out ${i * 0.2}s infinite` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Stop generating button — shown while SSE stream is active */}
          {isStreamActive && (
            <div className="flex justify-center py-1">
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1A1A2E] border border-[#00F0FF]/20 text-[#9CA3AF] hover:text-[#E8E8F0] hover:border-[#00F0FF]/40 transition-all min-h-[36px]"
              >
                <Square className="w-3 h-3" />
                Stop generating
              </button>
            </div>
          )}

          {/* Suggested prompts (show when only greeting) */}
          {messages.length <= 1 && !isTyping && !premiumSession && !agentOwner && (
            <div className="space-y-2 pt-2">
              <p className="text-xs text-[#6B7280] uppercase tracking-wider">Suggestions</p>
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="block w-full text-left px-4 py-2.5 min-h-[44px] rounded-xl bg-[#06060B] border border-[#00F0FF]/20 text-sm text-[#6B7280] hover:text-[#E8E8F0] hover:border-[#00F0FF]/40 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Phase 106: one-time first-chat capability tip */}
          {!tipDismissed && !agentOwner && messages.length >= 3 && agent.use_case && USE_CASE_TIPS[agent.use_case] && (
            <div className="mx-4 mb-2">
              <div className="rounded-xl border border-[#00F0FF]/20 bg-[#00F0FF]/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#00F0FF]">💡 Try these commands</span>
                  <button
                    onClick={() => {
                      localStorage.setItem(`tip-shown-${user?.id}`, '1');
                      setTipDismissed(true);
                    }}
                    className="text-[#6B7280] hover:text-[#E8E8F0] transition-colors"
                    aria-label="Dismiss tip"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <ul className="space-y-1">
                  {USE_CASE_TIPS[agent.use_case].map((tip) => (
                    <li key={tip} className="text-xs text-[#6B7280]">
                      <button
                        onClick={() => setInput(tip)}
                        className="hover:text-[#E8E8F0] text-left transition-colors"
                      >
                        → {tip}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />

          {/* 41.3 / 57.4: Scroll to bottom button with unread count badge */}
          {showScrollToBottom && (
            <button
              onClick={scrollToBottom}
              className="sticky bottom-4 ml-auto mr-2 flex items-center justify-center w-11 h-11 rounded-full shadow-lg transition-all relative"
              style={{ background: 'rgba(0,240,255,0.15)', border: '1px solid rgba(0,240,255,0.4)', color: '#00F0FF' }}
              aria-label="Scroll to bottom"
            >
              <ArrowDown className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 rounded-full bg-[#00F0FF] text-black text-[9px] font-bold flex items-center justify-center px-0.5 leading-none">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Deploy Dialog Overlay */}
        {showDeployDialog && (
          <div className="absolute inset-0 bg-black/60 z-10 flex items-center justify-center p-6">
            <div className="glass-card-v2 border border-[#00F0FF]/30 rounded-2xl p-5 w-full max-w-sm space-y-4">
              <div className="flex items-center gap-2">
                <Rocket className="w-5 h-5 text-[#F59E0B]" />
                <h3 className="text-sm font-semibold text-[#E8E8F0]">Deploy Specialist</h3>
              </div>
              <textarea
                value={deployTask}
                onChange={(e) => setDeployTask(e.target.value)}
                placeholder="Describe the task for the specialist..."
                className="w-full h-24 px-3 py-2 bg-[#06060B] border border-[#00F0FF]/30 rounded-xl text-sm text-[#E8E8F0] placeholder-[#6B7280]/50 resize-none focus:outline-none focus:border-[#00F0FF]/60"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleDeploy();
                  }
                }}
              />
              <p className="text-[11px] text-[#6B7280]/60">Costs 100 credits to deploy. Uses premium reasoning engine.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowDeployDialog(false); setDeployTask(''); }}
                  className="flex-1 px-4 py-2 rounded-xl border border-[#00F0FF]/20 text-sm text-[#6B7280] hover:text-[#E8E8F0] transition-colors"
                >
                  Cancel
                </button>
                <Button
                  onClick={handleDeploy}
                  disabled={!deployTask.trim() || isDeploying}
                  className="flex-1 bg-[#F59E0B] hover:bg-[#D97706] text-black rounded-xl text-sm font-medium"
                >
                  {isDeploying ? 'Deploying...' : 'Deploy'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Upgrade Prompt Overlay — shown when credits reach zero */}
        {showUpgradePrompt && (
          <div className="absolute inset-0 bg-black/70 z-10 flex items-center justify-center p-6">
            <div className="glass-card-v2 border border-[#00FF88]/30 rounded-2xl p-6 w-full max-w-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#00FF88]/10 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-[#00FF88]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#E8E8F0]">You're out of credits</h3>
                  <p className="text-xs text-[#6B7280]">
                    {planLabel} plan{planPrice !== null ? ` · $${planPrice.toFixed(2)}/mo` : ''}
                  </p>
                </div>
              </div>
              <p className="text-sm text-[#6B7280]">
                {creditsTotal !== null && creditsRemaining !== null
                  ? `You've used ${(creditsTotal - creditsRemaining).toLocaleString()} / ${creditsTotal.toLocaleString()} credits this cycle.`
                  : "Your monthly credits are used up."}
                {' '}Upgrade to keep chatting.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowUpgradePrompt(false)}
                  className="flex-1 px-4 py-2 rounded-xl border border-[#00F0FF]/20 text-sm text-[#6B7280] hover:text-[#E8E8F0] transition-colors"
                >
                  Dismiss
                </button>
                <button
                  onClick={() => { window.location.href = '/dashboard/billing'; }}
                  className="flex-1 px-4 py-2 rounded-xl bg-[#00FF88] hover:bg-[#00D973] text-black text-sm font-semibold transition-colors"
                >
                  Upgrade Plan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 82.7: AI safety footer — dismissable per session */}
        {!safetyDismissed && (
          <div
            className="px-4 py-1.5 flex items-center justify-between gap-2 border-t border-[#00F0FF]/5 bg-[#06060B]/80"
            data-testid="ai-safety-banner"
          >
            <span className="text-[10px] text-[#6B7280]/70">AI can make mistakes — always verify important information.</span>
            <button
              onClick={() => {
                sessionStorage.setItem('ai-disclaimer-dismissed', '1');
                setSafetyDismissed(true);
              }}
              className="text-[#6B7280]/50 hover:text-[#6B7280] flex-shrink-0 transition-colors"
              aria-label="Dismiss AI safety notice"
              data-testid="dismiss-safety-banner"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-[#00F0FF]/20 bg-[#06060B] safe-area-pb">
          {/* 60.6: reply-to context banner */}
          {replyTo && (
            <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg bg-[#00F0FF]/5 border border-[#00F0FF]/20" data-testid="reply-to-banner">
              <span className="text-[10px] text-[#00F0FF] flex-shrink-0">↩ Replying to</span>
              <span className="text-[11px] text-[#9CA3AF] truncate flex-1">{replyTo.content.slice(0, 60)}{replyTo.content.length > 60 ? '…' : ''}</span>
              <button onClick={() => setReplyTo(null)} className="text-[#6B7280] hover:text-[#E8E8F0] text-xs flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Dismiss reply">✕</button>
            </div>
          )}
          <div className="flex items-center gap-2">
            {!premiumSession && !agentOwner && (
              <button
                onClick={() => setShowDeployDialog(true)}
                className="p-2.5 rounded-lg hover:bg-[#F59E0B]/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                title="Deploy Specialist"
              >
                <Rocket className="w-4 h-4 text-[#F59E0B]" />
              </button>
            )}
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={premiumSession ? `Ask ${premiumSession.codename}...` : 'Ask anything...'}
              className="flex-1 bg-[#0C0C18] border-[#00F0FF]/30 text-[#E8E8F0] rounded-xl"
              data-testid="agent-chat-input"
              enterKeyHint="send"
              autoComplete="off"
              autoCorrect="on"
              autoCapitalize="sentences"
            />
            {/* 80.5/80.7: MediaRecorder voice input with state indicator */}
            {mediaRecorderSupported ? (
              <button
                onClick={handleMediaRecord}
                disabled={voiceRecordState === 'uploading' || voiceRecordState === 'transcribing'}
                className={`p-2.5 rounded-lg transition-colors relative min-w-[44px] min-h-[44px] flex items-center justify-center ${
                  voiceRecordState === 'recording'
                    ? 'bg-red-500/20 hover:bg-red-500/30'
                    : voiceRecordState !== 'idle'
                    ? 'bg-[#00F0FF]/10 cursor-wait'
                    : 'hover:bg-[#00F0FF]/10'
                }`}
                title={
                  voiceRecordState === 'recording' ? `Recording… ${recordingDuration}s (click to stop)`
                    : voiceRecordState === 'uploading' ? 'Uploading…'
                    : voiceRecordState === 'transcribing' ? 'Transcribing…'
                    : 'Record voice message'
                }
                data-testid="voice-record-button"
              >
                {voiceRecordState === 'uploading' || voiceRecordState === 'transcribing' ? (
                  <Loader2 className="w-4 h-4 text-[#00F0FF] animate-spin" />
                ) : (
                  <Mic className={`w-4 h-4 ${voiceRecordState === 'recording' ? 'text-red-400 animate-pulse' : 'text-[#6B7280]'}`} />
                )}
                {voiceRecordState === 'recording' && (
                  <span className="absolute -top-1 -right-1 text-[9px] bg-red-500 text-white rounded px-0.5 leading-4 min-w-[14px] text-center">
                    {recordingDuration}
                  </span>
                )}
              </button>
            ) : speechSupported ? (
              <button
                onClick={handleVoiceInput}
                className={`p-2.5 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center ${isListening ? 'bg-[#00F0FF]/20 hover:bg-[#00F0FF]/30' : 'hover:bg-[#00F0FF]/10'}`}
                title={isListening ? 'Stop listening' : 'Voice input'}
              >
                <Mic className={`w-4 h-4 ${isListening ? 'text-[#00F0FF]' : 'text-[#6B7280]'}`} />
              </button>
            ) : null}
            {/* 80.7: Voice error/cap toast */}
            {voiceError && (
              <span className="absolute bottom-16 left-4 right-4 text-xs text-red-400 bg-red-900/40 border border-red-500/30 rounded-lg px-3 py-1.5 text-center">
                {voiceError}
              </span>
            )}
            {/* 81.8: Image cap error toast */}
            {imageCapError && (
              <span className="absolute bottom-20 left-4 right-4 text-xs text-amber-400 bg-amber-900/40 border border-amber-500/30 rounded-lg px-3 py-1.5 text-center">
                {imageCapError}
              </span>
            )}
            <Button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isTyping}
              data-testid="agent-send-button"
              className={`rounded-xl px-3 press-scale ${
                premiumSession
                  ? 'bg-[#F59E0B] hover:bg-[#D97706]'
                  : 'bg-[#00F0FF] hover:bg-[#00D4B0]'
              }`}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-[10px] text-[#6B7280]/50">
              {premiumSession
                ? `${premiumSession.codename} · Premium Engine · ${premiumSession.messagesCount} messages`
                : <>Powered by Agentin &middot; {agent.primaryModel}</>
              }
            </p>
            <div className="flex items-center gap-2">
              {/* Rate limit indicator (33.4, 36.4) */}
              {chatRateLimitRemaining !== null && !premiumSession && !agentOwner && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    chatRateLimitRemaining < 5
                      ? 'text-[#EF4444] bg-[#EF4444]/10'
                      : chatRateLimitRemaining < 10
                      ? 'text-[#F59E0B] bg-[#F59E0B]/10'
                      : 'text-[#6B7280]/50'
                  }`}
                  title={`${chatRateLimitRemaining}/60 requests remaining${chatRateLimitResetAt && chatRateLimitResetAt > Date.now() ? ` · resets in ${Math.ceil((chatRateLimitResetAt - Date.now()) / 60000)}m` : ''}`}
                >
                  {chatRateLimitRemaining}/60 reqs
                </span>
              )}
              {messages.length > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    messages.length > 50
                      ? 'text-[#FF6161] bg-[#FF6161]/10'
                      : messages.length > 20
                      ? 'text-[#F59E0B] bg-[#F59E0B]/10'
                      : 'text-[#6B7280]/50'
                  }`}
                  title={messages.length > 50 ? 'Older messages may be truncated' : messages.length > 20 ? 'Context window filling up' : undefined}
                >
                  {messages.length > 50 ? `Context: ${messages.length} ⚠` : `Context: ${messages.length}`}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
