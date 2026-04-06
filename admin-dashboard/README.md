# Mission Control Admin Dashboard

Standalone single-file admin dashboard served at:

- **Production:** `https://api.geekspace.space/admin`
- **Staging:** (same — served from staging container)

## What it shows

- User analytics: total, today, week, month, active sessions, auth providers
- Onboarding funnel with stuck-user detection
- System vitals: uptime, memory, latency, RPM, error rate
- Live component status via Server-Sent Events
- Rolling latency chart (HTML canvas)
- Live request feed (terminal style)
- Top endpoints table
- Credit / billing summary with plan distribution
- 30-day signup timeline

## How it works

- This `index.html` is the entire frontend (no build step, no dependencies).
- Backend endpoints live in `server/src/routes/admin.ts`:
  - `GET /api/admin/dashboard` — main JSON payload (password-gated)
  - `GET /api/admin/stream` — SSE event stream
- The HTML is served by `serveAdminDashboard` in `server/src/routes/admin.ts`,
  which reads this file at `<project>/admin-dashboard/index.html` once at startup
  and caches it in memory.
- Auth: `X-Admin-Password` header, validated against `ADMIN_DASHBOARD_PASSWORD`
  env var (configured in `.env` and `.env.staging`).

## ⚠️ DO NOT DELETE

This file was previously deleted in PR #165 (`0e14f370`) "replaced by app
dashboard" — but the in-app dashboard does not actually replace it (the
in-app dashboard is user-facing; this is operator-facing analytics for
the API domain only). Restoring breaks nothing. If you think it should
go away, also remove the route handler in `server/src/routes/admin.ts`
(`serveAdminDashboard`) and the mount in `server/src/index.ts` and
`server/src/modules/admin/index.ts`.

## Restore history

- 2026-02-17 `53998afd` initial creation
- 2026-02-?? `78345b3f` mobile login + chat blur fix
- 2026-02-?? `c407473a` CSP fix for inline onclick (CURRENT VERSION)
- 2026-?? `0e14f370` deleted in cleanup PR #165 (mistake)
- 2026-04-06 restored from `c407473a`
