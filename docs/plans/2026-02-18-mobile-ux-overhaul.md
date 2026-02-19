# Mobile UX Overhaul — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform GeekSpace into a buttery-smooth, native-app-feel mobile experience across every flow — landing → login → onboarding → dashboard → portfolio — while keeping the dark futuristic aesthetic (dark theme, purple accents, Space Grotesk).

**Architecture:** Progressive enhancement approach — add mobile interaction primitives (swipe, pull-to-refresh, bottom sheets) as reusable hooks/components, then systematically apply them across all 18+ pages. No new dependencies except a lightweight gesture library. All changes are CSS/component-level — no backend changes needed.

**Tech Stack:** React 18, TailwindCSS, shadcn/ui, framer-motion (already likely available or add), react-swipeable (lightweight gesture hook), CSS `overscroll-behavior` + `touch-action` for native feel.

---

## Phase 1: Mobile Primitives & Foundation (Tasks 1–5)

These are the reusable building blocks that all subsequent pages will use.

---

### Task 1: Install gesture library + create mobile hooks

**Files:**
- Modify: `package.json` (root)
- Create: `src/hooks/useSwipeNavigation.ts`
- Create: `src/hooks/usePullToRefresh.ts`
- Create: `src/hooks/useMobileDetect.ts`

**Step 1: Install dependencies**

```bash
npm install react-swipeable framer-motion
```

Note: Check if framer-motion is already installed first (`grep framer package.json`). If so, skip it.

**Step 2: Create `useMobileDetect` hook**

```typescript
// src/hooks/useMobileDetect.ts
import { useState, useEffect } from 'react';

export function useMobileDetect() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return isMobile;
}
```

**Step 3: Create `usePullToRefresh` hook**

```typescript
// src/hooks/usePullToRefresh.ts
import { useRef, useState, useCallback } from 'react';

interface PullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number; // px to pull before triggering (default 80)
}

export function usePullToRefresh({ onRefresh, threshold = 80 }: PullToRefreshOptions) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      setPulling(true);
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling) return;
    const diff = e.touches[0].clientY - startY.current;
    if (diff > 0) {
      setPullDistance(Math.min(diff * 0.5, threshold * 1.5)); // dampen
    }
  }, [pulling, threshold]);

  const onTouchEnd = useCallback(async () => {
    if (pullDistance >= threshold && !refreshing) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
    setPulling(false);
    setPullDistance(0);
  }, [pullDistance, threshold, refreshing, onRefresh]);

  return {
    containerRef,
    pullDistance,
    refreshing,
    pullHandlers: { onTouchStart, onTouchMove, onTouchEnd },
  };
}
```

**Step 4: Create `useSwipeNavigation` hook**

```typescript
// src/hooks/useSwipeNavigation.ts
import { useSwipeable } from 'react-swipeable';
import { useNavigate } from 'react-router-dom';

const DASHBOARD_ROUTES = [
  '/dashboard',
  '/dashboard/portfolio',
  '/dashboard/terminal',
  '/dashboard/agent',
  '/dashboard/settings',
  '/dashboard/billing',
  '/dashboard/usage',
  '/dashboard/connections',
  '/dashboard/reminders',
  '/dashboard/automations',
  '/dashboard/fleet',
  '/dashboard/memory',
  '/dashboard/recipes',
  '/dashboard/health',
];

export function useSwipeNavigation(currentPath: string) {
  const navigate = useNavigate();
  const currentIndex = DASHBOARD_ROUTES.indexOf(currentPath);

  const handlers = useSwipeable({
    onSwipedLeft: () => {
      if (currentIndex < DASHBOARD_ROUTES.length - 1) {
        navigate(DASHBOARD_ROUTES[currentIndex + 1]);
      }
    },
    onSwipedRight: () => {
      if (currentIndex > 0) {
        navigate(DASHBOARD_ROUTES[currentIndex - 1]);
      }
    },
    trackMouse: false,
    delta: 50,
    preventScrollOnSwipe: false,
  });

  return handlers;
}
```

