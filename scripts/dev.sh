#!/usr/bin/env bash
# ============================================================
# GeekSpace 2.0 — local development
# Starts Redis in Docker, then runs server + frontend with hot-reload.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

echo "▸ Starting Redis..."
docker compose up -d redis

echo "▸ Installing dependencies..."
npm ci --silent
(cd server && npm ci --silent)

echo "▸ Starting server (tsx watch) + frontend (vite)..."
trap 'kill 0' EXIT
(cd server && npm run dev) &
npm run dev &
wait
