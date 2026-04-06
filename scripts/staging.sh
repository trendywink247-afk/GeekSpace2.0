#!/usr/bin/env bash
# ============================================================
# GeekSpace 2.0 — Staging deployment (canonical)
#
# Usage:
#   ./scripts/staging.sh                 # deploy current main
#   ./scripts/staging.sh --file staging  # legacy path (docker-compose.staging.yml)
#
# Default path uses the root docker-compose.yml `staging` service. This
# is the same path CI (.github/workflows/ci.yml → deploy-staging) uses,
# which means local and remote deploys are always byte-identical.
#
# The legacy `docker-compose.staging.yml` is kept around for the rare
# case where you want to deploy staging on its own isolated project
# (different container names, different volumes). That path loads
# `.env.staging` via --env-file so interpolation works.
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

MODE="canonical"
if [ "${1:-}" = "--file" ] && [ "${2:-}" = "staging" ]; then
  MODE="legacy"
fi

echo "========================================"
echo " GeekSpace Staging Deploy ($MODE)"
echo " Target: staging.agentin.chat (:3002)"
echo "========================================"
echo

# ── Pre-flight: .env.staging must exist ──
if [ ! -f ".env.staging" ]; then
  echo "ERROR: .env.staging not found. Copy from .env.staging.example and configure."
  exit 1
fi
# ── Canonical path needs REDIS_PASSWORD in root .env (used by root compose) ──
if [ "$MODE" = "canonical" ] && [ ! -f ".env" ]; then
  echo "ERROR: .env not found. Canonical path uses root docker-compose.yml which needs REDIS_PASSWORD from .env."
  exit 1
fi

export GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"

if [ "$MODE" = "canonical" ]; then
  echo ">> Building frontend (vite) into ./dist ..."
  # 2026-04-06: This is the crucial step that was missing for months.
  # Caddy serves the static SPA from /srv on the HOST, not from inside
  # the Docker container. `docker compose up -d --build staging` only
  # rebuilds the container's /app/dist — it does NOT touch /srv. As a
  # result, every "deploy" was shipping API-server changes to staging
  # while the user kept hitting a stale frontend bundle (sometimes 30+
  # hours old). This was the root cause of "the fix didn't work" being
  # repeated multiple times during the 2026-04-06 nav-bug debug session.
  npx vite build
  echo ">> Syncing ./dist -> /srv (Caddy static root) ..."
  rsync -a --delete dist/ /srv/

  echo ">> Building + starting staging container from root docker-compose.yml..."
  DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1 \
    docker compose up -d --build staging
  CONTAINER="geekspace-staging"
  HEALTH_URL="http://localhost:3002/api/health"
else
  echo ">> Building + starting staging from docker-compose.staging.yml (legacy)..."
  # --env-file makes `${STAGING_REDIS_PASSWORD}` interpolation work.
  # Without this, compose only reads root .env for interpolation and
  # staging-redis crashes with "wrong number of arguments" on empty
  # --requirepass. Learned the hard way; do not remove.
  DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1 \
    docker compose --env-file .env.staging -f docker-compose.staging.yml up -d --build
  echo ">> Restarting Caddy for staging route..."
  docker restart geekspace-caddy || true
  CONTAINER="geekspace-staging-app"
  HEALTH_URL="http://localhost:3002/api/health"
fi
echo

# ── Wait for health ──
echo ">> Waiting for staging health ($HEALTH_URL)..."
for i in $(seq 1 60); do
  if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
    echo "   Staging healthy after ${i}s"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "   ERROR: Staging not ready after 60s"
    echo "   Logs: docker logs $CONTAINER --tail=40"
    docker logs "$CONTAINER" --tail=40 || true
    exit 1
  fi
  sleep 1
done
echo

# ── Status ──
echo "-- Container Status --"
docker ps --filter "name=staging" --format "{{.Names}}: {{.Status}}"
echo
echo "Deploy complete. Staging: https://staging.agentin.chat"
