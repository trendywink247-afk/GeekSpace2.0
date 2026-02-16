import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export function PageProgress({ loading }: { loading: boolean }) {
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (loading) {
      setVisible(true);
      setWidth(0);
      let w = 0;
      intervalRef.current = setInterval(() => {
        if (w < 60) w += 8;
        else if (w < 85) w += 2;
        else if (w < 95) w += 0.5;
        else {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return;
        }
        setWidth(w);
      }, 100);
    } else if (visible) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setWidth(100);
      setTimeout(() => {
        setVisible(false);
        setWidth(0);
      }, 400);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loading]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-[3px] pointer-events-none">
      <div
        className={cn(
          "h-full bg-gradient-to-r from-[#7B61FF] to-[#61FF7B] transition-all ease-out",
          width === 100 ? 'duration-300 opacity-0' : 'duration-200'
        )}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
