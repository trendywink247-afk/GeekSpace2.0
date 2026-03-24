import { cn } from '@/lib/utils';

interface OrbitingCirclesProps {
  children: React.ReactNode;
  className?: string;
  reverse?: boolean;
  duration?: number;
  delay?: number;
  radius?: number;
  path?: boolean;
}

export function OrbitingCircles({
  children,
  className,
  reverse = false,
  duration = 20,
  delay = 0,
  radius = 160,
  path = true,
}: OrbitingCirclesProps) {
  return (
    <>
      {path && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          <circle
            cx="50%"
            cy="50%"
            r={radius}
            className="stroke-white/[0.04] stroke-[1]"
            fill="none"
          />
        </svg>
      )}
      <div
        style={{
          '--duration': `${duration}s`,
          '--radius': `${radius}px`,
          '--delay': `-${delay}s`,
        } as React.CSSProperties}
        className={cn(
          'absolute flex h-12 w-12 transform-gpu items-center justify-center rounded-full',
          'animate-[orbit_var(--duration)_linear_var(--delay)_infinite]',
          reverse && '[animation-direction:reverse]',
          className,
        )}
      >
        {children}
      </div>
    </>
  );
}
