import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Sparkles, Mic, RotateCcw, Zap, Rocket, Square, Search, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDashboardStore } from '@/stores/dashboardStore';
import { agentService, premiumAgentService, publicAgentService, memoryService } from '@/services/api';
import type { AgentPersonality, PremiumSession } from '@/types';
import { CodePreviewCard } from './CodePreviewCard';
import { ActionResultCard } from './ActionResultCard';
import { MessageReactions } from './MessageReactions';
import { useMobileDetect } from '@/hooks/useMobileDetect';

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

const personalityMeta: Record<AgentPersonality, { emoji: string; name: string; greeting: string }> = {
  edith: { emoji: '🔷', name: 'Edith', greeting: "What do you need? I'm ready." },
  jarvis: { emoji: '🟣', name: 'Jarvis', greeting: "Good day. How may I assist you?" },
  weebo: { emoji: '💚', name: 'Weebo', greeting: "Hiii! What are we working on today?!" },
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
}

interface AgentChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** Optional: agent belongs to another user (portfolio chat mode) */
  agentOwner?: string;
}

const suggestedPrompts = [
  "What's on my schedule today?",
  "Show me my usage stats",
  "Create a reminder for tomorrow",
  "Help me with a code review",
];

export function AgentChatPanel({ isOpen, onClose, agentOwner }: AgentChatPanelProps) {
  const agent = useDashboardStore((s) => s.agent);
  const isMobile = useMobileDetect();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isListening, setIsListening] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const speechSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // Swipe-down-to-close on mobile header
  const [touchStartY, setTouchStartY] = useState(0);
  const handleHeaderTouchStart = (e: React.TouchEvent) => setTouchStartY(e.touches[0].clientY);
  const handleHeaderTouchEnd = (e: React.TouchEvent) => {
    const diff = e.changedTouches[0].clientY - touchStartY;
    if (diff > 100) onClose(); // swipe down 100px+ to close
  };

  // Credits remaining from last successful regular chat
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Premium session state
  const [premiumSession, setPremiumSession] = useState<PremiumSession | null>(null);
  const [showDeployDialog, setShowDeployDialog] = useState(false);
  const [deployTask, setDeployTask] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);

  const pMeta = personalityMeta[(agent.personality as AgentPersonality) || 'jarvis'] || personalityMeta.jarvis;

  // Initialize with greeting
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: 'greeting',
          role: 'agent',
          content: pMeta.greeting,
          timestamp: new Date(),
        },
      ]);
    }
  }, [isOpen, messages.length, pMeta.greeting]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

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
    const content = text || input.trim();
    if (!content || isTyping) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    const agentMsgId = (Date.now() + 1).toString();

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

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
        setCreditsRemaining((data as unknown as Record<string, unknown>).creditsRemaining as number);
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
        // Attempt SSE streaming
        const res = await agentService.chatStream(content);

        if (!res.ok || !res.body) {
          // Stream not available — use regular chat
          await doRegularChat();
          return;
        }

        // Add empty streaming message
        setAgentMsg({ content: '', isStreaming: true });
        setIsTyping(false);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accumulated = '';
        let gotError = false;

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

              if (chunk.text) {
                accumulated += chunk.text;
                setAgentMsg({ content: accumulated });
              }

              if (chunk.done) {
                setAgentMsg({ isStreaming: false, provider: chunk.provider, model: chunk.model });
              }
            } catch {
              // skip malformed chunks
            }
          }
        }

        // Streaming ended — check if we actually got content
        if (!accumulated || gotError) {
          // Stream was empty or errored — fall back to regular chat
          setIsTyping(true);
          await doRegularChat();
          return;
        }

        // Ensure streaming flag is cleared
        setAgentMsg({ isStreaming: false });
      } catch {
        // Full fallback — try regular chat
        try {
          setIsTyping(true);
          await doRegularChat();
        } catch {
          setAgentMsg({
            content: "Sorry, I couldn't process that right now. Please try again.",
            isStreaming: false,
            retryContent: content,
          });
        }
      } finally {
        setIsTyping(false);
      }
    })();
  }, [input, isTyping, premiumSession, agentOwner, messages]);

  // ---- 8.3: Export conversations ----
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (showDeployDialog) {
        handleDeploy();
      } else {
        sendMessage();
      }
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
                <div className="text-xs text-[#00FF88] flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Online
                  {creditsRemaining !== null && (
                    <span className="ml-1 text-[#6B7280]">· ⚡ {creditsRemaining} credits</span>
                  )}
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
                className="p-2 rounded-lg hover:bg-[#00F0FF]/10 transition-colors"
                title="Reset chat"
              >
                <RotateCcw className="w-4 h-4 text-[#6B7280]" />
              </button>
            )}
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="p-2 rounded-lg hover:bg-[#00F0FF]/10 transition-colors"
              title="Export conversations"
            >
              <Download className={`w-4 h-4 ${isExporting ? 'text-[#00F0FF] animate-pulse' : 'text-[#6B7280]'}`} />
            </button>
            <button
              onClick={() => { setSearchOpen(v => !v); setSearchTerm(''); }}
              className={`p-2 rounded-lg transition-colors ${searchOpen ? 'bg-[#00F0FF]/20 text-[#00F0FF]' : 'hover:bg-[#00F0FF]/10 text-[#6B7280]'}`}
              title="Search messages"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-[#00F0FF]/10 transition-colors"
            >
              <X className="w-5 h-5 text-[#6B7280]" />
            </button>
          </div>
        </div>

        {/* Search bar */}
        {searchOpen && (
          <div className="px-4 py-2 border-b border-[#00F0FF]/10 bg-[#06060B]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6B7280]" />
              <input
                autoFocus
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search messages…"
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#0A0A12] border border-[#00F0FF]/20 text-sm text-[#E8E8F0] placeholder-[#6B7280] focus:outline-none focus:border-[#00F0FF]/50"
              />
              {searchTerm && (
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[#6B7280]">
                  {messages.filter(m => m.content.toLowerCase().includes(searchTerm.toLowerCase())).length} results
                </span>
              )}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {(searchOpen && searchTerm
            ? messages.filter(m => m.content.toLowerCase().includes(searchTerm.toLowerCase()))
            : messages
          ).map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : msg.role === 'system' ? 'justify-center' : 'justify-start'}`}
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
                    {msg.content}
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
                    {/* Message Reactions for agent messages */}
                    {msg.role === 'agent' && !msg.isStreaming && (
                      <MessageReactions
                        messageId={msg.id}
                        onReact={(id, reaction) => {
                          memoryService.addReaction(id, reaction).catch(() => {});
                        }}
                        onCopy={(_id) => {}}
                      />
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

          <div ref={messagesEndRef} />
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

        {/* Input */}
        <div className="p-4 border-t border-[#00F0FF]/20 bg-[#06060B] safe-area-pb">
          <div className="flex items-center gap-2">
            {!premiumSession && !agentOwner && (
              <button
                onClick={() => setShowDeployDialog(true)}
                className="p-2 rounded-lg hover:bg-[#F59E0B]/10 transition-colors"
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
            />
            {speechSupported && (
              <button
                onClick={handleVoiceInput}
                className={`p-2 rounded-lg transition-colors ${isListening ? 'bg-[#00F0FF]/20 hover:bg-[#00F0FF]/30' : 'hover:bg-[#00F0FF]/10'}`}
                title={isListening ? 'Stop listening' : 'Voice input'}
              >
                <Mic className={`w-4 h-4 ${isListening ? 'text-[#00F0FF]' : 'text-[#6B7280]'}`} />
              </button>
            )}
            <Button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isTyping}
              className={`rounded-xl px-3 press-scale ${
                premiumSession
                  ? 'bg-[#F59E0B] hover:bg-[#D97706]'
                  : 'bg-[#00F0FF] hover:bg-[#00D4B0]'
              }`}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-[#6B7280]/50 text-center mt-2">
            {premiumSession
              ? `${premiumSession.codename} · Premium Engine · ${premiumSession.messagesCount} messages`
              : <>Powered by Agentin &middot; {agent.primaryModel}</>
            }
          </p>
        </div>
      </div>
    </>
  );
}
