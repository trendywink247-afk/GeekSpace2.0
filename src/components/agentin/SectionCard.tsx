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
    <div className={`relative overflow-hidden rounded-xl bg-[var(--ag-bg-surface)] backdrop-blur-xl shadow-[0_0_0_1px_rgba(139,92,246,0.12),0_4px_16px_rgba(0,0,0,0.18),0_1px_3px_rgba(0,0,0,0.1)] hover:shadow-[0_0_0_1px_rgba(139,92,246,0.22),0_8px_32px_rgba(0,0,0,0.28),0_2px_6px_rgba(0,0,0,0.16)] transition-[box-shadow] duration-300 ${paddingClass} ${className}`}>
      {(title || subtitle) && (
        <div className="mb-4">
          {title && <h2 className="text-base font-semibold font-heading text-[var(--ag-text-primary,#F4F6FF)]">{title}</h2>}
          {subtitle && <p className="text-xs text-[var(--ag-text-secondary,#9CA3AF)] mt-0.5">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}
