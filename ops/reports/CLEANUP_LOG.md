# CLEANUP LOG — Proposed Removals

**Date:** 2026-02-23
**Branch:** `refactor/industry-grade-hardening-2026-02-23`
**Status:** PROPOSED ONLY — No deletions made.

---

## Proposed Removals

### HIGH CONFIDENCE — Safe to Delete

| # | Path | Type | Evidence | Impact |
|---|------|------|----------|--------|
| 1 | `import { test, expect } from '@playwright` | Accidental file | Filename is a code fragment. Not imported anywhere. Zero-byte or garbage content. | None |
| 2 | `ci-artifacts-22242784676/` | Stale CI output | Numbered artifact directory from old GitHub Actions run. Not referenced. Not gitignored. | None |
| 3 | `add-demo-accounts.mjs` | One-time script | File header says "One-time script". Never imported. `seedDemoData()` in `db/index.ts` supersedes it. | None |
| 4 | Root `Caddyfile` | Dead config | docker-compose.yml mounts `./caddy/Caddyfile` only. Root version is older (Feb 16 vs Feb 23). CLAUDE.md confirms "production now uses in-container caddy/Caddyfile". | None |
| 5 | Root `vitest.config.ts` | Dead config | Frontend has no Vitest tests (only Playwright E2E). Server uses `server/vitest.config.ts`. Root config is unreferenced. | None |

### MEDIUM CONFIDENCE — Archive First

| # | Path | Type | Evidence | Recommendation |
|---|------|------|----------|----------------|
| 6 | `bridge/edith-bridge/` | Deprecated service | docker-compose marks with `profiles: ["edith"]` (not started by default). Config.ts notes `[DEPRECATED]`. Direct `edith.ts` HTTP client replaced it. Still referenced in CI workflows for dependency install. | Archive to `docs/internal/archive/edith-bridge/`, remove from CI |
| 7 | `reports/` | Historical audit data | Contains dated audit reports (2026-02-19). Symlinks to subdirectories. Not referenced in code. | Archive to git history, delete from working tree |
| 8 | `server/docs/` | Duplicate docs | Contains docs that may duplicate `docs/`. Needs content comparison. | Compare with `docs/`, merge unique content, delete duplicates |

### LOW CONFIDENCE — Keep But Monitor

| # | Path | Type | Evidence | Recommendation |
|---|------|------|----------|----------------|
| 9 | `soul.md` | Unreferenced metadata | Not imported anywhere. Contains project values/philosophy (29 lines). | Keep — low cost, cultural value |
| 10 | `apminsightdata/`, `apminsightnode.json` | APM runtime data | Monitoring agent data directories. Mounted as Docker volume. Not code. | Keep — active monitoring |
| 11 | `admin-dashboard/index.html` | Minimal admin UI | Served by `admin.ts` route. 24KB HTML file. May be functional or broken. | Keep — verify if actively used before removal |

---

## Dependency Audit (Proposed)

### Root `package.json`
- `apminsight` — APM monitoring agent. Actively used (data directories present).

### Potential Unused Dependencies (needs verification in Phase 2)
- Run `npx depcheck` on both root and server to identify unused npm packages
- Run `npm audit` to identify security vulnerabilities

---

## Rules for Phase 2 Cleanup
1. **Never delete without evidence** — File must be unimported AND unreferenced
2. **Archive before delete** — Move to `docs/internal/archive/` or commit deletion with clear message
3. **Update references** — If removing a file, grep for all references and update them
4. **CI impact** — Verify CI pipelines don't reference removed files
5. **Git history preserves** — Deleted files remain in git history for recovery