**Step 5: Run `npx vite build` to verify no import errors**

Expected: Clean build.

**Step 6: Commit**

```bash
git add src/hooks/useMobileDetect.ts src/hooks/usePullToRefresh.ts src/hooks/useSwipeNavigation.ts package.json package-lock.json
git commit -m "feat: add mobile gesture hooks (swipe nav, pull-to-refresh, mobile detect)"
```

---

### Task 2: Create BottomSheet component

Replace center-screen dialogs with iOS-style bottom sheets on mobile.

**Files:**
- Create: `src/components/ui/bottom-sheet.tsx`
- Modify: `src/index.css` (add bottom-sheet animations)

**Step 1: Create `bottom-sheet.tsx`**

```tsx
// src/components/ui/bottom-sheet.tsx
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useMobileDetect } from '@/hooks/useMobileDetect';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  snapPoints?: number[]; // percentage heights, e.g. [40, 75, 95]
}

export function BottomSheet({ open, onClose, children, title, snapPoints = [50, 90] }: BottomSheetProps) {
  const isMobile = useMobileDetect();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(snapPoints[0]);
  const startY = useRef(0);
  const startHeight = useRef(0);

  // On mobile: bottom sheet. On desktop: fall through to regular dialog.
  // This component only renders the mobile version.
  // Wrap your dialog usage: isMobile ? <BottomSheet> : <Dialog>

  useEffect(() => {
    if (open) {
      setHeight(snapPoints[0]);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open, snapPoints]);

  if (!open) return null;

  const handleDragStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    startHeight.current = height;
  };

  const handleDrag = (e: React.TouchEvent) => {
    const diff = startY.current - e.touches[0].clientY;
    const newHeight = startHeight.current + (diff / window.innerHeight) * 100;
    setHeight(Math.max(20, Math.min(95, newHeight)));
  };

  const handleDragEnd = () => {
    // Snap to nearest snap point or close
    if (height < 25) {
      onClose();
      return;
    }
    const nearest = snapPoints.reduce((prev, curr) =>
      Math.abs(curr - height) < Math.abs(prev - height) ? curr : prev
    );
    setHeight(nearest);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border rounded-t-2xl transition-[height] duration-200 ease-out flex flex-col safe-area-pb"
        style={{ height: `${height}vh` }}
      >
        {/* Drag handle */}
        <div
          className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing"
          onTouchStart={handleDragStart}
          onTouchMove={handleDrag}
          onTouchEnd={handleDragEnd}
        >
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>
        {title && (
          <div className="px-4 pb-3 border-b border-border">
            <h3 className="text-lg font-semibold font-heading">{title}</h3>
          </div>
        )}
        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {children}
        </div>
      </div>
    </>
  );
}
```

**Step 2: Add animation CSS to `index.css`**

Add after existing animation keyframes:

```css
/* Bottom sheet entrance */
@keyframes sheet-slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.animate-sheet-up {
  animation: sheet-slide-up 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}
```

**Step 3: Verify build**

Run: `npx vite build`
Expected: Clean build.

**Step 4: Commit**

```bash
git add src/components/ui/bottom-sheet.tsx src/index.css
git commit -m "feat: add BottomSheet component for native-feel mobile dialogs"
```

---

### Task 3: Create PullToRefreshWrapper component

A reusable wrapper that adds pull-to-refresh to any page.

**Files:**
- Create: `src/components/PullToRefreshWrapper.tsx`

**Step 1: Create the component**

