import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Pin, PinOff, X, Loader2, CheckCircle2, MessageSquare } from 'lucide-react';

const AGENT_META: Record<string, { emoji: string; name: string; color: string }> = {
  weebo: { emoji: '✨', name: 'Weebo', color: '#A78BFA' },
  edith: { emoji: '🔷', name: 'Edith', color: '#8B5CF6' },
  jarvis: { emoji: '🤖', name: 'Jarvis', color: '#ADFF2F' },
  aria: { emoji: '🎨', name: 'Aria', color: '#FF6B9D' },
  forge: { emoji: '⚙️', name: 'Forge', color: '#F59E0B' },
  pulse: { emoji: '📊', name: 'Pulse', color: '#10B981' },
  echo: { emoji: '💬', name: 'Echo', color: '#6366F1' },
  cal: { emoji: '📅', name: 'Cal', color: '#84CC16' },
  nova: { emoji: '🔬', name: 'Nova', color: '#EC4899' },
};

export interface TheaterEvent {
  id: string;
  type: 'delegation' | 'narration' | 'tool_call' | 'tool_result' | 'comm' | 'done';
  fromAgent: string;
  toAgent?: string;
  content: string;
  tool?: string;
  timestamp: string;
  status?: 'active' | 'done' | 'error';
}

interface AgentTheaterPanelProps {
  events: TheaterEvent[];
  isActive: boolean;
  onClose?: () => void;
}

export function AgentTheaterPanel({ events, isActive, onClose }: AgentTheaterPanelProps) {
  const [pinned, setPinned] = useState(false);
  const [visible, setVisible] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (events.length > 0 || isActive) {
      setVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    }
    if (!isActive && !pinned && events.length > 0) {
      hideTimerRef.current = setTimeout(() => setVisible(false), 3000);
    }
    return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  }, [events, isActive, pinned]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [events]);

  if (!visible && events.length === 0) return null;

  const getAgent = (id: string) => AGENT_META[id] || { emoji: '🤖', name: id, color: '#8B5CF6' };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', duration: 0.4, bounce: 0 }}
          className="fixed bottom-24 right-4 z-50 w-72 max-h-80 rounded-2xl border shadow-2xl backdrop-blur-xl overflow-hidden"
          style={{
            background: 'var(--ag-bg-surface, rgba(12,12,24,0.95))',
            borderColor: 'var(--ag-border-subtle, rgba(139,92,246,0.2))',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: 'var(--ag-border-subtle, rgba(139,92,246,0.15))' }}>
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" style={{ color: 'var(--ag-violet, #8B5CF6)' }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--ag-text-primary, #F4F6FF)' }}>Agent Collaboration</span>
              {isActive && <Loader2 className="w-3 h-3 animate-spin" style={{ color: 'var(--ag-violet, #8B5CF6)' }} />}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPinned(!pinned)}
                className="p-1 rounded-lg hover:bg-white/5 transition-colors"
                title={pinned ? 'Unpin' : 'Pin open'}
              >
                {pinned ? <PinOff className="w-3 h-3" style={{ color: 'var(--ag-text-muted)' }} /> : <Pin className="w-3 h-3" style={{ color: 'var(--ag-text-muted)' }} />}
              </button>
              <button onClick={() => { setVisible(false); onClose?.(); }} className="p-1 rounded-lg hover:bg-white/5 transition-colors">
                <X className="w-3 h-3" style={{ color: 'var(--ag-text-muted)' }} />
              </button>
            </div>
          </div>

          {/* Event Timeline */}
          <div ref={scrollRef} className="p-2 space-y-1.5 overflow-y-auto max-h-60 scrollbar-thin">
            {events.map((evt) => {
              const from = getAgent(evt.fromAgent);
              const to = evt.toAgent ? getAgent(evt.toAgent) : null;

              return (
                <motion.div
                  key={evt.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-start gap-1.5 text-xs"
                >
                  {evt.type === 'delegation' && to ? (
                    <div className="flex items-center gap-1 flex-wrap">
                      <span>{from.emoji}</span>
                      <ArrowRight className="w-3 h-3" style={{ color: 'var(--ag-text-muted)' }} />
                      <span>{to.emoji}</span>
                      <span style={{ color: 'var(--ag-text-secondary)' }}>{evt.content}</span>
                    </div>
                  ) : evt.type === 'tool_call' || evt.type === 'tool_result' ? (
                    <div className="flex items-center gap-1">
                      <span>{from.emoji}</span>
                      {evt.status === 'active' ? (
                        <Loader2 className="w-3 h-3 animate-spin" style={{ color: from.color }} />
                      ) : (
                        <CheckCircle2 className="w-3 h-3" style={{ color: 'var(--ag-green, #10B981)' }} />
                      )}
                      <span style={{ color: 'var(--ag-text-secondary)' }}>{evt.content}</span>
                    </div>
                  ) : (
                    <div className="flex items-start gap-1">
                      <span className="shrink-0">{from.emoji}</span>
                      <span style={{ color: 'var(--ag-text-secondary)' }}>{evt.content}</span>
                    </div>
                  )}
                </motion.div>
              );
            })}
            {events.length === 0 && (
              <div className="text-xs text-center py-4" style={{ color: 'var(--ag-text-muted)' }}>Waiting for agent activity...</div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
