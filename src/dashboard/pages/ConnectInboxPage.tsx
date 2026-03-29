// ConnectInboxPage.tsx — Unified tabbed view: All Messages + Gmail
// Route: /connect/inbox  (registered as 'connect-inbox' in DashboardApp)
// Owner agent: aria (#FF6B9D)
import { useState } from 'react';
import { Inbox } from 'lucide-react';
import { PageShell, PageHeader, GsTabBar } from '@/components/agentin';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';
import { InboxPage } from './InboxPage';
import { GmailPage } from './GmailPage';

/** Aria accent — owner agent color */
const ARIA = '#FF6B9D';

type TabId = 'all' | 'gmail';

export function ConnectInboxPage() {
  const [activeTab, setActiveTab] = useState<TabId>('all');

  // Wire aria canvas notifications
  useAgentCanvas({ agent: 'aria', page: 'connect-inbox' });

  return (
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

      <div className="flex flex-col min-h-0 space-y-4">
        {/* Tab bar */}
        <GsTabBar
          tabs={[
            { id: 'all', label: 'All Messages' },
            { id: 'gmail', label: 'Gmail' },
          ]}
          activeTab={activeTab}
          onChange={(id) => setActiveTab(id as TabId)}
        />

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
  );
}
