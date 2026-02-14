# GeekSpace 2.0 — Deployment Guide

## Prerequisites

- VPS with Docker and Docker Compose installed
- Node.js 20+ (for local development only)
- Ollama running on the host (or accessible via network)
- OpenClaw gateway running (optional, for Brain 3)

## Quick Deploy (Docker)

```bash
# 1. Clone the repo
git clone <repo-url>
cd GeekSpace2.0

# 2. Configure environment
cp .env.example .env
nano .env
# Required: JWT_SECRET, ENCRYPTION_KEY
# Recommended: CORS_ORIGINS, PUBLIC_URL, OLLAMA_BASE_URL

# 3. Generate secrets
echo "JWT_SECRET=$(openssl rand -hex 64)" >> .env
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)" >> .env

# 4. Build and start
docker compose up -d --build

# 5. Verify
curl http://localhost/api/health | jq .
```

The app will be available at `http://localhost` (port 80 via nginx).

## Environment Configuration

### Required (Production)

| Variable | How to Generate | Description |
|----------|----------------|-------------|
| `JWT_SECRET` | `openssl rand -hex 64` | JWT signing key |
| `ENCRYPTION_KEY` | `openssl rand -hex 32` | AES key for API key encryption |

### Recommended

| Variable | Example | Description |
|----------|---------|-------------|
| `CORS_ORIGINS` | `https://yourdomain.com` | Allowed origins (comma-separated) |
| `PUBLIC_URL` | `https://yourdomain.com` | Public-facing URL |
| `API_URL` | `https://yourdomain.com/api` | API base URL |
| `NODE_ENV` | `production` | Enables security features |

### AI Providers

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_BASE_URL` | `http://host.docker.internal:11434` | Ollama endpoint |
| `OLLAMA_MODEL` | `qwen2.5:1.5b` | Ollama model name |
| `OPENROUTER_API_KEY` | (empty) | OpenRouter API key |
| `EDITH_GATEWAY_URL` | (empty) | OpenClaw gateway URL |
| `EDITH_TOKEN` | (empty) | OpenClaw bearer token |

## Ollama Setup

### Option A: Ollama on Host (recommended)

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull qwen2.5:1.5b

# Verify
curl http://localhost:11434/api/tags
```

In `.env`:
```env
OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_MODEL=qwen2.5:1.5b
```

The Docker Compose file includes `extra_hosts: ["host.docker.internal:host-gateway"]` to ensure this works on Linux.

### Option B: Ollama in Docker (same compose)

Add to `docker-compose.yml`:
```yaml
  ollama:
    image: ollama/ollama
    container_name: ollama
    volumes:
      - ollama-data:/root/.ollama
    networks:
      - geekspace-net
    deploy:
      resources:
        reservations:
          devices:
            - capabilities: [gpu]  # if GPU available
```

In `.env`:
```env
OLLAMA_BASE_URL=http://ollama:11434
```

## EDITH / OpenClaw Setup

OpenClaw is the Brain 3 premium reasoning engine. It runs as a separate Docker Compose stack.

### OpenClaw Already Running

If OpenClaw is already running (e.g., `openclaw-gtzk-openclaw-1` on port 59259):

```bash
# Verify it's running
docker ps | grep openclaw
# Check its network
docker network ls | grep openclaw

# Set in .env
EDITH_GATEWAY_URL=http://host.docker.internal:59259
```

### Docker Network Connection

The GeekSpace docker-compose.yml joins the OpenClaw network automatically:

```yaml
networks:
  openclaw-net:
    external: true
    name: openclaw-gtzk_default
```

This allows direct container DNS resolution. If your OpenClaw network name is different, update the `name` field accordingly.

If OpenClaw isn't running yet, you'll see a warning during `docker compose up`:
```
WARNING: Network openclaw-gtzk_default declared as external but could not be found
```

This is safe to ignore — the `host.docker.internal` fallback path still works. Once OpenClaw starts, restart GeekSpace to join the network:
```bash
docker compose down && docker compose up -d
```

### Verifying EDITH Connection

```bash
# Health check shows EDITH status
curl http://localhost/api/health | jq '.edith, .components.edith'
# Expected: true, "reachable"

