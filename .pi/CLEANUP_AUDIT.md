# GeekSpace 2.0 — Repo Cleanup & Docs Audit

**Date:** 2026-04-06
**Branch:** `chore/repo-cleanup-2026-04`
**Auditor:** Master orchestrator (Claude Code)
**Mode:** Audit-first → user approves → split-commit execution → PR

---

## 0 — Executive Summary

| Area | Status | Severity | Items |
|---|---|---|---|
| Junk files (untracked, on disk) | ⚠️ minor | LOW | 4 |
| Junk files (tracked, should be removed/ignored) | ⚠️ moderate | MED | 5 |
| Stale docs (plans, superpowers, internal audits in git) | 🚨 significant | MED | 13 files |
| Outdated docs (need rewrite/refresh) | 🚨 significant | HIGH | 6 files |
| Missing docs | ⚠️ minor | LOW | 3 |
| Naming inconsistencies | 🚨 significant | MED | ~70 files (hooks/utils/stores) + 7 server repos |
| `.pi/` coordination files stale | ⚠️ | LOW | 4 files (1 day old, fine) |
| Live system | ✅ healthy | — | 22/22 containers up |

**Headline finding:** Repo is in **good shape structurally** — no obvious junk, gitignore is comprehensive, build artifacts properly excluded. The real work is **docs (13 stale plan/audit files cluttering `docs/`) and naming inconsistency in `src/hooks` + `src/stores` + `src/utils` + 7 server repository files**.

---

## 1 — Repo Inventory

```
GeekSpace2.0/        1.9 GB total (1.0 GB node_modules, 730 MB server/node_modules)
├── 1,978 tracked source files (excl. node_modules/.git/dist)
├── Root MD: 6 files (AGENTS, CLAUDE, README, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT)
├── docs/: 32 markdown files
├── .pi/: 4 coordination files + audits/
├── server/src/: 18 modules + db, routes, services, middleware, etc.
├── src/: 17 top-level dirs (dashboard 320 files, components 122)
└── 22 Docker containers running healthy
```

---

## 2 — JUNK FILES

### 2.1 On-disk junk (untracked, safe to delete) — LOW
| Path | Why | Action |
|---|---|---|
| `test-results/` (20K) | Playwright run artifacts, gitignored | `rm -rf` |
| `playwright-report/` (520K) | Playwright report, gitignored | `rm -rf` |
| `server/coverage/` (6.3 MB) | Vitest coverage from local runs | `rm -rf` |
| `server/apminsightdata/` (88K) | Site24x7 APM local data, gitignored | `rm -rf` |

### 2.2 Tracked files that look like junk — MED
| Path | Issue | Recommendation |
|---|---|---|
| `data/geekspace.db` (0 bytes) | Empty placeholder DB **tracked in git**. Gitignore says `*.db` but this slipped through. | **Delete** + verify gitignore catches it (`git rm`). |
| `server/geekspace.db` (0 bytes) | Same as above | **Delete** + `git rm`. |
| `.landing-reference.txt` (9.5 KB) | One-off landing copy reference, **gitignored but still tracked** (added before ignore rule) | **Delete** (`git rm`) |
| `server/SANDBOX_PERF_SUMMARY.md` | Listed in `.gitignore` but tracked | **Delete** (`git rm`) — gitignore confirms it's stale |
| `scripts/write_files.py` (tiny) | Looks like one-off helper, no callers found in scripts/Makefile/CI | **Verify then delete** |

### 2.3 Empty directories
| Path | Action |
|---|---|
| `.pi/tasks/`, `.pi/todos/` | Keep — used by `todo` tool & TaskCreate |
| `data/uploads/`, `server/data/img-cache/` | Keep — runtime upload dirs (add `.gitkeep`) |

---

## 3 — STALE DOCS (tracked in git, should move or delete)

These 13 files are old plans/audits/specs that don't belong in `docs/` (which should be **living, current** docs). Recommend moving to `.pi/archive/` (gitignored) or deleting.

### 3.1 `docs/plans/` — 3 files (all from 2026-03-05 to 03-07)
| File | Age | Action |
|---|---|---|
| `2026-03-05-full-site-audit.md` | 1 month | Archive — completed audit |
| `2026-03-07-phase104-react-loop.md` | 1 month | Archive — phase complete |
| `2026-03-07-revamp-p0.md` | 1 month | Archive — phase complete |

### 3.2 `docs/superpowers/` — 6 files (all 2026-03-19 to 03-20)
Old "Agent Office" + "Visual Feedback" design specs. The features either shipped or were superseded.
| File | Action |
|---|---|
| `plans/2026-03-19-agent-office-redesign.md` | **Verify shipped** → archive |
| `plans/2026-03-20-agent-office-magical-experience.md` | Archive |
| `plans/2026-03-20-visual-feedback-activity-stream.md` | Archive |
| `specs/2026-03-19-agent-office-redesign.md` | Archive |
| `specs/2026-03-20-agent-office-magical-experience-design.md` | Archive |
| `specs/2026-03-20-visual-feedback-activity-stream-design.md` | Archive |

