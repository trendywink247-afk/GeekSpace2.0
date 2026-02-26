# Phase 75 — Production Hardening + E2E Coverage

## Goal
Fix deployment fragility (Caddy desync, stale static files, stale SW cache) and add E2E tests for agent chat and logout flows.

## Architecture

### Production Fixes
1. **Caddy config unification** — `caddy/Caddyfile` is source of truth; `prod.sh` copies it to `/etc/caddy/Caddyfile` and reloads host Caddy
2. **Static file sync automation** — `prod.sh` always runs `docker cp` after build + validates files exist
3. **Service worker cache bump** — `prod.sh` auto-increments `CACHE_NAME` in `public/sw.js` based on git SHA
4. **Root error boundary** — wrap `App.tsx` routes so public pages don't white-screen on crash
5. **Chunk load retry** — catch dynamic import failures, retry once, show error UI if still fails

### E2E Tests
6. **Agent chat** — login → navigate to chat → send message → verify message appears in thread
7. **Logout + re-login** — login → logout → verify redirect to /login → re-login → verify dashboard loads

### Meta
8. Phase 75 meta test
9. Brand guard
10. Ops + commit + PR + merge
