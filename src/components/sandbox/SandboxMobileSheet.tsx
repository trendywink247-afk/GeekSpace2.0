import { useEffect, useRef, useState } from 'react';
import { Terminal, ChevronUp } from 'lucide-react';
import { useMobileDetect } from '@/hooks/useMobileDetect';

const SNAP = { collapsed: 12, half: 50, full: 92 } as const;
type SheetState = keyof typeof SNAP;
const SNAP_VALS = Object.values(SNAP) as number[];

interface SandboxMobileSheetProps {
  /** Terminal output lines */
  output: string[];
  /** Controlled input value */
  inputValue: string;
  onInputChange: (val: string) => void;
  /** Called with the trimmed command string on submit */
  onSubmit: (cmd: string) => void;
  /** Short status shown in the collapsed bar e.g. "Ready" / "Running…" */
  status?: string;
  defaultState?: SheetState;
}

export function SandboxMobileSheet({
  output,
  inputValue,
  onInputChange,
  onSubmit,
  status = 'Ready',
  defaultState = 'half',
}: SandboxMobileSheetProps) {
  const isMobile = useMobileDetect();
  const [state, setState] = useState<SheetState>(defaultState);
  const [heightPct, setHeightPct] = useState<number>(SNAP[defaultState]);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);
  const startH = useRef(0);
  const outputRef = useRef<HTMLDivElement>(null);

  // Auto-scroll output to bottom
  useEffect(() => {
    if (outputRef.current)
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [output, heightPct]);

  // Keep heightPct in sync when state is set directly
  useEffect(() => { setHeightPct(SNAP[state]); }, [state]);

  const snapTo = (pct: number) => {
    const nearest = SNAP_VALS.reduce((p, c) =>
      Math.abs(c - pct) < Math.abs(p - pct) ? c : p
    );
    const entry = Object.entries(SNAP).find(([, v]) => v === nearest);
    if (entry) setState(entry[0] as SheetState);
    setHeightPct(nearest);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    setDragging(true);
    startY.current = e.touches[0].clientY;
    startH.current = heightPct;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging) return;
    const diff = startY.current - e.touches[0].clientY;
    setHeightPct(Math.max(SNAP.collapsed - 2, Math.min(SNAP.full + 2,
      startH.current + (diff / window.innerHeight) * 100)));
  };
  const onTouchEnd = () => { setDragging(false); snapTo(heightPct); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    if (state === 'collapsed') setState('half');
  };

  const cycleExpand = () => {
    if (state === 'collapsed') setState('half');
    else if (state === 'half') setState('full');
    else setState('half');
  };

  if (!isMobile) return null;
  const isCollapsed = state === 'collapsed';

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 flex flex-col bg-[#0C0C18] border-t border-[rgba(0,240,255,0.18)] rounded-t-2xl safe-area-pb${dragging ? '' : ' transition-[height] duration-200 ease-out'}`}
      style={{ height: `${heightPct}vh` }}
    >
      {/* Handle bar + status row */}
      <div
        className="relative flex items-center justify-between px-4 pt-3 pb-2 shrink-0 cursor-grab active:cursor-grabbing"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Terminal size={14} className="text-[#00F0FF] shrink-0" />
          <span className="text-xs font-medium text-[#00F0FF] font-['Space_Grotesk']">Terminal</span>
          <span className="text-xs text-muted-foreground truncate">— {status}</span>
        </div>
        {/* Drag pill */}
        <div className="absolute left-1/2 -translate-x-1/2 top-3 w-10 h-1 rounded-full bg-muted-foreground/30" />
        {/* Expand button — 44px touch target */}
        <button
          onClick={cycleExpand}
          className="flex items-center justify-center w-11 h-11 -mr-2 rounded-xl text-muted-foreground active:bg-muted/30"
          aria-label={isCollapsed ? 'Expand terminal' : 'Resize terminal'}
        >
          <ChevronUp
            size={18}
            className={`transition-transform duration-200${state === 'full' ? ' rotate-180' : ''}`}
          />
        </button>
      </div>

      {/* Output */}
      {!isCollapsed && (
        <div
          ref={outputRef}
          className="flex-1 overflow-y-auto px-4 pb-2 font-['JetBrains_Mono'] text-xs leading-5 text-[rgba(0,240,255,0.85)]"
        >
          {output.length === 0
            ? <span className="text-muted-foreground">Type a command below…</span>
            : output.map((line, i) => (
                <div key={i} className="whitespace-pre-wrap break-all">{line}</div>
              ))
          }
        </div>
      )}

      {/* Input row */}
      <form
        onSubmit={handleSubmit}
        className="shrink-0 flex items-center gap-2 px-4 pb-3 pt-2 border-t border-[rgba(0,240,255,0.1)]"
      >
        <span className="text-[#00F0FF] font-['JetBrains_Mono'] text-sm shrink-0 select-none">$</span>
        <input
          type="text"
          value={inputValue}
          onChange={e => onInputChange(e.target.value)}
          onFocus={() => { if (isCollapsed) setState('half'); }}
          placeholder="enter command…"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="flex-1 min-w-0 h-11 bg-transparent text-sm font-['JetBrains_Mono'] text-foreground placeholder:text-muted-foreground/50 outline-none caret-[#00F0FF]"
        />
        <button
          type="submit"
          className="shrink-0 flex items-center justify-center w-11 h-11 rounded-xl bg-[rgba(0,240,255,0.12)] active:bg-[rgba(0,240,255,0.22)] text-[#00F0FF]"
          aria-label="Run command"
        >
          <ChevronUp size={18} />
        </button>
      </form>
    </div>
  );
}