### 3.3 `docs/internal/` — 4 files
| File | Action |
|---|---|
| `sandbox-security-audit.md` | Old audit — archive |
| `sandbox-integration-notes.md` | Old notes — archive |
| `routing-audit-report.md` | Phase 111 done — archive |
| `benchmark-findings.md` | Verify still relevant; if yes promote to `docs/PERFORMANCE.md`, else archive |

### 3.4 Recommendation
Create `.pi/archive/2026-04-cleanup/` (gitignored), `git mv` all 13 there, remove the empty `docs/plans`, `docs/superpowers`, `docs/internal` directories. The `docs/adr/` ADR file stays — ADRs are meant to be historical.

---

## 4 — DOCS NEEDING UPDATE / REWRITE

### 4.1 Outdated, must update — HIGH priority

| File | Lines | Last updated | Issue | Action |
|---|---|---|---|---|
| `README.md` | 637 | 2026-03-28 | Likely missing recent agent v2 features (threading, HITL, file upload, feedback, theater, LLM router). Need to verify against current state. | **Full review + targeted update** |
| `CLAUDE.md` | 344 | 2026-04-02 | Mostly current but architecture section may lag. Mirrors AGENTS.md responsibilities for Claude Code users. | **Refresh + cross-link with AGENTS.md** |
| `AGENTS.md` | 240 | 2026-04-05 | Already current (you maintain it). | **Stats refresh only** (file counts, container counts) |
| `docs/CHANGELOG.md` | 97 | 2026-03-28 | Missing all April entries (metrics endpoint, backups, E2E in CI, security scans, world_models migration, .pi/skills move). | **Add 2026-04 section** |
| `docs/DEVELOPER_GUIDE.md` | 947 | 2026-03-28 | Likely references old hook names, old module structure. | **Section-by-section verify** |
| `docs/DOC_MAP.md` | 122 | 2026-03-28 | Index of all docs — must be updated if we move/delete files. | **Regenerate after cleanup** |

### 4.2 Likely current, spot-check only — MED
- `docs/API_REFERENCE.md`
- `docs/DEPLOYMENT.md`
- `docs/DEVOPS.md`
- `docs/TESTING.md`
- `docs/TROUBLESHOOTING.md`
- `docs/INTEGRATIONS.md`
- `docs/ENV_VARS.md`
- `docs/BACKEND_CONFIG.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/SOLUTION_ARCHITECTURE.md`
- `docs/REPO_WORKFLOW.md`
- `docs/BUSINESS_FEATURES.md`
- `docs/MICROSERVICES_ROADMAP.md`
- `docs/ddd/domains.md`
- `infra/README.md`
- `server/src/modules/README.md` (need to read)

### 4.3 Missing / recommended new docs — LOW
| File | Why |
|---|---|
| `ARCHITECTURE.md` (root) | Convention — quick architecture overview at root, links to `docs/SOLUTION_ARCHITECTURE.md` |
| `docs/NAMING_CONVENTIONS.md` | Output of this audit — codifies the standard going forward |
| `docs/RUNBOOK.md` | Ops runbook (incident response, common fixes). May exist as `TROUBLESHOOTING.md` — verify. |

---

## 5 — NAMING CONVENTIONS

### 5.1 Proposed standard

| Entity | Convention | Example |
|---|---|---|
| **React components** (.tsx) | `PascalCase.tsx` | `ChatPanel.tsx` |
| **shadcn/ui primitives** | `kebab-case.tsx` (intentional, shadcn convention) | `button.tsx`, `dialog.tsx` |
| **Hooks** (.ts/.tsx) | `use-kebab-case.ts` *(modern React convention)* | `use-chat-stream.ts` |
| **Utilities** (.ts) | `kebab-case.ts` | `date-format.ts` |
| **Stores** (zustand) | `kebab-case.ts` ending in `-store.ts` | `auth-store.ts` |
| **Server modules / files** | `kebab-case.ts` | `react-loop.ts` |
| **Server repositories** | `kebab-case.repository.ts` *(or current PascalCase if you prefer)* | `agent-config.repository.ts` |
| **Server routes** | `kebab-case.ts` | `password-reset.ts` |
| **DB tables/columns** | `snake_case` | `world_models`, `created_at` |
| **API routes** | `/api/kebab-case` | `/api/agent-runs` |
| **Test files** | `<file>.test.ts` adjacent OR `__tests__/<file>.test.ts` | (current usage is fine, just be consistent) |
| **Branches** | `feat/`, `fix/`, `chore/`, `refactor/`, `docs/` | `feat/world-models` |
| **Commit messages** | Conventional Commits | `fix(db): add missing tables` |

