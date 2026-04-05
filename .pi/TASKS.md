# Agent Task Board

Last updated by: MASTER
Sprint goal: Chat page — Final polish round, then move on

---

## TASK-19 | AGENT:frontend | STATUS:PENDING
**Goal**: Extract streaming logic from ChatPage.tsx into a useChatStream hook to get ChatPage under 600 lines.
Create src/hooks/useChatStream.ts that contains: sendMessage function, all streaming state (isTyping, isStreamActive, streamHealth, streamBuffer), the responseTimeout logic, reconnect logic, sync fallback, 401 redirect, and the mountedRef pattern.
Hook signature: `useChatStream({ personality, selectedAgent, mentionedAgent, onNotifyStart, onNotifyDone, onNotifyFail, connectSSE, disconnectSSE })`
Returns: `{ messages, setMessages, sendMessage, isTyping, isStreamActive, streamHealth, clearChat }`
Move ALL streaming code out of ChatPage.tsx into this hook. ChatPage becomes pure composition.
After: `npx tsc -b --noEmit` zero errors. ChatPage.tsx under 600 lines.
**Files in scope**: src/dashboard/pages/ChatPage.tsx, src/hooks/useChatStream.ts (new)
**Files OFF LIMITS**: src/dashboard/pages/chat/* (TASK-20 owns those), server/*

## TASK-20 | AGENT:designer | STATUS:PENDING
**Goal**: Final visual polish on Chat components using ui-ux-pro-max design intelligence. First run:
```bash
python3 .pi/skills/ui-ux-pro-max/scripts/search.py "AI chat messenger dark mode glassmorphism" --design-system
python3 .pi/skills/ui-ux-pro-max/scripts/search.py "chat animation loading states" --domain ux
```
Then apply recommendations to these files:
(1) ChatHeader.tsx — replace raw rgba glow shadows in personalityMeta with CSS variables or design-system-appropriate values
(2) ChatEmptyState.tsx — make starter prompts dynamic based on time of day (already has timeContext), ensure the empty state looks premium (glass card, proper spacing, agent avatar with glow)
(3) ChatMessageBubble.tsx — the code block syntax highlighting colors are hardcoded (bg-cyan-500/15 etc). Replace with design-token-based colors that work in both light and dark mode. Also ensure message bubbles have proper max-width (85% mobile, 70% desktop)
(4) ChatInput.tsx — ensure the input area has proper glass styling, the send button has the CTA gradient, and the agent selector dropdown looks polished
After: `npx tsc -b --noEmit` zero errors. No hardcoded hex colors.
**Files in scope**: src/dashboard/pages/chat/*.tsx, src/components/ChatMessageBubble.tsx
**Files OFF LIMITS**: ChatPage.tsx (TASK-19 owns it), server/*

## TASK-21 | AGENT:coder | STATUS:PENDING
**Goal**: Add basic markdown rendering to agent chat messages. Currently agent responses only handle code blocks (triple backtick). Add support for: **bold**, *italic*, [links](url), and bullet lists.
Read src/components/ChatMessageBubble.tsx. Find the `renderMessageContent` function. Enhance it to handle:
(1) **bold** → `<strong>`
(2) *italic* → `<em>`
(3) [text](url) → `<a href="url" target="_blank" rel="noopener">`  with violet color and underline
(4) `inline code` → `<code>` with monospace font and subtle bg
(5) Lines starting with `- ` or `* ` → `<li>` inside `<ul>`
Keep the existing code block (triple backtick) handling. Process markdown AFTER code blocks are extracted (so markdown inside code blocks is not processed).
After: `npx tsc -b --noEmit` zero errors. Test with a message containing all 5 markdown types.
**Files in scope**: src/components/ChatMessageBubble.tsx
**Files OFF LIMITS**: ChatPage.tsx, chat/*.tsx, server/*
