# Phase 3 — Critical Bugs: Dashboard + UI Blockers
**Status:** COMPLETE (with reality check)
**Date:** 2026-03-15

## Audit Reality Check — Most Already Fixed
- Settings privacy toggles: Already wired to `portfolioService.update()` ✅
- Activity pull-to-refresh: Already working with PullToRefreshWrapper ✅
- StatusPage CSS typo: No typo found — all `w-10 h-10` correct ✅
- GmailPage CSS typo: No typo found — clean implementation ✅
- Portfolio social link double-protocol: `normalizeUrl()` already handles correctly ✅
- Inbox action buttons: Already 44px minimum ✅
- Inbox polling: Already has 30s interval ✅
- Invite redirect: Already redirects to `/onboarding` ✅
- Privacy page email: Already `<a href="mailto:...">` ✅
- Terms page back button: Already uses `navigate(-1)` with `/` fallback ✅
- Automations action config: Already implemented (B3 fix) ✅

## Actual Fixes Applied

### BLOCKER-006: "Remember X" Messages Not Persisting
Added anchored regex pattern to `hasToolTrigger()` in `message-router.ts`:
```regex
/^(?:(?:please\s+)?(?:remember|save|note\s+down|keep\s+in\s+mind)\s+(?:that\s+)?|(?:don'?t|never)\s+forget\s+(?:that\s+)?|always\s+remember\s+)/i
```
Catches: "remember that...", "remember my...", "don't forget...", "keep in mind...", "always remember..."
Avoids: "do you remember...", "I remember..." (conversational, not commands)

### Brand Leaks Cleaned
- `HealthDashboardPage.tsx` — picoclaw refs updated
- `UsageAnalyticsPage.tsx` — picoclaw refs updated
- `WorkflowsPage.tsx` — picoclaw refs updated
- `StatusPage.tsx` — picoclaw refs updated
- `RemindersPage.tsx` — localStorage key `geekspace:` → `agentin:`
- `MediaGalleryPage.tsx` — localStorage key `geekspace-` → `agentin-`
- `dashboardStore.ts` — model name `geekspace-default` → `agentin-default`

### /api/usage/stats Route
Route doesn't exist but functionality is split across `/api/usage/summary` and `/api/usage/today`. No fix needed — frontend uses the correct endpoints.

## Files Changed
- `server/src/services/message-router.ts` — 2 lines
- `src/dashboard/pages/HealthDashboardPage.tsx` — 6 lines
- `src/dashboard/pages/UsageAnalyticsPage.tsx` — 4 lines
- `src/dashboard/pages/WorkflowsPage.tsx` — 8 lines
- `src/pages/StatusPage.tsx` — 2 lines
- `src/dashboard/pages/RemindersPage.tsx` — 1 line
- `src/dashboard/pages/MediaGalleryPage.tsx` — 6 lines
- `src/stores/dashboardStore.ts` — 1 line
