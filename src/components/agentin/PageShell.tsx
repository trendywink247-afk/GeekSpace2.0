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
    <div className={`relative p-4 md:p-6 pb-24 md:pb-6 ${spacingClass} animate-page-enter ${maxWidthClass} ${className}`}>
      {/* Aurora gradient orbs — matches landing page aesthetic */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10" aria-hidden="true">
        <div className="absolute -top-1/2 -left-1/4 w-[80vw] h-[80vw] rounded-full bg-[#8B5CF6]/[0.03] blur-[120px]" />
        <div className="absolute -bottom-1/3 -right-1/4 w-[60vw] h-[60vw] rounded-full bg-[#10B981]/[0.02] blur-[100px]" />
        <div className="absolute top-1/4 right-1/3 w-[40vw] h-[40vw] rounded-full bg-[#F59E0B]/[0.015] blur-[80px]" />
      </div>
      {children}
    </div>
  );
}
