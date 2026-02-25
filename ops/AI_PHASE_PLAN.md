# AI Phase Plan

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

## Phase 30 — COMPLETE ✓
**Theme:** Notifications + export polish + reliability
**PR:** https://github.com/trendywink247-afk/GeekSpace2.0/pull/59 | **Tests:** 277/277

| # | Item | Type | Status |
|---|------|------|--------|
| 30.1 | Notification preference center (Reminder Notifications toggle) | UX | Done |
| 30.2 | Export chat as Markdown from Settings | Feature | Done |
| 30.3 | DB index on reminders(user_id, datetime) | Hardening | Done |
| 30.4 | Snooze history UI (snooze_count badge on reminder cards) | UX | Done |
| 30.5 | E2E test for connect invite flow (/connect/:token) | Dev/Ops | Done |

---

## Phase 31 — COMPLETE ✓
**Theme:** Polish + search + recurrence
**PR:** https://github.com/trendywink247-afk/GeekSpace2.0/pull/60 | **Tests:** 287/287

| # | Item | Type | Status |
|---|------|------|--------|
| 31.1 | E2E stability: data-testid on all dashboard pages + login | Dev/Ops | Done |
| 31.2 | Reminder recurrence editor (daily/weekly/monthly + auto-next) | Feature | Done |
| 31.3 | Chat search UX (sticky bar, match count, highlighting, Ctrl+F) | UX | Done |
| 31.4 | Admin export: users CSV + activity JSON | Dev/Ops | Done |
| 31.5 | Push notification matrix (connections + weekly digest toggles) | UX | Done |

---

## Phase 32 — COMPLETE ✓
**Theme:** Mobile polish + analytics + session management
**PR:** https://github.com/trendywink247-afk/GeekSpace2.0/pull/61 | **Tests:** 290/290

| # | Item | Type | Status |
|---|------|------|--------|
| 32.1 | Overview sparklines (SVG trend charts on stat cards) | UX | Done |
| 32.2 | Mobile bottom nav badge counts (pending reminders) | UX | Done |
| 32.3 | Reminder filter by recurrence type (All/Recurring/One-off) | UX | Done |
| 32.4 | Admin feedback analytics endpoint (thumbs-down counts) | Dev/Ops | Done |
| 32.5 | Session revoke unit test (endpoint already existed) | Hardening | Done |

---

## Phase 33 — IN PROGRESS
**Theme:** AI improvements + portfolio + onboarding
**Branch:** `ai/phase-20260225-phase33-nlp-portfolio-onboarding`
**PR:** https://github.com/trendywink247-afk/GeekSpace2.0/pull/62
**Tests:** 290/290 passing

| # | Item | Type | Status |
|---|------|------|--------|
| 33.1 | Reminder NLP input (already existed in reminderParser.ts) | UX | Done |
| 33.2 | Portfolio project drag-to-reorder (HTML5 DnD, local state) | UX | Done |
| 33.3 | Telegram connect banner on OverviewPage (dismissible) | UX | Done |
| 33.4 | Rate limit status endpoint + chat footer indicator | Dev/Ops | Done |
| 33.5 | Request ID propagated to error responses + chat errors | Hardening | Done |

---

## Phase 34 — PROPOSED
**Theme:** Data, snooze UX, automation improvements

| # | Item | Type | Priority |
|---|------|------|----------|
| 34.1 | Reminder snooze quick-actions (1h/tomorrow/next week from card) | UX | High |
| 34.2 | Overview real sparkline data (7-day from activity log) | UX | High |
| 34.3 | Portfolio view-count tracking (per-project analytics) | Feature | Medium |
| 34.4 | Chat export per-conversation (not just all conversations) | Feature | Medium |
| 34.5 | Webhook test-fire button in Automations page | Dev/Ops | Low |
