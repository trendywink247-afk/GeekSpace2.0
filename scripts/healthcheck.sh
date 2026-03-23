#!/usr/bin/env bash
# ============================================================
# GeekSpace 2.0 — System health check
# Usage: ./scripts/healthcheck.sh
# ============================================================
set -euo pipefail

PASS=0
FAIL=0
WARN=0

pass() { echo "  [PASS] $1"; PASS=$((PASS + 1)); }
fail() { echo "  [FAIL] $1"; FAIL=$((FAIL + 1)); }
warn() { echo "  [WARN] $1"; WARN=$((WARN + 1)); }

echo "========================================"
echo " GeekSpace Health Check"
echo "========================================"
echo ""

# ── 1. GeekSpace API ──────────────────────
echo "-- API --"
if response=$(curl -sf --max-time 5 http://localhost:3001/api/health 2>/dev/null); then
    pass "GeekSpace API (localhost:3001)"
    # Show API health details if jq or python3 available
    if command -v python3 &>/dev/null; then
        echo "$response" | python3 -m json.tool 2>/dev/null | sed 's/^/       /'
    fi
else
    fail "GeekSpace API (localhost:3001) — not responding"
fi

# ── 2. Redis ──────────────────────────────
echo "-- Redis --"
# Source REDIS_PASSWORD from .env if not already set
if [ -z "${REDIS_PASSWORD:-}" ]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    ENV_FILE="${SCRIPT_DIR}/../.env"
    if [ -f "$ENV_FILE" ]; then
        REDIS_PASSWORD=$(grep -E '^REDIS_PASSWORD=' "$ENV_FILE" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
    fi
fi
REDIS_AUTH_FLAG=()
[ -n "${REDIS_PASSWORD:-}" ] && REDIS_AUTH_FLAG=(-a "$REDIS_PASSWORD")

if command -v redis-cli &>/dev/null; then
    if redis-cli "${REDIS_AUTH_FLAG[@]}" ping 2>/dev/null | grep -q PONG; then
        pass "Redis (local)"
    else
        fail "Redis — not responding to PING"
    fi
elif docker exec geekspace-redis redis-cli "${REDIS_AUTH_FLAG[@]}" ping 2>/dev/null | grep -q PONG; then
    pass "Redis (via Docker)"
else
    fail "Redis — not reachable"
fi

# ── 3. Ollama ─────────────────────────────
echo "-- Ollama --"
OLLAMA_URL="${OLLAMA_BASE_URL:-http://localhost:32778}"
if curl -sf -o /dev/null --max-time 5 "$OLLAMA_URL" 2>/dev/null; then
    # Count available models
    model_count=$(curl -sf --max-time 5 "$OLLAMA_URL/api/tags" 2>/dev/null \
        | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('models',[])))" 2>/dev/null || echo "?")
    pass "Ollama ($OLLAMA_URL) — $model_count model(s) loaded"
elif curl -sf -o /dev/null --max-time 5 http://localhost:11434 2>/dev/null; then
    pass "Ollama (localhost:11434, fallback port)"
else
    warn "Ollama — not reachable at $OLLAMA_URL"
fi

# ── 4. Docker containers ─────────────────
echo "-- Docker --"
if command -v docker &>/dev/null; then
    for container in geekspace-app geekspace-redis; do
        status=$(docker inspect -f '{{.State.Status}}' "$container" 2>/dev/null || echo "not_found")
        if [ "$status" = "running" ]; then
            health=$(docker inspect -f '{{.State.Health.Status}}' "$container" 2>/dev/null || echo "none")
            if [ "$health" = "healthy" ]; then
                pass "Container $container (healthy)"
            elif [ "$health" = "none" ]; then
                pass "Container $container (running)"
            else
                warn "Container $container (running, health: $health)"
            fi
        elif [ "$status" = "not_found" ]; then
            warn "Container $container — not found (may run outside Docker)"
        else
            fail "Container $container — status: $status"
        fi
    done
else
    warn "Docker CLI not available"
fi

# ── 5. Caddy ─────────────────────────────
echo "-- Caddy --"
if systemctl is-active --quiet caddy 2>/dev/null; then
    pass "Caddy reverse proxy"
else
    warn "Caddy — not running (or not managed by systemd)"
fi

# ── 6. Disk usage ────────────────────────
echo "-- Disk --"
disk_pct=$(df / --output=pcent 2>/dev/null | tail -1 | tr -d ' %')
if [ -n "$disk_pct" ]; then
    disk_info=$(df -h / --output=used,size 2>/dev/null | tail -1 | xargs)
    if [ "$disk_pct" -lt 85 ]; then
        pass "Disk: ${disk_pct}% ($disk_info)"
    elif [ "$disk_pct" -lt 95 ]; then
        warn "Disk: ${disk_pct}% ($disk_info) — getting full"
    else
        fail "Disk: ${disk_pct}% ($disk_info) — critical"
    fi
fi

# ── 7. Memory usage ─────────────────────
echo "-- Memory --"
if command -v free &>/dev/null; then
    mem_info=$(free -m | awk '/^Mem:/ {printf "%dMB / %dMB (%.0f%%)", $3, $2, $3/$2*100}')
    mem_pct=$(free | awk '/^Mem:/ {printf "%.0f", $3/$2*100}')
    if [ "$mem_pct" -lt 85 ]; then
        pass "Memory: $mem_info"
    elif [ "$mem_pct" -lt 95 ]; then
        warn "Memory: $mem_info — high"
    else
        fail "Memory: $mem_info — critical"
    fi
fi

# ── Summary ──────────────────────────────
echo ""
echo "========================================"
echo " Results: $PASS passed, $FAIL failed, $WARN warnings"
echo "========================================"

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
