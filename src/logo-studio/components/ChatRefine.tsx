import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';

interface VisualConcept {
  name: string;
  url: string;
  prompt?: string;
}

interface ChatMessage {
  role: 'user' | 'ai';
  text?: string;
  concepts?: VisualConcept[];
  error?: string;
}

interface ChatRefineProps {
  currentConcept: { name: string; url: string; prompt?: string } | null;
  companyName: string;
  style: string;
  onSelectConcept: (concept: { name: string; url: string; prompt?: string }) => void;
  onClose: () => void;
}

const QUICK_CHIPS = [
  'Make it bolder',
  'More minimal',
  'Try gold tones',
  'Add a desi touch',
  'Darker background',
  'More playful',
  'Make it premium',
  'Try emerald green',
  'More geometric',
  'Simplify it',
] as const;

function JarvisAvatar({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="14" fill="#ADFF2F" />
      <text x="14" y="18" textAnchor="middle" fill="#1a1a2e" fontSize="14" fontWeight="bold" fontFamily="system-ui">J</text>
    </svg>
  );
}

const SvgSend = <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-7-7l7 7-7 7" /></svg>;
const SvgClose = <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;

function LoadingDots() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      <span className="text-xs text-white/40 mr-1">Jarvis is creating</span>
      {[0, 1, 2].map((i) => (
        <span key={i} className="w-2 h-2 rounded-full bg-violet-400/60"
          style={{ animation: 'chatDotPulse 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
      ))}
    </div>
  );
}

const WELCOME_MESSAGE: ChatMessage = {
  role: 'ai',
  text: "I'm Jarvis, your creative assistant. Select a concept above, then tell me how you'd like to refine it.",
};

