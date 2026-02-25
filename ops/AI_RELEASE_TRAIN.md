# Release Train — GeekSpace 2.0

> Tracks main→production deploy cadence. Production deploys from main only.

## Release Train Policy
- Deploy to production every **20–30 phases** OR for critical fixes
- Each train must pass: lint + typecheck + build + unit tests + critical E2E + smoke tests
- Tag commits: `release/R<N>-start` and `release/R<N>-end`
- Monitor logs 30 min post-deploy

## R1 — Phases 1–20 (2026-02-24)
- **Status:** Deployed ✅ (pushed to live-production after Phase 20)
- **Key features shipped:** Image/video gen, snooze, escalation, OAuth, recurring reminders, portfolio themes, session management, activity log, command palette, invite system, accessibility, compact mode
- **Tests at deploy:** ~245 unit tests
- **Known issues at deploy:** None critical

## R2 — Phases 21–42 (2026-02-25)
- **Status:** In main ✅ — NOT yet deployed to live-production
- **Phases merged:** 21 through 42
- **Tests at R2 baseline:** 385
- **Key features:** Activity search, webhook dashboard, sparklines, memory search, bulk reminders, reminder priorities, invite flow, snooze log, portfolio contact form, CSV export, category/priority filters, bulk-complete, portfolio stats API, celebration banner, code copy button
- **Deploy prerequisites:** All CI green, smoke tests pass, user explicit request
- **Target deploy:** User request or after Phase ~60–65

## R3 — Phases 43–65 (upcoming)
- **Status:** In progress
- **Started:** Phase 43 (2026-02-25)
- **Goals:** Multi-user safety, mobile-first polish, integration reliability, XSS hardening, DB performance, feature parity, go-live readiness
- **Target phases:** 43–65 (approximately)
- **Phase 43 complete:** 396/396 tests. 401 loop fix, remind_before reset, date grouping, relative timestamps, automations run_count wiring, XSS hardening, DB indexes.
- **Phase 44 complete:** 414/414 tests. Webhook retry, recurring reminder fix, notification badge, OAuth error handling, admin rate limit, structured logs, page skeleton.
