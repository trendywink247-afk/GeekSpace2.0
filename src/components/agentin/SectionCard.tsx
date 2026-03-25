import { type ReactNode } from 'react';

interface SectionCardProps {
  children: ReactNode;
  /** Optional title for the card section */
  title?: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Additional className */
  className?: string;
  /** Card padding size */
  padding?: 'sm' | 'md' | 'lg';
}

const paddingClasses: Record<string, string> = {
  sm: 'p-3',
  md: 'p-4 md:p-5',
  lg: 'p-6',
};

export function SectionCard({ children, title, subtitle, className = '', padding = 'md' }: SectionCardProps) {
  const paddingClass = paddingClasses[padding] ?? 'p-4 md:p-5';
  return (
    <div className={`relative overflow-hidden rounded-xl bg-[var(--ag-bg-surface)] backdrop-blur-xl border border-[var(--ag-border-subtle)] hover:border-[var(--ag-border-default)] hover:shadow-[var(--ag-glow-sm)] hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] transition-all duration-300 ${paddingClass} ${className}`}>
      {(title || subtitle) && (
        <div className="mb-4">
          {title && <h2 className="text-base font-semibold text-[var(--ag-text-primary,#F4F6FF)]">{title}</h2>}
          {subtitle && <p className="text-xs text-[var(--ag-text-secondary,#9CA3AF)] mt-0.5">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}
