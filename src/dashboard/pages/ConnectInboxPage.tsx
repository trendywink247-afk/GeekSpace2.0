// ConnectInboxPage.tsx — Unified tabbed view: All Messages + Gmail
// Route: /connect/inbox  (registered as 'connect-inbox' in DashboardApp)
// Owner agent: aria
import { useState } from 'react';
import { Inbox, Mail } from 'lucide-react';
import { PageShell, PageHeader, SectionCard } from '@/components/agentin';
import { DashboardPageWrapper } from '@/components/agentin';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';
import { BlurFade } from '@/components/magicui/blur-fade';
import { InboxPage } from './InboxPage';
import { GmailPage } from './GmailPage';

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
        <BlurFade delay={0.1} inView>
          {/* Page header with aria dot */}
          <PageHeader
            icon={Inbox}
            title="Inbox"
            subtitle="Unified messages from all channels"
            badge={
              <span
                className="inline-block w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: 'var(--ag-aria)' }}
                title="Managed by Aria"
              />
            }
          />
        </BlurFade>

        <BlurFade delay={0.2} inView>
          <SectionCard className="mb-6">
            {/* Tab bar */}
            <div
              className="flex items-center gap-1 -m-4 -mb-4 p-4 pb-0 border-b border-[var(--ag-border-subtle)]"
              role="tablist"
              aria-label="Inbox tabs"
            >
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  id={`tab-${id}`}
                  onClick={() => setActiveTab(id)}
                  className={[
                    'flex items-center gap-2 px-4 py-3 text-sm font-medium font-heading rounded-t-xl border-b-2 transition-all duration-300 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ag-violet)]/30',
                    activeTab === id
                      ? 'border-[var(--ag-aria)] text-[var(--ag-aria)] bg-gradient-to-br from-[var(--ag-violet)]/10 to-[var(--ag-amber)]/5 shadow-[var(--ag-glow-sm)]'
                      : 'border-transparent text-[var(--ag-text-secondary)] hover:text-[var(--ag-text-primary)] hover:bg-[var(--ag-bg-surface-hover)] hover:border-[var(--ag-border-default)]',
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
          </SectionCard>
        </BlurFade>

        <BlurFade delay={0.3} inView>
          {/* Tab panels — pass shell={false} to prevent double PageShell nesting */}
          <div
            className="flex-1 min-h-0 overflow-y-auto"
            role="tabpanel"
            id={`tabpanel-${activeTab}`}
            aria-labelledby={`tab-${activeTab}`}
          >
            {activeTab === 'all' ? <InboxPage shell={false} /> : <GmailPage shell={false} />}
          </div>
        </BlurFade>
      </PageShell>
    </DashboardPageWrapper>
  );
}