> **Rationale:** kebab-case for non-component files matches the modern React + Node ecosystem (shadcn, Vite, Next.js App Router, NestJS). PascalCase only for JSX components. Hooks-as-kebab is the React 19 / Next 14 convention.

### 5.2 Violations found

#### A. `src/hooks/` — **24 violations** (currently camelCase, should be kebab)
```
authStore.ts                → auth-store.ts          (also: move to src/stores/)
useAgentCanvas.ts           → use-agent-canvas.ts
useAgentState.ts            → use-agent-state.ts
useChatActions.ts           → use-chat-actions.ts
useChatStream.ts            → use-chat-stream.ts
useFeatureFlag.ts           → use-feature-flag.ts
useFreeTrial.ts             → use-free-trial.ts
useIdleTimeout.ts           → use-idle-timeout.ts
useLogoutBlocker.ts         → use-logout-blocker.ts
useMobileDetect.ts          → use-mobile-detect.ts
useOverviewData.ts          → use-overview-data.ts
usePWA.ts                   → use-pwa.ts
usePullToRefresh.ts         → use-pull-to-refresh.ts
useSwipeNavigation.ts       → use-swipe-navigation.ts
useTTS.ts                   → use-tts.ts
useTilt.ts                  → use-tilt.ts
useVoice.ts                 → use-voice.ts
+ test files following same pattern
```
Note: `use-mobile.ts` already follows the convention — proves the standard exists, just inconsistently applied.

#### B. `src/stores/` — **3 violations**
```
authStore.ts        → auth-store.ts
dashboardStore.ts   → dashboard-store.ts
terminalStore.ts    → terminal-store.ts
themeStore.ts       → theme-store.ts
```

#### C. `src/utils/` — **5 violations**
```
dateFormat.ts       → date-format.ts
lazyRetry.ts        → lazy-retry.ts
reminderParser.ts   → reminder-parser.ts
textMeasure.ts      → text-measure.ts
notifications.ts    → notifications.ts (already ok)
alerts.ts           → alerts.ts (already ok)
api.ts              → api.ts (already ok)
```

#### D. `server/src/` — **7 violations**
```
repositories/AgentConfigRepository.ts      → agent-config.repository.ts
repositories/ArtifactRepository.ts         → artifact.repository.ts
repositories/ConversationRepository.ts     → conversation.repository.ts
repositories/SubscriptionRepository.ts     → subscription.repository.ts
routes/apiKeys.ts                          → api-keys.ts
routes/contactRouter.ts                    → contact.ts (or contact-router.ts)
routes/passwordReset.ts                    → password-reset.ts
```

#### E. `src/components/ui/` — **NO violations**
All shadcn primitives are kebab-case — that's correct shadcn convention. Leave alone.

#### F. Top-level component files (`src/components/*.tsx`) — needs deeper scan
Most are PascalCase already. A few stragglers possible. Defer to per-file check during execution.

### 5.3 Risk assessment for renames

| Batch | Files | Import surface | Risk | Auto-rename? |
|---|---|---|---|---|
| `src/utils/` | 4 | low (~5-15 imports each) | **LOW** | ✅ auto |
| `src/stores/` | 4 | medium (~20-40 imports each, used across pages) | **MED** | ⚠️ approve |
| `src/hooks/` | 17 | high (some used in 30+ files) | **MED-HIGH** | ⚠️ approve per-batch |
| `server/repositories/` | 4 | medium (used in services) | **MED** | ⚠️ approve |
| `server/routes/` | 3 | low (only mounted in app.ts) | **LOW** | ✅ auto |

**Strategy:** Auto-rename LOW (utils + server routes = 7 files) in one commit. For MED/HIGH, I'll do one commit per directory batch, you eyeball the diff before push.

---

## 6 — `.pi/` COORDINATION FILES

| File | Last update | Status |
|---|---|---|
| `FULL_AUDIT.md` | 2026-04-05 23:02 | 17h old — fine, but should refresh after cleanup |
| `TASKS.md` | 2026-04-05 22:40 | Current sprint; verify if cleanup work needs a TASK entry |
| `STATUS.md` | 2026-04-05 22:40 | OK |
| `HANDOFF.md` | 2026-04-05 22:40 | OK |
| `audits/chat-page-audit.md` | exists | Verify still relevant |

**Action:** After cleanup PR merges, refresh `FULL_AUDIT.md` with new repo stats.

---

## 7 — LIVE SYSTEM CHECK

```
Containers: 22/22 healthy ✅
- GeekSpace stack: app, staging, redis ×2, picoclaw, browser, meilisearch, qdrant, searxng, uptime-kuma
- Monitoring: grafana, prometheus, alertmanager, loki, promtail, cadvisor
- External: ollama, agent-zero, claude-bridge, cronicle
- Utility: crawl4ai, healthchecks ×2

Branch: chore/repo-cleanup-2026-04 (clean working tree at start)
Main: 7394d5e chore: move .pi/skills/ to global ~/.pi/agent/skills/
```

