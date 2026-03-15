# GeekSpace 2.0 — Operations Runbook

## Prerequisites

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| VPS | 2 vCPU, 4 GB RAM | 4 vCPU, 12-16 GB RAM |
| OS | Ubuntu 22.04+ / Debian 12+ | Ubuntu 24.04 |
| Docker | 24.0+ with Compose v2 | Latest |
| Caddy | 2.6+ (installed on host) | Latest |
| Domain | A-record pointing to VPS IP | — |
| Ollama | Running on host or Docker | With qwen3:8b |

---

## First Deploy

### 1. Install System Dependencies

```bash
# Docker
curl -fsSL https://get.docker.com | sh

# Caddy
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install caddy

# Ollama
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull qwen3:8b
```

### 2. Configure Caddy

```bash
cat > /etc/caddy/Caddyfile << 'EOF'
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
EOF

mkdir -p /var/www/geekspace
systemctl restart caddy
```

### 3. Clone and Configure

```bash
git clone https://github.com/trendywink247-afk/GeekSpace2.0.git
cd GeekSpace2.0

cp .env.example .env
nano .env
```

Required `.env` values for production:

```env
NODE_ENV=production
JWT_SECRET=$(openssl rand -hex 64)
ENCRYPTION_KEY=$(openssl rand -hex 32)
CORS_ORIGINS=https://yourdomain.com
PUBLIC_URL=https://yourdomain.com
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
REDIS_URL=redis://redis:6379
SEED_DEMO_DATA=false
```

### 4. Build and Start

```bash
docker compose up -d --build
docker cp geekspace-app:/app/dist/. /var/www/geekspace/

# Verify
docker compose ps
curl https://yourdomain.com/api/health
```

---

## Update Procedure

```bash
cd GeekSpace2.0
git pull origin live-production
docker compose up -d --build
docker cp geekspace-app:/app/dist/. /var/www/geekspace/
docker compose ps
curl https://yourdomain.com/api/health
```

> **Important**: The `docker cp` step is required — Caddy serves the frontend from `/var/www/geekspace`, not Docker.

---

## Container Management

### Service Overview

| Container | Image | Purpose | Port |
|-----------|-------|---------|------|
| `geekspace-app` | `geekspace20-geekspace` | Express API + built frontend | 3001 |
| `geekspace-redis` | `redis:7-alpine` | Job queue + cache | 6379 (internal) |
| `geekspace-caddy` | `caddy:2-alpine` | Reverse proxy, auto-HTTPS | 80, 443 |
| `geekspace-picoclaw` | Custom (Node 20) | Automation sidecar | 8080 (internal) |
| `geekspace-browser` | Custom (Playwright) | Headless Chromium | 3100 (internal) |
| `geekspace-searxng` | `searxng/searxng` | Self-hosted metasearch | 8888 (internal) |
| `geekspace-meilisearch` | `getmeili/meilisearch` | Instant search | 7700 (internal) |
| `geekspace-qdrant` | `qdrant/qdrant` | Vector DB | 6333 (internal) |
| `geekspace-uptime-kuma` | `louislam/uptime-kuma` | Monitoring | 3200 (internal) |

### Common Commands

```bash
docker compose ps                              # Status
docker compose logs -f geekspace               # Follow app logs
docker compose logs --tail=100 geekspace       # Last 100 lines
docker compose restart geekspace               # Restart app
docker compose up -d --build geekspace         # Rebuild after code changes
docker stats --no-stream                       # Resource usage
```

---

## Backup & Restore

### Backup SQLite Database

```bash
# Quick backup
docker cp geekspace-app:/app/data/geekspace.db ./backups/geekspace-$(date +%Y%m%d).db

# Volume-level backup
docker run --rm \
  -v geekspace20_geekspace-data:/data \
  -v $(pwd)/backups:/backups \
  alpine cp /data/geekspace.db /backups/geekspace-$(date +%Y%m%d).db
```

### Restore from Backup

