import { cn } from '@/lib/utils';

interface MarqueeProps {
  children: React.ReactNode;
  className?: string;
  reverse?: boolean;
  pauseOnHover?: boolean;
  vertical?: boolean;
  repeat?: number;
  speed?: number;
}

export function Marquee({
  children,
  className,
  reverse = false,
  pauseOnHover = false,
  vertical = false,
  repeat = 4,
  speed = 40,
}: MarqueeProps) {
  return (
    <div
      className={cn(
        'group flex overflow-hidden [--gap:1rem] gap-[var(--gap)]',
        vertical ? 'flex-col' : 'flex-row',
        className,
      )}
      style={{ '--duration': `${speed}s` } as React.CSSProperties}
    >
      {Array.from({ length: repeat }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'flex shrink-0 justify-around gap-[var(--gap)]',
            vertical ? 'flex-col animate-[marquee-scroll-v_var(--duration)_linear_infinite]' : 'animate-[marquee-scroll_var(--duration)_linear_infinite]',
            reverse && '[animation-direction:reverse]',
            pauseOnHover && 'group-hover:[animation-play-state:paused]',
          )}
        >
          {children}
        </div>
      ))}
    </div>
  );
}
