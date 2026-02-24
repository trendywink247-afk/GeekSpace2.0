# AI Backlog — GeekSpace 2.0

> Prioritized by impact × effort. Updated each phase.

## 🔴 Critical (P0)

_(none currently — all P0 items resolved in Phase 1/2)_

## 🟠 High (P1)

- [ ] Verify escalation Tier 1/2/3 wiring in `webhooks.ts` — plan file exists (`dapper-hatching-hopcroft.md`); confirm native reply + keyword matching + fallthrough all work end-to-end
- [ ] Health SSE sends full snapshot every 15s even if unchanged — no delta encoding (high bandwidth waste for dashboards)

## 🟡 Medium (P2)

- [ ] CSP `unsafe-inline` for scripts — should use nonce-based policy in production
- [ ] Duplicate WhatsApp linking implementations (old wa.me link + new QR) — confusing UX
- [ ] Reminder snooze UI (1h/tomorrow/custom) — currently no snooze option in dashboard
- [ ] Dashboard overview trend charts — sparklines for usage, credits, reminders over time
- [ ] Unit test coverage for message-router action dedup and escalation path

## 🟢 Low (P3)

- [ ] WhatsApp sending is still a stub — needs WA Business API keys to be functional
- [ ] Portfolio tab bar scroll on mobile — already hardened in E2E; consider adding CSS scroll-snap
- [ ] AI backlog grooming — review all completed items and remove stale ones

## ✅ Completed

- [x] **Phase 1** — Action button spamming fix (dedup + per-action handling)
- [x] **Phase 1** — Connections page per-integration loading + exponential backoff polling
- [x] **Phase 1** — Server startup hardening (safeStart, cluster detect, 10s shutdown timeout)
- [x] **Phase 1** — Image generation wiring (imageUrl on ActionResult + Pollinations.AI)
- [x] **Phase 1** — SSE connection limit 5→25 + probe timing log
- [x] **Phase 2** — WhatsApp webhook security (reject in prod when token not set)
- [x] **Phase 2** — Onboarding escape hatch ("Not X? Sign in as someone else")
- [x] **Phase 2** — Stale channel link cleanup (90-day TTL DELETE + daily cron)
- [x] **Phase 2** — Video generation wiring (videoUrl + channel reply 🎬)
- [x] **Phase 2** — Chat rate limit 30→60 per 15min
- [x] **Hotfix** — E2E portfolio mobile scroll (scrollIntoViewIfNeeded before tab click)
- [x] Smart escalation 3-tier matching (Tier1 native reply / Tier2 keyword / Tier3 fallthrough)
- [x] Preview URLs sent directly in Telegram after generate_code
- [x] Code blocks stripped from Telegram replies when artifact generated
- [x] CapabilitiesPage, DashboardTour, ImageGenPage, VideoGenPage, WebsiteBuilderPage, SocialMediaPage
- [x] notifMessageId stored in Redis escalation data for Tier1 matching
- [x] Auto-save generate_code artifacts to portfolios.projects
