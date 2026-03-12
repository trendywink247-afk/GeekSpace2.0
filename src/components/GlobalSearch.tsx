// ============================================================
// GlobalSearch — live data search modal (notes, reminders, habits, memories)
// Invoked from CommandPalette when user clicks the "Search Data" tab
// ============================================================

import { useState, useEffect, useRef } from 'react';
import { Search, FileText, Bell, Target, Brain } from 'lucide-react';

export interface SearchResult {
  id: string;
  type: 'note' | 'reminder' | 'habit' | 'memory' | string;
  title: string;
  snippet: string;
  created_at?: string;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  note:     <FileText className="w-4 h-4 text-[#00F0FF]" />,
  reminder: <Bell     className="w-4 h-4 text-[#FFB800]" />,
  habit:    <Target   className="w-4 h-4 text-[#00FF88]" />,
  memory:   <Brain    className="w-4 h-4 text-[#BF5FFF]" />,
};

const TYPE_LABELS: Record<string, string> = {
  note:     'Note',
  reminder: 'Reminder',
  habit:    'Habit',
  memory:   'Memory',
};

interface GlobalSearchProps {
  onClose: () => void;
}

export function GlobalSearch({ onClose }: GlobalSearchProps) {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef              = useRef<HTMLInputElement>(null);

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
        const res   = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, {
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
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
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
            {results.map(r => (
              <div
                key={`${r.type}-${r.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[#1A1A2E] cursor-pointer transition-colors"
              >
                <div className="flex-shrink-0">
                  {TYPE_ICONS[r.type] ?? <Search className="w-4 h-4 text-[#6B7280]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#E8E8F0] truncate font-medium">{r.title}</p>
                  {r.snippet && r.snippet !== r.title && (
                    <p className="text-xs text-[#6B7280] truncate mt-0.5">
                      {r.snippet.slice(0, 80)}
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
          <p className="text-xs text-[#4B5563] text-center py-4">
            Type 2+ characters to search across all your data
          </p>
        )}
      </div>
    </div>
  );
}
