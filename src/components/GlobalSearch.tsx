// ============================================================
// GlobalSearch — live data search modal (notes, reminders, habits, memories, conversations)
// Invoked from CommandPalette when user clicks the "Search Data" tab
// ============================================================

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, Bell, Target, Brain, MessageSquare } from 'lucide-react';

export interface SearchResult {
  id: string;
  type: 'note' | 'reminder' | 'habit' | 'memory' | 'conversation' | string;
  title: string;
  snippet: string;
  url?: string;
  created_at?: string;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  note:         <FileText      className="w-4 h-4 text-[#00F0FF]" />,
  reminder:     <Bell          className="w-4 h-4 text-[#FFB800]" />,
  habit:        <Target        className="w-4 h-4 text-[#00FF88]" />,
  memory:       <Brain         className="w-4 h-4 text-[#BF5FFF]" />,
  conversation: <MessageSquare className="w-4 h-4 text-[#8B5CF6]" />,
};

const TYPE_LABELS: Record<string, string> = {
  note:         'Note',
  reminder:     'Reminder',
  habit:        'Habit',
  memory:       'Memory',
  conversation: 'Conversation',
};

interface GlobalSearchProps {
  onClose: () => void;
}

export function GlobalSearch({ onClose }: GlobalSearchProps) {
  const navigate = useNavigate();
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef              = useRef<HTMLInputElement>(null);
  const itemRefs              = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('gs_token') ?? '';
        const res   = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}&limit=25`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { results: SearchResult[] };
        setResults(data.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = (result: SearchResult) => {
    if (result.url) {
      navigate(result.url);
    } else {
      const urlMap: Record<string, string> = {
        note:         '/dashboard/chat',
        reminder:     '/dashboard/reminders',
        habit:        '/dashboard/focus',
        memory:       '/dashboard/personal-memory',
        conversation: '/dashboard/chat',
      };
      navigate(urlMap[result.type] || '/dashboard');
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.length === 0) return;
      const next = (selectedIndex + 1) % results.length;
      setSelectedIndex(next);
      itemRefs.current[next]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length === 0) return;
      const prev = (selectedIndex - 1 + results.length) % results.length;
      setSelectedIndex(prev);
      itemRefs.current[prev]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg mx-4 bg-[#0D0D1A] border border-[#00F0FF]/30 rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#00F0FF]/10">
          <Search className="w-5 h-5 text-[#6B7280] flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search notes, reminders, habits, memories..."
            className="flex-1 bg-transparent text-[#E8E8F0] placeholder:text-[#4B5563] outline-none text-sm"
          />
          <kbd className="hidden sm:block text-xs text-[#4B5563] border border-[#2A2A3A] px-1.5 py-0.5 rounded">
            ESC
          </kbd>
        </div>

        {/* Spinner */}
        {loading && (
          <div className="flex justify-center py-5">
            <div className="w-5 h-5 border-2 border-[#00F0FF] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Results */}
        {!loading && results.length > 0 && (
          <div className="max-h-80 overflow-y-auto divide-y divide-[#1A1A2E]">
            {results.map((r, idx) => (
              <div
                key={`${r.type}-${r.id}`}
                ref={el => { itemRefs.current[idx] = el; }}
                onClick={() => handleSelect(r)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                  idx === selectedIndex
                    ? 'bg-[#00F0FF]/10 border-l-2 border-[#00F0FF]'
                    : 'hover:bg-[#1A1A2E] border-l-2 border-transparent'
                }`}
              >
                <div className="flex-shrink-0">
                  {TYPE_ICONS[r.type] ?? <Search className="w-4 h-4 text-[#6B7280]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#E8E8F0] truncate font-medium">{r.title}</p>
                  {r.snippet && r.snippet !== r.title && (
                    <p className="text-xs text-[#6B7280] truncate mt-0.5">
                      {r.snippet.slice(0, 100)}
                    </p>
                  )}
                </div>
                <span className="text-[10px] text-[#4B5563] uppercase tracking-wide flex-shrink-0">
                  {TYPE_LABELS[r.type] ?? r.type}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && query.trim().length >= 2 && results.length === 0 && (
          <p className="text-sm text-[#4B5563] text-center py-6">
            No results for &ldquo;{query}&rdquo;
          </p>
        )}

        {/* Hint before typing */}
        {!loading && query.trim().length < 2 && (
          <div className="py-4 px-4 text-center">
            <p className="text-xs text-[#4B5563] mb-3">
              Type 2+ characters to search across all your data
            </p>
            <div className="flex justify-center gap-4 text-xs text-[#4B5563]">
              <span className="flex items-center gap-1"><FileText className="w-3 h-3 text-[#00F0FF]" /> Notes</span>
              <span className="flex items-center gap-1"><Bell className="w-3 h-3 text-[#FFB800]" /> Reminders</span>
              <span className="flex items-center gap-1"><Target className="w-3 h-3 text-[#00FF88]" /> Habits</span>
              <span className="flex items-center gap-1"><Brain className="w-3 h-3 text-[#BF5FFF]" /> Memories</span>
              <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3 text-[#8B5CF6]" /> Chats</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#1A1A2E] text-xs text-[#4B5563]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-[#06060B] border border-[#1A1A2E] rounded text-[10px]">&uarr;&darr;</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-[#06060B] border border-[#1A1A2E] rounded text-[10px]">&crarr;</kbd>
              open
            </span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-[#06060B] border border-[#1A1A2E] rounded text-[10px]">ESC</kbd>
            close
          </div>
        </div>
      </div>
    </div>
  );
}
