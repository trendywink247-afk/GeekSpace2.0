# REFACTOR PLAN — Industry-Grade Hardening

**Date:** 2026-02-23
**Branch:** `refactor/industry-grade-hardening-2026-02-23`
**Phase:** 0+1 complete. Phase 2 commits listed below.

---

## Guiding Principles

1. **No schema changes** — All work is application-level code
2. **No destructive DB operations** — No DROP, TRUNCATE, ALTER TABLE modifications
3. **Backward compatible** — Old app version continues working against same DB
4. **Test-first** — Write tests before or alongside each fix
5. **Small, atomic commits** — Each commit is independently deployable
6. **Feature-flagged** — Behavioral changes gated by config where appropriate

---

## Phase 2 — Commit Plan (Ordered)

### Commit 1: `test: add multi-user data isolation tests`
**What changes:**
- New file: `server/src/test/api/isolation.test.ts`
- Creates 2 test users (A and B)
- Tests that User A cannot read/write User B's: reminders, memory, pico agents, pico tasks, artifacts, automations, portfolio (private), activity log
- Tests that public endpoints (portfolio view, directory) only expose intended data

**How tested:** `cd server && npm test` — new test file runs alongside existing 48 tests

**Risk:** None — read-only test addition

---

### Commit 2: `feat: enforce "at least 1 Weebo always active" rule`
**What changes:**
- `server/src/services/pico-fleet.ts` — In `updateAgent()`, if `enabled = false` and this is the last enabled agent for user, throw error
- `server/src/routes/pico.ts` — Return 400 with clear message
- `src/dashboard/pages/PicoFleetPage.tsx` — Disable toggle on last active agent, show tooltip
- New test: `server/src/test/api/pico-fleet.test.ts` — Tests CRUD, disable last agent rejection

**How tested:** Unit test for backend enforcement + manual UI verification

**Risk:** Low — additive validation. Users with all agents already disabled will be prompted to enable one on next visit.

---

### Commit 3: `fix: SSRF protection in pico-fleet call_api task`
**What changes:**
- `server/src/services/pico-fleet.ts` — Add URL validation before `fetch()` in `call_api`/`n8n_webhook` task handler:
  - Block private IPs (10.x, 172.16-31.x, 192.168.x, 127.x, ::1)
  - Block internal Docker hostnames (redis, picoclaw, geekspace, ollama)
  - Allow only http/https protocols
- New test: Verify blocked URLs return error, allowed URLs proceed

**How tested:** Unit test with mocked fetch

**Risk:** Low — rejects previously-allowed dangerous URLs. Legitimate external API calls unaffected.

---

### Commit 4: `fix: require n8n webhook secret, reject empty`
**What changes:**
- `server/src/routes/webhooks.ts` — If `N8N_WEBHOOK_SECRET` is empty string, reject n8n webhook requests with 503
- Log warning on startup if n8n routes are enabled but secret is empty

**How tested:** Unit test for secret enforcement

**Risk:** Low — n8n profile is optional and rarely used

---

### Commit 5: `fix: rate-limit SSE streaming endpoints`
**What changes:**
- `server/src/routes/agent.ts` — Apply rate limiter middleware to `/chat/stream` and health SSE endpoints
- Use existing rate limit config, separate window for SSE (longer window, lower max)

**How tested:** Manual test + existing E2E stream tests must still pass

**Risk:** Low — only adds rate limiting, doesn't change functionality

---

### Commit 6: `test: add pico-fleet unit tests (CRUD, task queue, worker)`
**What changes:**
- New file: `server/src/test/api/pico-fleet.test.ts`
- Tests: agent CRUD, slot limits by plan, task queueing, idempotency, cancel, cron jobs
- Tests: worker processes tasks in round-robin order
- Tests: disabled agents are skipped by worker

**How tested:** `cd server && npm test`

**Risk:** None — test-only addition

---

