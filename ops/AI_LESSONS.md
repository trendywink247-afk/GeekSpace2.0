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
# Docker rebuild happens automatically via webhook or:
docker compose up -d --build geekspace
curl localhost:3001/api/health
```

### Port 3001 conflicts
- Stale Node process causes "Invalid token" after JWT secret resets
- Fix: `fuser -k 3001/tcp` before starting
