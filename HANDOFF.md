# GeekSpace 2.0 — Handoff Prompt

> Use this file to onboard another AI or human engineer onto this repo.
> Last updated: 2026-02-14

---

## What Changed (this session)

### 1. Fixed broken `edith.ts` (CRITICAL)
- **Problem**: Bad merge left references to deleted `ENDPOINT_PATHS` constant, orphaned `res.json()` call on line 154, mismatched braces. File would not compile.
- **Fix**: Clean rewrite — single endpoint (`/v1/chat/completions` via bridge), 120s timeout, 1 retry. Keeps `EdithResponse` interface with `route: 'edith'` and `debug` fields. `edithProbe()` checks bridge `/health` endpoint for `ws_connected: true`.

### 2. Removed nginx from docker-compose.yml
- **Problem**: nginx service in compose bound ports 80/443, conflicting with Caddy already running on the VPS.
- **Fix**: Removed nginx service entirely. GeekSpace now exposes port 3001 directly via `ports: ["${PORT:-3001}:3001"]`. Caddy on VPS reverse-proxies to it.
- **Note**: `nginx/default.conf` file still exists in repo (harmless reference), but nothing uses it.

### 3. Made edith-bridge optional via Docker profiles
- **Problem**: `depends_on: edith-bridge: condition: service_healthy` blocked GeekSpace startup if EDITH wasn't wanted.
- **Fix**: Added `profiles: ["edith"]` to edith-bridge. Start with `docker compose --profile edith up -d` to include it, or plain `docker compose up -d` without it.

### 4. Fixed env var mismatch
- **Problem**: `config.ts` defaulted Ollama model to `qwen2.5:1.5b` but compose and `.env.example` used `qwen2.5-coder:1.5b`.
- **Fix**: config.ts default updated to `qwen2.5-coder:1.5b`.

### 5. Added operational scripts
- `scripts/dev.sh` — starts Redis + server (tsx watch) + frontend (vite) for local dev
- `scripts/prod.sh` — builds and deploys via Docker, supports `--edith` flag
- `scripts/healthcheck.sh` — checks all components (API, bridge, Ollama, containers)

### 6. Added/updated docs
- `docs/DEPLOYMENT.md` — rewritten for Caddy (not nginx), profiles, Ollama port mappings
- `docs/ENV_VARS.md` — complete reference of every env var
- `docs/TROUBLESHOOTING.md` — 10 common issues with exact diagnostic commands

---

## Final Folder Tree (key files)

```
GeekSpace2.0/
├── bridge/edith-bridge/          # WS-RPC → HTTP bridge for OpenClaw
│   ├── Dockerfile
│   ├── index.js                  # 409 lines — Express + WS JSON-RPC client
│   ├── package.json
│   └── package-lock.json
├── docker-compose.yml            # geekspace + redis + edith-bridge (profile)
├── Dockerfile                    # Multi-stage: vite build + tsc → node:20-alpine
├── .env.example
├── scripts/
│   ├── dev.sh
│   ├── prod.sh
│   └── healthcheck.sh
├── docs/
│   ├── DEPLOYMENT.md
│   ├── ENV_VARS.md
│   ├── TROUBLESHOOTING.md
│   ├── API.md
│   └── ARCHITECTURE.md
├── nginx/default.conf            # UNUSED — kept as reference only
├── server/src/
│   ├── config.ts                 # All env vars with defaults
│   ├── index.ts                  # Express app + health check
│   ├── services/
│   │   ├── edith.ts              # EDITH client (calls bridge)
│   │   └── llm.ts                # Tri-Brain router (Ollama/OpenRouter/EDITH)
│   └── ...
└── src/                          # React frontend (Vite)
```

---

## Final docker-compose.yml

```yaml
version: "3.9"

services:
  geekspace:
    build: .
    container_name: geekspace-app
    restart: unless-stopped
    env_file: .env
    ports:
      - "${PORT:-3001}:3001"          # Caddy proxies to this
    environment:
      - NODE_ENV=production
      - PORT=3001
      - DB_PATH=/app/data/geekspace.db
      - REDIS_URL=redis://redis:6379
      - OLLAMA_BASE_URL=${OLLAMA_BASE_URL:-http://host.docker.internal:11434}
      - OLLAMA_MODEL=${OLLAMA_MODEL:-qwen2.5-coder:1.5b}
      - EDITH_GATEWAY_URL=${EDITH_GATEWAY_URL:-http://edith-bridge:8787}
      - EDITH_TOKEN=${EDITH_TOKEN:-}
    extra_hosts:
      - "host.docker.internal:host-gateway"
    volumes:
      - geekspace-data:/app/data
    networks:
      - geekspace-net
    depends_on:
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      start_period: 15s
      retries: 3

  edith-bridge:
    build: ./bridge/edith-bridge
    container_name: geekspace-edith-bridge
    restart: unless-stopped
    profiles: ["edith"]
    environment:
      - EDITH_OPENCLAW_WS=${EDITH_OPENCLAW_WS:-ws://host.docker.internal:18789}
      - EDITH_TOKEN=${EDITH_TOKEN:-}
      - OPENCLAW_CHAT_METHOD=${OPENCLAW_CHAT_METHOD:-chat.completions}
      - BRIDGE_PORT=8787
      - REQUEST_TIMEOUT_MS=120000
      - LOG_LEVEL=${LOG_LEVEL:-info}
    extra_hosts:
      - "host.docker.internal:host-gateway"
    networks:
      - geekspace-net
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8787/health"]
      interval: 15s
      timeout: 5s
      start_period: 5s
      retries: 3

  redis:
    image: redis:7-alpine
    container_name: geekspace-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --maxmemory 128mb --maxmemory-policy allkeys-lru
    volumes:
      - redis-data:/data
    networks:
      - geekspace-net
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

volumes:
  geekspace-data:
  redis-data:

networks:
  geekspace-net:
    driver: bridge
```

