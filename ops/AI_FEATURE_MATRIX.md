# AI Feature Matrix — GeekSpace 2.0

> Living document. Updated each phase. Tracks to-and-fro verification status.
> Last updated: Phase 45 (2026-02-25)

## Legend
- ✅ Verified this phase
- ⚠️  Partial / known gap
- ❌ Unverified / broken
- — Not applicable

| Feature Domain | Core Routes/APIs | Happy Path | Round-Trip | Mobile | Unit Tests | E2E | Known Issues | Last Verified |
|---|---|---|---|---|---|---|---|---|
| **Auth / JWT / OAuth** | POST /auth/login, /register, /auth/google, /auth/github | ✅ | ✅ | ✅ | ✅ | ✅ | None known (OAuth error page added Ph44, 401 loop fixed Ph43, logout gs-auth fixed Ph45) | Phase 45 |
| **AI Chat / LLM Routing** | POST /chat, GET /chat/history, GET /conversations/export | ✅ | ✅ | ✅ | ⚠️ mocked | ⚠️ partial | None known | Phase 42 |
| **Reminders (all variants)** | GET/POST/PATCH/DELETE /reminders, /reminders/:id/snooze, /reminders/stats | ✅ | ✅ | ✅ | ✅ | ✅ | None known (recurring reschedule fixed Ph44, remind_before reset Ph43) | Phase 44 |
| **Automations / Webhooks** | GET/POST/PATCH/DELETE /automations, /webhooks, GET /automations/:id/runs | ✅ | ✅ | ✅ | ✅ | ⚠️ | None known (webhook retry Ph44, enabled toggle verified Ph44) | Phase 44 |
| **Connections (Telegram/WA)** | GET/POST /integrations, /webhooks/telegram, /webhooks/whatsapp | ✅ | ✅ | ✅ | ✅ | ✅ | None known | Phase 41 |
| **Portfolio / Public Pages** | GET/PUT /portfolio, GET /portfolio/:username, POST /portfolio/:username/contact | ✅ | ✅ | ✅ | ✅ | ✅ | None known (XSS fixed Ph43, OG entity-encode Ph45, view dedup Ph43) | Phase 45 |
| **Dashboard / Activity / Analytics** | GET /activity, DELETE /activity, sparklines | ✅ | ✅ | ✅ | ✅ | ⚠️ | None known (notification badge Ph44, sparklines UTC-bucketed Ph45) | Phase 45 |
| **Billing / Usage / Credits** | GET /billing, /usage, /credits | ✅ | ⚠️ | ✅ | ⚠️ | ⚠️ | Billing history UI minimal | Phase 22 |
| **Admin Endpoints / Audit** | GET /admin/users, /admin/usage, /admin/export | ✅ | ✅ | — | ⚠️ | ⚠️ | None known | Phase 44 |
| **Health / Observability** | GET /api/health, SSE /health/stream | ✅ | ✅ | — | ✅ | ⚠️ | None known | Phase 34 |
| **Session Management** | GET/DELETE /auth/sessions | ✅ | ✅ | ✅ | ✅ | ⚠️ | Revoke is DB-only; token valid until expiry | Phase 32 |
| **Memory / Agent Config** | GET/POST/DELETE /memory, GET/PATCH /agent/config | ✅ | ✅ | ✅ | ✅ | ✅ | None known | Phase 38 |
| **Snooze / Reminders UX** | POST /reminders/:id/snooze, GET /reminders/:id/snooze-history | ✅ | ✅ | ✅ | ✅ | ✅ | None known | Phase 40 |
| **Invite System** | POST /integrations/invite, accept flow | ✅ | ✅ | ✅ | ✅ | ✅ | None known | Phase 29 |

## To-and-Fro Gap Summary (Open Items)
| Gap | Fix Phase | Priority |
|-----|-----------|----------|
| Billing history UI is placeholder only | Future | Low |
