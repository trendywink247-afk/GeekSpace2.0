import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useMobileDetect } from '@/hooks/use-mobile-detect';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  snapPoints?: number[];
}

export function BottomSheet({ open, onClose, children, title, snapPoints = [50, 90] }: BottomSheetProps) {
  const isMobile = useMobileDetect();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(snapPoints[0]);
  const startY = useRef(0);
  const startHeight = useRef(0);

  useEffect(() => {
    if (open) {
      setHeight(snapPoints[0]); // eslint-disable-line react-hooks/set-state-in-effect
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open, snapPoints]);

  if (!open) return null;

  // On desktop, don't render (caller should use Dialog instead)
  if (!isMobile) return null;

  const handleDragStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    startHeight.current = height;
  };

  const handleDrag = (e: React.TouchEvent) => {
    const diff = startY.current - e.touches[0].clientY;
    const newHeight = startHeight.current + (diff / window.innerHeight) * 100;
    setHeight(Math.max(20, Math.min(95, newHeight)));
  };

  const handleDragEnd = () => {
    if (height < 25) {
      onClose();
      return;
    }
    const nearest = snapPoints.reduce((prev, curr) =>
      Math.abs(curr - height) < Math.abs(prev - height) ? curr : prev
    );
    setHeight(nearest);
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border rounded-t-2xl transition-[height] duration-200 ease-out flex flex-col safe-area-pb"
        style={{ height: `${height}vh` }}
      >
        <div
          className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing"
          onTouchStart={handleDragStart}
          onTouchMove={handleDrag}
          onTouchEnd={handleDragEnd}
        >
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>
        {title && (
          <div className="px-4 pb-3 border-b border-border">
            <h3 className="text-lg font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{title}</h3>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {children}
        </div>
      </div>
    </>
  );
}
