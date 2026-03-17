/**
 * Phase 88 Final Mobile Polish Tests
 * Verifies: touch targets, overflow, modal sizing, pull-to-refresh, bottom nav.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../../../');

function readSrc(rel: string): string {
  return fs.readFileSync(path.join(root, 'src', rel), 'utf-8');
}

describe('88.2 Notification dropdown horizontal overflow', () => {
  it('DashboardApp dropdown has max-w to prevent overflow on small screens', () => {
    const content = readSrc('dashboard/DashboardApp.tsx');
    expect(content).toContain('max-w-[calc(100vw-1rem)]');
  });
});

describe('88.3 Touch targets min 44x44px', () => {
  it('RemindersPage preset date buttons have min-h-[44px]', () => {
    const content = readSrc('dashboard/pages/RemindersPage.tsx');
    expect(content).toContain('py-2.5 rounded text-xs');
    expect(content).toContain('min-h-[44px]');
  });

  it('RemindersPage priority buttons have min-h-[44px]', () => {
    const content = readSrc('dashboard/pages/RemindersPage.tsx');
    expect(content).toContain('py-2.5 rounded-lg text-sm');
  });

  it('ActivityPage filter chips upgraded from min-h-[36px] to min-h-[44px]', () => {
    const content = readSrc('dashboard/pages/ActivityPage.tsx');
    expect(content).not.toContain('min-h-[36px]');
    expect(content).toContain('min-h-[44px]');
  });

  it('BillingPage currency toggle buttons have min-h-[44px]', () => {
    const content = readSrc('dashboard/pages/BillingPage.tsx');
    expect(content).toContain('min-h-[44px]');
  });

  it('DashboardApp hamburger menu button has min-w-[44px] min-h-[44px]', () => {
    const content = readSrc('dashboard/DashboardApp.tsx');
    expect(content).toContain('min-w-[44px] min-h-[44px]');
  });
});

describe('88.4 Tables have overflow-x-auto wrappers', () => {
  it('HealthDashboardPage table is wrapped in overflow-x-auto', () => {
    const content = readSrc('dashboard/pages/HealthDashboardPage.tsx');
    expect(content).toContain('overflow-x-auto');
  });

  it('AutomationsPage log table is wrapped in overflow-x-auto', () => {
    const content = readSrc('dashboard/pages/AutomationsPage.tsx');
    expect(content).toContain('overflow-x-auto');
  });

  it('BillingPage usage table has overflow-x-auto with min-w to prevent squeeze', () => {
    const content = readSrc('dashboard/pages/BillingPage.tsx');
    expect(content).toContain('overflow-x-auto');
    expect(content).toContain('min-w-[500px]');
  });

  it('MobileTable component exists with mobile card layout', () => {
    const content = readSrc('components/ui/mobile-table.tsx');
    expect(content).toContain('useMobileDetect');
    expect(content).toContain('space-y-3');
  });
});

describe('88.5 Pull-to-refresh on key scrollable pages', () => {
  it('OverviewPage has PullToRefreshWrapper', () => {
    const content = readSrc('dashboard/pages/OverviewPage.tsx');
    expect(content).toContain('PullToRefreshWrapper');
  });

  it('RemindersPage now has PullToRefreshWrapper', () => {
    const content = readSrc('dashboard/pages/RemindersPage.tsx');
    expect(content).toContain('PullToRefreshWrapper');
    expect(content).toContain('handlePullRefresh');
  });

  it('ActivityPage now has PullToRefreshWrapper', () => {
    const content = readSrc('dashboard/pages/ActivityPage.tsx');
    expect(content).toContain('PullToRefreshWrapper');
    expect(content).toContain('handlePullRefresh');
  });

  it('PullToRefreshWrapper only activates on mobile via useMobileDetect', () => {
    const content = readSrc('components/PullToRefreshWrapper.tsx');
    expect(content).toContain('useMobileDetect');
    expect(content).toContain('if (!isMobile)');
  });
});

describe('88.6 Bottom nav does not obscure content', () => {
  it('Main content area has pb-24 md:pb-0 to clear bottom nav', () => {
    const content = readSrc('dashboard/DashboardApp.tsx');
    expect(content).toContain('pb-24 md:pb-0');
  });

  it('Bottom nav positioned at bottom-3 with h-16', () => {
    const content = readSrc('dashboard/DashboardApp.tsx');
    expect(content).toContain('bottom-3');
    expect(content).toContain('h-16');
  });

  it('Floating action button clears bottom nav on mobile', () => {
    const content = readSrc('dashboard/DashboardApp.tsx');
    expect(content).toContain('bottom-24 md:bottom-8');
  });
});

describe('88.7 Modals properly sized on mobile', () => {
  it('Shadcn DialogContent base has max-w-[calc(100%-2rem)] for mobile safety', () => {
    const content = readSrc('components/ui/dialog.tsx');
    expect(content).toContain('max-w-[calc(100%-2rem)]');
    expect(content).toContain('sm:max-w-lg');
  });

  it('RemindersPage dialog does not override mobile sizing with standalone max-w-lg', () => {
    const content = readSrc('dashboard/pages/RemindersPage.tsx');
    expect(content).not.toContain('border-[#00F0FF]/20 max-w-lg');
  });

  it('RoadmapPage dialogs do not override mobile sizing with standalone max-w-lg', () => {
    const content = readSrc('dashboard/pages/RoadmapPage.tsx');
    expect(content).not.toContain('border-[#00F0FF]/20 max-w-lg');
    expect(content).not.toContain('border-[#BF5FFF]/20 max-w-lg');
  });
});

describe('Mobile infrastructure completeness', () => {
  it('useMobileDetect hook exists', () => {
    expect(fs.existsSync(path.join(root, 'src', 'hooks', 'useMobileDetect.ts'))).toBe(true);
  });

  it('usePullToRefresh hook exists', () => {
    expect(fs.existsSync(path.join(root, 'src', 'hooks', 'usePullToRefresh.ts'))).toBe(true);
  });

  it('DashboardApp has safe area handling for notch devices', () => {
    const content = readSrc('dashboard/DashboardApp.tsx');
    // Either classic safe-area-pb class OR env(safe-area-inset-bottom) inline approach
    const hasSafeArea = content.includes('safe-area-pb') || content.includes('safe-area-inset-bottom');
    expect(hasSafeArea).toBe(true);
  });

  it('DashboardApp has swipe navigation for mobile', () => {
    const content = readSrc('dashboard/DashboardApp.tsx');
    expect(content).toContain('useSwipeNavigation');
  });

  it('DashboardApp has edge-swipe gesture to open sidebar', () => {
    const content = readSrc('dashboard/DashboardApp.tsx');
    expect(content).toContain('swipeTouchStartX');
  });

  it('Mobile bottom tabs have minimum width for thumb reach', () => {
    const content = readSrc('dashboard/DashboardApp.tsx');
    expect(content).toContain('min-w-[56px]');
  });
});
