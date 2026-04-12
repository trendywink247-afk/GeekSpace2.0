# Agentin — Deployment Guide

> For Docker service details, see [`docs/DEVOPS.md`](DEVOPS.md). For infrastructure components, see [`infra/README.md`](../infra/README.md).

## Prerequisites

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| VPS | 2 vCPU, 4 GB RAM | 4 vCPU, 12-16 GB RAM |
| OS | Ubuntu 22.04+ / Debian 12+ | Ubuntu 24.04 |
| Docker | 24.0+ with Compose v2 | Latest |
| Caddy | 2.6+ (in Docker or on host) | Latest |
| Domain | A-record pointing to VPS IP | — |
| Ollama | Running on host or Docker | With 7B+ model |

> **RAM note**: Ollama's `gemma4` model needs ~5-6 GB RAM on CPU. Budget 12-16 GB total for the full stack.

## Secrets Management

Real secrets (API keys, JWT_SECRET, ENCRYPTION_KEY, tokens) must live in
`/root/.agentin-secrets`, NOT in the in-repo `.env`.

### One-time VPS setup
```bash
cp ~/GeekSpace2.0/.env /root/.agentin-secrets
chmod 600 /root/.agentin-secrets
echo 'set -a && source /root/.agentin-secrets && set +a' >> ~/.bashrc
source ~/.bashrc
```

### What goes in /root/.agentin-secrets
`JWT_SECRET`, `ENCRYPTION_KEY`, all `*_API_KEY`, `TELEGRAM_BOT_TOKEN`,
`TELEGRAM_WEBHOOK_SECRET`, `STRIPE_*`, `ADMIN_*`, `RESEND_API_KEY`, `GITHUB_DEV_TOKEN`,
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

### What stays in .env (safe, non-sensitive)
`NODE_ENV`, `PORT`, `DB_PATH`, `*_BASE_URL`, `*_TIMEOUT_MS`, `CORS_ORIGINS`,
`PUBLIC_URL`, `API_URL`, `LOG_LEVEL`, rate limit settings

---

## Quick Deploy

```bash
# 1. Clone
git clone https://github.com/trendywink247-afk/GeekSpace2.0.git
cd GeekSpace2.0

# 2. Bootstrap (creates .env, generates secrets, builds, deploys)
./scripts/bootstrap.sh

# 3. Edit .env — set your domain and Ollama URL
#    CORS_ORIGINS, PUBLIC_URL, API_URL, OLLAMA_BASE_URL

# 4. Copy frontend to Caddy serving directory
docker cp geekspace-app:/app/dist/. /var/www/geekspace/

# 5. Verify
curl http://localhost:3001/api/health | jq .
```

The bootstrap script handles `.env` creation, secret generation (`JWT_SECRET`, `ENCRYPTION_KEY`), Docker network setup, and container deployment. It's idempotent — safe to run multiple times.

## Architecture

```
Internet → Caddy (:443, auto-HTTPS)
               │
               ├── /api/*  →  Agentin (:3001) → Redis (:6379)
               │                    │
               │                    ├── Ollama (local LLM)
               │                    └── Groq/Together AI/Edith (cloud LLM)
               │
               └── /*  →  /var/www/geekspace (SPA files)
```

**Docker Compose services:**

| Service | Required | Port | Purpose |
|---------|----------|------|---------|
| `geekspace` | Yes | 3001 (exposed) | Express API + built frontend |
| `redis` | Yes | 6379 (internal) | Job queue + cache |
| `caddy` | Yes | 80, 443 (exposed) | Reverse proxy, auto-HTTPS |
| `picoclaw` | Optional | 8080 (internal) | Automation sidecar (fast small model) |
| `browser` | Optional | 3100 (internal) | Playwright headless Chromium |
| `searxng` | Optional | 8888 (internal) | Self-hosted metasearch |
| `meilisearch` | Optional | 7700 (internal) | Typo-tolerant instant search |
| `qdrant` | Optional | 6333 (internal) | Vector DB for semantic search |
| `uptime-kuma` | Optional | 3200 (internal) | Monitoring dashboard |

## Caddy Configuration

```caddyfile
{
    email admin@yourdomain.com
}

yourdomain.com {
    handle /api/* {
        reverse_proxy localhost:3001
    }
    handle {
        root * /var/www/geekspace
        try_files {path} /index.html
        file_server
    }
}
```