---

## 8 — EXECUTION PLAN (split commits → PR)

Per your approval (commit-by-commit or all-at-once after report sign-off):

```
Commit 1  chore(cleanup): remove on-disk junk artifacts
          → rm test-results/ playwright-report/ server/coverage/ server/apminsightdata/
          → no git changes, just disk hygiene

Commit 2  chore(cleanup): untrack stale tracked junk
          → git rm data/geekspace.db server/geekspace.db .landing-reference.txt
                   server/SANDBOX_PERF_SUMMARY.md scripts/write_files.py
          → tighten .gitignore if needed

Commit 3  chore(docs): archive completed plans/specs/audits
          → git mv 13 files from docs/{plans,superpowers,internal} → .pi/archive/2026-04/
          → OR delete if you prefer (your call)

Commit 4  docs: refresh README, CLAUDE.md, AGENTS.md stats
          → fact-check against current code, add missing v2 features

Commit 5  docs: update CHANGELOG with 2026-04 entries
          → metrics, backups, E2E CI, security scans, world_models, skills move

Commit 6  docs: rewrite/refresh DEVELOPER_GUIDE + regenerate DOC_MAP
          → align with current module structure & file names

Commit 7  docs: add NAMING_CONVENTIONS.md + ARCHITECTURE.md
          → codify standards from §5

Commit 8  refactor(naming): kebab-case low-risk files (utils + server routes)
          → 7 files, auto-update imports, build verify

Commit 9  refactor(naming): kebab-case src/stores
          → 4 files, ~80 import updates

Commit 10 refactor(naming): kebab-case src/hooks
          → 17 files, ~200+ import updates (BIGGEST diff)

Commit 11 refactor(naming): kebab-case server repositories + remaining routes
          → 7 files, ~30 import updates

Commit 12 chore(audit): refresh .pi/FULL_AUDIT.md post-cleanup

→ Push branch → open PR → CI green → user merges
```

Each commit gated by: lint + frontend tsc + server tsc + vite build + tests (pre-push hook does this automatically).

---

## 9 — QUESTIONS BEFORE I EXECUTE

1. **Stale docs (§3):** Archive to `.pi/archive/2026-04/` (gitignored, kept on disk for reference) **or** hard-delete via `git rm`?
   → **Recommendation:** Archive. Cheap and reversible.

2. **`scripts/write_files.py`:** I'll grep for any reference before deleting. OK?
   → **Default:** yes, delete if zero references.

3. **`server/SANDBOX_PERF_SUMMARY.md`:** It's already in `.gitignore` but tracked. Untrack via `git rm --cached` (keeps file on disk) **or** full delete?
   → **Recommendation:** Full `git rm` — gitignore says it's stale.

4. **shadcn primitives in `src/components/ui/`:** Confirm I should **leave as kebab-case** (shadcn convention)? Otherwise we'd break shadcn CLI updates.
   → **Strong recommendation:** leave alone.

5. **Naming renames — execute order:** OK with me doing low-risk auto first (commit 8), then pausing for your sign-off before MED/HIGH batches (commits 9-11)?
   → **Default:** yes, pause after commit 8.

6. **PR description:** I'll write a comprehensive PR body summarizing all 12 commits, before/after stats, and migration notes. OK?

7. **Anything to **add** to scope I missed?** E.g.:
   - Dead code detection (unused exports via `ts-prune` / `knip`)?
   - Dependency audit (`npm outdated`, unused deps via `depcheck`)?
   - License headers?
   - Editor config (`.editorconfig`)?

---

## 10 — APPROVAL CHECKLIST

Reply with any combination:

```
[ ] §2.1 on-disk junk delete            → APPROVED / SKIP
[ ] §2.2 tracked junk git rm             → APPROVED / SKIP / MODIFY
[ ] §3 stale docs archive (not delete)   → APPROVED / DELETE INSTEAD
[ ] §4 docs refresh (README/CLAUDE/etc)  → APPROVED / SKIP SOME
[ ] §5 naming standard as proposed       → APPROVED / MODIFY
[ ] §5 LOW-risk renames auto             → APPROVED / SKIP
[ ] §5 MED/HIGH renames (pause for me)   → APPROVED / SKIP
[ ] §9 add ts-prune dead-code scan       → YES / NO
[ ] §9 add depcheck unused-deps scan     → YES / NO
[ ] PR title: "chore: repo cleanup + docs refresh + naming standardization"
```

Or just say **"go all"** and I run the full plan, pausing only before the HIGH-risk hook renames.

---

**End of audit. Awaiting your call.**
