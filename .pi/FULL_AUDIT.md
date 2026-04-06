# GeekSpace 2.0 — Full System Audit

**Date:** 2026-04-06
**Branch:** `chore/repo-cleanup-2026-04` (9 commits ahead of main)
**VPS:** 8 cores, 31GB RAM, ~284GB free disk
**Refreshed by:** Master orchestrator (post-cleanup audit)

---

## 1. VPS state

- **Containers:** 23 running (was 22; includes alertmanager separately)
  - GeekSpace stack (10): app, staging, redis ×2, picoclaw, browser, meilisearch, qdrant, searxng, uptime-kuma
  - Monitoring (6): grafana, prometheus, alertmanager, loki, promtail, cadvisor
  - External (4): ollama, agent-zero, claude-bridge, cronicle
  - Utility (3): crawl4ai, healthchecks, healthchecks-postgres
- **All healthy:** yes ✅

## 2. Repo state (after cleanup)

- **Source files:** ~1,977 tracked (excluding node_modules/.git/dist)
- **Server modules:** 18 in `server/src/modules/`
- **Server .ts files:** 504
- **Dashboard pages:** 202 .tsx files in `src/dashboard/`
- **Frontend .tsx total:** 399
- **Root docs:** AGENTS, CLAUDE, README, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, **ARCHITECTURE** (new)
- **docs/:** 19 files (down from 32 — 13 stale archived off-repo)
- **Archive location:** `/root/geekspace-archives/2026-04/` (off-repo, on VPS)

## 3. Recent work

- **Main latest:** `7394d5e chore: move .pi/skills/ to global`
- **Branch:** `chore/repo-cleanup-2026-04` — 9 commits:
  1. Remove orphan scripts/write_files.py + on-disk junk
  2. Archive 13 completed plans/specs/audits → VPS
  3. Refresh README, CLAUDE.md, CHANGELOG
  4. Refresh DEVELOPER_GUIDE, regenerate DOC_MAP
  5. Add ARCHITECTURE.md and NAMING_CONVENTIONS.md
  6. Kebab-case low-risk files (utils + server routes/services) — 8 files
  7. Kebab-case src/stores — 4 files, 43 importers
  8. Kebab-case src/hooks — 16 files, 70 files touched
  9. Kebab-case server repositories — 6 files

## 4. Naming standard

See `docs/NAMING_CONVENTIONS.md`. Now enforced across:
- ✅ src/utils/, src/stores/, src/hooks/
- ✅ server/src/routes/ (api-keys.ts)
- ✅ server/src/services/ (contact-router, password-reset)
- ✅ server/src/repositories/ + server/src/modules/*/repositories/
- Shadcn primitives under src/components/ui/ intentionally stay kebab-case
- Remaining camelCase/PascalCase in the codebase is limited to React component files (correct)

## 5. Build health

- Frontend `npx tsc -b --noEmit`: ✅ clean
- Server `npx tsc --noEmit`: ✅ clean
- `npx vite build`: ✅ builds (same chunk-size warnings as before, pre-existing)
- Tests: not re-run this audit (last known green)

## 6. Open action items

- **Chunk size:** `ConvertTool`, `blocknote`, `ChatPage` > 600 kB — consider manualChunks (pre-existing, tracked separately).
- **Repository consolidation:** `server/src/repositories/` still exists alongside `server/src/modules/*/repositories/`. Legacy location has only 2 files (now kebab'd). Future refactor: move into modules.
- **DEVELOPER_GUIDE §5 + §7:** recipes still reference legacy `server/src/routes/bookmarks.ts` and `DashboardApp.tsx`. Flagged by refresh agent; update when the module migration completes.
- **Lint filename rule:** recommend adding `unicorn/filename-case` to ESLint in a follow-up PR to enforce kebab-case automatically.
- **Secrets rotation:** user scheduled for next 2-3 days (`.env`, `.env.staging`).

## 7. Files archived off-repo

`/root/geekspace-archives/2026-04/` (13 files + README):
- `plans/` — 3 phase plans (Mar 5–7)
- `superpowers/` — 6 Agent Office + Visual Feedback specs (Mar 19–20)
- `internal/` — 4 sandbox/routing audits (Mar 28)

Restore procedure documented in the archive README.
