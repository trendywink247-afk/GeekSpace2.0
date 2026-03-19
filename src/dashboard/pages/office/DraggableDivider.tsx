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
      className="h-2 cursor-row-resize flex items-center justify-center group hover:bg-[#00F0FF]/10 transition-colors"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div className="w-12 h-1 rounded-full bg-[#00F0FF]/15 group-hover:bg-[#00F0FF]/30 transition-colors" />
    </div>
  );
}
