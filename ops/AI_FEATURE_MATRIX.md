# AI Feature Matrix — GeekSpace 2.0

> Living document. Updated each phase. Tracks to-and-fro verification status.
> Last updated: Phase 43 (2026-02-25)

## Legend
- ✅ Verified this phase
- ⚠️  Partial / known gap
- ❌ Unverified / broken
- — Not applicable

| Feature Domain | Core Routes/APIs | Happy Path | Round-Trip | Mobile | Unit Tests | E2E | Known Issues | Last Verified |
|---|---|---|---|---|---|---|---|---|
| **Auth / JWT / OAuth** | POST /auth/login, /register, /auth/google, /auth/github | ✅ | ⚠️ | ✅ | ✅ | ✅ | 401 expiry loop (fix: phase 43.2) | Phase 43 |
| **AI Chat / LLM Routing** | POST /chat, GET /chat/history, GET /conversations/export | ✅ | ✅ | ✅ | ⚠️ mocked | ⚠️ partial | None known | Phase 42 |
| **Reminders (all variants)** | GET/POST/PATCH/DELETE /reminders, /reminders/:id/snooze, /reminders/stats | ✅ | ⚠️ | ✅ | ✅ | ✅ | remind_before_sent_at not reset on reschedule (fix: 43.3) | Phase 43 |
| **Automations / Webhooks** | GET/POST/PATCH/DELETE /automations, /webhooks, GET /automations/:id/runs | ✅ | ⚠️ | ⚠️ | ✅ | ⚠️ | run_count + last_run_at not wired to frontend (fix: 43.6) | Phase 43 |
| **Connections (Telegram/WA)** | GET/POST /integrations, /webhooks/telegram, /webhooks/whatsapp | ✅ | ✅ | ✅ | ✅ | ✅ | None known | Phase 41 |
| **Portfolio / Public Pages** | GET/PUT /portfolio, GET /portfolio/:username, POST /portfolio/:username/contact | ✅ | ⚠️ | ✅ | ✅ | ✅ | Same-session view_count double-count (fix: 43.7); XSS in bio/projects (fix: 43.8) | Phase 43 |
| **Dashboard / Activity / Analytics** | GET /activity, DELETE /activity, sparklines | ✅ | ✅ | ⚠️ | ✅ | ⚠️ | Timestamps are raw ISO strings (fix: 43.5) | Phase 43 |
| **Billing / Usage / Credits** | GET /billing, /usage, /credits | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ | Billing history UI minimal | Phase 22 |
| **Admin Endpoints / Audit** | GET /admin/users, /admin/usage, /admin/export | ✅ | ⚠️ | — | ⚠️ | ⚠️ | No rate-limit on admin routes (risk R12) | Phase 31 |
| **Health / Observability** | GET /api/health, SSE /health/stream | ✅ | ✅ | — | ✅ | ⚠️ | None known | Phase 34 |
| **Session Management** | GET/DELETE /auth/sessions | ✅ | ✅ | ✅ | ✅ | ⚠️ | Revoke is DB-only; token valid until expiry | Phase 32 |
| **Memory / Agent Config** | GET/POST/DELETE /memory, GET/PATCH /agent/config | ✅ | ✅ | ✅ | ✅ | ✅ | None known | Phase 38 |
| **Snooze / Reminders UX** | POST /reminders/:id/snooze, GET /reminders/:id/snooze-history | ✅ | ✅ | ✅ | ✅ | ✅ | None known | Phase 40 |
| **Invite System** | POST /integrations/invite, accept flow | ✅ | ✅ | ✅ | ✅ | ✅ | None known | Phase 29 |

## To-and-Fro Gap Summary (Open Items)
| Gap | Fix Phase | Priority |
|-----|-----------|----------|
| 401 expiry → UI hangs without redirect | 43.2 | High |
| remind_before_sent_at not reset on reschedule | 43.3 | High |
| Automations run_count not shown in UI | 43.6 | Medium |
| Portfolio view_count double-counts on refresh | 43.7 | Medium |
| Portfolio bio/projects vulnerable to XSS | 43.8 | High |
| Billing history UI is placeholder only | Future | Low |
| Admin routes have no rate limit | Future | Medium |