```tsx
// src/components/PullToRefreshWrapper.tsx
import { type ReactNode } from 'react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useMobileDetect } from '@/hooks/useMobileDetect';
import { Loader2 } from 'lucide-react';

interface Props {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  className?: string;
}

export function PullToRefreshWrapper({ onRefresh, children, className = '' }: Props) {
  const isMobile = useMobileDetect();
  const { containerRef, pullDistance, refreshing, pullHandlers } = usePullToRefresh({ onRefresh });

  if (!isMobile) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      ref={containerRef}
      className={`relative overflow-y-auto ${className}`}
      {...pullHandlers}
    >
      {/* Pull indicator */}
      {(pullDistance > 0 || refreshing) && (
        <div
          className="flex items-center justify-center transition-all duration-150"
          style={{ height: refreshing ? 48 : pullDistance, opacity: Math.min(1, pullDistance / 60) }}
        >
          <Loader2
            className={`w-5 h-5 text-primary ${refreshing ? 'animate-spin' : ''}`}
            style={{ transform: `rotate(${pullDistance * 3}deg)` }}
          />
        </div>
      )}
      {children}
    </div>
  );
}
```

**Step 2: Verify build**

Run: `npx vite build`
Expected: Clean build.

**Step 3: Commit**

```bash
git add src/components/PullToRefreshWrapper.tsx
git commit -m "feat: add PullToRefreshWrapper component"
```

---

### Task 4: Create MobileTable component (card-based table for mobile)

Replace horizontal-scroll tables with stacked cards on mobile.

**Files:**
- Create: `src/components/ui/mobile-table.tsx`

**Step 1: Create `mobile-table.tsx`**

```tsx
// src/components/ui/mobile-table.tsx
import { useMobileDetect } from '@/hooks/useMobileDetect';
import { type ReactNode } from 'react';

interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  /** Show as the card's primary (bold, larger) field on mobile */
  primary?: boolean;
  /** Hide this column on mobile card view */
  hideOnMobile?: boolean;
}

interface MobileTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  emptyMessage?: string;
}

export function MobileTable<T>({ columns, data, keyExtractor, emptyMessage = 'No data' }: MobileTableProps<T>) {
  const isMobile = useMobileDetect();

  if (data.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">{emptyMessage}</div>
    );
  }

  // Mobile: card layout
  if (isMobile) {
    const visibleCols = columns.filter(c => !c.hideOnMobile);
    const primaryCol = visibleCols.find(c => c.primary) || visibleCols[0];
    const secondaryCols = visibleCols.filter(c => c !== primaryCol);

    return (
      <div className="space-y-3">
        {data.map(row => (
          <div key={keyExtractor(row)} className="bg-card border border-border rounded-xl p-4 space-y-2">
            <div className="font-medium text-sm">{primaryCol.render(row)}</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {secondaryCols.map(col => (
                <div key={col.key}>
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider">{col.label}</span>
                  <div className="text-sm">{col.render(row)}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Desktop: regular table
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            {columns.map(col => (
              <th key={col.key} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr key={keyExtractor(row)} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
              {columns.map(col => (
                <td key={col.key} className="px-4 py-3">{col.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `npx vite build`
Expected: Clean build.

**Step 3: Commit**

```bash
git add src/components/ui/mobile-table.tsx
git commit -m "feat: add MobileTable component (card layout on mobile, table on desktop)"
```

---

### Task 5: Add global mobile CSS polish + page transition animations

**Files:**
- Modify: `src/index.css`
- Modify: `index.html` (add apple meta tags)

**Step 1: Add mobile-first CSS utilities to `index.css`**

Add after existing safe-area utilities:

```css
/* ---- Mobile UX Polish ---- */

/* Prevent rubber-band overscroll on iOS */
html, body {
  overscroll-behavior: none;
  -webkit-overflow-scrolling: touch;
}

/* Smooth page transitions */
@keyframes page-enter {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-page-enter {
  animation: page-enter 0.25s ease-out;
}

/* Mobile touch feedback */
.touch-highlight {
  -webkit-tap-highlight-color: rgba(123, 97, 255, 0.1);
}

/* Font heading utility (Space Grotesk) */
.font-heading {
  font-family: 'Space Grotesk', sans-serif;
}

/* Bottom sheet drag handle pulse */
@keyframes handle-pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.6; }
}
.animate-handle-pulse {
  animation: handle-pulse 2s ease-in-out infinite;
}

