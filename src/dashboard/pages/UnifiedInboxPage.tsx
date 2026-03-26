// UnifiedInboxPage.tsx -- Tabbed view combining AI Inbox + Gmail
import { useState } from 'react';
import { Inbox, Mail } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InboxPage } from './InboxPage';
import { GmailPage } from './GmailPage';
import { PageShell } from '@/components/agentin';

export function UnifiedInboxPage() {
  const [activeTab, setActiveTab] = useState('messages');

  return (
    <PageShell maxWidth="6xl" spacing={4}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-[var(--ag-bg-surface)] border border-[var(--ag-border-glow)]">
          <TabsTrigger
            value="messages"
            className="data-[state=active]:bg-[var(--ag-cyan)]/10 data-[state=active]:text-[var(--ag-cyan)] gap-2 min-h-[44px]"
          >
            <Inbox className="w-4 h-4" />
            All Messages
          </TabsTrigger>
          <TabsTrigger
            value="gmail"
            className="data-[state=active]:bg-[var(--ag-cyan)]/10 data-[state=active]:text-[var(--ag-cyan)] gap-2 min-h-[44px]"
          >
            <Mail className="w-4 h-4" />
            Gmail
          </TabsTrigger>
        </TabsList>

        <TabsContent value="messages" className="mt-0">
          <InboxPage />
        </TabsContent>

        <TabsContent value="gmail" className="mt-0">
          <GmailPage />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
