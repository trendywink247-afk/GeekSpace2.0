import type { ReactNode } from 'react';

interface ToolShellProps {
  title: string;
  description: string;
  onBack: () => void;
  children: ReactNode;
}

export function ToolShell({ title, description, onBack, children }: ToolShellProps) {
  return (
    <div className="space-y-6">
      {/* back + heading */}
      <div className="flex items-start gap-4">
        <button
          onClick={onBack}
          className="mt-0.5 flex-shrink-0 flex items-center justify-center w-11 min-h-[44px] rounded-lg border border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)] text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:border-[var(--ag-border-default)] transition-colors cursor-pointer"
          aria-label="Back to tools"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M5 12l7 7M5 12l7-7" />
          </svg>
        </button>

        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[var(--ag-text-primary)] tracking-tight">{title}</h2>
          <p className="text-sm text-[var(--ag-text-secondary)] mt-1 leading-relaxed">{description}</p>
        </div>
      </div>

      {/* tool content */}
      <div className="rounded-2xl border border-[var(--ag-border-subtle)] bg-[var(--ag-bg-surface)] p-5 sm:p-6">
        {children}
      </div>
    </div>
  );
}
