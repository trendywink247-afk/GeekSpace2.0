#!/usr/bin/env bash
# ============================================================
# GeekSpace 2.0 — Production deployment
# Usage: ./scripts/prod.sh
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "========================================"
echo " GeekSpace Production Deploy"
echo "========================================"
echo ""

# ── 1. Pull latest code ──────────────────
echo ">> Pulling latest code..."
git pull --ff-only
echo ""

# ── 2. Build Docker images ───────────────
echo ">> Building Docker images..."
docker compose build
echo ""

# ── 3. Deploy ────────────────────────────
echo ">> Starting containers..."
docker compose up -d
echo ""

# ── 4. Sync frontend to Caddy serve dir ─
echo ">> Syncing frontend assets to host..."
docker cp geekspace-app:/app/dist/. /var/www/geekspace/
# Validate critical files exist
for f in index.html assets; do
    if [ ! -e "/var/www/geekspace/$f" ]; then
        echo "ERROR: /var/www/geekspace/$f missing after sync!"
        exit 1
    fi
done
echo "   Frontend synced to /var/www/geekspace/"
echo ""

# ── 5. Bump service worker cache name ────
echo ">> Bumping service worker cache..."
SHORT_SHA=$(git rev-parse --short HEAD)
SW_FILE="/var/www/geekspace/sw.js"
if [ -f "$SW_FILE" ]; then
    sed -i "s/const CACHE_NAME = '.*'/const CACHE_NAME = 'agentin-${SHORT_SHA}'/" "$SW_FILE"
    echo "   SW cache: agentin-${SHORT_SHA}"
fi
echo ""

# ── 6. Sync Caddy config + reload ────────
echo ">> Reloading Caddy..."
if systemctl is-active --quiet caddy; then
    sudo caddy reload --config /etc/caddy/Caddyfile 2>/dev/null && echo "   Host Caddy reloaded" || echo "   Host Caddy reload failed"
else
    echo "   Host Caddy not running — skipping reload"
fi
echo ""

# ── 7. Wait for startup ─────────────────
echo ">> Waiting for services to start..."
for i in $(seq 1 30); do
    if curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
        echo "   API ready after ${i}s"
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "   API not ready after 30s — continuing with healthcheck"
    fi
    sleep 1
done
echo ""

# ── 8. Health check ──────────────────────
echo ">> Running health check..."
echo ""
if bash "$SCRIPT_DIR/healthcheck.sh"; then
    echo ""
    echo "Deploy successful."
else
    echo ""
    echo "Deploy completed with issues."
    echo "Check logs: docker compose logs --tail=50"
fi

# ── 9. Container status ─────────────────
echo ""
echo "-- Container Status --"
docker compose ps
