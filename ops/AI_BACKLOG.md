# AI Backlog — GeekSpace 2.0

> Prioritized by impact × effort. Updated each phase.

## 🔴 Critical (P0)

- [ ] WhatsApp sending is a no-op stub (`whatsapp.ts:5-18`) — messaging to WhatsApp users never delivered
- [ ] Webhook verification bypass in dev mode (`whatsapp.ts:24`) — any request can forge WhatsApp events
- [ ] SSE connection limit is 5 (`health.ts:104`) — admin dashboard + monitoring tools exhaust it fast

## 🟠 High (P1)

- [ ] Message-router sends action summaries on every reply, even when zero actions fired ("button spamming")
- [ ] Connections page uses global `isLoading` state — all Connect buttons disabled during any dashboard fetch
- [ ] Cluster detection relies on `NODE_APP_INSTANCE` env var — fragile if PM2 misconfigured
- [ ] Server scheduler failures swallowed silently — Telegram bot crash invisible to ops

## 🟡 Medium (P2)

- [ ] Image generation via Pollinations.AI (free, no API key) — users can't generate images from chat
- [ ] Connections polling is 3s hardcoded — should use exponential backoff to avoid hammering API
- [ ] Duplicate WhatsApp linking implementations (old wa.me link + new QR) — confusing UX
- [ ] Stale channel links never purged — grow indefinitely, no 90-day TTL cleanup
- [ ] Graceful shutdown timeout missing — hung processes possible during restart
- [ ] Video generation via Pollinations.AI (free, no API key)

## 🟢 Low (P3)

- [ ] CSP allows `unsafe-inline` for scripts — should use nonce-based CSP in production
- [ ] Health SSE sends full snapshot every 15s even if unchanged — no delta encoding
- [ ] Onboarding has no step progress indicator or escape hatch
- [ ] Chat rate limit (2 req/min) may be too strict for power users

## ✅ Completed

- [x] Smart escalation 3-tier matching (Tier1 native reply / Tier2 keyword / Tier3 fallthrough)
- [x] Preview URLs sent directly in Telegram after generate_code
- [x] Code blocks stripped from Telegram replies when artifact generated
- [x] CapabilitiesPage — 20+ capabilities, pipeline visualizer, hidden powers
- [x] DashboardTour — 6-step guided first-use flow
- [x] notifMessageId stored in Redis escalation data for Tier1 matching
- [x] Auto-save generate_code artifacts to portfolios.projects
