# AI Handoff — Post-Phase 77 (Per-User Limits UI + Usage Dashboard)

**Date:** 2026-03-01
**Branch:** `main`
**Tests:** 77 server unit test files | 892 tests (all passing)
**CI:** Phase gate 7/7 ✅ | Smoke tests 11/11 ✅
**Brand Guard:** 0 violations
**Build:** Clean (frontend + server)

---

## Compaction Recovery Rule (MANDATORY)
If the conversation is compacted, before doing ANY work:
1. Re-read: `CLAUDE.md`, `ops/AI_HANDOFF.md`, `ops/AI_PHASE_PLAN.md`, `ops/AI_FEATURE_MATRIX.md`
2. Run: `git status && git branch --show-current && git log --oneline -5`
3. Print a brief "Rehydrated Context" summary (phase, branch, current tasks, constraints)
4. Only then continue implementation — never rely on memory from compacted context

---

## Post-Phase 77 — What Was Done

**Theme:** Per-User Limits UI + Usage Dashboard + Onboarding Polish

### New Capabilities

**GET /api/usage/today**
- Returns `{plan, messages:{used,limit,percentage}, voice:{used,limit,percentage}, images:{used,limit,percentage}, tokenPercentage}`
- Per-plan daily limits: free(30 msg/5 voice/3 img), monthly(150/30/20), yearly(500/100/80)
- Counts from `usage_events` table for today's date
- Imported `getDailyTokenUsage` + `getTokenBudget` from token-budget service

**Today's Usage Widget (OverviewPage)**
- Compact card after the Bento Stats Grid
- Shows Messages / Voice / Images progress bars with color-coded thresholds
  - Green = <80%, Amber = 80-99%, Red = 100%
- Links to full Usage Analytics page

**Soft-Limit Warning Banner (77.4)**
- Dismissable amber banner in OverviewPage when any resource >= 80%
- Shows "Approaching daily limit" with upgrade CTA for free users

**Hard-Limit Upgrade Prompt (77.5)**
- AgentChatPanel now catches HTTP 429 errors specifically
- Shows `setShowUpgradePrompt(true)` (reuses existing upgrade overlay)
- Sets a friendly "reached your daily limit" message instead of raw error

**Dynamic Plan Badge (77.6)**
- SettingsPage profile card badge now reads from `user.plan`
- free = grey "Free Plan", monthly/yearly/halfyear = cyan "Premium — ...", team = "Team Plan"

**Confirmed Already Working**
- Onboarding checklist (77.7): ONBOARDING_ITEMS in OverviewPage lines 187-218
- Forgot password Telegram OTP (77.8): ForgotPasswordPage already uses `channel='auto'` and renders "Check your Telegram" when server returns `channel:'telegram'`

### Files Changed
- `server/src/routes/usage.ts` — `/today` endpoint + DAILY_*_LIMITS constants + import token-budget
- `src/services/api.ts` — `usageService.today()` method added
- `src/dashboard/pages/OverviewPage.tsx` — todayUsage state, fetch, widget, soft-limit banner
- `src/components/AgentChatPanel.tsx` — 429 error → upgrade prompt
- `src/dashboard/pages/SettingsPage.tsx` — dynamic plan badge
- `server/src/test/api/phase77.test.ts` (NEW) — 22 tests covering all Phase 77 changes

---

## Verification Status
- [x] Tests: 892/892 passed (77 test files)
- [x] Phase gate: 7/7 ✅
- [x] Brand guard: 0 violations
- [x] TypeScript: clean (frontend + server)
- [x] Staging: deployed + 11/11 smoke tests ✅
- [x] Merged to main (e281534)
- [x] Pushed to origin/main

---

## Known Issues / Open Risks
- Pre-existing chunk size warning (index.js 738kB, recharts 431kB) — not Phase 77 concern
- `job-queue.ts` handlers still not wired to actual voice/image routes (Phase 78 candidate)
- `Progress` component color override uses CSS custom property (`--progress-foreground`) which depends on shadcn CSS var support — visual color may not apply without additional CSS; functional logic is correct
- Daily limits are approximate (usage_events tool field may not always be populated for voice/image)

---

## Architecture Notes
- `/today` endpoint uses `date(created_at) = date('now')` for SQLite same-day filtering
- Daily message limit counts `tool = 'ai.chat'` OR empty/null tool (generic chat events)
- Token budget and message count limits are independent signals (token = LLM cost, messages = API calls)

---

## Next Steps (Phase 78 candidates)
- Wire job queue handlers to voice/image service calls (unblocked)
- Frontend job status polling endpoint (`GET /api/jobs/:id`)
- Frontend bundle splitting (recharts + index.js — Phase 77 noted, Phase 78 priority)
- CSRF tokens (mentioned in phase 75 open risks — still open)
- Virtual scroll for long chat history
- Next release train candidate: Phase 80

## Merge Status
Merged `ai/phase-20260301-phase77` → `main` (e281534)
Pushed to `origin/main`
