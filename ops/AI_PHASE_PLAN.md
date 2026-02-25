# Phase 12 Plan — GeekSpace 2.0

> Branch: `ai/phase-20260225-whatsapp-snooze-stats`
> Worktree: `.worktrees/phase-12`
> Baseline: 175/175 tests passing → **181/181 at completion**
> PR: https://github.com/trendywink247-afk/GeekSpace2.0/pull/41

## Items

### 12.1 — WhatsApp Service Consolidation (Bug Fix / Reliability) ✅
**Problem:** Phase 11 introduced `whatsapp-new.ts` as an experimental service alongside the
original `whatsapp.ts`, creating split-brain risk and confusing `integrations.ts` routes.
**Fix:** Merged all logic back into `whatsapp.ts`. Made `whatsapp-new.ts` a thin facade re-export.
Cleaned up duplicate handler code in `integrations.ts`.
**Files:** `server/src/services/whatsapp.ts`, `server/src/services/whatsapp-new.ts`, `server/src/routes/integrations.ts`

### 12.2 — (Not assigned)

### 12.3 — Portfolio Stats Daily Breakdown Chart (Feature) ✅
**Problem:** `GET /api/portfolio/stats` only returned `{ totalViews, recentViews }` with no
time-series data. PortfolioPage showed flat counts with no visual chart.
**Fix:** Extended the API to return `dailyBreakdown` (last 30 days). Added recharts `AreaChart`
in PortfolioPage with 7-day/30-day toggle. Added Phase 12 DB index for efficient queries.
**Files:** `server/src/routes/portfolio.ts`, `src/dashboard/pages/PortfolioPage.tsx`, `src/services/api.ts`, `server/src/db/index.ts`

### 12.4 — Unit Tests: PATCH Reminders + Portfolio Stats (Dev/Ops) ✅
**Problem:** PATCH reminders endpoint had no test coverage. Portfolio stats endpoint (new in
Phase 11) had no tests.
**Fix:** Added 2 PATCH reminder tests to `reminders.test.ts`. Created new `portfolio-stats.test.ts`
with 4 tests: auth guard, shape, zeros, visit count isolation.
**Files:** `server/src/test/api/reminders.test.ts`, `server/src/test/api/portfolio-stats.test.ts` (new)
**Result:** 181/181 tests passing (up from 175)

### 12.5 — Credits Progress Bar in AgentChatPanel (UX) ✅
**Problem:** Users had no visual indication of remaining credits while chatting. Only a text
count appeared after a response was received. New users had no credit context at all.
**Fix:** Fetch `billingService.getPlan()` on panel open. Render a 1px `h-1` progress bar below
the header. Green (>50%) → amber (20–50%) → red (<20%). Hover tooltip shows exact count.
Pre-populates `creditsRemaining` from subscription fetch for accuracy from first message.
**Files:** `src/components/AgentChatPanel.tsx`

## Execution Order
12.1 → 12.3 → 12.4 → 12.5

## Definition of Done
- [x] All 5 items implemented
- [x] `cd server && npm test` — 181/181 tests pass
- [x] `npx tsc --noEmit` (frontend) — clean
- [x] `cd server && npx tsc --noEmit` (server) — clean
- [x] `npm run build` — clean
- [x] ESLint `--max-warnings=0` on changed frontend files — clean
- [x] PR #41 opened and merged
- [x] `ops/AI_HANDOFF.md` updated

---

# Phase 13 Plan (Proposed)

> To begin Phase 13, create worktree: `git worktree add .worktrees/phase-13 -b ai/phase-YYYYMMDD-<topic>`

### 13.1 — Reminder snooze expiry cleanup (Bug Fix)
Snoozed reminders whose snooze_until has passed are never auto-resumed. Add a cron check.

### 13.2 — Email notification delivery (Feature)
Send reminder notifications via email (SMTP) as alternative to Telegram.

### 13.3 — Agent response streaming via SSE (UX)
Stream LLM tokens to frontend for faster perceived latency (TTFB).

### 13.4 — E2E coverage: portfolio stats + model preference (Dev/Ops)
Playwright specs for portfolio stats chart render + model picker flow.

### 13.5 — Automation webhook retry with backoff (Hardening)
Webhook triggers currently fail silently. Add retry with exponential backoff.
