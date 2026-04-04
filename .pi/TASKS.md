# Agent Task Board

Last updated by: MASTER
Sprint goal: Fix 6 dashboard bugs — canvas, feed, inputs, URL, navigation, map fitting

---

## TASK-4 | AGENT:frontend | STATUS:PENDING
**Goal**: Fix 3 issues in DashboardApp.tsx and DashboardSidebar.tsx: (1) Remove `key={location.pathname}` from DashboardRouter — the setCurrentPage fix is sufficient, key causes full remount and state loss. (2) In DashboardSidebar.tsx, find the Home nav item that navigates to `/dashboard/office` and change it to `/dashboard`. Also check any other link that goes to `/dashboard/office` and change to `/dashboard`. (3) Verify the sidebar Home link `id` is `'office'` in the menuGroups but navigates to `/dashboard` not `/dashboard/office`.
**Files in scope**: src/dashboard/DashboardApp.tsx, src/dashboard/DashboardSidebar.tsx
**Files OFF LIMITS**: src/dashboard/pages/office/* (TASK-5 owns those)
**Depends on**: NONE
**Done when**: `npx tsc -b --noEmit` zero errors. No reference to `/dashboard/office` URL in any sidebar/tab navigation.

## TASK-5 | AGENT:designer | STATUS:PENDING
**Goal**: Fix 3 issues in OfficeHomePage.tsx: (1) Outer container: change `min-h-[calc(100dvh-64px)] md:min-h-dvh overflow-y-auto` to `min-h-[calc(100dvh-64px)] md:h-[calc(100dvh-64px)] overflow-y-auto md:overflow-hidden` — mobile scrolls, desktop uses fixed height so canvas h-full works. (2) The SmartSidebar wrapper (the flex-1 div that contains EnhancedSidebar) needs `overflow-y-auto` and `h-full` so the feed tab scrolls internally instead of stretching the page. Find the div wrapping EnhancedSidebar and add `overflow-y-auto`. (3) The main content flex row (canvas + sidebar) on desktop needs `flex-1 min-h-0` so children can use h-full properly — find the div with `flex flex-col md:flex-row flex-1` and ensure it has `min-h-0`.
**Files in scope**: src/dashboard/pages/office/OfficeHomePage.tsx
**Files OFF LIMITS**: DashboardApp.tsx (TASK-4), DashboardSidebar.tsx (TASK-4), SmartSidebar.tsx (TASK-6)
**Depends on**: NONE
**Done when**: `npx tsc -b --noEmit` zero errors. Desktop: canvas visible, fills 60% width. Mobile: page scrolls, canvas 30vh.

## TASK-6 | AGENT:coder | STATUS:PENDING
**Goal**: Fix duplicate inputs and SmartSidebar chat input. (1) Read src/dashboard/pages/office/SmartSidebar.tsx and find the bottom chat input ("Ask an agent..."). (2) Read src/dashboard/pages/office/OfficeHomePage.tsx and find the SuggestionStrip component — it also has a chat-like input. (3) Remove or hide the SmartSidebar bottom chat input — the SuggestionStrip at the bottom of OfficeHomePage handles chat. Set the SmartSidebar `hideInput` prop to true, OR find where it renders the input and wrap it in a condition, OR simply remove the input JSX from SmartSidebar if there's a hideInput prop already.
**Files in scope**: src/dashboard/pages/office/SmartSidebar.tsx, src/dashboard/pages/office/OfficeHomePage.tsx (READ ONLY — only to understand SuggestionStrip)
**Files OFF LIMITS**: DashboardApp.tsx, DashboardSidebar.tsx, DashboardRouter.tsx
**Depends on**: NONE
**Done when**: `npx tsc -b --noEmit` zero errors. Only ONE chat input visible on the Office page.