export function ChatRefine({
  currentConcept,
  companyName,
  style,
  onSelectConcept,
  onClose,
}: ChatRefineProps) {
  const token = useAuthStore((s) => s.token);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState(currentConcept?.prompt || '');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync prompt when currentConcept changes externally
  useEffect(() => {
    if (currentConcept?.prompt) {
      setCurrentPrompt(currentConcept.prompt);
    }
  }, [currentConcept?.prompt]);

  // Auto-scroll to bottom on new messages or loading change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      setInput('');
      setMessages((prev) => [...prev, { role: 'user', text: trimmed }]);
      setLoading(true);

      try {
        const res = await fetch('/api/logo/ai-refine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({
            instruction: trimmed,
            currentPrompt,
            companyName,
            style,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: 'Request failed' }));
          throw new Error(data.error || `HTTP ${res.status}`);
        }

        const data = await res.json();
        const concepts: VisualConcept[] = (data.concepts || []).slice(0, 4).map(
          (c: VisualConcept, i: number) => ({
            ...c,
            name: c.name || `Refinement ${i + 1}`,
          }),
        );

        if (data.modifiedPrompt) {
          setCurrentPrompt(data.modifiedPrompt);
        }

        if (concepts.length === 0) {
          setMessages((prev) => [
            ...prev,
            { role: 'ai', error: 'No results generated -- try rephrasing your instruction.' },
          ]);
        } else {
          setMessages((prev) => [...prev, { role: 'ai', concepts }]);
        }
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          { role: 'ai', error: err.message || 'Something went wrong. Please try again.' },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, currentPrompt, companyName, style],
  );

  const handleSubmit = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      sendMessage(input);
    }, 150);
  }, [input, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !loading) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit, loading],
  );

  const handleChipClick = useCallback(
    (chip: string) => {
      if (loading) return;
      setInput(chip);
      sendMessage(chip);
    },
    [loading, sendMessage],
  );

  const handleConceptSelect = useCallback(
    (concept: VisualConcept) => {
      onSelectConcept(concept);
      if (concept.prompt) {
        setCurrentPrompt(concept.prompt);
      }
    },
    [onSelectConcept],
  );

  const allMessages = [WELCOME_MESSAGE, ...messages];

  return (
    <>
      {/* Keyframe animation for loading dots */}
      <style>{`
        @keyframes chatDotPulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
        @keyframes chatFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .chat-msg-enter { animation: chatFadeIn 0.25s ease-out; }
      `}</style>

      <div className="flex flex-col rounded-2xl border border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)] overflow-hidden
        w-full md:w-[380px] md:max-h-[calc(100vh-100px)]
        max-h-[70vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--ag-border-subtle)] shrink-0">
          <div className="flex items-center gap-2.5">
            <JarvisAvatar size={28} />
            <div className="flex flex-col">
              <h3 className="text-sm font-medium text-white/80 leading-tight">
                Chat with Jarvis
              </h3>
              <span className="text-[10px] text-white/30 leading-tight">
                Creative AI Agent
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] transition-colors cursor-pointer"
            aria-label="Close refinement panel"
          >
            <span className="w-7 h-7 rounded-full bg-[var(--ag-bg-surface)] flex items-center justify-center hover:bg-[var(--ag-bg-surface-hover)]">
              {SvgClose}
            </span>
          </button>
        </div>

        {/* Current concept preview */}
        {currentConcept && (
          <div className="px-4 pt-3 pb-2 border-b border-[var(--ag-border-subtle)] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-[var(--ag-bg-base)] shrink-0">
                <img
                  src={currentConcept.url}
                  alt={currentConcept.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-white/60 truncate">{currentConcept.name}</p>
                <p className="text-[10px] text-white/25 mt-0.5">Currently editing</p>
              </div>
            </div>
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ scrollbarWidth: 'thin' }}>
          {!currentConcept && messages.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <JarvisAvatar size={36} />
              <p className="text-xs text-white/30 text-center">
                Select a logo concept first, then I can help refine it
              </p>
            </div>
          ) : (
            allMessages.map((msg, i) => (
              <div key={i} className="chat-msg-enter">
                {msg.role === 'user' ? (
                  <div className="flex justify-end">
                    <div className="max-w-[80%] px-3 py-2 rounded-2xl rounded-br-md bg-violet-600/80 text-sm text-white/90">
                      {msg.text}
                    </div>
                  </div>
                ) : msg.error ? (
                  <div className="flex items-start gap-2 justify-start">
                    <div className="shrink-0 mt-0.5"><JarvisAvatar size={20} /></div>
                    <div className="max-w-[80%] px-3 py-2 rounded-2xl rounded-bl-md bg-red-500/[0.08] border border-red-500/20 text-xs text-red-400/80">
                      {msg.error}
                    </div>
                  </div>
                ) : msg.text ? (
                  <div className="flex items-start gap-2 justify-start">
                    <div className="shrink-0 mt-0.5"><JarvisAvatar size={20} /></div>
                    <div className="max-w-[80%] px-3 py-2 rounded-2xl rounded-bl-md bg-[var(--ag-bg-surface)] border border-[var(--ag-border-subtle)] text-sm text-[var(--ag-text-secondary)]">
                      {msg.text}
                    </div>
                  </div>
                ) : msg.concepts ? (
                  <div className="flex items-start gap-2 justify-start">
                    <div className="shrink-0 mt-0.5"><JarvisAvatar size={20} /></div>
                    <div className="max-w-[80%]">
                      <div className="grid grid-cols-2 gap-1.5">
                        {msg.concepts.map((c, j) => (
                          <button
                            key={j}
                            onClick={() => handleConceptSelect(c)}
                            className="relative min-h-[44px] aspect-square rounded-lg overflow-hidden bg-[var(--ag-bg-base)] border border-[var(--ag-border-subtle)] hover:border-violet-500/50 transition-colors cursor-pointer group"
                            aria-label={`Select ${c.name}`}
                          >
                            <img
                              src={c.url}
                              alt={c.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <span className="absolute bottom-1 left-1 right-1 text-[9px] text-white/70 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                              {c.name}
                            </span>
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-white/20 mt-1.5 pl-0.5">
                        Tap a result to use it
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            ))
          )}

          {loading && (
            <div className="flex items-start gap-2 justify-start chat-msg-enter">
              <div className="shrink-0 mt-0.5"><JarvisAvatar size={20} /></div>
              <div className="rounded-2xl rounded-bl-md bg-white/[0.03] border border-white/[0.06]">
                <LoadingDots />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick action chips */}
        <div className="px-4 pt-2 pb-1 shrink-0">
          <div
            className="flex gap-1.5 overflow-x-auto pb-1"
            style={{ scrollbarWidth: 'none' }}
          >
            {QUICK_CHIPS.map((chip) => (
              <button
                key={chip}
                onClick={() => handleChipClick(chip)}
                disabled={loading}
                className="min-h-[44px] px-2.5 py-1 rounded-full text-[11px] whitespace-nowrap shrink-0 transition-colors cursor-pointer
                  bg-[var(--ag-bg-surface)] border border-[var(--ag-border-subtle)] text-[var(--ag-text-secondary)]
                  hover:bg-violet-600/80 hover:text-white hover:border-violet-500/40
                  disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        {/* Input area */}
        <div className="px-4 pb-3 pt-1 shrink-0">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. make it bolder, try warm tones..."
              disabled={loading}
              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-violet-500/40 transition-colors disabled:opacity-40"
            />
            <button
              onClick={handleSubmit}
              disabled={loading || !input.trim()}
              className="min-w-[44px] min-h-[44px] rounded-lg bg-violet-600/80 hover:bg-violet-600 flex items-center justify-center text-white transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
              aria-label="Send message"
            >
              {SvgSend}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