```bash
docker compose stop geekspace
docker run --rm \
  -v geekspace20_geekspace-data:/data \
  -v $(pwd)/backups:/backups \
  alpine cp /backups/geekspace-20260215.db /data/geekspace.db
docker compose start geekspace
```

### Automated Daily Backups (cron)

```bash
# crontab -e
0 3 * * * mkdir -p /root/backups && docker cp geekspace-app:/app/data/geekspace.db /root/backups/geekspace-$(date +\%Y\%m\%d).db
0 4 * * * find /root/backups -name "geekspace-*.db" -mtime +30 -delete
```

---

## Secret Rotation

### Rotate JWT_SECRET

1. Generate new secret: `openssl rand -hex 64`
2. Update `JWT_SECRET` in `.env`
3. Restart: `docker compose restart geekspace`
4. **Impact**: All existing sessions invalidated — users must log in again

### Rotate ENCRYPTION_KEY

> **Warning**: Changing the encryption key makes previously encrypted API keys unreadable.

1. Generate new key: `openssl rand -hex 32`
2. Update `ENCRYPTION_KEY` in `.env`
3. Restart: `docker compose restart geekspace`

---

## Credit System Maintenance

### Check User Credits

```bash
docker exec geekspace-app node -e "
const db = require('/app/server/node_modules/better-sqlite3')('/app/data/geekspace.db');
console.table(db.prepare('SELECT s.user_id, u.username, s.plan, s.credits_remaining, s.credits_total, s.cycle_end FROM subscriptions s JOIN users u ON u.id = s.user_id').all());
"
```

### Reset a User's Billing Cycle

```bash
docker exec geekspace-app node -e "
const db = require('/app/server/node_modules/better-sqlite3')('/app/data/geekspace.db');
const now = new Date().toISOString().split('T')[0];
const end = new Date(Date.now() + 30*86400000).toISOString().split('T')[0];
db.prepare('UPDATE subscriptions SET credits_remaining = credits_total, cycle_start = ?, cycle_end = ? WHERE user_id = ?').run(now, end, 'USER_ID_HERE');
console.log('Cycle reset');
"
```

### Grant Credits to a User

```bash
docker exec geekspace-app node -e "
const db = require('/app/server/node_modules/better-sqlite3')('/app/data/geekspace.db');
db.prepare('UPDATE subscriptions SET credits_remaining = credits_remaining + 10000 WHERE user_id = ?').run('USER_ID_HERE');
console.log('Credits granted');
"
```

### Upgrade a User's Plan

```bash
docker exec geekspace-app node -e "
const db = require('/app/server/node_modules/better-sqlite3')('/app/data/geekspace.db');
db.prepare('UPDATE subscriptions SET plan = ?, credits_remaining = ?, credits_total = ? WHERE user_id = ?').run('monthly', 100000, 100000, 'USER_ID_HERE');
console.log('Plan upgraded');
"
```

---

## Personality System Troubleshooting

### Check Current Personality

```bash
docker exec geekspace-app node -e "
const db = require('/app/server/node_modules/better-sqlite3')('/app/data/geekspace.db');
console.table(db.prepare('SELECT user_id, name, personality, mode, voice FROM agent_configs').all());
"
```

### Reset Personality to Default (Jarvis)

```bash
docker exec geekspace-app node -e "
const db = require('/app/server/node_modules/better-sqlite3')('/app/data/geekspace.db');
db.prepare('UPDATE agent_configs SET personality = ? WHERE user_id = ?').run('jarvis', 'USER_ID_HERE');
console.log('Reset to Jarvis');
"
```

### Verify Personality Prompt Loading

```bash
# Check that personality prompts exist in the compiled output
docker exec geekspace-app node -e "
const { getPersonality } = require('/app/server/dist/prompts/personalities.js');
['edith','jarvis','weebo'].forEach(p => {
  const def = getPersonality(p);
  console.log(p + ':', def ? 'OK (' + def.subtitle + ')' : 'MISSING');
});
"
```

---

## Monitoring

### Health Endpoint

