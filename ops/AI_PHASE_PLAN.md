# Phase 6 Plan — GeekSpace 2.0

> Branch: `ai/phase-20260224-usage-snooze-csp`
> Worktree: `.worktrees/phase-6`
> Baseline: 147/147 tests passing

## Items

### 6.1 — Reminder snooze UI
**Problem:** No snooze option in Reminders dashboard. Users can only delete or edit — can't defer.
**Fix:** Add snooze popover to each reminder card: 1h / Tomorrow 9am / Custom (datetime-local)
**Wire to:** existing `snoozeReminder` store action
**Files:** `src/dashboard/pages/RemindersPage.tsx`

### 6.2 — Overview sparklines
**Problem:** Overview stats cards show single numbers with no trend direction.
**Fix:** Mini AreaChart (Recharts already in deps) on each stat using `chartData` already in store — no new API call.
**Files:** `src/dashboard/pages/OverviewPage.tsx`

### 6.3 — Health SSE delta encoding
**Problem:** Full snapshot pushed every 15s even if unchanged — bandwidth waste.
**Fix:** Track `lastSnapshot` fingerprint; only push when data changes or >60s since last full push.
**Files:** `server/src/routes/health.ts`

### 6.4 — Admin dashboard inline-onclick audit
**Problem:** CLAUDE.md notes "Helmet CSP blocks inline onclick — use addEventListener instead."
Admin dashboard in `admin.ts` uses inline HTML strings — audit for inline handlers and fix.
**Files:** `server/src/routes/admin.ts`

### 6.5 — Message-router action dedup tests
**Problem:** Action dedup path and Telegram channel handling have no unit coverage.
**Fix:** New test file covering: dedup within 5s window, generate_code preview URL, generate_image URL.
**Files:** `server/src/test/api/message-router.test.ts`

## Execution Order
6.1 → 6.2 → 6.3 → 6.4 → 6.5

## Definition of Done
- [ ] All 5 items implemented
- [ ] `cd server && npm test` — all tests pass (≥147 + new ones)
- [ ] `npx tsc --noEmit` + `cd server && npx tsc --noEmit` — clean
- [ ] `npm run build` + `cd server && npm run build` — clean
- [ ] `eslint --max-warnings=0` on changed files — clean
- [ ] PR #35 opened
- [ ] `ops/AI_HANDOFF.md` updated
