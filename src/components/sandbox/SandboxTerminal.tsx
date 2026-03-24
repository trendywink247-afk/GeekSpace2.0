// ============================================================
// SandboxTerminal — Real-time terminal UI for code sandboxes
//
// Connects to the sandbox SSE stream for live stdout/stderr,
// sends commands via REST, and provides command history with
// arrow-key navigation. Auto-scrolls unless the user scrolls up.
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';

// -- Types -------------------------------------------------------------------

interface OutputLine {
  id: number;
  type: 'stdout' | 'stderr' | 'system';
  text: string;
  timestamp: number;
}

interface SandboxStatus {
  state: 'creating' | 'active' | 'idle' | 'error' | 'destroyed';
  memoryMb: number;
  tier: string;
}

interface SandboxTerminalProps {
  sandboxId: string;
  /** Called when the sandbox reports a status change */
  onStatusChange?: (status: SandboxStatus) => void;
}

// -- Helpers -----------------------------------------------------------------

const API_URL = import.meta.env.VITE_API_URL
  || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');

function getToken(): string | null {
  return localStorage.getItem('gs_token')
    || localStorage.getItem('token')
    || sessionStorage.getItem('token');
}

const STATUS_COLORS: Record<SandboxStatus['state'], string> = {
  creating: 'text-yellow-400',
  active:   'text-agentin-lime',
  idle:     'text-zinc-400',
  error:    'text-red-400',
  destroyed:'text-zinc-600',
};

// -- Component ---------------------------------------------------------------

let lineIdCounter = 0;

export function SandboxTerminal({ sandboxId, onStatusChange }: SandboxTerminalProps) {
  const [lines, setLines] = useState<OutputLine[]>([]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [status, setStatus] = useState<SandboxStatus>({
    state: 'creating', memoryMb: 0, tier: '',
  });
  const [pinned, setPinned] = useState(true);

  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const esRef = useRef<EventSource | null>(null);

  // -- Append helper ---------------------------------------------------------

  const append = useCallback((type: OutputLine['type'], text: string) => {
    setLines(prev => {
      const next = [...prev, { id: ++lineIdCounter, type, text, timestamp: Date.now() }];
      return next.length > 2000 ? next.slice(-1500) : next;
    });
  }, []);

  // -- SSE connection --------------------------------------------------------

  useEffect(() => {
    const token = getToken();
    if (!token || !sandboxId) return;

    const url = `${API_URL}/sandbox/stream/${sandboxId}?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    esRef.current = es;

    append('system', `Connecting to sandbox ${sandboxId}...`);

    es.addEventListener('stdout', (e: MessageEvent) => append('stdout', e.data));
    es.addEventListener('stderr', (e: MessageEvent) => append('stderr', e.data));

    es.addEventListener('status', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as SandboxStatus;
        setStatus(data);
        onStatusChange?.(data);
        append('system', `Sandbox ${data.state} | ${data.memoryMb}MB | ${data.tier}`);
      } catch { /* ignore malformed status */ }
    });

    es.addEventListener('system', (e: MessageEvent) => append('system', e.data));

    es.onerror = () => {
      append('system', 'Connection lost. Retrying...');
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [sandboxId, append, onStatusChange]);

  // -- Auto-scroll -----------------------------------------------------------

  useEffect(() => {
    if (pinned && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [lines, pinned]);

  const handleScroll = useCallback(() => {
    const el = outputRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setPinned(atBottom);
  }, []);

  // -- Execute command -------------------------------------------------------

  const exec = useCallback(async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    setHistory(prev => [...prev.filter(h => h !== trimmed), trimmed]);
    setHistoryIdx(-1);
    append('stdout', `$ ${trimmed}`);
    setInput('');

    const token = getToken();
    if (!token) { append('stderr', 'No auth token'); return; }

    try {
      const res = await fetch(`${API_URL}/sandbox/${sandboxId}/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ command: trimmed }),
      });
      if (!res.ok) {
        const body = await res.text();
        append('stderr', `Error ${res.status}: ${body}`);
      }
    } catch (err) {
      append('stderr', `Network error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [sandboxId, append]);

  // -- Key handling ----------------------------------------------------------

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      exec(input);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const next = historyIdx < history.length - 1 ? historyIdx + 1 : historyIdx;
      setHistoryIdx(next);
      setInput(history[history.length - 1 - next]);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx <= 0) { setHistoryIdx(-1); setInput(''); return; }
      const next = historyIdx - 1;
      setHistoryIdx(next);
      setInput(history[history.length - 1 - next]);
    }
  }, [input, history, historyIdx, exec]);

  // -- Render ----------------------------------------------------------------

  return (
    <div className="flex flex-col h-full rounded-lg border border-border bg-agentin-black dark:bg-agentin-black overflow-hidden font-mono text-sm">
      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-agentin-surface border-b border-border text-xs select-none">
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full ${status.state === 'active' ? 'bg-agentin-lime' : status.state === 'error' ? 'bg-red-500' : 'bg-yellow-400'}`} />
          <span className={STATUS_COLORS[status.state]}>
            {status.state}
          </span>
          {status.tier && (
            <span className="text-zinc-500">({status.tier})</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-zinc-500">
          {status.memoryMb > 0 && (
            <span>{status.memoryMb}MB</span>
          )}
          {!pinned && (
            <button
              onClick={() => { setPinned(true); outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight, behavior: 'smooth' }); }}
              className="text-agentin-cyan hover:underline"
            >
              Scroll to bottom
            </button>
          )}
        </div>
      </div>

      {/* Output area */}
      <div
        ref={outputRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-2 min-h-0"
      >
        {lines.map(line => (
          <div
            key={line.id}
            className={`whitespace-pre-wrap break-all leading-5 ${
              line.type === 'stderr' ? 'text-red-400'
                : line.type === 'system' ? 'text-zinc-500 italic'
                  : 'text-zinc-100'
            }`}
          >
            {line.text}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-border bg-agentin-surface">
        <span className="text-agentin-lime select-none">$</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => { setInput(e.target.value); setHistoryIdx(-1); }}
          onKeyDown={handleKeyDown}
          placeholder="Enter command..."
          className="flex-1 bg-transparent text-zinc-100 placeholder:text-zinc-600 outline-none caret-agentin-cyan"
          autoFocus
          spellCheck={false}
          autoComplete="off"
        />
      </div>
    </div>
  );
}
