// ConnectInboxPage.tsx — Unified tabbed view: All Messages + Gmail
// Route: /connect/inbox  (registered as 'connect-inbox' in DashboardApp)
import { useState } from 'react';
import { Inbox, Mail } from 'lucide-react';
import { PageShell } from '@/components/agentin';
import { InboxPage } from './InboxPage';
import { GmailPage } from './GmailPage';

type TabId = 'all' | 'gmail';

export function ConnectInboxPage() {
  const [activeTab, setActiveTab] = useState<TabId>('all');

  return (
    <PageShell>
    <div className="flex flex-col min-h-0">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 pt-0 pb-0 border-b border-[var(--ag-border-subtle)]">
        <button
          onClick={() => setActiveTab('all')}
          className={[
            'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50',
            activeTab === 'all'
              ? 'border-[var(--ag-cyan)] text-[var(--ag-cyan)] bg-[var(--ag-cyan)]/5'
              : 'border-transparent text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)] hover:bg-white/5',
          ].join(' ')}
          aria-selected={activeTab === 'all'}
          role="tab"
        >
          <Inbox className="w-4 h-4 shrink-0" />
          All Messages
        </button>
        <button
          onClick={() => setActiveTab('gmail')}
          className={[
            'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00F0FF]/50',
            activeTab === 'gmail'
              ? 'border-[var(--ag-cyan)] text-[var(--ag-cyan)] bg-[var(--ag-cyan)]/5'
              : 'border-transparent text-[var(--ag-text-muted)] hover:text-[var(--ag-text-primary)] hover:bg-white/5',
          ].join(' ')}
          aria-selected={activeTab === 'gmail'}
          role="tab"
        >
          <Mail className="w-4 h-4 shrink-0" />
          Gmail
        </button>
      </div>

      {/* Tab panels — pass shell={false} to prevent double PageShell nesting */}
      <div className="flex-1 min-h-0 overflow-y-auto" role="tabpanel">
        {activeTab === 'all' ? <InboxPage shell={false} /> : <GmailPage shell={false} />}
      </div>
    </div>
    </PageShell>
  );
}
