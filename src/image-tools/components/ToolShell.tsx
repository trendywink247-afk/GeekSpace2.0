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
          className="mt-0.5 flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/50 hover:text-white/80 hover:border-white/[0.15] transition-colors cursor-pointer"
          aria-label="Back to tools"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M5 12l7 7M5 12l7-7" />
          </svg>
        </button>

        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{title}</h2>
          <p className="text-sm text-white/40 mt-1 leading-relaxed">{description}</p>
        </div>
      </div>

      {/* tool content */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 sm:p-6">
        {children}
      </div>
    </div>
  );
}
