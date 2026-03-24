import { cn } from '@/lib/utils';

interface BentoGridProps {
  children: React.ReactNode;
  className?: string;
}

export function BentoGrid({ children, className }: BentoGridProps) {
  return (
    <div
      className={cn(
        'grid w-full auto-rows-[22rem] grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3',
        className,
      )}
    >
      {children}
    </div>
  );
}

interface BentoCardProps {
  name: string;
  description: string;
  icon?: React.ReactNode;
  className?: string;
  background?: React.ReactNode;
  href?: string;
  cta?: string;
  children?: React.ReactNode;
}

export function BentoCard({
  name,
  description,
  icon,
  className,
  background,
  href,
  cta,
  children,
}: BentoCardProps) {
  return (
    <div
      className={cn(
        'group relative col-span-1 flex flex-col justify-between overflow-hidden rounded-2xl',
        'border border-white/[0.06] bg-[var(--layer-card)]',
        'transform-gpu transition-all duration-300',
        'hover:border-white/[0.12] hover:shadow-lg hover:shadow-[var(--glow-violet)]',
        className,
      )}
    >
      {/* Background element */}
      {background && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-60 transition-opacity duration-300 group-hover:opacity-80">
          {background}
        </div>
      )}
      <div className="pointer-events-none z-10 flex transform-gpu flex-col gap-1 p-6 transition-all duration-300 group-hover:-translate-y-1">
        {icon && <div className="mb-2 h-10 w-10 text-[#8B5CF6]">{icon}</div>}
        <h3 className="text-lg font-semibold text-[var(--text-primary)]" style={{ fontFamily: 'Syne, sans-serif' }}>
          {name}
        </h3>
        <p className="max-w-lg text-sm text-[var(--text-muted)]">{description}</p>
      </div>
      {children && <div className="relative z-10 px-6 pb-4">{children}</div>}
      {cta && href && (
        <a
          href={href}
          className={cn(
            'pointer-events-auto absolute bottom-0 flex w-full translate-y-10 items-center p-4 opacity-0',
            'transform-gpu transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100',
          )}
        >
          <span className="text-sm font-medium text-[#8B5CF6]">{cta} &rarr;</span>
        </a>
      )}
    </div>
  );
}
