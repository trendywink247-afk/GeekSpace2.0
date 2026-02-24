# Phase 1 Plan — Reliability + Image Gen + Connections Polish

**Branch:** `ai/phase-20260224-reliability-onboarding`
**Started:** 2026-02-24
**Status:** 🔄 In Progress

---

## Phase 1 Items (5)

### 1. 🐛 Critical Bug Fix — Action Button Spamming
**File:** `server/src/services/message-router.ts`
**Problem:** Action summaries (✅ icons, 🔗 links) appear in every Telegram/WhatsApp reply even when zero actions executed.
**Fix:** Only append action summary block when `actionResults.length > 0` AND at least one action succeeded. Add dedup so the same action message doesn't appear twice in a thread.
**Risk:** Low — purely additive filter, no core routing changes.

### 2. 🎨 UI/UX — Connections Tab Polish
**Files:** `src/dashboard/pages/ConnectionsPage.tsx`
**Problem:** Global `isLoading` disables all Connect buttons. Polling hardcoded at 3s. No per-connection loading state.
**Fix:**
- Add per-integration `isConnecting` state (Telegram / WhatsApp separate)
- Change Connect button `disabled` from `isLoading` to `isConnecting[id]`
- Add exponential backoff to polling (1s → 2s → 4s, max 5s, jitter ±500ms)
**Risk:** Low — frontend-only, no API changes.

### 3. 🛡 Edge-Case Hardening — Server Startup Reliability
**Files:** `server/src/index.ts`
**Problem:** Cluster detection fragile, scheduler failures swallowed, no graceful shutdown timeout.
**Fix:**
- Add `logger.info({ isMainWorker, instance }, 'Cluster init')` for observability
- Wrap each scheduler in named try/catch with error logging (not fire-and-forget)
- Add 10s graceful shutdown timeout (`setTimeout(() => process.exit(1), 10_000)`)
**Risk:** Low — logging + timeout, no logic changes.

### 4. 🖼 New Feature — Image Generation (Pollinations.AI)
**Files:**
- `server/src/services/action-executor.ts` — add `generate_image` action
- `server/src/services/action-parser.ts` — add Zod schema for `generate_image`
- `server/src/prompts/openclaw-system.ts` — add image gen to capabilities
- `server/src/routes/artifacts.ts` — serve generated image URLs
**Implementation:**
```
Pollinations.AI: https://image.pollinations.ai/prompt/{encoded_prompt}?width=512&height=512&nologo=true
```
Free, no API key, returns image directly.
**Risk:** Medium — new action type, but isolated. Failure returns graceful error.
**Tests:** Add unit test for action parser + executor mock.

### 5. 🔧 Dev/Ops — SSE Connection Limit + Health Logging
**File:** `server/src/routes/health.ts`
**Problem:** `MAX_SSE_CONNECTIONS = 5` is hit by admin dashboard + monitoring. Probe start time not logged.
**Fix:**
- Increase `MAX_SSE_CONNECTIONS` from 5 to 25
- Add `logger.info({ duration }, 'Health probe completed')` at first probe finish
- Add `logger.warn({ existing }, 'SSE connection limit reached')` when rejecting
**Risk:** Very low — observability + limit bump, no logic changes.

---

## Verification Plan

```bash
# After each item:
cd server && npm test       # must stay 113/113

# After frontend items:
npm run lint && npx tsc --noEmit && npm run build

# After all items:
cd server && npm run build
# Docker build dry-run if time allows
```

## Definition of Done

- [ ] All 5 items implemented
- [ ] 113 tests still passing (+ new image gen tests)
- [ ] lint/typecheck/build green (root + server)
- [ ] PR opened with verification evidence
- [ ] AI_HANDOFF.md updated
- [ ] Phase 2 proposed
