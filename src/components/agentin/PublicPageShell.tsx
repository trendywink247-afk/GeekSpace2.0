import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface PublicPageShellProps {
  children: ReactNode;
  /** Page title shown in the sticky header */
  title?: string;
  /** Icon shown next to the title */
  icon?: LucideIcon;
  /** Max content width. Default: '4xl' */
  maxWidth?: '3xl' | '4xl' | '5xl' | '6xl' | '7xl';
  /** Additional className for the content area */
  className?: string;
}

/**
 * Layout wrapper for public (non-dashboard) pages: Privacy, Terms, Status, Docs, etc.
 * Provides the premium Agentin background effects (aurora, dot-grid, noise) and a
 * sticky header with navigation — matching the landing page aesthetic.
 */
export function PublicPageShell({ children, title, icon: Icon, maxWidth = '4xl', className = '' }: PublicPageShellProps) {
  const maxWidthClasses: Record<string, string> = {
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    '7xl': 'max-w-7xl',
  };

  return (
    <div className="relative min-h-dvh text-[var(--ag-text-primary,#F4F6FF)] overflow-hidden" style={{ background: 'var(--ag-bg-base, #06061a)' }}>
      {/* Aurora gradient orbs */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute -top-1/2 -left-1/4 w-[80vw] h-[80vw] rounded-full bg-[#8B5CF6]/[0.03] blur-[120px]" />
        <div className="absolute -bottom-1/3 -right-1/4 w-[60vw] h-[60vw] rounded-full bg-[#10B981]/[0.02] blur-[100px]" />
        <div className="absolute top-1/4 right-1/3 w-[40vw] h-[40vw] rounded-full bg-[#F59E0B]/[0.015] blur-[80px]" />
      </div>

      {/* Dot-grid overlay */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(rgba(139,92,246,0.07) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          opacity: 0.07,
        }}
        aria-hidden="true"
      />

      {/* Noise texture overlay */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          opacity: 0.025,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '128px 128px',
        }}
        aria-hidden="true"
      />

      {/* Sticky header */}
      <header
        className="relative sticky top-0 z-40 border-b border-[var(--ag-border-subtle,rgba(139,92,246,0.08))]"
        style={{ background: 'rgba(6, 6, 26, 0.8)', backdropFilter: 'blur(20px) saturate(180%)' }}
      >
        <div className={`${maxWidthClasses[maxWidth] ?? 'max-w-4xl'} mx-auto flex items-center gap-3 px-6 py-3`}>
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-[var(--ag-text-muted,#6B7280)] hover:text-[var(--ag-text-primary,#F4F6FF)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Home</span>
          </Link>
          {title && (
            <div className="flex items-center gap-2 ml-2">
              {Icon && <Icon className="w-4 h-4 text-[var(--ag-cyan,#A78BFA)]" />}
              <span className="font-heading font-semibold text-[var(--ag-text-primary,#F4F6FF)]">{title}</span>
            </div>
          )}
        </div>
      </header>

      {/* Content area */}
      <main className={`relative ${maxWidthClasses[maxWidth] ?? 'max-w-4xl'} mx-auto px-4 sm:px-6 py-8 md:py-12 pb-24 md:pb-12 animate-page-enter ${className}`}>
        {children}
      </main>
    </div>
  );
}
