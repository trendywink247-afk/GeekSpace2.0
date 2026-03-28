import { Link } from 'react-router-dom';

export function StudioHeader() {
  return (
    <header
      className="relative sticky top-0 z-40 border-b border-[var(--ag-border-subtle)] bg-[var(--ag-bg-base)]/80"
      style={{ backdropFilter: 'blur(20px) saturate(180%)' }}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 w-full">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="min-h-[44px] flex items-center gap-1.5 text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] transition-colors text-xs"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M19 12H5m0 0l7 7m-7-7l7-7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="hidden sm:inline">Back to Agentin</span>
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
            <img src="/logo-agentin.webp" alt="Agentin" className="w-6 h-6 object-contain hidden sm:block" />
            <div>
              <h1 className="text-base font-semibold text-[var(--ag-text-primary)] leading-tight">Just another AI Logo creator for Vibe artists</h1>
              <p className="text-[10px] text-[var(--ag-text-muted)] leading-tight">Powered by Agentin</p>
            </div>
            <span className="mt-1 sm:mt-0 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full px-3 py-0.5 text-[11px] whitespace-nowrap w-fit">
              Part of the &#8377;9/month plan
            </span>
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />
    </header>
  );
}
