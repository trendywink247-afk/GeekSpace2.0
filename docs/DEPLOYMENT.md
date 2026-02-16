# GeekSpace 2.0 — Deployment Guide

## Prerequisites

- VPS with Docker and Docker Compose v2 installed
- Caddy (or any reverse proxy) for HTTPS termination
- Ollama running on the host (optional but recommended)
- OpenClaw running on the host (optional — for EDITH Brain 3)

## Quick Deploy

```bash
# 1. Clone and configure
git clone <repo-url> && cd GeekSpace2.0
cp .env.example .env

# 2. Generate secrets
echo "JWT_SECRET=$(openssl rand -hex 64)" >> .env
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)" >> .env

# 3. Set your domain
sed -i 's|https://yourdomain.com|https://your-actual-domain.com|g' .env

# 4. Deploy (core only)
./scripts/prod.sh

# 5. Deploy (with EDITH/OpenClaw)
./scripts/prod.sh --edith
```

The app listens on port 3001. Point your reverse proxy (Caddy) at it.

## Architecture

```
Internet → Caddy (:443) → GeekSpace (:3001) → Redis (:6379)
                                ↓
                          edith-bridge (:8787) → OpenClaw WS (:18789)
                                ↓
                          Ollama (host :11434 or :32768)
```

**Services in docker-compose.yml:**

| Service | Required | Port | Purpose |
|---------|----------|------|---------|
| `geekspace` | Yes | 3001 (exposed) | API + frontend |
| `redis` | Yes | 6379 (internal) | Job queue + cache |
| `edith-bridge` | No | 8787 (internal) | WS-RPC→HTTP bridge for OpenClaw |

## Caddy Configuration

```caddyfile
yourdomain.com {
    reverse_proxy localhost:3001
}
```

Caddy handles HTTPS automatically via Let's Encrypt.

## Docker Compose Profiles

The EDITH bridge is **optional** and gated behind a Docker Compose profile:

```bash
# Core only (geekspace + redis)
docker compose up -d

# With EDITH bridge
docker compose --profile edith up -d

# Rebuild after code changes
docker compose --profile edith up -d --build
```

## Ollama Setup

### Host-mapped port

If Ollama maps `32768→11434`:

```env
OLLAMA_BASE_URL=http://host.docker.internal:32768
```

### Standard port

```env
OLLAMA_BASE_URL=http://host.docker.internal:11434
```

### Pull a model

```bash
ollama pull qwen2.5-coder:1.5b
curl http://localhost:11434/api/tags   # verify
```

## EDITH / OpenClaw Setup

1. Get your token:
```bash
cat /data/.openclaw/openclaw.json | jq -r .token
```

2. Set in `.env`:
```env
EDITH_TOKEN=<your-token>
EDITH_OPENCLAW_WS=ws://host.docker.internal:18789
EDITH_GATEWAY_URL=http://edith-bridge:8787
```

3. Start with the edith profile:
```bash
docker compose --profile edith up -d --build
```

4. Verify:
```bash
curl http://localhost:8787/health | jq .
# {"status":"ok","ws_connected":true,"rpc_ok":true,...}
```

## Health Checks

```bash
# All components
./scripts/healthcheck.sh

# Just the API
curl http://localhost:3001/api/health | jq .

# Just the bridge
curl http://localhost:8787/health | jq .
```

## Updating

```bash
cd /path/to/GeekSpace2.0
git pull
./scripts/prod.sh          # or ./scripts/prod.sh --edith
```

SQLite migrations run automatically (`CREATE TABLE IF NOT EXISTS`).

## Backup

```bash
# Database only
docker cp geekspace-app:/app/data/geekspace.db ./backup-$(date +%Y%m%d).db

# Full volume backup
docker compose down
docker run --rm -v geekspace2_geekspace-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/geekspace-data-$(date +%Y%m%d).tar.gz /data
docker compose up -d
```

## Environment Variables

See [ENV_VARS.md](./ENV_VARS.md) for the complete reference.

## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues and fixes.
