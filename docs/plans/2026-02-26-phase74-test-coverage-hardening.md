# Phase 74 — Test Coverage Hardening

**Date:** 2026-02-26
**Theme:** Dedicated test suites for the 5 highest-risk untested routes, plus dead code cleanup and bundle optimization.
**Baseline:** 760/760 tests, lint/typecheck/build/brand clean.

## Problem

27+ routes lack dedicated test files. Five are security or production-critical:
- `apiKeys.ts` (67 lines) — API key CRUD with encryption, no tests
- `integrations.ts` (503 lines) — third-party connect/disconnect/permissions, no tests
- `contact.ts` (443 lines) — human contact system with rate limits and quiet hours, no tests
- `oauth.ts` (224 lines) — Google/GitHub OAuth with user create/link, no tests
- `webhooks.ts` (807 lines) — Telegram bot webhook with secret verification, no tests

Additionally: 3 orphaned page components exist (not in any router), and the 886kB index bundle lacks vendor splitting.

## Tasks

| # | Item | Category | Est. Tests |
|---|------|----------|------------|
| 74.1 | CI baseline verification | Reliability | — |
| 74.2 | apiKeys.ts tests — CRUD, rotate, auth guard, activity log | Security | ~5 |
| 74.3 | integrations.ts tests — list, connect, disconnect, permissions, Telegram link | Security | ~8 |
| 74.4 | contact.ts tests — create, rate limit, preferences, quiet hours, accept/decline | Feature | ~8 |
| 74.5 | oauth.ts tests — strategy registration, callback flows, error paths | Security | ~5 |
| 74.6 | webhooks.ts tests — secret validation, bot filtering, command dispatch | Security | ~6 |
| 74.7 | Remove orphaned pages (ArtifactsPage, TemplateGalleryPage, MediaGalleryPage) | Cleanup | — |
| 74.8 | Vite manual chunks — split recharts/radix out of index bundle | Performance | — |
| 74.9 | Update AI_FEATURE_MATRIX.md with new coverage | Dev/Ops | — |
| 74.10 | Update AI_RISK_REGISTER.md — close R13 | Dev/Ops | — |
| 74.11 | phase74.test.ts (meta + regression) | Dev/Ops | ~2 |
| 74.12 | Brand guard — 0 violations | Brand | — |
| 74.13 | Ops + commit + PR + merge | Dev/Ops | — |

**Expected:** ~34 new tests across 6 files.

## Test Strategy

- **apiKeys / integrations / contact:** Standard supertest + test DB. Straightforward HTTP assertions.
- **oauth:** Mock Passport strategies. Test callback handler logic (user create vs link, missing email).
- **webhooks:** Mock telegram.ts and message-router.ts services. Test secret verification, bot-message filtering, command extraction.
- All test files follow existing pattern: `server/src/test/api/<name>.test.ts`.

## Risks

- OAuth Passport mocking may need custom strategy stubs — medium complexity.
- Webhook tests depend on mocking multiple external services — medium complexity.
- Dead code removal (task 74.7) is safe since pages aren't referenced in any router.

## Success Criteria

- All 5 route files have dedicated test coverage for happy path + key error paths.
- Total test count ~794+.
- No regressions. Lint/typecheck/build/brand all clean.