```bash
curl https://yourdomain.com/api/health | jq .
```

| Status | Meaning |
|--------|---------|
| `"ok": true` | Database is healthy |
| `"status": "degraded"` | Database is down |
| `ollama: "reachable"` | Ollama responded to `/api/tags` |

### Log Analysis

```bash
docker compose logs -f geekspace                              # Follow all
docker compose logs geekspace 2>&1 | grep '"level":50'        # Errors only
docker compose logs geekspace 2>&1 | grep '"level":40'        # Warnings
docker compose logs geekspace 2>&1 | grep -c '"status":401'   # Auth failures
```

### Caddy Logs

```bash
journalctl -u caddy -f
journalctl -u caddy --since "1h"
```

### Resource Usage

```bash
docker stats --no-stream
# Expected baseline:
# geekspace-app:   ~80MB RAM, <1% CPU
# geekspace-redis: ~10MB RAM, <1% CPU
# Ollama (8b):     ~5GB RAM
```

---

## Database Queries

```bash
# List all users
docker exec geekspace-app node -e "
const db = require('/app/server/node_modules/better-sqlite3')('/app/data/geekspace.db');
console.table(db.prepare('SELECT id, email, username, name, plan FROM users').all());
"

# Check table sizes
docker exec geekspace-app node -e "
const db = require('/app/server/node_modules/better-sqlite3')('/app/data/geekspace.db');
['users','agent_configs','subscriptions','premium_sessions','reminders','integrations','portfolios','automations','usage_events','api_keys','features','activity_log'].forEach(t => {
  const r = db.prepare('SELECT COUNT(*) as count FROM ' + t).get();
  console.log(t + ': ' + r.count + ' rows');
});
"

# Recent activity
docker exec geekspace-app node -e "
const db = require('/app/server/node_modules/better-sqlite3')('/app/data/geekspace.db');
console.table(db.prepare('SELECT action, details, created_at FROM activity_log ORDER BY created_at DESC LIMIT 10').all());
"
```

---

## Password Reset

```bash
docker exec geekspace-app node -e "
const Database = require('/app/server/node_modules/better-sqlite3');
const bcrypt = require('/app/server/node_modules/bcryptjs');
const db = new Database('/app/data/geekspace.db');
const hash = bcrypt.hashSync('NewPassword123', 10);
db.prepare('UPDATE users SET password_hash = ? WHERE email = ?').run(hash, 'user@example.com');
console.log('Password reset successful');
"
```

---

## Network Topology

```
Internet
    │
    ▼
Caddy (:443, auto-HTTPS)
    │
    ├── /api/*  →  geekspace-app (:3001)  ── Redis (:6379)
    │                     │                   [geekspace-net]
    │                     │
    │                     ├── Ollama (:11434 or :32778)
    │                     └── Moonshot API (cloud, via OpenRouter)
    │
    └── /*  →  /var/www/geekspace (SPA)
```

**Networks:**
- `geekspace-net` — internal bridge for GeekSpace containers (app, redis)
- `geekspace-shared` — external network for reaching Ollama containers

---

## Caddy Management

```bash
systemctl status caddy         # Status
systemctl reload caddy         # Reload config (no downtime)
cat /etc/caddy/Caddyfile       # View config
journalctl -u caddy -f         # Logs
```

---

## Docker Cleanup

```bash
docker image prune -f                      # Remove unused images
docker container prune -f                  # Remove stopped containers
docker system prune -f                     # Full cleanup
docker system df                           # Check disk usage
```

---

## Full Rebuild (Nuclear Option)

Preserves database:

```bash
cd GeekSpace2.0
docker compose down
docker image prune -f
docker compose build --no-cache
docker compose up -d
docker cp geekspace-app:/app/dist/. /var/www/geekspace/
docker compose ps
curl https://yourdomain.com/api/health
```

To also reset the database (lose all data):

```bash
docker compose down -v
docker compose up -d --build
docker cp geekspace-app:/app/dist/. /var/www/geekspace/
```
