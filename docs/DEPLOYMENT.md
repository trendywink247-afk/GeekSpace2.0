# GeekSpace 2.0 — Deployment Guide

## Prerequisites

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| VPS | 2 vCPU, 4 GB RAM | 4 vCPU, 12-16 GB RAM |
| OS | Ubuntu 22.04+ / Debian 12+ | Ubuntu 24.04 |
| Docker | 24.0+ with Compose v2 | Latest |
| Caddy | 2.6+ (on host, not Docker) | Latest |
| Domain | A-record pointing to VPS IP | — |
| Ollama | Running on host or Docker | With 7B+ model |

> **RAM note**: Ollama's `llama3.1:8b` model needs ~5-6 GB RAM on CPU. Budget 12-16 GB total for the full stack.

## Quick Deploy

```bash
# 1. Clone and configure
git clone https://github.com/trendywink247-afk/GeekSpace2.0.git
cd GeekSpace2.0
cp .env.example .env

# 2. Generate secrets
echo "JWT_SECRET=$(openssl rand -hex 64)" >> .env
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)" >> .env

# 3. Set your domain and Ollama URL
# Edit .env — set CORS_ORIGINS, PUBLIC_URL, OLLAMA_BASE_URL

# 4. Deploy
docker compose up -d --build

# 5. Copy frontend to Caddy serving directory
docker cp geekspace-app:/app/dist/. /var/www/geekspace/

# 6. Verify
curl http://localhost:3001/api/health | jq .
```

## Architecture

```
Internet → Caddy (:443, auto-HTTPS)
               │
               ├── /api/*  →  GeekSpace (:3001) → Redis (:6379)
               │                    │
               │                    ├── Ollama (local LLM)
               │                    └── Moonshot API (cloud LLM)
               │
               └── /*  →  /var/www/geekspace (SPA files)
```

**Docker Compose services:**

| Service | Required | Port | Purpose |
|---------|----------|------|---------|
| `geekspace` | Yes | 3001 (exposed) | Express API + built frontend |
| `redis` | Yes | 6379 (internal) | Job queue + cache |

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
ollama pull llama3.1:8b

# Verify
curl http://localhost:11434/api/tags
```

If Ollama runs in Docker with a mapped port (e.g. `32778→11434`):
```env
OLLAMA_BASE_URL=http://localhost:32778
# Or from inside Docker: http://host.docker.internal:32778
```

## Health Checks

```bash
# All components
./scripts/healthcheck.sh

# Just the API
curl http://localhost:3001/api/health | jq .

# Docker container status
docker compose ps
```

## Updating

```bash
cd GeekSpace2.0
git pull origin live-production
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
