import { cn } from '@/lib/utils';

interface BorderBeamProps {
  className?: string;
  size?: number;
  duration?: number;
  borderWidth?: number;
  colorFrom?: string;
  colorTo?: string;
  delay?: number;
}

export function BorderBeam({
  className,
  size = 200,
  duration = 12,
  borderWidth = 1.5,
  colorFrom = '#8B5CF6',
  colorTo = '#F59E0B',
  delay = 0,
}: BorderBeamProps) {
  return (
    <div
      style={{
        '--size': `${size}px`,
        '--duration': `${duration}s`,
        '--border-width': `${borderWidth}px`,
        '--color-from': colorFrom,
        '--color-to': colorTo,
        '--delay': `-${delay}s`,
      } as React.CSSProperties}
      className={cn(
        'pointer-events-none absolute inset-0 rounded-[inherit]',
        'after:absolute after:inset-0 after:rounded-[inherit] after:p-[var(--border-width)]',
        'after:![mask-composite:exclude] after:[mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)]',
        'after:bg-[length:var(--size)_var(--size)] after:bg-[conic-gradient(from_calc(var(--delay)*-1turn),transparent_0,var(--color-from)_10%,var(--color-to)_20%,transparent_30%)]',
        'after:animate-[border-rotate_var(--duration)_linear_infinite]',
        className,
      )}
    />
  );
}
