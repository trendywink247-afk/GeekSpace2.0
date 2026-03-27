import { useState, useRef, useCallback, useEffect } from 'react';

interface BeforeAfterProps {
  before: string;
  after: string;
  beforeLabel?: string;
  afterLabel?: string;
}

export function BeforeAfter({
  before,
  after,
  beforeLabel = 'Before',
  afterLabel = 'After',
}: BeforeAfterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(50); // percentage 0-100
  const [dragging, setDragging] = useState(false);

  const updatePosition = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setPosition(pct);
  }, []);

  /* mouse events */
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    updatePosition(e.clientX);
  }, [updatePosition]);

  useEffect(() => {
    if (!dragging) return;

    const onMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      updatePosition(e.clientX);
    };
    const onMouseUp = () => setDragging(false);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragging, updatePosition]);

  /* touch events */
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    setDragging(true);
    updatePosition(e.touches[0].clientX);
  }, [updatePosition]);

  useEffect(() => {
    if (!dragging) return;

    const onTouchMove = (e: TouchEvent) => {
      updatePosition(e.touches[0].clientX);
    };
    const onTouchEnd = () => setDragging(false);

    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [dragging, updatePosition]);

  /* checkerboard CSS for transparency */
  const checkerboard = {
    backgroundImage: `
      linear-gradient(45deg, rgba(255,255,255,0.04) 25%, transparent 25%),
      linear-gradient(-45deg, rgba(255,255,255,0.04) 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.04) 75%),
      linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.04) 75%)
    `,
    backgroundSize: '16px 16px',
    backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
  };

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="relative w-full rounded-xl overflow-hidden border border-[var(--ag-border-subtle)] select-none"
        style={{ ...checkerboard, cursor: dragging ? 'ew-resize' : 'default' }}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
      >
        {/* after image (full width, bottom layer) */}
        <img
          src={after}
          alt={afterLabel}
          className="block w-full h-auto"
          draggable={false}
        />

        {/* before image (clipped) */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${position}%` }}
        >
          <img
            src={before}
            alt={beforeLabel}
            className="block h-full object-cover"
            style={{ width: containerRef.current ? `${containerRef.current.offsetWidth}px` : '100%' }}
            draggable={false}
          />
        </div>

        {/* divider line */}
        <div
          className="absolute top-0 bottom-0 w-[2px] bg-white/80 z-10"
          style={{ left: `${position}%`, transform: 'translateX(-1px)' }}
        >
          {/* handle */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 border-2 border-white shadow-lg flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#06061a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 5l-5 7 5 7" />
              <path d="M16 5l5 7-5 7" />
            </svg>
          </div>
        </div>

        {/* labels */}
        <div
          className="absolute top-3 left-3 z-20 px-2 py-1 rounded-md text-[10px] font-medium uppercase tracking-wider bg-black/60 text-white/80"
          style={{ backdropFilter: 'blur(8px)' }}
        >
          {beforeLabel}
        </div>
        <div
          className="absolute top-3 right-3 z-20 px-2 py-1 rounded-md text-[10px] font-medium uppercase tracking-wider bg-black/60 text-white/80"
          style={{ backdropFilter: 'blur(8px)' }}
        >
          {afterLabel}
        </div>
      </div>
    </div>
  );
}
