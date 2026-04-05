# Agent Task Board

Last updated by: MASTER
Sprint goal: Chat page Round 2 — maximize message area, kill mobile bloat

---

## TASK-13 | AGENT:frontend | STATUS:PENDING
**Goal**: Remove bloat from ChatPage to maximize message area on mobile. Read src/dashboard/pages/ChatPage.tsx and all files in src/dashboard/pages/chat/. Make these changes:
(1) Hide the PageHeader ("AI Chat / Chat with your AI assistant") entirely on mobile — wrap it in `<div className="hidden md:block">`. It's redundant on mobile since the ChatHeader already shows the agent name.
(2) In ChatInput.tsx, find the keyboard shortcut hint ("Shift+Enter for new line · Alt+V for voice") and hide it on mobile: `<span className="hidden md:inline">...</span>`.
(3) In ChatInput.tsx, find the agent selector chips (Auto, Weebo, Edith, Jarvis, Aria). Replace the always-visible chip row with a single dropdown/select button on mobile. Use a button that shows the current agent name, and on click opens a small popover or bottom sheet with the agent options. On desktop, keep the chips visible.
(4) Update the main chat height calc to reclaim the space: change `h-[calc(100dvh-200px)]` to `h-[calc(100dvh-140px)]` on mobile since we're hiding the page header.
After changes: `npx tsc -b --noEmit` — zero errors.
**Files in scope**: src/dashboard/pages/ChatPage.tsx, src/dashboard/pages/chat/ChatInput.tsx, src/dashboard/pages/chat/ChatHeader.tsx
**Files OFF LIMITS**: server/*, DashboardApp.tsx, MobileTabBar.tsx
**Depends on**: NONE
**Done when**: On mobile 393px viewport, messages get ~70% of screen. No shortcut hints visible. Agent selector is compact.

## TASK-14 | AGENT:designer | STATUS:PENDING
**Goal**: Fix floating button overlap and reduce bottom bloat on the Chat page. Read src/dashboard/DashboardApp.tsx and src/dashboard/pages/ChatPage.tsx.
(1) In DashboardApp.tsx, find the floating AgentChatButton (`fixed bottom-24 md:bottom-8 right-4`) — HIDE it when currentPage is 'chat' since we're already on the chat page. Wrap it: `{currentPage !== 'chat' && <div className="fixed bottom-24..."><AgentChatButton .../></div>}`
(2) In DashboardApp.tsx, find the Mobile Quick Actions Button (`fixed bottom-24 left-4 md:hidden`) — also HIDE it on the chat page: `{currentPage !== 'chat' && ...}`
(3) In ChatInput.tsx or ChatPage.tsx, find any council mode toggle button at the bottom and make it smaller or move it inline with the send button instead of being a separate row.
After changes: `npx tsc -b --noEmit` — zero errors.
**Files in scope**: src/dashboard/DashboardApp.tsx, src/dashboard/pages/ChatPage.tsx, src/dashboard/pages/chat/ChatInput.tsx
**Files OFF LIMITS**: server/*, DashboardSidebar.tsx, MobileTabBar.tsx
**Depends on**: NONE
**Done when**: No floating buttons visible on chat page. Clean input area without overlap. Zero TS errors.

## TASK-15 | AGENT:coder | STATUS:PENDING  
**Goal**: Merge the ChatHeader agent info with the DashboardApp header on mobile to eliminate one layer. Read src/dashboard/pages/chat/ChatHeader.tsx and src/dashboard/pages/ChatPage.tsx.
(1) On mobile, the ChatHeader (agent name, voice toggle, clear) should BE the page header — not a separate bar below it. Move the agent avatar + name into the space where "AI Chat" title was (which TASK-13 hides on mobile). The ChatHeader should have `sticky top-0 z-20` on mobile so it stays visible while scrolling.
(2) Remove the conversation sidebar toggle button from the ChatHeader on mobile — the sidebar is now a drawer triggered by a hamburger in the DashboardApp header, not a separate toggle.
(3) Ensure the ChatHeader has proper glass styling: `backdrop-blur-xl` with `bg-[var(--ag-bg-base)]/80`.
After changes: `npx tsc -b --noEmit` — zero errors.
**Files in scope**: src/dashboard/pages/chat/ChatHeader.tsx, src/dashboard/pages/ChatPage.tsx
**Files OFF LIMITS**: server/*, DashboardApp.tsx (TASK-14 owns it), ChatInput.tsx (TASK-13 owns it)
**Depends on**: NONE
**Done when**: On mobile, only ONE header row with agent info. No duplicate navigation layers. Zero TS errors.
