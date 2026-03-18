import { useState, useEffect, useRef, useCallback } from 'react';

// ── Types ──

export interface MentionAgent {
  id: string;
  name: string;
  emoji: string;
  description: string;
  isCore: boolean;
}

interface AgentMentionPopupProps {
  query: string;
  onSelect: (agent: MentionAgent) => void;
  onClose: () => void;
  visible: boolean;
}

// ── Agent List ──

export const MENTION_AGENTS: MentionAgent[] = [
  { id: 'weebo', name: 'Weebo', emoji: '\u2728', description: 'Creative & playful', isCore: true },
  { id: 'edith', name: 'Edith', emoji: '\uD83D\uDD37', description: 'CTO energy', isCore: true },
  { id: 'jarvis', name: 'Jarvis', emoji: '\uD83E\uDD16', description: 'Warm butler', isCore: true },
  { id: 'aria', name: 'Aria', emoji: '\uD83C\uDFA8', description: 'Creative director', isCore: false },
  { id: 'forge', name: 'Forge', emoji: '\u2699\uFE0F', description: 'Builder', isCore: false },
  { id: 'pulse', name: 'Pulse', emoji: '\uD83D\uDCCA', description: 'Data analyst', isCore: false },
  { id: 'echo', name: 'Echo', emoji: '\uD83D\uDCAC', description: 'Coach', isCore: false },
  { id: 'cal', name: 'Cal', emoji: '\uD83D\uDCC5', description: 'Organizer', isCore: false },
  { id: 'nova', name: 'Nova', emoji: '\uD83D\uDE80', description: 'Explorer', isCore: false },
];

// ── Component ──

export function AgentMentionPopup({ query, onSelect, onClose, visible }: AgentMentionPopupProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter agents by query (case-insensitive prefix match)
  const filtered = MENTION_AGENTS.filter((a) =>
    a.name.toLowerCase().startsWith(query.toLowerCase()),
  );

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-mention-item]');
    const target = items[selectedIndex] as HTMLElement | undefined;
    target?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Keyboard handler — attached to window so it works even when textarea is focused
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!visible || filtered.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        onSelect(filtered[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [visible, filtered, selectedIndex, onSelect, onClose],
  );

  useEffect(() => {
    if (!visible) return;
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [visible, handleKeyDown]);

  if (!visible || filtered.length === 0) return null;

  return (
    <div
      className="absolute bottom-full left-0 mb-1 w-64 max-h-56 overflow-y-auto rounded-lg bg-[#0C0C18] border border-[#00F0FF]/10 shadow-xl shadow-black/40 z-50 scrollbar-hide"
      role="listbox"
      aria-label="Mention an agent"
    >
      <div className="px-2.5 py-1.5 border-b border-[#00F0FF]/5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#4B5563]">
          Mention an agent
        </span>
      </div>
      <div ref={listRef} className="py-1">
        {filtered.map((agent, i) => (
          <button
            key={agent.id}
            data-mention-item
            role="option"
            aria-selected={i === selectedIndex}
            onClick={() => onSelect(agent)}
            onMouseEnter={() => setSelectedIndex(i)}
            className={[
              'flex items-center gap-2.5 w-full px-2.5 py-2 text-left transition-colors text-sm',
              i === selectedIndex
                ? 'bg-[#00F0FF]/10 text-[#E8E8F0]'
                : 'text-[#9CA3AF] hover:bg-[#00F0FF]/5 hover:text-[#E8E8F0]',
            ].join(' ')}
          >
            <span className="text-base leading-none shrink-0">{agent.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-xs">{agent.name}</span>
                {agent.isCore && (
                  <span className="px-1 py-px rounded text-[8px] font-semibold uppercase tracking-wider bg-[#00F0FF]/10 text-[#00F0FF]/70">
                    core
                  </span>
                )}
              </div>
              <p className="text-[10px] text-[#4B5563] truncate">{agent.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
