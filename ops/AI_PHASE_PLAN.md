# Phase 7 Plan — GeekSpace 2.0

> Branch: `ai/phase-20260225-escalation-search-hardening`
> Worktree: `.worktrees/phase-7`
> Baseline: 147/147 tests passing

## Items

### 7.1 — Escalation service extraction + unit tests ✅
**Problem:** P1 backlog — escalation logic is embedded in `webhooks.ts` with no unit coverage.
**Fix:** Extracted `EscalationData`, `handleEscalationReply`, `markEscalationAnswered` into
`server/src/services/escalation.ts`. Added 7 unit tests covering all tiers + edge cases.
**Files:** `server/src/services/escalation.ts` (new), `server/src/routes/webhooks.ts`,
`server/src/test/api/escalation.test.ts` (new)
**Result:** 154/154 tests passing (+7 new)

### 7.2 — Webhook bot-message filtering ✅
**Problem:** Bot messages and oversized text can cause feedback loops and abuse.
**Fix:** Two guards added after `res.sendStatus(200)` in Telegram webhook handler:
- `update.message?.from?.is_bot === true` → skip with log
- `update.message?.text?.length > 8000` → skip with warn
**Files:** `server/src/routes/webhooks.ts`

### 7.3 — Build info in health endpoint ✅
**Problem:** No runtime version or environment info in `/api/health` response.
**Fix:** Added `build: { version, nodeVersion, platform }` to the REST GET `/api/health` response.
**Files:** `server/src/app.ts`

### 7.4 — Chat history search ✅
**Problem:** No way to search through conversation history.
**Fix:**
- Backend: `getRecentConversations` now accepts optional `search` param — adds `LIKE` filter
- Backend: `GET /api/conversations` passes `req.query.search` to service
- Frontend: Search toggle (magnifying glass) in `AgentChatPanel` header — filters local messages
  with X-results indicator
**Files:** `server/src/services/memory.ts`, `server/src/routes/agent.ts`,
`src/components/AgentChatPanel.tsx`

### 7.5 — Ops files update ✅
Updated `ops/AI_PHASE_PLAN.md`, `ops/AI_HANDOFF.md`, `ops/AI_BACKLOG.md`.

## Execution Order
7.1 → 7.2 → 7.3 → 7.4 → 7.5

## Definition of Done
- [x] All 5 items implemented
- [x] `cd server && npm test` — 154/154 tests pass (+7 new)
- [x] `npx tsc --noEmit` + `cd server && npx tsc --noEmit` — clean
- [x] `npm run build` + `cd server && npm run build` — clean
- [x] ESLint — no new errors on changed files (pre-existing warnings only)
- [x] PR opened
- [x] `ops/AI_HANDOFF.md` updated