### Commit 7: `test: add billing and subscription tests`
**What changes:**
- New file: `server/src/test/api/billing.test.ts`
- Tests: GET subscription, credit deduction, plan limits, plan upgrade/downgrade
- Tests: free user credit cap, day pass logic

**How tested:** `cd server && npm test`

**Risk:** None — test-only addition

---

### Commit 8: `test: add automation route tests`
**What changes:**
- New file: `server/src/test/api/automations.test.ts`
- Tests: CRUD, trigger types, webhook trigger, manual trigger, ownership verification

**How tested:** `cd server && npm test`

**Risk:** None — test-only addition

---

### Commit 9: `fix: add Zod validation to unvalidated routes`
**What changes:**
- Add Zod schemas + `validate()` middleware to the 4 routes identified in prior audit as missing validation
- Specific routes TBD after identifying which 4 (from AUDIT-2026-02-17)

**How tested:** Existing tests + new validation rejection tests

**Risk:** Low — may reject previously-accepted malformed requests (improvement)

---

### Commit 10: `chore: cleanup stale files`
**What changes:**
- Delete: `import { test, expect } from '@playwright` (accidental file)
- Delete: `ci-artifacts-22242784676/` (stale CI artifacts)
- Delete: `add-demo-accounts.mjs` (superseded by seedDemoData)
- Delete: Root `Caddyfile` (superseded by `caddy/Caddyfile`)
- Delete: Root `vitest.config.ts` (unreferenced)
- Add `ci-artifacts-*` to `.gitignore`

**How tested:** `npm run build` + `cd server && npm run build` + `cd server && npm test` — verify nothing breaks

**Risk:** Very low — all files confirmed unreferenced

---

### Commit 11: `fix: add portfolio chat visitor rate limiting`
**What changes:**
- `server/src/routes/agent.ts` — Add per-IP rate limit on public portfolio chat endpoint
- Limit: 10 messages per 5 minutes per IP
- Prevents memory pollution spam attack

**How tested:** Manual test + existing E2E portfolio tests

**Risk:** Low — only affects anonymous visitors, authenticated users unaffected

---

### Commit 12: `docs: update audit and plan documents`
**What changes:**
- Update AUDIT_REPORT.md with Phase 2 completion status
- Update TEST_REPORT.md with new test counts
- Update SECURITY_REPORT.md with remediated items
- Final DEPLOYMENT_RUNBOOK.md review

**How tested:** N/A — documentation only

**Risk:** None

---

## Phase 3 — Future Work (Not in This Branch)

These items are identified but deferred:

1. **JWT httpOnly cookies** — Migrate token storage from localStorage to httpOnly cookies
2. **Token revocation** — Redis-backed JWT blacklist for logout/password-change
3. **OAuth state validation** — Verify CSRF state parameter in Google/GitHub OAuth
4. **Secret rotation tooling** — Automated key rotation documentation
5. **npm audit remediation** — Address any vulnerable dependencies
6. **PII scrubbing in logs** — Add Pino redact rules for email, IP, tokens
7. **Comprehensive E2E expansion** — Cover billing, admin, media generation, OAuth
8. **Edith bridge deprecation** — Remove from CI workflows, archive code
9. **DB migration framework** — Add proper versioned migration system with prod guards

---

## Success Criteria

Phase 2 is complete when:
- [ ] All 48 existing tests still pass
- [ ] New isolation tests pass (Commit 1)
- [ ] New pico-fleet tests pass (Commits 2, 6)
- [ ] New billing tests pass (Commit 7)
- [ ] New automation tests pass (Commit 8)
- [ ] SSRF protection active (Commit 3)
- [ ] n8n webhook hardened (Commit 4)
- [ ] SSE rate limited (Commit 5)
- [ ] Stale files removed (Commit 10)
- [ ] CI pipeline passes (both `ci.yml` and `test.yml`)
- [ ] Zero schema changes to production DB
- [ ] Zero downtime deployment possible
