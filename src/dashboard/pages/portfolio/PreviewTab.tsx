import { Eye, ExternalLink } from 'lucide-react';
import { SectionCard } from '@/components/agentin';

interface PreviewTabProps {
  username?: string;
}

export function PreviewTab({ username }: PreviewTabProps) {
  return (
    <SectionCard title="Live Preview" subtitle="This is how your public portfolio looks to visitors">
      {username && (
        <div className="flex justify-end mb-3">
          <a
            href={`/portfolio/${username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-[var(--ag-violet)] hover:text-[#7C3AED] transition-colors min-h-[44px]"
          >
            <ExternalLink className="w-4 h-4" />
            Open in new tab
          </a>
        </div>
      )}
      {username ? (
        <div className="relative w-full rounded-b-xl overflow-hidden border-t border-[rgba(139,92,246,0.08)] shadow-[0_0_20px_rgba(139,92,246,0.06)]">
          <div className="flex items-center gap-2 px-4 py-2 bg-[var(--ag-bg-base)] border-b border-[rgba(139,92,246,0.08)]">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#FF6161]/40" />
              <div className="w-3 h-3 rounded-full bg-[#FFB800]/40" />
              <div className="w-3 h-3 rounded-full bg-[#00FF88]/40" />
            </div>
            <span className="text-xs text-[var(--ag-text-muted)] font-mono truncate">
              {window.location.origin}/portfolio/{username}
            </span>
          </div>
          <iframe
            src={`/portfolio/${username}`}
            title="Portfolio preview"
            className="w-full"
            style={{ height: '600px', border: 'none' }}
            loading="lazy"
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center px-6">
          <Eye className="w-12 h-12 text-[#EC4899]/30 mb-4" />
          <p className="text-[var(--ag-text-muted)] mb-2">No username set</p>
          <p className="text-sm text-[var(--ag-text-muted)]/70">Set a username in your profile to see a preview</p>
        </div>
      )}
    </SectionCard>
  );
}
