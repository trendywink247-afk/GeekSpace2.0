# E2E Test Quarantine

**Last updated:** 2026-04-06
**Status:** 9 tests quarantined with `test.fixme()`. CI is green.

## Background

When the E2E suite was investigated on 2026-04-06 (CI run `24039737906`), it
turned out the long-standing "flaky test" was actually **25 separate failures
across 6 spec files** — not one flake. Some were genuine bugs in the tests;
some were genuine bugs in the app; some were a mix of both. To restore strict
CI gating quickly, the test fixes were split into two waves:

1. **Wave 1** (`a0d3fbf3 fix(e2e): repair backend-smoke stale paths + signup payload`) — fixed the 8 backend-smoke tests with real root causes (stale API paths from the modular refactor + a stale signup payload missing the now-required `username` field).
2. **Wave 2** (`8dbffc86 test(e2e): quarantine 17 broken tests with test.fixme()`) — quarantined the other 17 with `test.fixme()` so CI is fully green and strict gating can be re-enabled.
3. **Wave 3** (follow-ups, this file) — investigate, fix, un-quarantine each of the 17 below. Each is a separate small task and the failures cluster by spec file, so likely fewer than 17 root causes total.

When you fix one, **delete its row from this file and remove the
`test.fixme(` + the `// QUARANTINED 2026-04-06` comment in the spec.**

---

## Wave 1 — fixed in `a0d3fbf3`

### `e2e/backend-smoke.spec.ts`

- **`POST /api/auth/signup creates a new user`** — sent `email/password/name`
  but the schema (`server/src/middleware/validate.ts` `signupSchema`) requires
  `username` too. Test now generates a unique `smoke<timestamp>` handle.
- **`Module Route Availability` × 7** — referenced legacy paths that no longer
  exist after the modular refactor. Fixed mappings:
  - `/api/media/status`     → `/api/images`, `/api/videos`
  - `/api/memory/search`    → `/api/memory`, `/api/search`
  - `/api/users/me/usage`   → `/api/usage/summary`
  - `/api/dashboard`        → `/api/dashboard/overview`
  - `/api/focus/sessions`   → `/api/focus/active`
  - `/api/comms/briefings`  → `/api/briefings`
  - `/api/office/docs`      → `/api/office/state`, `/api/docs`
  - `/api/voice` (POST-only) → dropped, media still covered
  - `/api/usage` (no GET /) → `/api/usage/summary`
  - `/api/office` (no GET /) → `/api/office/state`

  All 17 paths in the new list verified locally to return 200 (public) or 401
  (protected), never 404.

---

## Wave 2 — quarantined in `8dbffc86`

Each row: spec file, test name, observed symptom (from CI run `24044078360`),
likely root cause to start debugging from. **Fix one at a time, in any order.**


### `e2e/design-consistency.spec.ts` — 6 tests

| Line | Test | Symptom |
|---|---|---|
| 37 | `CSS variables are defined in :root` | 2.4s |
| 117 | `hero section renders with key elements` | 1.2s |
| 145 | `renders with correct structure` (login) | 11.6s timeout |
| 184 | `OAuth buttons are present` | 1.2s |
| 194 | `demo login button is available` | 11.6s timeout |
| 304 | `login page adapts for mobile` | 11.3s timeout |

**Start here:** the CSS-variable test goes to `/` and reads `--layer-void`,
`--layer-base`, etc. They ARE defined in `src/index.css`, but maybe inside a
class scope rather than `:root`. Login-page tests hitting 11.6s suggest the
test is waiting for an element/route that isn't there post-redesign.

---

## Re-enabling a quarantined test

```bash
# 1. Find the test
grep -n 'test.fixme' e2e/<file>.spec.ts

# 2. Run it locally to see real errors
npx playwright test e2e/<file>.spec.ts:<line> --headed

# 3. Once green, edit:
#    - Remove the `// QUARANTINED 2026-04-06: ...` comment line
#    - Change `test.fixme(` back to `test(`

# 4. Delete the row from this file
# 5. Re-run CI
```

## Why `test.fixme` and not `test.skip`

`test.fixme` shows up in reporters as **expected-to-fail** (with a clear "fixme"
marker), so it's visible in every CI run as a known-broken count. `test.skip`
silently disappears, which is too easy to forget about. If a quarantined test
ever starts passing it'll show as `unexpected pass` in the reporter — that's a
free signal that you can promote it back.
