# Release Notes — GeekSpace 2.0

> User-facing changes by phase. Written before each merge to live-production.

---

## Post-Phase 78 (2026-03-01) — Telegram/WhatsApp Stability + Connections Polish

*Status: Committed to main*

### What's New
- **WhatsApp disclaimer**: Dialog now shows "Utility flows only — reminders, OTP, notifications" with link to Agentin web app
- **Telegram connection polish**: Connection card now shows "Last message: X ago" from actual Telegram activity
- **Reminder dead-letter monitoring**: Failed Telegram reminder deliveries are now logged to `reminder_dead_letters` table; viewable via admin dashboard
- **Telegram status API**: `/api/integrations/telegram/status` now returns `connected`, `lastPing`, and `botConfigured` fields

### What's Fixed
- **Telegram disconnect atomicity**: Unlinking Telegram now uses a DB transaction — no more orphaned state if any of the 3 DB ops fail
- **Connection activity tracking**: `integrations.last_sync` now updates on every incoming Telegram/WhatsApp message (previously only updated on link)
- **Auth rate limits verified**: Login (10 req/15min) and signup (5 req/15min) limits confirmed working

---

## Post-Phase 75 (2026-02-28) — Infrastructure + CI Hardening

*Status: Committed to main*

### What's New
- **Staging environment**: Isolated staging on `staging.agentin.chat` with separate DB/Redis, shares AI services with production
- **Autonomy audit system**: 12-check automated audit (production health, staging, containers, disk, memory, OpenClaw, git, tests, SSL) runs daily via Cronicle
- **Scheduled monitoring**: Daily staging smoke tests and weekly Docker space reports via Cronicle

### What's Fixed
- **E2E test suite fully green**: Fixed 2 failing tests (logout strict mode violation, reminders test ordering interference) — CI now passes all 79 E2E tests
- **CI pipeline cleanup**: Removed redundant `test.yml` workflow that duplicated `ci.yml`
- **OpenClaw resilience**: Systemd watchdog timer ensures OpenClaw container alias survives Hostinger container recreation

### Under the Hood
- Added `data-testid="reminder-card-{id}"` to reminder cards for reliable E2E targeting
- Cronicle connected to geekspace network for direct staging container access
- Tracked Cronicle config reference in `ops/cronicle/` for reproducibility
- Autonomy loop tooling: orchestrator script, deploy script, smoke tests, rules document

---

## Phase 1 (2026-02-24) — Reliability + Image Generation

*Status: In Progress*

### What's New
- **Image generation**: Ask your agent to generate any image — "draw a cyberpunk city at night", "create a logo for my SaaS" — and get a live image back instantly. Powered by Pollinations.AI (free, no limits).

### What's Fixed
- **Cleaner Telegram/WhatsApp replies**: Action confirmations (like "Reminder set!" or "Site generated!") now only appear when an action actually ran. Previously they appeared on every message.
- **Connections page responsiveness**: Clicking "Connect" no longer freezes all other buttons on the page. Each integration now has its own loading state.
- **More stable server startup**: Scheduler failures are now logged with clear error messages instead of being silently swallowed.

### Under the Hood
- Health monitoring now supports up to 25 concurrent SSE connections (was 5)
- Server startup logs cluster/worker information for easier debugging
- Exponential backoff on connection status polling (reduces unnecessary API calls)

---

## Previous Phases

### Smart Escalation + Capabilities (2026-02-24)
- Telegram now uses native swipe-reply detection to route answers to the right visitor question
- Added "What Can I Do?" page showing all 20+ agent capabilities
- First-use guided tour walks new users through key features
- Generated websites now send a direct preview link in chat instead of "open your dashboard"