/* Mobile card press effect */
.press-scale {
  transition: transform 0.1s ease;
}
.press-scale:active {
  transform: scale(0.97);
}
```

**Step 2: Add apple PWA meta tags to `index.html`**

Add after existing meta tags:

```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="format-detection" content="telephone=no" />
```

**Step 3: Verify build**

Run: `npx vite build`
Expected: Clean build.

**Step 4: Commit**

```bash
git add src/index.css index.html
git commit -m "feat: add mobile CSS polish, page transitions, apple PWA meta tags"
```

---

## Phase 2: Dashboard Shell & Navigation (Tasks 6–8)

Make the core navigation silky smooth on mobile.

---

### Task 6: Upgrade DashboardApp mobile shell

Smooth out the sidebar drawer, add swipe navigation, page transitions, and polish the bottom tab bar.

**Files:**
- Modify: `src/dashboard/DashboardApp.tsx`

**Step 1: Read the current file**

Read `src/dashboard/DashboardApp.tsx` to understand exact structure.

**Step 2: Add swipe navigation to the main content area**

Import `useSwipeNavigation` and wrap the main `<Outlet>` or content area with the swipe handlers:

```tsx
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import { useLocation } from 'react-router-dom';

// Inside the component:
const location = useLocation();
const swipeHandlers = useSwipeNavigation(location.pathname);

// Wrap the main content:
<main {...swipeHandlers} className="flex-1 overflow-y-auto animate-page-enter">
  {/* page content */}
</main>
```

**Step 3: Add page transition animation**

Add `animate-page-enter` class to the content wrapper and use `key={location.pathname}` to re-trigger animation on navigation:

```tsx
<div key={location.pathname} className="animate-page-enter">
  {/* Outlet or page render */}
</div>
```

**Step 4: Polish bottom tab bar**

- Add `backdrop-blur-xl bg-background/80` for frosted glass effect
- Add `touch-highlight press-scale` to each tab button
- Add subtle active indicator (purple dot or bar under active tab)
- Ensure `safe-area-pb` is applied

**Step 5: Improve sidebar drawer**

- Reduce width from `w-72` (288px) to `w-64` (256px) for small phones
- Add `backdrop-blur-xl` to the drawer backdrop
- Add swipe-to-close on the drawer (swipe left to dismiss)

**Step 6: Verify build**

Run: `npx vite build`
Expected: Clean build.

**Step 7: Commit**

```bash
git add src/dashboard/DashboardApp.tsx
git commit -m "feat: upgrade dashboard shell — swipe nav, page transitions, frosted tab bar"
```

---

### Task 7: Upgrade AgentChatPanel for mobile

The chat panel is the most-used interaction. Make it feel native.

**Files:**
- Modify: `src/components/AgentChatPanel.tsx`

**Step 1: Read the current file**

Read `src/components/AgentChatPanel.tsx` thoroughly.

**Step 2: Mobile-specific improvements**

- Make the panel full-screen on mobile (`fixed inset-0 z-50` when open on mobile)
- Add `safe-area-pt` to the header and `safe-area-pb` to the input area
- Add swipe-down-to-close gesture (swipe down on the header to dismiss)
- Use `backdrop-blur-xl` on the panel background
- Add message bubble animations (slide up from bottom for new messages)
- Make the input area sticky at the bottom with proper keyboard handling
- Add haptic-style feedback on send (subtle scale animation on send button)

**Step 3: Polish message bubbles**

- User messages: right-aligned, purple accent background
- Agent messages: left-aligned, card background
- Add subtle entry animation for each new message
- Ensure code blocks are scrollable horizontally on mobile

**Step 4: Verify build**

Run: `npx vite build`
Expected: Clean build.

**Step 5: Commit**

```bash
git add src/components/AgentChatPanel.tsx
git commit -m "feat: upgrade chat panel for mobile — full-screen, gestures, message animations"
```

---

### Task 8: Upgrade Landing Page + Login for mobile

First impression matters. Make landing → login flow gorgeous.

**Files:**
- Modify: `src/landing/LandingPage.tsx`
- Modify: `src/landing/sections/HeroSection.tsx`
- Modify: `src/onboarding/LoginPage.tsx`

**Step 1: Read current landing/login files**

Read `LandingPage.tsx`, `HeroSection.tsx`, and `LoginPage.tsx`.

**Step 2: Polish HeroSection for mobile**

- Ensure hero text scales properly (`text-4xl md:text-6xl`)
- CTA buttons stack vertically on mobile (`flex-col sm:flex-row`)
- Reduce padding on mobile (`px-4` instead of `px-8`)
- Add subtle scroll-triggered fade-in animations to sections

**Step 3: Polish LoginPage for mobile**

- Center the form vertically on mobile
- Make form full-width with `max-w-sm mx-auto`
- Add `autofocus` to email field
- Ensure keyboard doesn't cover inputs (scroll into view on focus)
- Add smooth transitions between login/signup toggle

**Step 4: Verify build**

Run: `npx vite build`
Expected: Clean build.

**Step 5: Commit**

```bash
git add src/landing/LandingPage.tsx src/landing/sections/HeroSection.tsx src/onboarding/LoginPage.tsx
git commit -m "feat: polish landing page and login for mobile"
```

---

## Phase 3: Dashboard Pages — Core Experience (Tasks 9–14)

---

### Task 9: Upgrade OverviewPage for mobile

**Files:**
- Modify: `src/dashboard/pages/OverviewPage.tsx`

**Step 1: Read current file**

**Step 2: Wrap with PullToRefreshWrapper**

```tsx
<PullToRefreshWrapper onRefresh={async () => { /* refetch stats */ }}>
  {/* page content */}
