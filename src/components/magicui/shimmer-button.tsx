import { cn } from '@/lib/utils';

interface ShimmerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  shimmerColor?: string;
  shimmerSize?: string;
  borderRadius?: string;
  shimmerDuration?: string;
  background?: string;
  children: React.ReactNode;
  className?: string;
}

export function ShimmerButton({
  shimmerColor = 'rgba(255, 255, 255, 0.12)',
  shimmerSize = '0.08em',
  shimmerDuration = '2.5s',
  borderRadius = '0.75rem',
  background = 'linear-gradient(135deg, #8B5CF6, #F59E0B)',
  children,
  className,
  ...props
}: ShimmerButtonProps) {
  return (
    <button
      style={{
        '--shimmer-color': shimmerColor,
        '--radius': borderRadius,
        '--speed': shimmerDuration,
        '--spread': shimmerSize,
        '--bg': background,
      } as React.CSSProperties}
      className={cn(
        'group relative z-0 flex cursor-pointer items-center justify-center overflow-hidden whitespace-nowrap px-6 py-3',
        'text-white font-semibold text-sm',
        'transform-gpu transition-transform duration-300 ease-out hover:scale-[1.02] active:scale-[0.98]',
        '[background:var(--bg)] [border-radius:var(--radius)]',
        'shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset,0_4px_16px_rgba(139,92,246,0.15)]',
        'hover:shadow-[0_0_0_1px_rgba(255,255,255,0.12)_inset,0_8px_24px_rgba(139,92,246,0.25)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#06060B]',
        className,
      )}
      {...props}
    >
      {/* Shimmer sweep */}
      <div
        className="absolute inset-0 overflow-hidden [border-radius:var(--radius)]"
        style={{ maskImage: 'linear-gradient(#fff, #fff)', WebkitMaskImage: 'linear-gradient(#fff, #fff)' }}
      >
        <div
          className="absolute inset-[-100%] animate-[shimmer-sweep_var(--speed)_ease-in-out_infinite]"
          style={{
            background: `linear-gradient(transparent 40%, var(--shimmer-color) 50%, transparent 60%)`,
            width: '200%',
            transform: 'rotate(25deg)',
          }}
        />
      </div>
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </button>
  );
}
