# Autonomy Specification — GeekSpace 2.0

This document defines the rules, roles, cadence, and safety boundaries for autonomous multi-agent development sessions on GeekSpace 2.0.

---

## Agent Roles

### Builder (Code)
- **Purpose:** Implement features, fixes, and improvements
- **Allowed:** Edit application code, add tests, update ops docs, create branches, commit
- **Forbidden:** Direct production deploy, DB migrations without approval, delete production data, modify `.env` secrets, push to `main` without gate pass

### QA (Tests)
- **Purpose:** Verify implementations, run test suites, validate round-trip behavior
- **Allowed:** Run unit/integration/E2E tests, read code, report regressions, run smoke tests
- **Forbidden:** Edit application code, deploy, modify infrastructure

### Ops (Deploy)
- **Purpose:** Deploy to staging, run smoke tests, create PRs
- **Allowed:** Run `scripts/staging.sh`, run `scripts/smoke-staging.sh`, restart staging containers, create GitHub PRs
- **Forbidden:** Deploy to production (human-only), modify production Docker containers, change DNS/Caddy production routes, touch production `.env`

---

## Daily Cadence (6-Step Cycle)

Each autonomous session follows this sequence:

### Step 1: Audit
- Read `ops/AI_HANDOFF.md`, `ops/AI_PHASE_PLAN.md`, `ops/AI_BACKLOG.md`
- Run `cd server && npm test` — record baseline test count
- Check `git status`, confirm on `main` branch, no uncommitted changes
- Check production health: `curl -sf https://ai.geekspace.space/api/health`
- Check disk: `df -h /` — must have >1GB free
- Determine current phase number from handoff

### Step 2: Plan
- Create feature branch: `ai/phase-<N>-<topic>`
- Write 10-item phase plan to `ops/AI_PHASE_PLAN.md` following the required mix:
  - 2 reliability/bug fixes
  - 2 UI/UX/mobile-first improvements
  - 2 edge-case/state-sync/flow wiring fixes
  - 1 security hardening
  - 1 dev/ops improvement
  - 1 performance/scalability improvement
  - 1 small user-facing feature
- List risks, affected files, rollback notes

### Step 3: Implement
- Work through phase items in small batches
- Run tests after each batch (`cd server && npm test`)
- Verify to-and-fro functionality for every touched feature
- Commit incrementally with clear messages

### Step 4: Gate
- Run full phase gate: `./ops/phase-gate.sh --skip-e2e`
- All checks must pass: lint, typecheck, build, tests, coverage
- Run brand guard: `npm run brand-guard`
- If gate fails: fix issues, re-run. After 3 consecutive failures → STOP and escalate.

### Step 5: Stage
- Deploy to staging: `./scripts/staging.sh`
- Wait for health: `curl -sf https://staging.agentin.chat/api/health`
- Run staging smoke tests: `./scripts/smoke-staging.sh`
- All smoke checks must pass before proceeding

### Step 6: PR
- Update `ops/AI_HANDOFF.md` with completed work
- Update `ops/AI_RELEASE_NOTES.md` with user-facing changes
- Create PR targeting `main`: `./ops/pr-phase.sh`
- **STOP** — human reviews and merges PR

---

## Staging-First Policy

**Every change stages before production.**

- The autonomous loop NEVER deploys to production
- Production deploys are human-initiated only, from `main` branch
- Staging (`staging.agentin.chat`) is the furthest the loop can push
- Staging and production share AI services (Ollama, OpenRouter, Edith) but have isolated DBs and Redis

---

## Stop Conditions

The autonomous loop must STOP immediately and escalate if any of these occur:

| Condition | Severity | Action |
|-----------|----------|--------|
| Test regression > 5 tests from baseline | High | Stop, revert last batch, escalate |
| Production health endpoint fails | Critical | Stop all work, alert human |
| Staging health fails after deploy | High | Rollback staging, investigate |
| DB corruption detected (WAL errors, schema mismatch) | Critical | Stop, do NOT retry, escalate |
| Secret/credential exposed in code or logs | Critical | Immediately revert commit, escalate |
| Disk space < 1GB on `/` | High | Stop, run `docker system prune`, escalate |
| 3 consecutive phase gate failures | High | Stop, escalate — likely systemic issue |
| Memory usage > 90% sustained | Medium | Pause, check for container leaks |
| Any `git push --force` attempted | Critical | Block — never force push |
| Merge conflict on `main` | Medium | Stop, escalate — human resolves |

---

## Escalation Rules

### Low (informational)
- Deprecation warnings in build output
- Flaky test (passes on retry)
- Non-blocking lint warnings

**Action:** Log in handoff, continue.

### Medium (caution)
- Single test failure in unrelated module
- Build warning about chunk sizes
- Staging smoke test warning (not failure)

**Action:** Log in handoff, attempt fix if <5 min, otherwise note and continue.

### High (stop current task)
- Multiple test failures
- Gate failure after fix attempt
- Staging deploy failure
- Disk/memory pressure

**Action:** Stop current task. Write handoff with full context. Do not start new work.

### Critical (stop everything)
- Production health failure
- DB corruption
- Secret exposure
- Data loss risk

**Action:** Stop immediately. Write emergency handoff. Alert human via all available channels.

---

## Forbidden Actions (All Roles)

These actions are NEVER permitted in autonomous mode:

1. Deploy to production (`scripts/prod.sh`, `docker compose up` on production compose)
2. Modify production `.env` or `.env` secrets
3. Run destructive DB operations (DROP, TRUNCATE, DELETE without WHERE)
4. Force push any branch (`git push --force`)
5. Delete `main` or `live-production` branches
6. Modify systemd services or timers
7. Change DNS records or Caddy production routes
8. Access or modify other users' data
9. Install system-level packages without approval
10. Modify fail2ban, firewall, or SSH configuration

---

## Session Budget

- **~65% context window:** Compact and summarize, write interim handoff
- **~80% context window:** Stop adding scope, finish current items only
- **~90% context window:** Write final handoff immediately, commit all work

---

## Verification Checklist (End of Session)

- [ ] All phase items implemented or explicitly deferred with reason
- [ ] Test count >= baseline (no regressions)
- [ ] Phase gate passed (`./ops/phase-gate.sh --skip-e2e`)
- [ ] Staging deployed and smoke tests passing
- [ ] `ops/AI_HANDOFF.md` updated with current state
- [ ] `ops/AI_RELEASE_NOTES.md` updated
- [ ] PR created (or work committed on feature branch)
- [ ] No uncommitted changes left
