# Agent Task Board

Last updated by: MASTER
Sprint goal: Chat page — Round 1 fixes (split component, mobile layout, test IDs)

---

## TASK-10 | AGENT:frontend | STATUS:PENDING
**Goal**: Split ChatPage.tsx (1648 lines) into smaller components. Extract these into separate files in src/dashboard/pages/chat/:
(1) ChatSidebar.tsx — the conversation sidebar (ConversationItem component + sidebar JSX, ~150 lines). Props: conversations, search, onPin, onDelete, onClear, isOpen, onClose.
(2) ChatHeader.tsx — the chat header bar with agent avatar, voice toggle, clear button, stream health. Props: agentName, personality, meta, isTyping, isStreamActive, streamHealth, voiceMode, onToggleVoice, onClear, sidebarOpen, onToggleSidebar, ttsIsSpeaking, onStopTTS.
(3) ChatEmptyState.tsx — the empty state with hero avatar, greeting, starter prompts, session continuity. Props: meta, timeContext, onStarterPrompt, onResume.
(4) ChatInput.tsx — the input form at the bottom with textarea, send button, voice button, mention popup, council toggle. Props: input, onInputChange, onSubmit, isTyping, voiceMode, voice, interimText, mentionPopup state, councilMode, mentionedAgent.
Keep ChatPage.tsx as the orchestrator that composes these 4 + the Virtuoso message list.
After splitting, run `npx tsc -b --noEmit` — MUST be zero errors including TS6133. The page must work IDENTICALLY to before.
**Files in scope**: src/dashboard/pages/ChatPage.tsx, src/dashboard/pages/chat/ (new dir)
**Files OFF LIMITS**: server/*, components/ChatMessageBubble.tsx, components/ToolStepIndicator.tsx
**Depends on**: NONE
**Done when**: ChatPage.tsx under 800 lines. 4 new files created. `npx tsc -b --noEmit` zero errors. `npx vite build` succeeds.

## TASK-11 | AGENT:designer | STATUS:PENDING
**Goal**: Fix Chat page mobile layout and design consistency. Read src/dashboard/pages/ChatPage.tsx (and any new chat/ subcomponents if TASK-10 runs first). Make these changes:
(1) Replace `h-[calc(100dvh-240px)] md:h-[calc(100vh-180px)]` with `h-[calc(100dvh-200px)] md:h-[calc(100vh-140px)]` — account for header (56px) + page header (~60px) + bottom tabs (80px) on mobile.
(2) Add `pb-20 md:pb-0` to the main chat container so bottom tab bar doesn't cover the input.
(3) Sidebar action buttons (pin/delete in ConversationItem): change `min-w-[24px] min-h-[24px]` to `min-w-[36px] min-h-[36px]` for better touch targets.
(4) Replace hardcoded colors in personalityMeta with CSS variables: `'#ADFF2F'` → `'var(--ag-lime)'`, `'#FF6B9D'` → `'var(--ag-pink)'`, `'#F59E0B'` → `'var(--ag-amber)'`, `'#10B981'` → `'var(--ag-green)'`, `'#6366F1'` → `'var(--ag-indigo)'`, `'#84CC16'` → `'var(--ag-lime)'`, `'#EC4899'` → `'var(--ag-nova)'`.
(5) Make conversation sidebar a mobile drawer: on mobile (md:hidden), it should be `fixed inset-0 z-50` with backdrop overlay, not inline push.
After changes run `npx tsc -b --noEmit` — zero errors.
**Files in scope**: src/dashboard/pages/ChatPage.tsx, src/dashboard/pages/chat/*.tsx (if they exist from TASK-10)
**Files OFF LIMITS**: server/*, DashboardApp.tsx, DashboardSidebar.tsx
**Depends on**: TASK-10 (but can start on ChatPage.tsx directly if TASK-10 isn't done yet)
**Done when**: Mobile chat usable — input visible above tab bar, sidebar is drawer overlay, 44px+ touch targets. `npx tsc -b --noEmit` zero errors.

## TASK-12 | AGENT:coder | STATUS:PENDING
**Goal**: Add data-testid attributes to ChatPage for E2E testing. Read the ChatPage.tsx (or the new split files if TASK-10 ran). Add these test IDs:
(1) `data-testid="chat-input"` on the textarea
(2) `data-testid="chat-send-button"` on the send button
(3) `data-testid="chat-message-list"` on the Virtuoso container or its wrapper div
(4) `data-testid="chat-sidebar-toggle"` on the sidebar open/close button
(5) `data-testid="chat-voice-toggle"` on the voice mode toggle
(6) `data-testid="chat-clear-button"` on the clear chat button
(7) `data-testid="chat-empty-state"` on the empty state container
(8) `data-testid="chat-agent-name"` on the agent name in the header
(9) `data-testid="chat-stream-health"` on the StreamHealthDot component wrapper
Also add `data-testid="chat-starter-prompt"` to each starter prompt button.
After changes run `npx tsc -b --noEmit` — zero errors.
**Files in scope**: src/dashboard/pages/ChatPage.tsx, src/dashboard/pages/chat/*.tsx (if they exist)
**Files OFF LIMITS**: server/*, test files (TASK-12 only adds IDs, doesn't write tests)
**Depends on**: TASK-10 (but can work on ChatPage.tsx directly)
**Done when**: `grep -c 'data-testid' src/dashboard/pages/ChatPage.tsx src/dashboard/pages/chat/*.tsx` shows 10+ test IDs. Zero TS errors.
