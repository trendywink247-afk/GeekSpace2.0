# Architecture: CI/CD Pipeline

> Sub-document of [AGE-64](/AGE/issues/AGE-64) (architecture audit). See also `ARCHITECTURE.md` (umbrella, authored by CTO in [AGE-68](/AGE/issues/AGE-68)) and `CLAUDE.md §CI/CD & Deployment`.
>
> <!-- snapshot: 2026-04-20T00:30:00Z -->

---

## 1. `.github/workflows/ci.yml` — Annotated

### Trigger conditions

| Event | Condition | Effect |
|-------|-----------|--------|
| `push` | Branch `main`, non-doc paths | All checks + auto-deploy staging |
| `pull_request` | Target `main`, non-doc paths | All checks (no deploy) |
| `workflow_dispatch` | Manual, `deploy_target` input | Checks + conditional deploy |

**Paths-ignore** (CI skips entirely if only these change):

```text
**/*.md   docs/**   .gitignore   LICENSE
```

This means documentation PRs (including `docs/arch-repo.md` and `docs/arch-ci.md`) bypass CI completely. Intentional: docs don't affect runtime correctness.

> **AGE-72 update (2026-04-20)**: `paths-ignore` was removed — see [PR #324](https://github.com/trendywink247-afk/GeekSpace2.0/pull/324). Branch protection requires the `Summary` check on every PR; skipping the workflow for docs-only PRs left them permanently `BLOCKED`. Docs PRs now run the full pipeline (~6 min) so `Summary` reports success.

**Concurrency**: `group: ci-${{ github.ref }}`, `cancel-in-progress: true` — a new push to a branch cancels the prior in-flight run for that branch.

---

### Job graph

```text
┌─ lint-and-typecheck   (timeout: 8m)  ─┐
├─ build-frontend       (timeout: 8m)  ─┤
├─ build-server         (timeout: 6m)  ─┤
├─ unit-tests-frontend  (timeout: 8m)  ─┼─→ summary ─→ deploy-staging / deploy-production
├─ unit-tests-server    (timeout: 8m)  ─┤         └─→ promote-branches (prod only)
├─ e2e-tests            (timeout: 15m) ─┤
└─ security-scans       (timeout: 10m) ─┘

notify-failure  (triggers on summary failure, main branch pushes only)
```

All seven jobs feed into `summary`. `summary` is the **required status check** that branch protection enforces. Deploy jobs depend on `summary`, so they cannot run unless all seven pass.

---

### Job-by-job annotation

#### `lint-and-typecheck` (8 min)

- Checks out with `fetch-depth: 0` (needed for `git diff base...head` to scope lint to changed files).
- **Installs**: root deps (`npm ci`) + server deps (`npm --prefix server ci`, `NODE_ENV=development` to pull `@types/*`).
- **Lint**: computes changed `.ts/.tsx/.js/.jsx` files between base and head. If no JS/TS changed, skips. Runs `npx eslint --max-warnings=0 $CHANGED_FILES` — zero warnings allowed on changed files.
- **Typecheck root**: `npx tsc --noEmit` (React frontend, strict).
- **Typecheck server**: `npm --prefix server run typecheck` (`tsc --noEmit`, ES-module strict).

> CI lints **changed files only** — not the full repo. Full-repo lint runs nightly in `lint-full.yml` (non-blocking, tracks lint debt). This means a new PR can introduce warnings in untouched files without failing CI.

#### `build-frontend` (8 min)

- Installs root deps.
- Runs `npx vite build` with `VITE_TEST_MODE=true` (disables some runtime checks that require a live backend).
- Validates that the frontend bundles without error. Does **not** publish the `dist/` artifact — the actual deploy rebuilds on the VPS host.

#### `build-server` (6 min)

- Installs server deps (`NODE_ENV=development`).
- Runs `npm --prefix server run build` (`tsc` → `server/dist/`).
- Validates TypeScript compiles cleanly.

#### `unit-tests-frontend` (8 min)

- Installs root deps.
- Runs `npm test` (`vitest run` from root, tests in `tests/`).

#### `unit-tests-server` (8 min, previously 15 min before AGE-45 tuning)

- Installs server deps (`NODE_ENV=development`).
- Runs `npm --prefix server run test` (`TEST_MODE=true vitest run`). `TEST_MODE=true` activates MSW mock handlers for LLM providers, Telegram, Stripe, and Razorpay — no real API calls in tests.

> The timeout was bumped from 8 min → 15 min in PRs #310 and #311 after the agentic v3 test suite expansion caused occasional timeout failures. **Current timeout: 8 min** (reverted — verify with `gh pr view 311`). <!-- TODO: verify exact current timeout value in the live workflow -->

#### `e2e-tests` (15 min) — **merge-gating since AGE-22**

- Full build (frontend + server) inside the runner.
- Caches Playwright browsers by `runner.os + package-lock.json` hash; installs system deps on cache hit path.
- Runs `npx playwright test --project=chromium --reporter=list,junit` (Chromium only in CI).
- Environment: `CI=true`, `TEST_MODE=true`, dummy `JWT_SECRET`, `ENCRYPTION_KEY`, `DB_PATH=/tmp/e2e-test.db`, `NODE_ENV=test`.
- Uploads Playwright HTML report + JUnit XML as artifacts (7-day retention).

> Prior to AGE-22, E2E ran with `continue-on-error: true` and was excluded from `summary`'s `needs:`. 26 consecutive CI runs were green, so it was promoted to a hard gate.

#### `security-scans` (10 min) — **merge-gating since AGE-22**

Four sub-steps, each individually noted:

| Step | What it checks | Gate history |
|------|---------------|--------------|
| **Validate Caddyfile** | Downloads Caddy v2.8.4 binary, runs `caddy validate --config caddy/Caddyfile --adapter caddyfile`. Only runs if `caddy/Caddyfile` changed. | GATING. 100% pass rate (26/26 runs). |
| **Validate OpenAPI spec** | `npx @redocly/cli lint openapi/openapi.yaml --skip-rule no-unused-components`. | GATING. Fixed under [AGE-34](/AGE/issues/AGE-34) (18 nullable errors rewritten as OpenAPI 3.1 type unions). |
| **Audit dependencies** | `npm audit --audit-level=critical` (root + server). | GATING. `\|\| true` removed under [AGE-35](/AGE/issues/AGE-35) after protobufjs CVE resolved to 7.5.5. |
| **gitleaks** | `gitleaks/gitleaks-action@v2` — scans commit history for leaked secrets. | GATING. 100% pass (26/26). |
| **Semgrep SAST** | `returntocorp/semgrep-action@v1` with rulesets `p/security-audit p/typescript p/nodejs p/react`. New findings block the job. | GATING since [AGE-39](/AGE/issues/AGE-39), which cleared all 26 pre-existing findings (each fixed or suppressed with a `// nosemgrep: <rule-id> — <reason>` annotation). |

The remaining four steps use `if: always()` so an OpenAPI lint failure does not short-circuit the other scans.

#### `summary` (always)

Collects the `result` fields from all seven jobs and fails if any is not `success`. Writes a markdown table to the GitHub Actions step summary. This job is the **required status check** that branch protection enforces.

#### `deploy-staging` (10 min) — runs on `push` to `main` after `summary` passes

Depends on `summary` (which transitively waits for E2E + security).

SSH workflow (`appleboy/ssh-action@v1`, `DEPLOY_HOST` + `DEPLOY_SSH_KEY` secrets, 8m command timeout):

1. Abort any stuck merge/rebase on the VPS (`git merge --abort`, `git rebase --abort`).
2. Hard-reset to `origin/main`, clean worktree.
3. Tag previous staging image as `:previous` for rollback.
4. Build frontend on the VPS host: `npm ci && npx vite build`.
5. Rsync `dist/` → `/srv/staging/` (Caddy static root for staging, `--delete`).
6. `docker compose up -d --build staging` (BuildKit enabled).
7. Health check loop: 30 × 2s polls to `http://localhost:3002/api/health`.
8. **Smoke check**: compare `GET /api/health/version` commit vs expected `GIT_SHA`. On mismatch → rollback to `:previous` image and exit 1.
9. Record deploy duration to Prometheus textfile collector (`/var/lib/prometheus/textfile_collector/deploy_staging.prom`).

#### `deploy-production` (10 min) — manual dispatch only (`deploy_target: production`)

Runs after `summary`. Protected by GitHub `production` environment (requires approval in GitHub UI).

SSH workflow (same host, `command_timeout: 8m`):

1. Abort stuck git operations.
2. **Dirty-tree check**: fails loudly if the VPS working tree has local edits (safety guard).
3. Hard-reset to `origin/main`.
4. Tag previous production image as `:previous` for rollback.
5. Build frontend on host + rsync `dist/` → `/srv/prod/` (with `--delete`) **before** container restart. This prevents a window where new API code runs with old static assets (or vice versa).
6. `docker compose build --build-arg GIT_SHA=$GIT_SHA geekspace` (BuildKit).
7. `docker compose up -d geekspace`.
8. Health check loop: 30 × 2s polls to `http://localhost:3001/api/health`.
9. Smoke check: `GET /api/health/version` must report `$GIT_SHA`. On failure → rollback.
10. Git tag `prod-<timestamp>-<sha>` pushed to origin (enables `git describe --tags --match 'prod-*'` to identify live production commit).
11. Verify public URL `https://ai.agentin.chat/api/health`.
12. `docker image prune -f --filter "until=72h"`.

> Staging is deliberately **not** rebuilt during a production deploy. Staging is meant to stay ahead of production. To mirror staging to prod, run `staging-only` dispatch separately.

#### `notify-failure` — fires on `summary` failure, main-branch pushes only

Sends a Telegram message with the failing commit SHA and Actions run URL:

```text
🔴 CI failed on main
Commit: <sha>
Run: <run_url>
```

Uses `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` secrets. Skips silently if secrets are not set (avoids hard failure in forks or environments without Telegram configured).

#### `promote-branches` — fires after `deploy-production` succeeds

Force-pushes `main` to the two tracking branches:

```bash
git push origin HEAD:staging --force
git push origin HEAD:live-production --force
```

These branches serve as audit trails and are used by external tooling (e.g. Grafana annotations, Uptime Kuma) to correlate the current live state. **Never delete `staging` or `live-production`.**

---

### Other workflows

#### `.github/workflows/deploy.yml` — Emergency Rollback

Manual dispatch. Accepts `commit_sha` (required) and `skip_staging` (bool, default false). SSHs to the VPS and resets both prod and staging (unless skipped) to the specified commit SHA. Used only when CI auto-rollback fails or a post-deploy regression is found after manual promotion.

#### `.github/workflows/lint-full.yml` — Nightly Full Lint

Runs at `02:30 UTC` (03:00 AM UTC — nightly) and on `workflow_dispatch`. Lints the entire repo (not just changed files). **Non-blocking** — failures do not gate merges. Used to track and gradually pay down lint debt across the full codebase.

#### `.github/workflows/ops-remote-exec.yml` — Ops Remote Exec

Manual dispatch for VPS operations: Litestream install, status check, and restore drill. Reads Cloudflare R2 credentials from the `production-ops` GitHub Environment.

#### `.github/workflows/dependabot-auto-merge.yml` — Dependabot Auto-merge

Auto-merges Dependabot PRs that pass CI. Minor and patch updates are auto-approved; major version bumps require manual review.

---

## 2. `scripts/` Inventory

<!-- snapshot: 2026-04-20T00:30:00Z -->

| Script | When it fires | What it does |
|--------|--------------|--------------|
| `backup-db.sh` | Daily cron (03:00 VPS local) via Cronicle | SQLite `.backup` → `/root/backups/geekspace/geekspace-YYYY-MM-DD-HHMMSS.db.gz`. 30-day local retention; weekly backups kept 4 weeks. WAL-safe (checkpoints before snapshot). |
| `backup-drill.sh` | Nightly via Cronicle | Locates DB (Docker volume → dev path), creates drill backup to `/root/backups/drill-YYYYMMDD.db`, restores to temp, runs `PRAGMA integrity_check`, logs PASS/FAIL to `ops/reports/backup-drill-YYYYMMDD.txt`. |
| `cronicle-autonomy-audit.sh` | Daily via Cronicle | Read-only health check: prod up/down, disk space, container health, unit test pass/fail. **Never commits, pushes, or deploys.** Exit 0 = warnings OK; exit 1 = infra critical; exit 2 = tests failing. |
| `cronicle-launch-check-wrapper.sh` | `02:30 UTC` daily via Cronicle (job `gs_prelaunch_check`) | Runs `launch-check.sh`, then posts the summary to Telegram. Wraps the launch check in a Telegram-notification harness. |
| `deploy-caddy.sh` | Manual (ops, root required) | Copies `caddy/Caddyfile` (canonical, version-controlled) to `/etc/caddy/Caddyfile`, validates with `caddy validate`, and reloads Caddy. Supports `--dry-run` and `--diff` flags. Exists because the host Caddy config historically diverged from the repo copy. |
| `health-check.sh` | Every 4 hours via cron | Checks API health endpoint, Redis, Meilisearch, Qdrant, disk space, container states. Logs to `/var/log/geekspace-health.log`. Sends Telegram alert on failure. |
| `launch-check.sh` | Manual or via `cronicle-launch-check-wrapper.sh` | Runs all automatable items from `ops/LAUNCH_CHECKLIST.md` against a configurable `BASE_URL` (default `https://api.agentin.chat`). Results written to `ops/reports/launch-check-YYYYMMDD.txt`. Exit 0 = all pass, exit 1 = failures. |
| `load-test.sh` | Manual / pre-deploy | Simulates 40 concurrent users, 60s duration. Targets `GET /api/health` and `POST /api/agent/chat` with a demo token. Results → `ops/reports/load-test-YYYYMMDD.txt`. |
| `nightly-ai-audit.sh` | `07:00 UTC` daily via Cronicle | Reads `.pi/FULL_AUDIT.md`, sends to Claude Bridge (`localhost:8787`) for AI analysis, reports findings via Telegram. Exit 0 always (Cronicle compatibility). |
| `offsite-backup.sh` | Daily via cron (after `backup-db.sh`) | Syncs `/root/backups/` to the primary `offsite` rclone remote (configurable). Supports `--dry-run`. |
| `pr-phase.sh` | Called via SSH from OpenClaw's `pr-create` bin | Creates a GitHub PR from the current branch → main with a structured title using `gh pr create`. Accepts `--phase`, `--type`, `--tests`, `--branch` args. |
| `queue.sh` | Manual (OpenClaw phase queue management) | CLI for reading and managing the phase queue at `ops/phase-queue.txt`. Commands: `status`, `add`. |
| `secondary-backup.sh` | Weekly (Sundays `04:00`) via cron | Syncs `/root/backups/` to a second `offsite-b2` rclone remote (Backblaze B2 by default). Complements `offsite-backup.sh` for two-remote redundancy. |
| `setup-offsite-backup.sh` | Manual (one-time setup) | Prints rclone setup instructions, optionally runs `rclone config` interactively (`--interactive`), installs the cron job (`--cron`). |
| `smoke-staging.sh` | After staging deploy (called from CI or manually) | Runs key endpoint checks against `staging.agentin.chat` (or a supplied `BASE_URL`). Reports PASS/FAIL/WARN per check. |
| `spawn-agent.sh` | Manual / OpenClaw orchestration | Launches a Claude agent (builder/checker/etc.) with a prompt file via `claude-remote`. Logs to `ops/reports/agent-<type>-<timestamp>.log`. Notifies Telegram on start/finish. |
| `staging.sh` | Manual (mirrors CI staging path) | Deploys the current `main` to the staging container using the same `docker compose up -d --build staging` path that CI uses. Supports `--file staging` for the legacy `docker-compose.staging.yml` path. |
| `weekly-audit.sh` | Weekly via Cronicle | Generates a weekly audit report at `ops/reports/weekly-audit-YYYY-MM-DD.md` and posts a summary to Telegram. |

**Scripts referenced in `CLAUDE.md` but not present in `scripts/`:**

| Script | Status |
|--------|--------|
| `focus-module.sh` | `TODO: verify` — not found in `scripts/` as of 2026-04-20. `CLAUDE.md` documents it as modifying `.claudeignore` to hide non-focus modules; it may have been removed or never committed. |

---

## 3. Branch Model

### Branches

| Branch | Purpose | How it gets updated |
|--------|---------|---------------------|
| `main` | Development trunk — canonical source of truth | Direct push (CTO/ops) or PR merge |
| `staging` | Tracks what last shipped to staging post-prod-deploy | Force-pushed from `main` by `promote-branches` job after every production deploy |
| `live-production` | Tracks what last shipped to production | Force-pushed from `main` by `promote-branches` job after every production deploy |
| `agent/*/...` | Agent feature branches | Created by agents (e.g. `agent/fullstack-a/AGE-67-arch-docs`), merged to `main` via PR |
| `cto/...` | CTO hotfix/ops branches | Merged to `main` via PR or direct push |

### Development flow

```text
feature branch  →  PR to main  →  CI all-green  →  Squash-merge to main
                                                          │
                                                   Auto: staging deploy
                                                          │
                                      Manual dispatch: production deploy
                                                          │
                                           Force-push: staging + live-production tracking branches
```

### Protection rules for `main`

Branch protection was queried on 2026-04-20. The PAT used by CI agents cannot read branch protection settings (`gh api` returns 403). Based on workflow design and observable behavior:

- The `summary` job is configured as the required status check. All seven upstream jobs (lint, build-frontend, build-server, unit-tests-frontend, unit-tests-server, e2e-tests, security-scans) must pass.
- PRs require at least one approving review before merge.
- Force-push is not allowed for regular contributors; the `promote-branches` job uses a separate `GITHUB_TOKEN` with `contents: write` permission scoped to that job.

> **TODO: verify** — `gh api repos/trendywink247-afk/GeekSpace2.0/branches/main/protection` returns 403 for the CI agent PAT. A PAT with `repo` scope or a repository admin can confirm exact protection rules.

### Staging vs production path

**Staging** (automatic on every merge to `main`):
1. `push` to `main` triggers CI.
2. On `summary` pass, `deploy-staging` SSHs to VPS, builds frontend, rsyncs to `/srv/staging/`, rebuilds the `staging` Docker service.
3. Live at `https://staging.agentin.chat` (port 3002).

**Production** (manual):
1. CTO manually dispatches `ci.yml` with `deploy_target: production`.
2. CI runs all checks again (fresh run, not reusing the prior push run).
3. On `summary` pass, `deploy-production` fires with the `production` GitHub Environment guard.
4. SSHs to VPS, builds frontend on host, rsyncs to `/srv/prod/`, rebuilds the `geekspace` Docker service.
5. Live at `https://ai.agentin.chat` (port 3001).
6. `promote-branches` force-pushes `main` → `staging` and `live-production`.

---

## 4. Bot Identity Caveat

### The push-vs-PR author split

Automated PRs in this repo are opened by **`Agentinopsbot`** (a GitHub App / bot identity used by the Paperclip agent harness). However, the underlying `git push` that creates the branch still authenticates as **`trendywink247-afk`** — the personal GitHub account whose credentials are present on the VPS.

This matters because GitHub's branch protection "require non-last-pusher review" rule (when enabled) identifies the reviewer by comparing the last commit author/pusher with the approving reviewer. Under the current setup:

- The branch is pushed by `trendywink247-afk`.
- The PR is created by `Agentinopsbot`.
- If branch protection requires that the last pusher cannot approve their own PR, **`trendywink247-afk` cannot self-approve**, but `Agentinopsbot` (as PR author, not committer) is a distinct identity and technically could approve — depending on exact GitHub rule configuration.

In practice, all agent PRs require a human board review before merge, which sidesteps the identity ambiguity. The clean fix is issuing `Agentinopsbot` a dedicated SSH deploy key or machine-user PAT so pushes also authenticate as the bot identity, making committer and PR author the same actor. This is tracked in [AGE-43](/AGE/issues/AGE-43).

See also: [PR #311](https://github.com/trendywink247-afk/GeekSpace2.0/pull/311) (the last CI timeout fix) as a reference example of an agent-opened PR that required board merge.

---

*Cross-links: [AGE-64](/AGE/issues/AGE-64) (parent audit) · `ARCHITECTURE.md` (umbrella, [AGE-68](/AGE/issues/AGE-68)) · `CLAUDE.md §CI/CD & Deployment`*
