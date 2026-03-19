// src/dashboard/pages/office/DraggableDivider.tsx
import { useCallback, useRef } from 'react';

interface Props {
  onResize: (topPercent: number) => void;
}

export function DraggableDivider({ onResize }: Props) {
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    containerRef.current = e.currentTarget.parentElement as HTMLDivElement;
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = ((e.clientY - rect.top) / rect.height) * 100;
    onResize(Math.min(70, Math.max(30, pct)));
  }, [onResize]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    dragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  return (
    <div
      className="h-4 md:h-3 cursor-row-resize flex items-center justify-center group transition-all duration-200 touch-none"
      style={{ background: 'linear-gradient(to right, transparent 5%, rgba(0,240,255,0.04) 50%, transparent 95%)' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Full-width neon line */}
      <div
        className="absolute left-0 right-0 h-[1px] group-hover:h-[2px] transition-all duration-300"
        style={{
          background: 'linear-gradient(to right, transparent 2%, rgba(0,240,255,0.2) 20%, rgba(0,240,255,0.35) 50%, rgba(0,240,255,0.2) 80%, transparent 98%)',
          boxShadow: '0 0 6px rgba(0,240,255,0.1)',
        }}
      />
      {/* Center grab handle */}
      <div
        className="relative z-10 w-16 h-1.5 rounded-full transition-all duration-300 group-hover:w-20 group-hover:h-2 group-hover:shadow-[0_0_12px_rgba(0,240,255,0.3)]"
        style={{
          background: 'linear-gradient(to right, rgba(0,240,255,0.15), rgba(0,240,255,0.3), rgba(0,240,255,0.15))',
        }}
      >
        {/* Three grab dots */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-1.5">
          <div className="w-1 h-1 rounded-full bg-[#00F0FF]/40 group-hover:bg-[#00F0FF]/70" />
          <div className="w-1 h-1 rounded-full bg-[#00F0FF]/40 group-hover:bg-[#00F0FF]/70" />
          <div className="w-1 h-1 rounded-full bg-[#00F0FF]/40 group-hover:bg-[#00F0FF]/70" />
        </div>
      </div>
    </div>
  );
}
