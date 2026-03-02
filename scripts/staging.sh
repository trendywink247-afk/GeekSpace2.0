#!/usr/bin/env bash
# ============================================================
# GeekSpace 2.0 — Staging deployment
# Usage: ./scripts/staging.sh
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "========================================"
echo " GeekSpace Staging Deploy"
echo " Target: staging.agentin.chat"
echo "========================================"
echo ""

# ── 0. Pre-flight ──────────────────────────
if [ ! -f ".env.staging" ]; then
  echo "ERROR: .env.staging not found. Copy from .env.staging.example and configure."
  exit 1
fi

# ── 1. Build + deploy staging containers ───
echo ">> Building staging Docker images..."
GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
export GIT_SHA
docker compose -f docker-compose.staging.yml build
echo ""

echo ">> Starting staging containers..."
docker compose -f docker-compose.staging.yml up -d
echo ""

# ── 2. Restart Caddy to pick up Caddyfile changes ──
echo ">> Restarting Caddy for staging route..."
docker restart geekspace-caddy
echo ""

# ── 3. Wait for staging app to become healthy ──
echo ">> Waiting for staging app health..."
for i in $(seq 1 60); do
  if docker exec geekspace-staging-app curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "   Staging app healthy after ${i}s"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "   WARNING: Staging app not ready after 60s"
    echo "   Check: docker logs geekspace-staging-app --tail=40"
    exit 1
  fi
  sleep 1
done
echo ""

# ── 4. Container status ─────────────────
echo "-- Staging Container Status --"
docker compose -f docker-compose.staging.yml ps
echo ""
echo "Deploy complete. Staging: https://staging.agentin.chat"
