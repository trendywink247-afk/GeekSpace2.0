# Phase 2 Plan — Onboarding + Video Gen + Channel Cleanup

**Branch:** `ai/phase-20260224-onboarding-cleanup`
**Started:** 2026-02-24
**Status:** 🔄 In Progress

---

## Phase 2 Items (5)

### 1. 🐛 Critical Fix — WhatsApp Silent Drop + Webhook Security
**File:** `server/src/services/whatsapp.ts`
**Problem:**
- `sendWhatsAppMessage()` silently drops all messages (no-op stub)
- `verifyWhatsAppWebhook()` returns `true` when token not configured (security hole)
**Fix:**
- Replace stub with logger.warn + informative error so callers handle gracefully
- Require webhook token in production; only bypass in explicit dev/test mode
**Risk:** Low — no API keys available; makes silent failure explicit and observable.

### 2. 🎨 UI/UX — Onboarding Polish
**Files:** `src/onboarding/OnboardingWizard.tsx` (or whichever file has the wizard steps)
**Problem:** No step progress indicator, no escape hatch, no visual progress feedback.
**Fix:**
- Add "Step X of Y" header with animated progress bar
- Add "Sign in as a different account" link at bottom → calls logout()
**Risk:** Low — UI-only, no auth logic changes.

### 3. 🛡 Edge-Case Hardening — Stale Channel Link Cleanup
**Files:** `server/src/services/artifact-cleanup.ts` OR new scheduler function
**Problem:** Channel links in DB accumulate indefinitely — no TTL, no inactive cleanup.
**Fix:**
- Add `purgeStaleChannelLinks()`: DELETE WHERE `last_message_at < 90 days ago`
- Run daily alongside existing artifact cleanup scheduler
- Log count of purged records
**Risk:** Very low — read-first, only deletes old inactive links.

### 4. 🎬 New Feature — Video Generation (Pollinations.AI)
**Files:**
- `server/src/prompts/openclaw-system.ts` — document `generate_video` tool
- `server/src/services/action-executor.ts` — add `videoUrl` to ActionResult
- `server/src/services/message-router.ts` — handle video URL in channel reply
**Implementation:** Schema + executor already exist. Mirrors generate_image pattern exactly.
**Risk:** Low — additive only, graceful error on failure.

### 5. 🔧 Dev/Ops — Chat Rate Limit Relaxation + Backlog Update
**File:** `server/src/app.ts`
**Problem:** Chat rate limit is 30/15min (2/min) — blocks power users testing features.
**Fix:** Increase to 60/15min (4/min) — still protective, less friction for legitimate use.
**Also:** Update ops/AI_BACKLOG.md to mark Phase 1+2 items complete.

---

## Verification Plan

```bash
cd server && npm test                            # must stay 113/113
npm run lint && npx tsc --noEmit && npm run build
cd server && npx tsc --noEmit && npm run build
```

## Definition of Done

- [ ] All 5 items implemented
- [ ] 113+ tests passing
- [ ] lint/typecheck/build green
- [ ] PR opened with evidence
- [ ] AI_HANDOFF.md updated
- [ ] Phase 3 proposed