</PullToRefreshWrapper>
```

**Step 3: Mobile layout improvements**

- Stat cards: `grid-cols-2` on mobile with compact text, `gap-3` instead of `gap-4`
- Charts: Add `min-h-[200px]` to prevent squishing, reduce margins
- Reminders section: Stack into a scrollable horizontal list on mobile
- Integration grid: `grid-cols-2` with smaller cards on mobile
- Latest briefing: Full-width card with proper text truncation

**Step 4: Add press-scale to interactive cards**

Add `press-scale touch-highlight` to stat cards and integration cards.

**Step 5: Verify build and commit**

```bash
git add src/dashboard/pages/OverviewPage.tsx
git commit -m "feat: upgrade OverviewPage mobile UX — pull-to-refresh, compact grids, press feedback"
```

---

### Task 10: Upgrade BillingPage for mobile

The billing page has the most complex mobile layout issues (5-column plan grid, usage table).

**Files:**
- Modify: `src/dashboard/pages/BillingPage.tsx`

**Step 1: Read current file**

**Step 2: Replace plan grid with horizontal scroll cards**

On mobile, replace the grid with a horizontally scrollable card strip:

```tsx
{/* Mobile: horizontal scroll */}
<div className="flex md:hidden gap-3 overflow-x-auto pb-4 snap-x snap-mandatory -mx-4 px-4">
  {plans.map(plan => (
    <div key={plan.id} className="min-w-[260px] snap-center flex-shrink-0">
      {/* plan card content */}
    </div>
  ))}
</div>
{/* Desktop: grid */}
<div className="hidden md:grid grid-cols-3 xl:grid-cols-5 gap-4">
  {/* existing plan grid */}
