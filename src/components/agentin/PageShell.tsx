import { type ReactNode } from 'react';

interface PageShellProps {
  children: ReactNode;
  /** Max content width. Default: none (full width). Use '5xl' for content pages. */
  maxWidth?: '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full';
  /** Vertical spacing between children. Default: 6 */
  spacing?: 4 | 6 | 8;
  /** Additional className */
  className?: string;
}

const maxWidthClasses: Record<string, string> = {
  '3xl': 'max-w-3xl mx-auto',
  '4xl': 'max-w-4xl mx-auto',
  '5xl': 'max-w-5xl mx-auto',
  '6xl': 'max-w-6xl mx-auto',
  '7xl': 'max-w-7xl mx-auto',
};

const spacingClasses: Record<number, string> = {
  4: 'space-y-4',
  6: 'space-y-6',
  8: 'space-y-8',
};

export function PageShell({ children, maxWidth, spacing = 6, className = '' }: PageShellProps) {
  const maxWidthClass = maxWidth && maxWidth !== 'full' ? maxWidthClasses[maxWidth] ?? '' : '';
  const spacingClass = spacingClasses[spacing] ?? 'space-y-6';
  return (
    <div className={`p-4 md:p-6 pb-24 md:pb-6 ${spacingClass} animate-page-enter ${maxWidthClass} ${className}`}>
      {children}
    </div>
  );
}
