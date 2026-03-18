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
    <div className={`bg-[#0C0C18] border border-[#00F0FF]/10 rounded-xl ${paddingClass} ${className}`}>
      {(title || subtitle) && (
        <div className="mb-4">
          {title && <h2 className="text-base font-semibold text-[#F4F6FF]">{title}</h2>}
          {subtitle && <p className="text-xs text-[#8892A4] mt-0.5">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}
