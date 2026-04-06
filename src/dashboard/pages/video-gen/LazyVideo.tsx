import { useState, useEffect, useRef } from 'react';

interface LazyVideoProps {
  src: string;
  className?: string;
}

/**
 * Lazy-loads a video via IntersectionObserver.
 * The `src` is only set once the element enters the viewport (+ 200px margin).
 */
export function LazyVideo({ src, className }: LazyVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !el.src) {
          el.src = src;
          setLoaded(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [src]);

  return (
    <div className="relative w-full h-full">
      {!loaded && (
        <div className="absolute inset-0 bg-[var(--ag-bg-surface)] animate-pulse" />
      )}
      <video
        ref={videoRef}
        className={className}
        muted
        preload="none"
      />
    </div>
  );
}