---

## Exact VPS Deploy Commands

### Fresh deploy

```bash
# 1. Clone
git clone <repo-url> ~/GeekSpace2.0 && cd ~/GeekSpace2.0

# 2. Configure
cp .env.example .env
echo "JWT_SECRET=$(openssl rand -hex 64)" >> .env
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)" >> .env

# 3. Set Ollama URL (check your port mapping first)
docker ps | grep ollama                           # find the mapped port
# If 0.0.0.0:32768->11434:
sed -i 's|OLLAMA_BASE_URL=.*|OLLAMA_BASE_URL=http://host.docker.internal:32768|' .env

# 4. Set EDITH token
TOKEN=$(cat /data/.openclaw/openclaw.json | jq -r .token)
sed -i "s|EDITH_TOKEN=|EDITH_TOKEN=$TOKEN|" .env

# 5. Deploy with EDITH
./scripts/prod.sh --edith

# 6. Verify
./scripts/healthcheck.sh
```

### Update existing deploy

```bash
cd ~/GeekSpace2.0
git pull
./scripts/prod.sh --edith     # rebuilds only changed layers
```

---

## What to Verify After Deploy

```bash
# 1. GeekSpace health — must show "ok"
curl -s http://localhost:3001/api/health | jq .
# Expected: {"ok":true,"status":"ok","components":{"database":"ok","ollama":"reachable","edith":"reachable",...}}

# 2. EDITH bridge — must show ws_connected + rpc_ok
curl -s http://localhost:8787/health | jq .
# Expected: {"status":"ok","ws_connected":true,"rpc_ok":true,...}

# 3. Chat through bridge
curl -s -X POST http://localhost:8787/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"What is 2+2?"}]}' | jq .choices[0].message.content
# Expected: a string answer from OpenClaw

# 4. Full end-to-end via GeekSpace API
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"alex@example.com","password":"demo123"}' | jq -r .token)
curl -s -X POST http://localhost:3001/api/agent/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message":"Explain what GeekSpace is"}' | jq .
```

---

## Known Pitfalls

| Issue | Cause | Fix |
|-------|-------|-----|
| `host.docker.internal` not resolving | Old Docker or missing `extra_hosts` | Ensure compose has `extra_hosts: ["host.docker.internal:host-gateway"]` |
| Ollama "unreachable" | Port mapping mismatch | Check `docker ps \| grep ollama` for actual mapped port |
| EDITH "unreachable" but bridge running | `ws_connected: false` — token wrong or OpenClaw not on :18789 | Check `cat /data/.openclaw/openclaw.json`, verify `ss -tlnp \| grep 18789` |
| Bridge `rpc_ok: false` | Wrong `OPENCLAW_CHAT_METHOD` | Try `chat.completions`, `chat.complete`, or `llm.chat` |
| Port 80/443 conflict | Nginx remnant in old compose | This is now removed. If still present, `docker compose down` old stack first |
| `EDITH_GATEWAY_URL` points to `:59259` | Old config — that's the OpenClaw UI (returns HTML) | Must point to `http://edith-bridge:8787` |
| GeekSpace won't start without bridge | Old compose had `depends_on: edith-bridge: service_healthy` | Now uses profiles — bridge is optional |

---

## EDITH Bridge Protocol Reference

The bridge translates OpenAI HTTP → OpenClaw WS JSON-RPC:

```
HTTP Request                           WS Frame Sent
POST /v1/chat/completions    →    {"id":"<uuid>","method":"chat.completions",
{                                  "params":{"messages":[...],"max_tokens":4096}}
  "messages": [...],
  "max_tokens": 4096          WS Frame Received
}                             ←    {"id":"<uuid>","ok":true,"result":{...}}

HTTP Response                     Returned to caller
{                                 (OpenAI-compatible JSON)
  "choices": [{
    "message": {"content": "..."}
  }],
  "usage": {...}
}
```

Health probe: Bridge calls `skills.status` RPC (1.5s timeout) to verify OpenClaw is responsive.
