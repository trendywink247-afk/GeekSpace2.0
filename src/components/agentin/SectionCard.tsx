import { type ReactNode } from 'react';

interface SectionCardProps {
  children: ReactNode;
  /** Optional mono-uppercase label above the title */
  label?: string;
  /** Optional title for the card section */
  title?: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Additional className */
  className?: string;
  /** Card padding size */
  padding?: 'sm' | 'md' | 'lg';
  /** Right-aligned header actions */
  actions?: ReactNode;
}

const paddingClasses: Record<string, string> = {
  sm: 'p-3',
  md: 'p-4 md:p-5',
  lg: 'p-5 md:p-6',
};

export function SectionCard({ children, label, title, subtitle, className = '', padding = 'md', actions }: SectionCardProps) {
  const paddingClass = paddingClasses[padding] ?? 'p-4 md:p-5';
  return (
    <div className={`gs-card ${paddingClass} ${className}`}>
      {(label || title || subtitle || actions) && (
        <div className="mb-4">
          {label && <span className="gs-section-label">{label}</span>}
          {(title || actions) && (
            <div className="flex items-center justify-between gap-2">
              {title && (
                <h2 className="text-base font-semibold font-heading text-[var(--ag-text-primary,#F4F6FF)]">{title}</h2>
              )}
              {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
            </div>
          )}
          {subtitle && <p className="text-xs text-[var(--ag-text-secondary,#9CA3AF)] mt-0.5">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}
