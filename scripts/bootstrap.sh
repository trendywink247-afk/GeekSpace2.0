#!/usr/bin/env bash
# ============================================================
# GeekSpace 2.0 — Bootstrap Deploy
# Idempotent: safe to run multiple times.
# Creates network, validates .env, generates secrets, deploys.
# Usage: ./scripts/bootstrap.sh
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "========================================"
echo " GeekSpace Bootstrap"
echo " $(date -u '+%Y-%m-%d %H:%M UTC')"
echo "========================================"
echo ""

# ── 1. Docker network ──────────────────
echo ">> Ensuring Docker network 'geekspace-shared'..."
if docker network inspect geekspace-shared >/dev/null 2>&1; then
    echo "   Already exists."
else
    docker network create geekspace-shared
    echo "   Created."
fi
echo ""

# ── 2. .env file ───────────────────────
if [ -f .env ]; then
    echo ">> .env exists."
else
    echo ">> .env missing — copying from .env.example..."
    cp .env.example .env
    echo ""
    echo "   ┌────────────────────────────────────────────┐"
    echo "   │  TODO: Edit .env and set these values:     │"
    echo "   │                                            │"
    echo "   │  CORS_ORIGINS=https://yourdomain.com       │"
    echo "   │  PUBLIC_URL=https://yourdomain.com         │"
    echo "   │  API_URL=https://yourdomain.com            │"
    echo "   │  OLLAMA_BASE_URL=http://ollama:11434       │"
    echo "   │                                            │"
    echo "   │  Then re-run: ./scripts/bootstrap.sh       │"
    echo "   └────────────────────────────────────────────┘"
fi
echo ""

# ── 3. Auto-generate secrets ──────────
echo ">> Checking production secrets..."

fill_secret() {
    local key="$1"
    local gen_cmd="$2"
    local label="$3"

    # Match: KEY= with nothing after it, or KEY= followed by whitespace only
    if grep -qE "^${key}=\s*$" .env 2>/dev/null; then
        local value
        value=$(eval "$gen_cmd")
        # Use | as sed delimiter to avoid issues with / in values
        sed -i "s|^${key}=.*|${key}=${value}|" .env
        echo "   Generated ${label}."
    elif grep -qE "^${key}=" .env 2>/dev/null; then
        echo "   ${label} already set."
    else
        # Key line doesn't exist at all — append it
        local value
        value=$(eval "$gen_cmd")
        echo "${key}=${value}" >> .env
        echo "   Generated ${label} (appended)."
    fi
}

fill_secret "JWT_SECRET" "openssl rand -hex 64" "JWT_SECRET"
fill_secret "ENCRYPTION_KEY" "openssl rand -hex 32" "ENCRYPTION_KEY"
echo ""

# ── 4. Build and start ─────────────────
echo ">> Building and starting Docker containers..."
docker compose up -d --build
echo ""

# ── 5. Wait for API ────────────────────
echo ">> Waiting for API (up to 45s)..."
API_READY=false
for i in $(seq 1 45); do
    if curl -sf http://localhost:3001/api/health >/dev/null 2>&1; then
        echo "   API ready after ${i}s."
        API_READY=true
        break
    fi
    sleep 1
done
if [ "$API_READY" = false ]; then
    echo "   API not ready after 45s."
fi
echo ""

# ── 6. Summary ──────────────────────────
echo "========================================"
echo " GeekSpace Bootstrap Summary"
echo "========================================"

# API
if [ "$API_READY" = true ]; then
    echo "  API:       http://localhost:3001/api/health  READY"
else
    echo "  API:       http://localhost:3001/api/health  NOT READY"
fi

# Ollama
OLLAMA_URL=$(grep -E "^OLLAMA_BASE_URL=" .env 2>/dev/null | cut -d= -f2- | xargs 2>/dev/null || echo "")
if [ -n "$OLLAMA_URL" ]; then
    if curl -sf "${OLLAMA_URL}/api/tags" >/dev/null 2>&1; then
        echo "  Ollama:    reachable ($OLLAMA_URL)"
    else
        echo "  Ollama:    unreachable ($OLLAMA_URL)"
    fi
else
    echo "  Ollama:    not configured"
fi

# PicoClaw
PICO_ENABLED=$(grep -E "^PICOCLAW_ENABLED=" .env 2>/dev/null | cut -d= -f2- | xargs 2>/dev/null || echo "false")
PICO_URL=$(grep -E "^PICOCLAW_URL=" .env 2>/dev/null | cut -d= -f2- | xargs 2>/dev/null || echo "")
if [ "$PICO_ENABLED" = "true" ] && [ -n "$PICO_URL" ]; then
    if curl -sf "${PICO_URL}/health" >/dev/null 2>&1; then
        echo "  PicoClaw:  reachable ($PICO_URL)"
    else
        echo "  PicoClaw:  unreachable ($PICO_URL)"
    fi
elif [ "$PICO_ENABLED" = "true" ]; then
    echo "  PicoClaw:  enabled but URL not set"
else
    echo "  PicoClaw:  disabled"
fi

# Redis
REDIS_STATUS=$(docker inspect -f '{{.State.Health.Status}}' geekspace-redis 2>/dev/null || echo "not_found")
if [ "$REDIS_STATUS" = "healthy" ]; then
    echo "  Redis:     ok (healthy)"
elif [ "$REDIS_STATUS" = "not_found" ]; then
    echo "  Redis:     down (container not found)"
else
    echo "  Redis:     $REDIS_STATUS"
fi

# Telegram
TELEGRAM_TOKEN=$(grep -E "^TELEGRAM_BOT_TOKEN=" .env 2>/dev/null | cut -d= -f2- | xargs 2>/dev/null || echo "")
if [ -n "$TELEGRAM_TOKEN" ]; then
    echo "  Telegram:  configured"
else
    echo "  Telegram:  not_configured"
fi

echo "========================================"
echo ""

if [ "$API_READY" = true ]; then
    echo "Done. GeekSpace is running."
else
    echo "Done with warnings. Check: docker compose logs --tail 50 geekspace"
fi
