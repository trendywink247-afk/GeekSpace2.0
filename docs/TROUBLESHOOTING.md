# GeekSpace 2.0 — Troubleshooting

## Quick diagnosis

```bash
./scripts/healthcheck.sh
```

This checks GeekSpace API, EDITH bridge, Ollama, and Docker container status.

---

## Common Issues

### 1. GeekSpace returns 503 / "degraded"

**Cause**: Database is unreachable or corrupt.

```bash
# Check DB file exists inside container
docker exec geekspace-app ls -la /app/data/geekspace.db

# Check DB integrity
docker exec geekspace-app sh -c \
  'sqlite3 /app/data/geekspace.db "PRAGMA integrity_check"'

# Check container logs
docker compose logs --tail=50 geekspace
```

### 2. EDITH shows "unreachable" in health check

**Cause**: Bridge not running, or WS not connected to OpenClaw.

```bash
# Is the bridge running?
docker compose --profile edith ps

# If not started:
docker compose --profile edith up -d edith-bridge

# Check bridge health directly
curl http://localhost:8787/health | jq .

# Expected when working:
# {"status":"ok","ws_connected":true,"rpc_ok":true,...}

# If ws_connected: false — OpenClaw is not reachable on port 18789
# Check OpenClaw is running:
ss -tlnp | grep 18789
```

### 3. EDITH bridge connects (ws_connected: true) but rpc_ok: false

**Cause**: Token mismatch or OpenClaw not accepting RPC.

```bash
# Verify token matches what OpenClaw expects
cat /data/.openclaw/openclaw.json | jq .token

# Compare with what bridge sees (should NOT print the token — check .env)
grep EDITH_TOKEN .env

# Check bridge logs for RPC errors
docker compose --profile edith logs --tail=30 edith-bridge
```

### 4. Ollama shows "unreachable"

**Cause**: Ollama not running, or wrong port mapping.

```bash
# Check if Ollama is running on host
curl http://localhost:11434/api/tags

# Check the docker port mapping for Ollama
docker ps | grep ollama
# If it shows 0.0.0.0:32768->11434, then set:
# OLLAMA_BASE_URL=http://host.docker.internal:32768

# Verify from inside GeekSpace container
docker exec geekspace-app sh -c \
  'curl http://host.docker.internal:11434/api/tags'
```

### 5. "host.docker.internal" not resolving

**Cause**: Missing `extra_hosts` or old Docker version.

```bash
# Verify the entry exists
docker exec geekspace-app cat /etc/hosts | grep host.docker.internal

# If missing, check docker-compose.yml has:
#   extra_hosts:
#     - "host.docker.internal:host-gateway"
```

### 6. Port 3001 conflict

**Cause**: Another process using port 3001.

```bash
ss -tlnp | grep 3001

# Change port in .env:
# PORT=3002
# Then restart: docker compose up -d --build
```

### 7. Caddy can't reach GeekSpace

**Cause**: GeekSpace not exposing port, or wrong Caddyfile config.

```bash
# Verify port is exposed
docker compose ps geekspace
# Should show: 0.0.0.0:3001->3001/tcp

# Test from host
curl http://localhost:3001/api/health

# Caddyfile should have something like:
# yourdomain.com {
#     reverse_proxy localhost:3001
# }
```

### 8. Build failures

```bash
# Clean Docker build cache
docker compose build --no-cache

# Check TypeScript compilation
cd server && npx tsc --noEmit

# Check frontend build
npm run build
```

### 9. EDITH chat returns 502 "Bridge RPC error"

**Cause**: OpenClaw rejected the RPC call or the chat method name is wrong.

```bash
# Check bridge logs for the exact error
docker compose --profile edith logs --tail=20 edith-bridge | grep error

# Try a different RPC method:
# OPENCLAW_CHAT_METHOD=llm.chat  (or whatever OpenClaw supports)

# Test the bridge directly
curl -X POST http://localhost:8787/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"hi"}]}'
```

### 10. SQLite "database is locked"

**Cause**: Multiple writers or unclean shutdown.

```bash
# Stop all services
docker compose down

# Check for leftover lock files
docker run --rm -v geekspace2_geekspace-data:/data alpine ls -la /data/

# Restart
docker compose up -d
```

---

## Log locations

| Service | Command |
|---------|---------|
| GeekSpace API | `docker compose logs -f geekspace` |
| EDITH Bridge | `docker compose --profile edith logs -f edith-bridge` |
| Redis | `docker compose logs -f redis` |
| All services | `docker compose logs -f` |

All services use JSON structured logging. Pipe through `jq` for readability:

```bash
docker compose logs --tail=20 geekspace | sed 's/^[^ ]* //' | jq . 2>/dev/null
```
