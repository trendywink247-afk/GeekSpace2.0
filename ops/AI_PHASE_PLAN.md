# Phase 8 Plan — GeekSpace 2.0

> Branch: `ai/phase-20260225-chat-retry-usage-export`
> Worktree: `.worktrees/phase-8`
> Baseline: 154/154 tests passing

## Items

### 8.1 — Chat error recovery + retry button ✅
**Problem:** When an agent response fails, the user has no way to retry without retyping the message.
**Fix:** Added `retryContent?: string` field to `ChatMessage` interface. When a send fails,
the error message stores the original user content in `retryContent`. A small "Retry" button
with `RotateCcw` icon renders below the error, calling `sendMessage(msg.retryContent)` on click.
**Files:** `src/components/AgentChatPanel.tsx`

### 8.2 — Credits remaining display in regular chat ✅
**Problem:** Users have no visibility into credit consumption during regular (non-premium) chat.
**Fix:** After each successful `agentService.chat()` response, `creditsRemaining` state is updated
and shown as "· ⚡ N credits" in the Online status indicator in the chat header.
**Files:** `src/components/AgentChatPanel.tsx`

### 8.3 — Conversation export API + download button ✅
**Problem:** Users cannot export/backup their conversation history.
**Fix:**
- Backend: `GET /api/conversations/export` endpoint (auth required) returns up to 1000 conversations
  as a JSON file with `Content-Disposition: attachment` header.
- Frontend: Download icon button in chat header triggers `memoryService.getConversationsExport(1000)`
  and uses `URL.createObjectURL` to download `conversations.json`.
- `api.ts`: Added `getConversationsExport()` and `addReaction()` to `memoryService`.
**Files:** `server/src/routes/agent.ts`, `src/components/AgentChatPanel.tsx`, `src/services/api.ts`

### 8.4 — WhatsApp old endpoint deprecation log ✅
**Problem:** Old `POST /integrations/whatsapp/link` (wa.me approach) is still active with no
visibility into whether anyone is still using it.
**Fix:** Added `logger.warn({ userId }, 'whatsapp/link (deprecated wa.me): use /whatsapp/qr instead')`
and `X-Deprecated: true` response header to the endpoint handler.
**Files:** `server/src/routes/integrations.ts`

### 8.5 — Message reactions persistence ✅
**Problem:** `MessageReactions` component had a TODO to send reactions to the server.
**Fix:**
- Backend: `POST /api/conversations/reactions` endpoint stores reactions in new `message_reactions`
  table (id, user_id, message_id, reaction, created_at).
- DB: `message_reactions` table created with `CREATE TABLE IF NOT EXISTS` in `db/index.ts`.
- Frontend: `MessageReactions.onReact` now calls `memoryService.addReaction(id, reaction)`.
  `onCopy` callback uses `_id` naming to satisfy noUnusedParameters.
**Files:** `server/src/routes/agent.ts`, `server/src/db/index.ts`, `src/components/AgentChatPanel.tsx`

### 8.6 — Ops files update ✅
Updated `ops/AI_PHASE_PLAN.md`, `ops/AI_HANDOFF.md`, `ops/AI_BACKLOG.md`.

## Execution Order
8.1 → 8.2 → 8.3 → 8.4 → 8.5 → 8.6

## Definition of Done
- [x] All 5 items implemented
- [x] `cd server && npm test` — 154/154 tests pass (no regression)
- [x] `npx tsc --noEmit` + `cd server && npx tsc --noEmit` — clean
- [x] `npm run build` + `cd server && npm run build` — clean
- [x] ESLint `--max-warnings=0` on changed frontend files — clean
- [x] PR opened
- [x] `ops/AI_HANDOFF.md` updated
