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
echo ">> Syncing frontend assets to Caddy..."
docker cp geekspace-app:/app/dist/. /var/www/geekspace/
echo "   Frontend synced to /var/www/geekspace/"
echo ""

# ── 5. Wait for startup ─────────────────
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

# ── 6. Health check ──────────────────────
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

# ── 7. Container status ─────────────────
echo ""
echo "-- Container Status --"
docker compose ps
