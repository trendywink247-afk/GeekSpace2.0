# AI Phase Plan — GeekSpace 2.0

**Current Phase:** 27 (PLANNED)
**Last Phase Completed:** 26

---

## Phase 26: COMPLETE (2026-02-25)

- 26.1 App Version Display in Settings footer + GET /api/version
- 26.2 Reminder Priority Levels (low/normal/high/urgent)
- 26.3 Rate Limit Standard Headers + low-limit chat warning
- 26.4 E2E: reminders bulk delete + priority selector
- 26.5 Agent Quality Metrics (satisfaction rate on OverviewPage)

---

## Phase 27: Proposed (next session)

**Theme:** Performance, PWA polish, and advanced agent features

| # | Item | Type | Files |
|---|------|------|-------|
| 27.1 | Offline mode indicator improvement — show cached data age | UX | `PWAInstallPrompt.tsx`, service worker |
| 27.2 | Reminder smart scheduling — suggest next available slot when time conflicts | Feature | `RemindersPage.tsx`, new `/api/reminders/suggest-time` |
| 27.3 | Agent context window tracking — show token budget used | Dev/Ops | `AgentChatPanel.tsx`, agent.ts chat response |
| 27.4 | Bulk reminder import (CSV upload) | Feature | `RemindersPage.tsx`, `reminders.ts` |
| 27.5 | Audit log for security events (login, password change, API key create) | Hardening | new `audit_log` table, middleware |

**Definition of Done:** Tests ≥245, 0 TS errors, 0 lint warnings on changed files, clean build, PR opened.
