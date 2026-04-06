import { SectionCard } from '@/components/agentin';
import type { PortfolioContact } from '@/services/api';

interface MessagesTabProps {
  contacts: PortfolioContact[];
}

export function MessagesTab({ contacts }: MessagesTabProps) {
  return (
    <SectionCard title="Portfolio Messages" subtitle="Messages sent by visitors to your public portfolio">
      {contacts.length === 0 ? (
        <p className="text-sm text-[var(--ag-text-muted)] text-center py-8">
          No messages yet. Share your portfolio to get started.
        </p>
      ) : (
        <div className="space-y-3">
          {contacts.map((c) => (
            <div
              key={c.id}
              className="rounded-lg bg-[var(--ag-bg-surface)] backdrop-blur-xl p-4 space-y-1 shadow-[0_0_0_1px_rgba(139,92,246,0.08),0_2px_8px_rgba(0,0,0,0.1)] hover:shadow-[0_0_0_1px_rgba(139,92,246,0.14),0_4px_16px_rgba(0,0,0,0.16)] transition-[box-shadow] duration-200"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-[var(--ag-text-primary)] text-sm">{c.sender_name}</span>
                <div className="flex items-center gap-2">
                  {c.sender_email && (
                    <a
                      href={`mailto:${c.sender_email}?subject=Re%3A%20Your%20message%20on%20my%20portfolio`}
                      className="text-xs px-2 py-1 rounded-lg bg-[#EC4899]/10 text-[#EC4899] border border-[rgba(139,92,246,0.08)] hover:bg-[#EC4899]/20 transition-colors"
                    >
                      Reply
                    </a>
                  )}
                  <span className="text-xs text-[var(--ag-text-muted)]">
                    {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </div>
              {c.sender_email && (
                <span className="text-xs text-[var(--ag-text-muted)]">{c.sender_email}</span>
              )}
              <p className="text-sm text-[var(--ag-text-primary)] mt-1 whitespace-pre-wrap">{c.message}</p>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
