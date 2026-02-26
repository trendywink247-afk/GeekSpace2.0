# AI Lessons — GeekSpace 2.0

> Recurring bugs, architectural decisions, and gotchas discovered during autonomous work.

## TypeScript / Build

### noUnusedLocals kills CI (Frontend)
- `tsconfig.app.json` enforces `noUnusedLocals: true` and `noUnusedParameters: true`
- Server `tsconfig.json` does NOT enforce this
- **Pattern:** Always verify every import is used in JSX AND data arrays, not just JSX
- **Example:** `import { Cpu }` was removed from CapabilitiesPage because it wasn't in JSX — but it WAS in capability data objects (`icon: Cpu`). CI failed.
- **Fix:** Grep for every imported name in the file before removing it

### ESLint --max-warnings=0 on changed files (CI)
- The `ci.yml` workflow lints ONLY changed files but treats warnings as errors
- The `test.yml` workflow lints ALL files but only fails on errors
- **Pattern:** Never introduce new lint warnings in files you touch, even if they existed before

## Database

### Three DB files can exist
- `/app/data/geekspace.db` — Docker container (production)
- `server/data/geekspace.db` — local dev
- `./geekspace.db` (root) — sometimes created by accident
- **Rule:** For production changes, use the Docker container path, NOT `server/data/`

## Telegram / Escalation

### 3-tier escalation matching (implemented Feb 2026)
- Tier 1: native Telegram `reply_to_message.message_id` matched against `notifMessageId` in Redis
- Tier 2: keyword scoring on visitor name + question nouns; only matches if score ≥ 1 AND reply ≤ 50 words
- Tier 3: fall-through → normal chat
- **Risk:** Tier 2 must not consume legitimate chat messages. Score threshold is critical.

### sanitizeForTelegram() is the safety net
- Lightweight models ignore "no markdown" in system prompt
- The sanitizer always strips markdown before sending to Telegram
- **Do NOT** assume model will obey formatting instructions; always sanitize

## Cluster / PM2

### NODE_APP_INSTANCE env var
- PM2 cluster sets this to '0' for primary worker, '1' for secondary, etc.
- Used in `index.ts` to decide which worker runs schedulers (primary only)
- If misconfigured or not using PM2, all workers may try to run schedulers → duplicates

## Action System

### Action blocks in LLM output
- Format: `<<<ACTION {...} ACTION>>>`
- Parsed by `action-parser.ts` (Zod-validated)
- Executed by `action-executor.ts`
- **Risk:** If LLM generates malformed JSON inside action block, parser skips it silently
- **Pattern:** Log malformed blocks so we can detect LLM formatting regressions

## CI / Deployment

### Full deploy sequence
```bash
git push origin main
# Wait for CI + Test workflows green (GitHub Actions)
git push origin main:live-production
# Wait for CI green on live-production
# ALWAYS use prod.sh — it includes the static file sync step
cd ~/GeekSpace2.0 && ./scripts/prod.sh
curl localhost:3001/api/health
```

### Caddy serves static files from HOST path, NOT the container
- `docker-compose.yml` mounts `/var/www/geekspace:/srv:ro` into the Caddy container
- When geekspace-app is rebuilt, the new `/app/dist/` assets stay INSIDE the container
- Caddy keeps serving the old files from `/var/www/geekspace/` on the host
- **CRITICAL:** Always run `docker cp geekspace-app:/app/dist/. /var/www/geekspace/` after a build
- `./scripts/prod.sh` does this automatically — do NOT run `docker compose up -d --build` directly
- Symptom: users don't see updates even though containers are healthy and API is working
- After sync, bump `public/sw.js` CACHE_NAME version to force browser SW cache clear

### Port 3001 conflicts
- Stale Node process causes "Invalid token" after JWT secret resets
- Fix: `fuser -k 3001/tcp` before starting

## Phase 10 Lessons

### Dynamic import in synchronous middleware
- `requireAuth` middleware is NOT async — cannot use `await import()`
- The `createHash` from Node's `crypto` module must be imported statically at the top of the file
- Pattern: always check if a function is async before using dynamic imports inside it

### Frontend TypeScript: noUnusedLocals catches removed JSX
- Removing UI elements that used a specific icon import leaves the import dangling
- `tsc -b` catches this but ESLint does NOT (no-unused-vars is off)
- Always run `npm run build` (not just `tsc --noEmit`) to catch these; the Vite build uses strict tsconfig.app.json

### Session tracking without token blacklist
- JWT is stateless — revoking a session DB record does not invalidate the token
- The correct pattern: mark sessions inactive in DB; accept the limitation in a comment
- For real invalidation, a Redis token blacklist with TTL matching JWT expiry is needed

### userService additions pattern
- New API service methods follow the pattern: `methodName: () => api.verb<ReturnType>('/path')`  
- Always export new interface types (like `UserSession`, `ActivityEntry`) from `api.ts` so pages can import them without circular deps
- Use `type` imports (`type UserSession`) in page components to help tree-shaking

### Worktree cleanup
- Old worktrees with `node_modules/` require `--force` to remove
- Safe to force-remove completed phase worktrees (phase-1 through phase-6 removed in Phase 10)

## Caddy Host vs Docker (Phase 72 Lesson)

### Docker Caddy port mapping is unreachable on Hostinger VPS
- Docker Caddy binds 0.0.0.0:80/443 via docker-proxy — works from server loopback but **times out from external internet**
- Root cause: Hostinger networking doesn't route external traffic to Docker's userland proxy
- **Fix:** Use host-level Caddy (`/etc/caddy/Caddyfile`, systemd service) for production
- Host Caddy can't resolve Docker hostname `geekspace` → added alias in `/etc/hosts` (`127.0.0.1 localhost geekspace`)
- `/etc/hosts` managed by cloud-init — alias may be wiped on VPS re-provision

### Two Caddyfile locations (keep in sync)
- `/etc/caddy/Caddyfile` — host-level (systemd, serves production traffic)
- `~/GeekSpace2.0/caddy/Caddyfile` — Docker Caddy (has gate page auth, but can't serve external traffic)
- **CRITICAL:** After `docker compose up --build`, run `docker cp geekspace-app:/app/dist/. /var/www/geekspace/` AND ensure `gate.html` is in `/srv`

### Gate page authentication
- Cookie `gs_auth == "geekspace-verified-2026"` required; without it → redirect to `/gate.html`
- Host Caddy must replicate: `@authed expression`, `handle @authed`, `handle { redir * /gate.html }`
- `/gate.html` must exist in host Caddy's root (`/srv`) — copy from `/var/www/geekspace/gate.html`
