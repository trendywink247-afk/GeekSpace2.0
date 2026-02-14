#!/usr/bin/env bash
# ============================================================
# GeekSpace 2.0 — production deploy
#
# Usage:
#   ./scripts/prod.sh              # core only (geekspace + redis)
#   ./scripts/prod.sh --edith      # core + edith-bridge
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

PROFILE_FLAG=""
if [[ "${1:-}" == "--edith" ]]; then
  PROFILE_FLAG="--profile edith"
  echo "▸ EDITH bridge enabled"
fi

echo "▸ Building and starting services..."
docker compose $PROFILE_FLAG up -d --build

echo "▸ Waiting for health check (up to 30s)..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:${PORT:-3001}/api/health > /dev/null 2>&1; then
    echo "▸ GeekSpace is healthy!"
    curl -s http://localhost:${PORT:-3001}/api/health | python3 -m json.tool 2>/dev/null || \
      curl -s http://localhost:${PORT:-3001}/api/health
    exit 0
  fi
  sleep 1
done

echo "✗ Health check failed after 30s"
docker compose logs --tail=20 geekspace
exit 1