Caddy handles HTTPS automatically via Let's Encrypt. No manual certificate management needed.

```bash
# Install Caddy
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install caddy

# Apply config
cp Caddyfile /etc/caddy/Caddyfile
systemctl restart caddy
```

## Ollama Setup

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull qwen3:8b

# Verify
curl http://localhost:11434/api/tags
```

If Ollama runs in Docker with a mapped port (e.g. `32778→11434`):
```env
OLLAMA_BASE_URL=http://localhost:32778
# Or from inside Docker: http://host.docker.internal:32778
```

## Telegram Bot Setup

1. Create a bot via [@BotFather](https://t.me/BotFather) on Telegram
2. Copy the bot token
3. Set in `.env`:
   ```env
   TELEGRAM_BOT_TOKEN=your_token_here
   TELEGRAM_WEBHOOK_SECRET=any_random_string_here
   API_URL=https://yourdomain.com
   ```
4. Restart: `docker compose up -d geekspace`
5. Verify — the server registers the webhook automatically on startup:
   ```bash
   docker logs --tail 20 geekspace-app | grep -i telegram
   # Expected: "Telegram bot identified" + "Telegram webhook registered"
   ```

> **Note**: The bot token and webhook secret are read from `.env` only. They are never stored in the database.

## Automation Sidecar

The automation sidecar is a lightweight Node.js container that handles trivial/automation tasks via a fast small model. It runs on the internal network — **never exposed publicly**.

1. Set in `.env`:
   ```env
   PICOCLAW_URL=http://picoclaw:8080
   PICOCLAW_ENABLED=true
   ```
2. Rebuild: `docker compose up -d --build`
3. Verify:
   ```bash
   curl http://localhost:3001/api/health | jq .components.picoclaw
   # Expected: "reachable"
   ```

## Health Checks & Repair

```bash
# Full system health check
./scripts/healthcheck.sh

# Diagnose port conflicts and container issues
./scripts/repair.sh

# Docker cleanup (unused images, containers, build cache)
./scripts/cleanup.sh

# Just the API
curl http://localhost:3001/api/health | jq .

# Docker container status
docker compose ps
```

Use `repair.sh` when the API is unreachable or you suspect a port conflict (e.g., a stale host Node process competing with Docker for port 3001). It prints diagnostics and suggested fix commands without modifying anything.

## Updating

```bash
cd GeekSpace2.0
git pull origin main
docker compose up -d --build
docker cp geekspace-app:/app/dist/. /var/www/geekspace/
docker compose ps
curl https://yourdomain.com/api/health
```

> **Important**: Step 3 (`docker cp`) is required because Caddy serves the frontend from `/var/www/geekspace`, not from Docker. Forgetting this means users see the old frontend.

## Monitoring

```bash
# Container resource usage
docker stats --no-stream

# Expected baseline (idle):
# geekspace-app:   ~80MB RAM, <1% CPU
# geekspace-redis: ~10MB RAM, <1% CPU

# Application logs (JSON structured)
docker compose logs -f geekspace

# Filter errors only (Pino level 50 = error)
docker compose logs geekspace 2>&1 | grep '"level":50'

# Caddy logs
journalctl -u caddy -f
```

## Docker Cleanup & Maintenance

```bash
# Remove unused images (after updates)
docker image prune -f

# Remove all stopped containers
docker container prune -f

# Remove unused volumes (CAUTION: don't remove data volumes)
docker volume ls  # check first
docker volume prune -f --filter "label!=keep"

# Full cleanup (unused images, containers, networks)
docker system prune -f

# Check disk usage
docker system df
```

## Backup

```bash
# Database backup
docker cp geekspace-app:/app/data/geekspace.db ./backups/geekspace-$(date +%Y%m%d).db

# Automated daily backup (add to crontab)
0 3 * * * mkdir -p /root/backups && docker cp geekspace-app:/app/data/geekspace.db /root/backups/geekspace-$(date +\%Y\%m\%d).db
0 4 * * * find /root/backups -name "geekspace-*.db" -mtime +30 -delete
```

## Environment Variables

See [ENV_VARS.md](./ENV_VARS.md) for the complete reference.

## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues and fixes.
