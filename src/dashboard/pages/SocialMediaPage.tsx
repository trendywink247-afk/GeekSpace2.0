// SocialMediaPage.tsx — Aria-owned social media handler
import { useState, useEffect, useCallback } from 'react';
import { PageShell, PageHeader } from '@/components/agentin';
import { DashboardPageWrapper } from '@/components/agentin';
import { useAgentCanvas } from '@/hooks/useAgentCanvas';
import { BlurFade } from '@/components/magicui/blur-fade';
import { Share2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { socialMediaService } from '@/services/api';
import type { SocialAccount, ContentPlanItem } from '@/services/api';
import { StatsSummary } from './social-media/helpers';
import { AccountsTab } from './social-media/AccountsTab';
import { ContentPlanTab } from './social-media/ContentPlanTab';
import { PostList } from './social-media/PostList';

export function SocialMediaPage() {
  const { notifyStart, notifyDone, notifyFail } = useAgentCanvas({
    agent: 'aria',
    page: 'social-media',
  });
  const [statsAccounts, setStatsAccounts] = useState<SocialAccount[]>([]);
  const [statsItems, setStatsItems] = useState<ContentPlanItem[]>([]);
  const [statsLoaded, setStatsLoaded] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const [accountsRes, plansRes] = await Promise.all([
        socialMediaService.getAccounts(),
        socialMediaService.getPlans(),
      ]);
      setStatsAccounts(accountsRes.data);

      if (plansRes.data.length > 0) {
        const planResponses = await Promise.all(
          plansRes.data.map((plan) => socialMediaService.getPlan(plan.id))
        );
        setStatsItems(planResponses.flatMap((r) => r.data.items ?? []));
      }
    } catch {
      // Stats are best-effort
    } finally {
      setStatsLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handlePostScheduled = useCallback(async () => {
    await notifyDone('Post scheduled via social media handler');
    loadStats();
  }, [notifyDone, loadStats]);

  const handleAccountCreated = useCallback(async () => {
    await notifyDone('Social account connected');
    loadStats();
  }, [notifyDone, loadStats]);

  // Suppress unused var lint — available for future use
  void notifyStart;
  void notifyFail;

  return (
    <DashboardPageWrapper>
      <PageShell maxWidth="4xl">
        <div className="space-y-6 pb-24 md:pb-6 overflow-x-hidden">
          <PageHeader
            icon={Share2}
            title="Social Media Handler"
            subtitle="Connect accounts, generate content plans, and auto-post on schedule."
            badge={
              <span className="inline-flex items-center gap-1 text-[10px] text-[var(--ag-text-muted)] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B9D]" />
                Aria
              </span>
            }
          />

          {/* Stats summary bar */}
          {statsLoaded && (statsAccounts.length > 0 || statsItems.length > 0) && (
            <StatsSummary accounts={statsAccounts} items={statsItems} />
          )}

          <BlurFade delay={0.2}>
            <Tabs defaultValue="accounts" className="w-full">
              <TabsList className="bg-[var(--ag-bg-surface)] border border-[var(--ag-border-subtle)]">
                <TabsTrigger
                  value="accounts"
                  className="data-[state=active]:bg-[var(--ag-violet)]/10 data-[state=active]:text-[var(--ag-violet)]"
                >
                  Accounts
                </TabsTrigger>
                <TabsTrigger
                  value="plan"
                  className="data-[state=active]:bg-[var(--ag-violet)]/10 data-[state=active]:text-[var(--ag-violet)]"
                >
                  Content Plan
                </TabsTrigger>
                <TabsTrigger
                  value="posts"
                  className="data-[state=active]:bg-[var(--ag-violet)]/10 data-[state=active]:text-[var(--ag-violet)]"
                >
                  Posts
                </TabsTrigger>
              </TabsList>

              <TabsContent value="accounts" className="mt-4">
                <BlurFade delay={0.3}>
                  <AccountsTab onAccountCreated={handleAccountCreated} />
                </BlurFade>
              </TabsContent>

              <TabsContent value="plan" className="mt-4">
                <BlurFade delay={0.3}>
                  <ContentPlanTab onPostScheduled={handlePostScheduled} />
                </BlurFade>
              </TabsContent>

              <TabsContent value="posts" className="mt-4">
                <BlurFade delay={0.3}>
                  <PostList />
                </BlurFade>
              </TabsContent>
            </Tabs>
          </BlurFade>
        </div>
      </PageShell>
    </DashboardPageWrapper>
  );
}