</div>
```

**Step 3: Replace usage table with MobileTable**

Import `MobileTable` and define columns:

```tsx
const usageColumns = [
  { key: 'date', label: 'Date', primary: true, render: (r) => r.date },
  { key: 'requests', label: 'Requests', render: (r) => r.requests },
  { key: 'tokens', label: 'Tokens', render: (r) => formatNumber(r.totalTokens) },
  { key: 'cost', label: 'Cost', render: (r) => `$${r.totalCost.toFixed(4)}` },
  { key: 'models', label: 'Models', hideOnMobile: true, render: (r) => r.modelCount },
];
```

**Step 4: Polish credit progress bar**

- Make the progress bar taller on mobile (`h-3` instead of `h-2`)
- Add percentage label inside or below the bar
- Use gradient fill (purple → accent)

**Step 5: Verify build and commit**

```bash
git add src/dashboard/pages/BillingPage.tsx
git commit -m "feat: upgrade BillingPage mobile — scroll plans, card-based usage table"
```

---

### Task 11: Upgrade UsageAnalyticsPage for mobile

**Files:**
- Modify: `src/dashboard/pages/UsageAnalyticsPage.tsx`

**Step 1: Read current file**

**Step 2: Wrap with PullToRefreshWrapper**

**Step 3: Mobile improvements**

- KPI cards: Keep `grid-cols-2` but make more compact (smaller text, tighter padding)
- Range selector: Make it full-width horizontally scrollable on mobile
- Charts: Ensure `ResponsiveContainer` has adequate `min-h-[180px]`
- Provider pie chart: Show legend below chart on mobile (not beside it)
- Events table: Replace with `MobileTable` component

**Step 4: Verify build and commit**

```bash
git add src/dashboard/pages/UsageAnalyticsPage.tsx
git commit -m "feat: upgrade UsageAnalyticsPage mobile — card tables, compact charts, pull-to-refresh"
```

---

### Task 12: Upgrade SettingsPage for mobile

**Files:**
- Modify: `src/dashboard/pages/SettingsPage.tsx`

**Step 1: Read current file**

**Step 2: Mobile tab navigation**

Replace tabs with a vertically stacked accordion on mobile:

```tsx
{isMobile ? (
  <div className="space-y-2">
    {tabs.map(tab => (
      <details key={tab.id} className="bg-card border border-border rounded-xl overflow-hidden" open={activeTab === tab.id}>
        <summary
          className="px-4 py-3 font-medium cursor-pointer flex items-center gap-2"
          onClick={() => setActiveTab(tab.id)}
        >
          {tab.icon} {tab.label}
        </summary>
        <div className="px-4 pb-4">{tab.content}</div>
      </details>
    ))}
  </div>
) : (
  /* existing Tabs component */
)}
```

**Step 3: Form field improvements**

- Stack label + input vertically on mobile (remove grid-cols-2 for form fields)
- Add proper spacing between form groups
- Theme color picker: make circles larger on mobile (touch targets)
- API key list: card layout on mobile instead of table

**Step 4: Verify build and commit**

```bash
git add src/dashboard/pages/SettingsPage.tsx
git commit -m "feat: upgrade SettingsPage mobile — accordion tabs, stacked forms, larger touch targets"
```

---

### Task 13: Upgrade PicoFleetPage for mobile

**Files:**
- Modify: `src/dashboard/pages/PicoFleetPage.tsx`

**Step 1: Read current file**

**Step 2: Mobile improvements**

- Agent cards: Keep `grid-cols-1` on mobile, add personality emoji larger display
- Task list: Collapsible cards with expand/collapse animation
- Create agent dialog: Use `BottomSheet` on mobile
- Task input area: Sticky at bottom on mobile with proper keyboard handling
- Stats grid: `grid-cols-2` compact layout

**Step 3: Add pull-to-refresh**

Wrap with `PullToRefreshWrapper` to refresh task list.

**Step 4: Add press-scale to agent cards**

**Step 5: Verify build and commit**

```bash
git add src/dashboard/pages/PicoFleetPage.tsx
git commit -m "feat: upgrade PicoFleetPage mobile — bottom sheet, collapsible tasks, pull-to-refresh"
```

---

### Task 14: Upgrade ConnectionsPage for mobile

**Files:**
- Modify: `src/dashboard/pages/ConnectionsPage.tsx`

**Step 1: Read current file**

**Step 2: Mobile improvements**

- Integration cards: Full-width cards on mobile with larger connect/disconnect buttons
- Telegram link flow: Use `BottomSheet` for the deep-link dialog on mobile
- Email setup: Use `BottomSheet` for the email address dialog
- Status summary: Compact horizontal layout on mobile
- Health badges: Larger on mobile for touch

**Step 3: Verify build and commit**

```bash
git add src/dashboard/pages/ConnectionsPage.tsx
git commit -m "feat: upgrade ConnectionsPage mobile — bottom sheet dialogs, larger touch targets"
```

---

## Phase 4: Remaining Pages (Tasks 15–20)

---

### Task 15: Upgrade RemindersPage for mobile

**Files:**
- Modify: `src/dashboard/pages/RemindersPage.tsx`

**Step 1: Read current file**

**Step 2: Mobile improvements**

- Calendar view: Stack days vertically on mobile (1 column) instead of 7-column grid
- Or: show a scrollable horizontal day strip instead of full calendar
- Add reminder dialog: Use `BottomSheet` on mobile
- List view: Full-width cards with swipe-to-complete gesture (stretch goal)
- Filter tabs: Horizontally scrollable pill strip

**Step 3: Verify build and commit**

```bash
git add src/dashboard/pages/RemindersPage.tsx
git commit -m "feat: upgrade RemindersPage mobile — bottom sheet, compact calendar, scrollable filters"
```

---

### Task 16: Upgrade AutomationsPage for mobile

**Files:**
- Modify: `src/dashboard/pages/AutomationsPage.tsx`

**Step 1: Read current file**

**Step 2: Mobile improvements**

- Create automation dialog: Use `BottomSheet` on mobile
- Automation cards: Full-width, show trigger/action as icon badges
- KPI stats: `grid-cols-2` compact
- Action buttons: Larger touch targets, icon-only on mobile

**Step 3: Verify build and commit**

```bash
git add src/dashboard/pages/AutomationsPage.tsx
git commit -m "feat: upgrade AutomationsPage mobile — bottom sheet, compact cards"
```

---

### Task 17: Upgrade MemoryManagerPage for mobile

**Files:**
- Modify: `src/dashboard/pages/MemoryManagerPage.tsx`

**Step 1: Read current file**

**Step 2: Mobile improvements**

- Memory cards: Full-width with larger text for key/value
- Edit/create dialog: Use `BottomSheet` on mobile
- Category filter: Horizontal scrollable pill strip
- Sort dropdown: Larger touch target
- Conversation tab: Chat-bubble style layout (messages alternate sides)
- Search: Sticky at top

**Step 3: Verify build and commit**

```bash
git add src/dashboard/pages/MemoryManagerPage.tsx
git commit -m "feat: upgrade MemoryManagerPage mobile — bottom sheet, sticky search, pill filters"
```

---

### Task 18: Upgrade PortfolioPage (editor) for mobile

**Files:**
- Modify: `src/dashboard/pages/PortfolioPage.tsx`

**Step 1: Read current file**

**Step 2: Mobile improvements**

- Section tabs: Horizontal scrollable strip
- Skills: Tag input with mobile-friendly chip removal
- Projects: Card-based list with expand/collapse for edit
- Milestones: Vertical timeline with compact cards
- AI edit prompt: Sticky input at bottom on mobile
- Preview button: Float as FAB (floating action button)

**Step 3: Verify build and commit**

```bash
git add src/dashboard/pages/PortfolioPage.tsx
git commit -m "feat: upgrade PortfolioPage editor mobile — scrollable tabs, compact sections"
```

---

### Task 19: Upgrade HealthDashboardPage for mobile

**Files:**
- Modify: `src/dashboard/pages/HealthDashboardPage.tsx`

**Step 1: Read current file**

**Step 2: Mobile improvements**

- Component status: `grid-cols-2` compact cards with color-coded borders
- Metrics: `grid-cols-2` with larger numbers
- Endpoints table: Replace with `MobileTable`
- SSE connection indicator: Compact badge in header

**Step 3: Verify build and commit**

```bash
git add src/dashboard/pages/HealthDashboardPage.tsx
git commit -m "feat: upgrade HealthDashboardPage mobile — card tables, compact status grid"
```

---

### Task 20: Upgrade Portfolio public view + Explore page for mobile

**Files:**
- Modify: `src/portfolio/PortfolioView.tsx`
- Modify: `src/explore/ExplorePage.tsx`

**Step 1: Read current files**

**Step 2: PortfolioView mobile improvements**

- Hero section: Full-width avatar, stacked name/headline
- Skills: Horizontal scrollable chip row
- Projects: Full-width cards with press-scale
- Agent chat: Full-screen bottom sheet on mobile
- Social links: Icon-only row on mobile

**Step 3: ExplorePage mobile improvements**

- Directory cards: Full-width stacked on mobile
- Search: Sticky at top
- Tags: Horizontal scrollable filter strip

**Step 4: Verify build and commit**

```bash
git add src/portfolio/PortfolioView.tsx src/explore/ExplorePage.tsx
git commit -m "feat: upgrade Portfolio view and Explore page for mobile"
```

---

## Phase 5: Final Polish (Tasks 21–22)

---

### Task 21: Upgrade OnboardingPage for mobile

**Files:**
- Modify: `src/onboarding/OnboardingPage.tsx`
- Modify: `src/onboarding/steps/*.tsx` (all step files)

**Step 1: Read current files**

**Step 2: Mobile improvements**

- Step indicator: Compact dot-style progress at top
- Step content: Full-width, centered, generous padding
- Step transitions: Slide-left/right animation between steps
- Buttons: Full-width CTA at bottom, large touch targets
- Skip button: Top-right, clear but not dominant

**Step 3: Verify build and commit**

```bash
git add src/onboarding/OnboardingPage.tsx src/onboarding/steps/
git commit -m "feat: upgrade OnboardingPage mobile — step animations, compact progress, full-width CTAs"
```

---

### Task 22: Full mobile QA pass + final frontend deploy

**Step 1: Build frontend**

```bash
npx vite build
```
Expected: Clean build, no TypeScript errors.

**Step 2: Deploy frontend**

```bash
cp -r dist/* /var/www/geekspace/
```

**Step 3: Test on mobile dimensions (375px, 390px, 414px widths)**

Use Puppeteer or Chrome DevTools to screenshot every page at 390px width:

Pages to test:
1. Landing page (`/`)
2. Login page (`/login`)
3. Dashboard overview (`/dashboard`)
4. Portfolio editor (`/dashboard/portfolio`)
5. Billing (`/dashboard/billing`)
6. Usage (`/dashboard/usage`)
7. Settings (`/dashboard/settings`)
8. Connections (`/dashboard/connections`)
9. Reminders (`/dashboard/reminders`)
10. Automations (`/dashboard/automations`)
11. Fleet (`/dashboard/fleet`)
12. Memory (`/dashboard/memory`)
13. Recipes (`/dashboard/recipes`)
14. Health (`/dashboard/health`)
15. Terminal (`/dashboard/terminal`)
16. Agent settings (`/dashboard/agent`)
17. Public portfolio (`/username`)
18. Explore (`/explore`)

**Step 4: Fix any visual issues found**

**Step 5: Final commit and push**

```bash
git add -A
git commit -m "feat: complete mobile UX overhaul — all pages optimized for mobile"
git push origin live-production
```

---

## Summary

| Phase | Tasks | Focus |
|-------|-------|-------|
| 1 | 1–5 | Mobile primitives: hooks, BottomSheet, PullToRefresh, MobileTable, CSS |
| 2 | 6–8 | Dashboard shell, chat panel, landing/login |
| 3 | 9–14 | Core dashboard pages (Overview, Billing, Usage, Settings, Fleet, Connections) |
| 4 | 15–20 | Remaining pages (Reminders, Automations, Memory, Portfolio, Health, Explore) |
| 5 | 21–22 | Onboarding + full QA pass |

**Total: 22 tasks, ~14 files created, ~18 files modified, 0 backend changes.**
