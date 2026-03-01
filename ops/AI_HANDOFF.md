# AI Handoff — Post-Phase 78 (Telegram/WhatsApp Stability + Connections Polish)

**Date:** 2026-03-01
**Branch:** `main`
**Tests:** 78 server unit test files | 916 tests (all passing)
**CI:** Phase gate 7/7 ✅ | Smoke tests 11/11 ✅
**Brand Guard:** 0 violations
**Build:** Clean (frontend + server)

---

## Compaction Recovery Rule (MANDATORY)
If the conversation is compacted, before doing ANY work:
1. Re-read: `CLAUDE.md`, `ops/AI_HANDOFF.md`, `ops/AI_PHASE_PLAN.md`, `ops/AI_FEATURE_MATRIX.md`
2. Run: `git status && git branch --show-current && git log --oneline -5`
3. Print a brief "Rehydrated Context" summary (phase, branch, current tasks, constraints)
4. Only then continue implementation — never rely on memory from compacted context

---

## Post-Phase 78 — What Was Done

**Theme:** Telegram/WhatsApp Stability + Connections Polish

### New Capabilities

**GET /api/integrations/telegram/status (enhanced)**
- Added `connected` (alias for `linked`) boolean field
- Added `lastPing` (alias for `last_message_at` from channel_links)
- Added `botConfigured` flag (`!!config.telegramBotToken`)
- Frontend `api.ts` type updated accordingly

**Telegram Disconnect Atomicity (78.3)**
- `DELETE /api/integrations/telegram/link` now wraps 3 DB ops in `db.transaction()`
- channel_links delete + integrations status update + activity_log insert = one atomic op
- Prevents orphaned state if any of the three operations fail

**Telegram /start Command Auto-Registration (78.4 — verified pre-existing)**
- `/start link_{code}` deep link flow was already complete in `webhooks.ts`
- `handleLinkCode()` function creates channel_links + updates integrations + deletes used code
- Tests added to verify all parts of the flow

**WhatsApp Platform Policy Disclaimer (78.5)**
- Added green disclaimer box in ConnectionsPage.tsx WhatsApp QR dialog
- Text: "Utility flows only — reminders, OTP, and notifications. AI chat via Agentin web app [link]"
- Displayed during `show-qr` step with link to `ai.agentin.chat`

**Telegram lastPing in ConnectionsPage (78.6)**
- `telegramLastPing` state added — fetches from `GET /telegram/status` on mount
- Displays "Last message: X ago" in the Telegram connection card (cyan color)
- message-router.ts now also updates `integrations.last_sync` when a message is processed
  - Ensures "Last synced: X ago" on the card reflects real activity

**Reminder Dead-Letter Table (78.7)**
- Added `reminder_dead_letters` table to DB (additive migration via `db.exec`)
- Columns: id, reminder_id, user_id, channel, error, attempts, last_attempt_at, created_at
- reminder-scheduler.ts logs to dead_letters when `sendTelegramMessage` returns `{success:false}`
  - Note: `sendTelegramMessage` already retries 3x internally before returning failure
  - Error field: `'send_failed_after_retries'`
- Admin endpoint: `GET /api/admin/dead-letters` — returns last N failed reminder deliveries
  - Includes reminder text, username, channel, error, attempts, timestamps

**Auth Rate Limits (78.8 — verified pre-existing)**
- login: 10/15min with `skipSuccessfulRequests: true`
- signup: 5/15min
- refresh: 10/15min
- Tests added to verify presence

### Files Changed
- `server/src/routes/integrations.ts` — status endpoint + atomic disconnect
- `server/src/routes/admin.ts` — dead-letters endpoint
- `server/src/db/index.ts` — reminder_dead_letters table migration
- `server/src/services/reminder-scheduler.ts` — dead-letter logging on Telegram failure
- `server/src/services/message-router.ts` — update integrations.last_sync on message
- `src/dashboard/pages/ConnectionsPage.tsx` — WhatsApp disclaimer + telegramLastPing
- `src/services/api.ts` — updated checkTelegramLink type with new fields
- `server/src/test/api/phase78.test.ts` (NEW) — 24 tests covering all Phase 78 changes

---

## Verification Status
- [x] Tests: 916/916 passed (78 test files)
- [x] Phase gate: 7/7 ✅
- [x] Brand guard: 0 violations
- [x] TypeScript: clean (frontend + server)
- [x] Staging: 11/11 smoke tests ✅
- [x] Merged to main (30cb010)
- [x] Pushed to origin/main

---

## Known Issues / Open Risks
- Pre-existing chunk size warning (index.js 738kB, recharts 431kB) — bundle splitting still pending
- `job-queue.ts` handlers still not wired to actual voice/image routes
- Dead-letters only captures Telegram reminder failures — WhatsApp failures not yet tracked
- `telegramLastPing` is fetched via separate API call on mount (could be consolidated into integrations GET)

---

## Architecture Notes
- `integrations.last_sync` is now updated on every Telegram/WhatsApp message in message-router
- `channel_links.last_message_at` = last message from user to bot
- `integrations.last_sync` = last message received (same as above now)
- `reminder_dead_letters` does NOT track send errors for reminders with no channel_link (those are logged as warn, not dead-lettered)

---

## Next Steps (Phase 79 candidates)
- Bundle splitting: code-split recharts + index.js (Phase 77/78 deferred)
- Wire job queue handlers to voice/image service calls
- Frontend job status polling (`GET /api/jobs/:id`)
- CSRF tokens (mentioned in phase 75/76/77/78 open risks — still open)
- Virtual scroll for long chat history
- WhatsApp dead-letter support (not just Telegram)
- Next release train candidate: Phase 80

## Merge Status
Merged `ai/phase-20260302-phase78` → `main` (30cb010)
Pushed to `origin/main`
