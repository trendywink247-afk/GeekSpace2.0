# Phase 3 Plan — Escalation Verification + UX Polish + Hardening

**Branch:** `ai/phase-YYYYMMDD-<topic>` (create when ready)
**Status:** 📋 Planning

---

## Phase 3 Items (5)

### 1. 🐛 Critical Fix — Verify Escalation Wiring End-to-End
**Files:** `server/src/routes/webhooks.ts`
**Context:** The plan file `dapper-hatching-hopcroft.md` describes 3-tier escalation:
- Tier 1: native Telegram reply (match by notifMessageId)
- Tier 2: keyword match from pending escalations
- Tier 3: fallthrough to normal chat
**Verification:** Audit `handleEscalationReply()` in webhooks.ts — confirm all 3 tiers implemented,
notifMessageId is read from Redis, and real chat requests (like "build me a page") are NOT
swallowed as escalation answers.
**Risk:** Exploratory. May be already complete (per previous session summary). If already done, skip
to next item.

### 2. 🎨 UI/UX — Reminder Snooze Buttons
**File:** `src/dashboard/pages/RemindersPage.tsx`
**Problem:** No snooze option — users can only complete or dismiss a reminder, not defer it.
**Fix:** Add snooze dropdown on each reminder card:
- "1 hour" → update datetime to now+1h
- "Tomorrow" → update datetime to tomorrow at same time
- "Custom" → open time picker
**Risk:** Medium — requires API endpoint `PATCH /api/reminders/:id` with `datetime` update, plus UI change.

### 3. 🛡 Edge-Case Hardening — CSP Nonce Policy
**File:** `server/src/app.ts`
**Problem:** Helmet CSP uses `unsafe-inline` for script-src — bypasses XSS protection.
**Fix:** Use `nonce-based` CSP:
- Generate per-request nonce via `crypto.randomBytes(16).toString('base64')`
- Pass to Helmet `scriptSrc: ["'self'", (req, res) => \`'nonce-${res.locals.nonce}'\`]`
- Note: Frontend is SPA — inline scripts in index.html need nonce attribute or must move to external scripts
**Risk:** High — may break frontend rendering if any inline scripts exist. Requires careful audit first.
  Consider doing static audit first and only implementing if no inline scripts found.

### 4. 🔧 Dev/Ops — Unit Tests for Action Dedup + Message Router
**File:** `server/src/test/api/` (new test file: `message-router.test.ts`)
**Problem:** action dedup logic (Phase 1) and video/image channel handling have no unit coverage.
**Fix:** Add tests for:
- Action dedup: same message in finalReply → not appended again
- `generate_code` → preview URL appended
- `generate_image` → 🖼️ URL appended
- `generate_video` → 🎬 Video: URL appended
**Risk:** Low — test-only, no production code changes.

### 5. 🌟 Feature — Dashboard Overview Sparklines
**File:** `src/dashboard/pages/OverviewPage.tsx`
**Problem:** Overview stats cards show single numbers with no trend — hard to know if things are improving.
**Fix:** Add 7-day sparkline chart (recharts, already in deps) to each stat card:
- Messages sent per day (7d)
- Credits used per day (7d)
- Reminders completed per day (7d)
**Backend:** Use existing `/api/usage` data, aggregate by day in frontend.
**Risk:** Low — additive UI change, existing recharts dep.

---

## Verification Plan

```bash
cd server && npm test                            # must stay 113+ passing
npm run lint && npx tsc --noEmit && npm run build
cd server && npx tsc --noEmit && npm run build
./ops/phase-gate.sh --skip-e2e
```

## Definition of Done

- [ ] All items implemented (or skipped with documented reason)
- [ ] 113+ unit tests passing
- [ ] lint/typecheck/build green
- [ ] PR #32 opened with evidence
- [ ] AI_HANDOFF.md updated
- [ ] Phase 4 proposed
