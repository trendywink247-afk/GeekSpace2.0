# GeekSpace 2.0 — Operations Runbook

## Prerequisites

| Requirement | Minimum |
|---|---|
| VPS | 2 vCPU, 2 GB RAM (Hostinger KVM2 or equivalent) |
| OS | Ubuntu 22.04+ / Debian 12+ |
| Docker | 24.0+ |
| Docker Compose | v2.20+ |
| Domain | A-record pointing to VPS IP |
| Ollama | Installed on host (or separate server) |

---

## First Deploy

```bash
# 1. Clone and enter the repo
git clone https://github.com/trendywink247-afk/GeekSpace2.0.git
cd GeekSpace2.0

# 2. Create environment file
cp .env.example .env

# 3. Generate secrets
echo "JWT_SECRET=$(openssl rand -hex 64)" >> .env
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)" >> .env

# 4. Edit .env — set CORS_ORIGINS, PUBLIC_URL, OLLAMA_BASE_URL, etc.
nano .env

# 5. Build and start
docker compose up -d --build

# 6. Verify
docker compose ps          # all services "Up (healthy)"
curl http://localhost/api/health
```

### Ollama Setup (on host)

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull the default model
ollama pull qwen2.5-coder:1.5b

# Verify it's running
curl http://localhost:11434/api/tags
```

The Docker container reaches Ollama via `host.docker.internal:11434`. On Linux, add this to docker-compose.yml under the `geekspace` service if needed:

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

---

## Update Procedure

```bash
cd GeekSpace2.0

# 1. Pull latest code
git pull origin main

# 2. Rebuild and restart (zero-downtime with health checks)
docker compose up -d --build

# 3. Verify
docker compose ps
curl http://localhost/api/health

# 4. Check logs for errors
docker compose logs --tail=50 geekspace
```

---

## Backup & Restore

### Backup SQLite Database

```bash
# Option 1: Copy from Docker volume
docker compose exec geekspace cp /app/data/geekspace.db /app/data/backup-$(date +%Y%m%d).db
docker cp geekspace-app:/app/data/backup-$(date +%Y%m%d).db ./backups/

# Option 2: Direct volume backup
docker run --rm -v geekspace20_geekspace-data:/data -v $(pwd)/backups:/backups alpine \
  cp /data/geekspace.db /backups/geekspace-$(date +%Y%m%d).db
```

### Restore from Backup

```bash
# 1. Stop the app
docker compose stop geekspace

# 2. Copy backup into volume
docker cp ./backups/geekspace-20260213.db geekspace-app:/app/data/geekspace.db

# 3. Restart
docker compose start geekspace
```

### Automated Daily Backups (cron)

```bash
# Add to crontab: crontab -e
0 3 * * * cd /path/to/GeekSpace2.0 && docker run --rm \
  -v geekspace20_geekspace-data:/data \
  -v /path/to/backups:/backups \
  alpine cp /data/geekspace.db /backups/geekspace-$(date +\%Y\%m\%d).db
```

---

## Secret Rotation

### Rotate JWT_SECRET

1. Generate new secret: `openssl rand -hex 64`
2. Update `JWT_SECRET` in `.env`
3. Restart: `docker compose restart geekspace`
4. **Impact**: All existing sessions are invalidated — users must log in again

### Rotate ENCRYPTION_KEY

> **Warning**: Changing the encryption key will make previously encrypted API keys unreadable. You must re-encrypt them or ask users to re-enter their API keys.

1. Generate new key: `openssl rand -hex 32`
2. Update `ENCRYPTION_KEY` in `.env`
3. Restart: `docker compose restart geekspace`

---

## Monitoring

### Health Endpoint

```bash
# Returns status, uptime, component health
curl http://localhost/api/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-02-13T12:00:00.000Z",
  "version": "2.1.0",
  "uptime": 86400,
  "components": {
    "database": "ok",
    "ollama": "configured",
    "openrouter": "configured",
    "edith": "not_configured"
  }
}
```

### Logs

```bash
# All services
docker compose logs -f

# Just the app (structured JSON in production)
docker compose logs -f geekspace

# Last 100 lines
docker compose logs --tail=100 geekspace

# Filter errors (requires jq)
docker compose logs geekspace 2>&1 | grep '"level":50'
```

### Resource Usage

```bash
docker stats --no-stream
```

---

## Troubleshooting

### Container won't start

```bash
docker compose logs geekspace
# Look for: "FATAL: Required env var JWT_SECRET is not set"
# Fix: ensure .env has all required vars
```

### Ollama connection refused

```bash
# Check Ollama is running on host
curl http://localhost:11434/api/tags

# Check Docker can reach host
docker compose exec geekspace curl http://host.docker.internal:11434/api/tags

# On Linux, ensure extra_hosts is set (see Ollama Setup above)
```

### Database locked errors

```bash
# Only one process should access SQLite at a time
# Check no duplicate containers are running
docker compose ps

# If stuck, restart
docker compose restart geekspace
```

### 502 Bad Gateway from Nginx

```bash
# App hasn't started yet or crashed — check health
docker compose ps
docker compose logs geekspace

# Nginx may have started before app was healthy — restart nginx
docker compose restart nginx
```

### High memory usage

```bash
# Check per-container usage
docker stats --no-stream

# Redis is capped at 128MB by default (see docker-compose.yml)
# For the app, check for memory leaks in logs
```

---

## SSL Setup (Certbot)

```bash
# Install certbot on host
apt install certbot

# Get certificate
certbot certonly --standalone -d yourdomain.com

# Copy certs
mkdir -p nginx/certs
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/certs/
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/certs/

# Uncomment the HTTPS server block in nginx/default.conf
# Uncomment the cert volume mount in docker-compose.yml
# Uncomment the HTTP→HTTPS redirect in nginx/default.conf

docker compose restart nginx

# Auto-renew (add to crontab)
0 0 1 * * certbot renew --quiet && cp /etc/letsencrypt/live/yourdomain.com/*.pem /path/to/GeekSpace2.0/nginx/certs/ && docker compose restart nginx
```
