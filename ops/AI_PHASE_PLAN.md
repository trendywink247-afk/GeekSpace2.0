# AI Phase Plan

## Phase 28 — COMPLETE ✓
**Branch:** `ai/phase-20260225-polish-accessibility-final`
**PR:** https://github.com/trendywink247-afk/GeekSpace2.0/pull/57
**Tests:** 262/262 passing

| Item | Description | Status |
|------|-------------|--------|
| 28.1 | Accessibility: Skip-to-main link + id="main-content" | Done |
| 28.2 | Portfolio Template Gallery: richer previews + 2 coming-soon cards | Done |
| 28.3 | Server Graceful Shutdown: httpServer.close() drains in-flight requests | Done |
| 28.4 | Unit Tests: invites.test.ts (5 tests) + reminder priority tests (3 tests) | Done |
| 28.5 | Dashboard Compact Mode: authStore + gs-compact CSS + Settings toggle | Done |

---

## Phase 29 — COMPLETE ✓
**Branch:** `ai/phase-20260225-phase29-connect-preview-reliability`
**Tests:** 271/271 passing

| # | Item | Type | Status |
|---|------|------|--------|
| 29.1 | Connection invite accept UI (`/connect/:token` page) | Feature | Done |
| 29.2 | Portfolio live preview tab (iframe side-by-side) | UX | Done |
| 29.3 | Request timeout middleware (30s all routes) | Hardening | Done |
| 29.4 | Reminder bulk-snooze from dashboard | UX | Done |
| 29.5 | E2E tests for compact mode + skip-link | Dev/Ops | Done |

---

## Phase 30 — IN PROGRESS
**Theme:** Notifications + export polish + reliability
**Branch:** `ai/phase-20260225-phase30-notifications-export-reliability`
**PR:** https://github.com/trendywink247-afk/GeekSpace2.0/pull/59
**Tests:** 277/277 passing

| # | Item | Type | Status |
|---|------|------|--------|
| 30.1 | Notification preference center (Reminder Notifications toggle) | UX | Done |
| 30.2 | Export chat as Markdown from Settings | Feature | Done |
| 30.3 | DB index on reminders(user_id, datetime) | Hardening | Done |
| 30.4 | Snooze history UI (snooze_count badge on reminder cards) | UX | Done |
| 30.5 | E2E test for connect invite flow (/connect/:token) | Dev/Ops | Done |

---

## Phase 31 — PROPOSED
**Theme:** Polish + search + recurrence

| # | Item | Type | Priority |
|---|------|------|----------|
| 31.1 | E2E stability: data-testid on key interactive elements | Dev/Ops | High |
| 31.2 | Reminder recurrence editor (edit pattern in-place) | Feature | Medium |
| 31.3 | Chat search UX (highlight matches, sticky search bar) | UX | Medium |
| 31.4 | Admin dashboard export (users CSV + activity summary) | Dev/Ops | Low |
| 31.5 | Push notification matrix (per-type per-channel toggles) | UX | Low |
