# GeekSpace 2.0 — Troubleshooting

## Quick Diagnosis

```bash
./scripts/healthcheck.sh
```

---

## Common Issues

### 1. GeekSpace returns 503 / "degraded"

**Cause**: Database is unreachable or corrupt.

```bash
docker exec geekspace-app ls -la /app/data/geekspace.db
docker exec geekspace-app sh -c 'sqlite3 /app/data/geekspace.db "PRAGMA integrity_check"'
docker compose logs --tail=50 geekspace
```

### 2. Ollama not responding / shows "unreachable"

**Cause**: Ollama container not running, wrong port mapping, or network issue.

> **Note**: Agentin has a health monitor that probes Ollama every 30s. When Ollama is **down**, the LLM router automatically skips it and falls through to Groq/OpenRouter — no 120s hangs. Messages continue to work, just via cloud providers. The health monitor restores Ollama routing automatically when it comes back up.

```bash
# Check if Ollama is running
curl http://localhost:32778/api/tags  # VPS port (Hostinger maps 32778→11434)
curl http://localhost:11434/api/tags  # standard port

# If no response, check the process/container
docker ps | grep ollama               # if running in Docker
/root/geekspace-network-fix.sh        # reconnect Ollama to geekspace-shared network

# Check port mapping — if Docker maps 32778→11434:
# Set OLLAMA_BASE_URL=http://localhost:32778 in .env

# Verify from inside the GeekSpace container
docker exec geekspace-app curl -s http://ollama-qtzz-ollama-1:11434/api/tags

# If "host.docker.internal" doesn't resolve, check docker-compose.yml has:
#   extra_hosts:
#     - "host.docker.internal:host-gateway"
```

### 3. AI mentions internal systems (OpenClaw, Brain, etc.)

**Cause**: System prompt contains outdated references, or the LLM is hallucinating internal details.

```bash
# Check the system prompt file
grep -i "openclaw\|brain\|tri-brain" server/src/prompts/openclaw-system.ts

# If found, update the prompt to remove internal codenames
# The prompt should only reference "GeekSpace" and the personality name

# Also check seed data for internal name leaks
grep -i "openclaw\|brain" server/src/db/index.ts
```

### 4. Credits not deducting after chat

**Cause**: Subscription table missing or credit deduction not firing.

```bash
# Check user's subscription exists
docker exec geekspace-app node -e "
const db = require('/app/server/node_modules/better-sqlite3')('/app/data/geekspace.db');
console.table(db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').all('USER_ID_HERE'));
"

# If no subscription row, the user was created before the billing migration.
# Fix: insert a free subscription manually or have the user re-register.

# Check deductSubscriptionCredits is being called — look for credit logs:
docker compose logs geekspace 2>&1 | grep -i "credit"
```

### 5. Portfolio chat sounds generic / doesn't know about the user

**Cause**: Portfolio data is empty, or the system prompt isn't loading user context.

```bash
# Check the user's portfolio data
docker exec geekspace-app node -e "
const db = require('/app/server/node_modules/better-sqlite3')('/app/data/geekspace.db');
const p = db.prepare('SELECT * FROM portfolios WHERE username = ?').get('USERNAME');
console.log(JSON.stringify(p, null, 2));
"

# If skills/projects are empty or null, the portfolio visitor prompt
# (buildPortfolioVisitorPrompt) has no context to inject.
# Fix: Have the user fill in their portfolio (skills, projects, bio).

# Also verify the portfolio chat route works:
curl -s -X POST https://yourdomain.com/api/agent/chat/public/USERNAME \
  -H 'Content-Type: application/json' \
  -d '{"message":"What does this person do?"}'
```

### 6. Port 3001 conflict

**Cause**: Another process using port 3001.

```bash
ss -tlnp | grep 3001
fuser -k 3001/tcp    # kill the stale process

# Or change port in .env: PORT=3002
```

### 7. Caddy can't reach GeekSpace

**Cause**: GeekSpace not exposing port, or wrong Caddyfile config.

```bash
docker compose ps geekspace    # Should show 0.0.0.0:3001->3001/tcp
curl http://localhost:3001/api/health

# Caddyfile should have:
# reverse_proxy localhost:3001
```

### 8. Build failures

```bash
# Clean Docker build cache
docker compose build --no-cache

# Check TypeScript compilation
cd server && npx tsc --noEmit   # backend
npx tsc --noEmit                # frontend (from project root)

# Common cause: unused imports with noUnusedLocals/noUnusedParameters in tsconfig
```

### 9. SQLite "database is locked"

**Cause**: Multiple writers or unclean shutdown.

```bash
docker compose down
docker compose up -d
# WAL mode handles most concurrency, but only one writer at a time
```

### 10. Frontend not updating after deploy

```bash
# Frontend is served by Caddy from /var/www/geekspace, NOT Docker
docker cp geekspace-app:/app/dist/. /var/www/geekspace/
ls -la /var/www/geekspace/assets/index-*.js
# If users still see old version: hard refresh (Ctrl+Shift+R)
```

### 11. "Invalid token" / 401 on all requests

**Cause**: JWT_SECRET changed since token was issued, or stale server process.

```bash
# Kill stale processes (JWT secret regenerates on restart)
fuser -k 3001/tcp
# Restart server
docker compose restart geekspace
# Users must re-login after JWT_SECRET changes
```

### 12. Agent Mission Control feed frozen / not updating

**Cause**: Browser session token expired (401). The Office page silently stops polling when it gets 401 responses.

**Fix**: A red banner will appear at the top of the page reading "Session expired — live feed paused." Click **Re-login** to clear the token and return to the login page.

If the banner doesn't appear (older session), just hard-refresh the page (`Ctrl+Shift+R`) or navigate to `/login` manually.

```bash
# Verify token is valid by checking logs
docker compose logs geekspace --tail=20 | grep "401"
# If you see 401s for /api/geekos/agents or /api/activity, the token expired
```

### 13. Personality not changing

**Cause**: Agent config not updating, or frontend cache.

```bash
# Check personality in DB
docker exec geekspace-app node -e "
const db = require('/app/server/node_modules/better-sqlite3')('/app/data/geekspace.db');
console.table(db.prepare('SELECT user_id, name, personality FROM agent_configs').all());
"

# Update via API
curl -X PATCH https://yourdomain.com/api/agent/config \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"personality":"edith"}'
```

---

## Log Locations

| Service | Command |
|---------|---------|
| GeekSpace API | `docker compose logs -f geekspace` |
| Redis | `docker compose logs -f redis` |
| Caddy | `journalctl -u caddy -f` |
| All services | `docker compose logs -f` |

All services use JSON structured logging. Pipe through `jq` for readability:

```bash
docker compose logs --tail=20 geekspace | sed 's/^[^ ]* //' | jq . 2>/dev/null
```