# Force a message through EDITH
TOKEN=$(curl -s -X POST http://localhost/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"alex@example.com","password":"demo123"}' | jq -r .token)

curl -s -X POST http://localhost/api/agent/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message":"/edith what is 2+2?"}' | jq .
```

## SSL / HTTPS

### Option A: Let's Encrypt with Certbot

```bash
# Install certbot
apt install certbot

# Get certificate
certbot certonly --standalone -d yourdomain.com

# Copy certs
mkdir -p nginx/certs
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/certs/
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/certs/
```

Then uncomment the HTTPS server block in `nginx/default.conf` and the cert volume mount in `docker-compose.yml`:

```yaml
volumes:
  - ./nginx/certs:/etc/nginx/certs:ro
```

### Option B: Cloudflare Proxy

Point your domain's DNS to the VPS IP through Cloudflare proxy (orange cloud). Cloudflare handles SSL termination.

## Nginx Configuration

The default `nginx/default.conf` provides:

- **Gzip** compression for text, CSS, JS, JSON, SVG
- **Security headers**: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy
- **API proxy**: `/api/*` to Express backend with WebSocket support
- **SPA fallback**: `/*` serves the React build with `try_files`
- **LLM timeouts**: 120s proxy timeouts (Ollama can be slow on first inference)
- **Static caching**: 30-day cache for JS/CSS/images

## Monitoring

### Health Check

```bash
# Full health check
curl http://localhost/api/health | jq .

# Watch health continuously
watch -n 5 'curl -s http://localhost/api/health | jq .'
```

### Logs

```bash
# All services
docker compose logs -f

# Just the app
docker compose logs -f geekspace

# Just nginx
docker compose logs -f nginx
```

The app uses Pino structured logging. Set `LOG_LEVEL=debug` in `.env` for verbose output.

### Container Health

```bash
docker compose ps
# Shows health status for all containers
```

## Updating

```bash
cd /path/to/GeekSpace2.0
git pull origin main
docker compose up -d --build
```

The SQLite database persists in the `geekspace-data` Docker volume. Schema migrations run automatically on startup via `CREATE TABLE IF NOT EXISTS`.

## Backup

### Database

```bash
# Copy from Docker volume
docker cp geekspace-app:/app/data/geekspace.db ./backup-$(date +%Y%m%d).db
```

### Full Backup

```bash
# Stop services
docker compose stop

# Backup volumes
docker run --rm -v geekspace2_geekspace-data:/data -v $(pwd)/backups:/backup \
  alpine tar czf /backup/geekspace-data-$(date +%Y%m%d).tar.gz /data

# Restart
docker compose start
```

## Troubleshooting

### EDITH not reachable

```bash
# Check OpenClaw is running
docker ps | grep openclaw

# Check network exists
docker network inspect openclaw-gtzk_default

# Test from host
curl http://localhost:59259/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"hi"}]}'

# Test from inside GeekSpace container
docker exec -it geekspace-app sh -c \
  'curl http://host.docker.internal:59259/v1/chat/completions \
   -H "Content-Type: application/json" -d "{}"'
```

### Ollama not reachable

```bash
# Check Ollama is running on host
curl http://localhost:11434/api/tags

# Check from inside container
docker exec -it geekspace-app sh -c \
  'curl http://host.docker.internal:11434/api/tags'
```

### Build failures

```bash
# Clean Docker cache and rebuild
docker compose build --no-cache

# Check TypeScript compilation locally
cd server && npx tsc --noEmit
```

### Database issues

```bash
# Check DB file exists
docker exec -it geekspace-app ls -la /app/data/

# Check DB integrity
docker exec -it geekspace-app sh -c \
  'sqlite3 /app/data/geekspace.db "PRAGMA integrity_check"'
```
