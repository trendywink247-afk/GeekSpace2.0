// ConnectInboxPage.tsx — Unified tabbed view: All Messages + Gmail
// Route: /connect/inbox  (registered as 'connect-inbox' in DashboardApp)
// Owner agent: aria (#FF6B9D)
import { useState } from 'react';
import { Inbox, Mail } from 'lucide-react';
import { PageShell, PageHeader } from '@/components/agentin';
import { DashboardPageWrapper } from '@/components/agentin';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';
import { InboxPage } from './InboxPage';
import { GmailPage } from './GmailPage';

/** Aria accent — owner agent color */
const ARIA = '#FF6B9D';

type TabId = 'all' | 'gmail';

const TABS: { id: TabId; label: string; icon: typeof Inbox }[] = [
  { id: 'all', label: 'All Messages', icon: Inbox },
  { id: 'gmail', label: 'Gmail', icon: Mail },
];

export function ConnectInboxPage() {
  const [activeTab, setActiveTab] = useState<TabId>('all');

  // Wire aria canvas notifications
  useAgentCanvas({ agent: 'aria', page: 'connect-inbox' });

  return (
    <DashboardPageWrapper>
    <PageShell>
      {/* Page header with aria dot */}
      <PageHeader
        icon={Inbox}
        title="Inbox"
        subtitle="Unified messages from all channels"
        badge={
          <span
            className="inline-block w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: ARIA }}
            title="Managed by Aria"
          />
        }
      />

      <div className="flex flex-col min-h-0">
        {/* Tab bar */}
        <div
          className="flex items-center gap-1 px-4 pt-0 pb-0 border-b border-[rgba(139,92,246,0.08)]"
          role="tablist"
          aria-label="Inbox tabs"
        >
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              id={`tab-${id}`}
              onClick={() => setActiveTab(id)}
              className={[
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors min-h-[44px] focus-visible:outline-none focus-visible:ring-2',
                `focus-visible:ring-[${ARIA}]/50`,
                activeTab === id
                  ? `border-[${ARIA}] text-[${ARIA}] bg-[${ARIA}]/5`
                  : 'border-transparent text-[#9CA3AF] hover:text-[#F4F6FF] hover:bg-white/5',
              ].join(' ')}
              aria-selected={activeTab === id}
              aria-controls={`tabpanel-${id}`}
              role="tab"
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab panels — pass shell={false} to prevent double PageShell nesting */}
        <div
          className="flex-1 min-h-0 overflow-y-auto"
          role="tabpanel"
          id={`tabpanel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
        >
          {activeTab === 'all' ? <InboxPage shell={false} /> : <GmailPage shell={false} />}
        </div>
      </div>
    </PageShell>
    </DashboardPageWrapper>
  );
}
