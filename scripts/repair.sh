#!/usr/bin/env bash
# ============================================================
# GeekSpace 2.0 — Repair & Diagnostics
# Read-only: prints diagnostics and suggested fixes.
# Does NOT auto-kill or modify anything.
# Usage: ./scripts/repair.sh
# ============================================================
set -euo pipefail

ISSUES=0

echo "========================================"
echo " GeekSpace Repair Diagnostics"
echo " $(date -u '+%Y-%m-%d %H:%M UTC')"
echo "========================================"
echo ""

# ── 1. Port 3001 conflict ──────────────
echo "-- Port 3001 --"
PORT_LINE=$(ss -ltnp 2>/dev/null | grep ':3001' || true)

if [ -z "$PORT_LINE" ]; then
    echo "  [WARN] Nothing is listening on :3001."
    echo ""
    echo "  Suggested fix:"
    echo "    docker compose up -d geekspace"
    echo ""
    ISSUES=$((ISSUES + 1))
else
    echo "  $PORT_LINE"
    echo ""

    # Extract PID from ss output
    PID=$(echo "$PORT_LINE" | grep -oP 'pid=\K[0-9]+' | head -1 || true)

    if [ -n "$PID" ]; then
        # Get process name
        PROC_NAME=$(ps -p "$PID" -o comm= 2>/dev/null || echo "unknown")
        PROC_CMD=$(ps -p "$PID" -o args= 2>/dev/null || echo "unknown")
        PROC_PPID=$(ps -p "$PID" -o ppid= 2>/dev/null | xargs || echo "?")

        if [ "$PROC_NAME" = "docker-proxy" ]; then
            echo "  [OK] Docker proxy owns :3001 (PID $PID). This is correct."
        else
            echo "  [CONFLICT] PID $PID ($PROC_NAME) owns :3001."
            echo "  Command: $PROC_CMD"
            echo "  PPID:    $PROC_PPID"
            echo ""

            # Check if managed by systemd (exclude oneshot network/fix services)
            SYSTEMD_SVC=$(systemctl list-units --type=service --state=active 2>/dev/null | grep -iE 'geekspace.*(api|app|node|server)' || true)
            if [ -n "$SYSTEMD_SVC" ]; then
                echo "  Managed by systemd:"
                echo "    $SYSTEMD_SVC"
                echo ""
                echo "  Suggested fix:"
                echo "    sudo systemctl stop <service-name>"
                echo "    sudo systemctl disable <service-name>"
            else
                echo "  Not managed by systemd (likely orphaned process)."
            fi

            # Check if managed by pm2
            if command -v pm2 &>/dev/null; then
                PM2_LIST=$(pm2 list 2>/dev/null | grep -i geek || true)
                if [ -n "$PM2_LIST" ]; then
                    echo "  Managed by pm2:"
                    echo "    $PM2_LIST"
                    echo ""
                    echo "  Suggested fix:"
                    echo "    pm2 stop geekspace && pm2 delete geekspace"
                else
                    echo "  Not managed by pm2."
                fi
            else
                echo "  pm2 not installed."
            fi

            echo ""
            echo "  Suggested fix:"
            echo "    kill $PID"
            echo "    docker compose up -d geekspace"
            echo ""
            ISSUES=$((ISSUES + 1))
        fi
    fi
fi
echo ""

# ── 2. Docker containers ───────────────
echo "-- Docker Containers --"

EXPECTED_CONTAINERS="geekspace-app geekspace-redis"
for CONTAINER in $EXPECTED_CONTAINERS; do
    STATUS=$(docker inspect -f '{{.State.Status}}' "$CONTAINER" 2>/dev/null || echo "not_found")
    if [ "$STATUS" = "running" ]; then
        HEALTH=$(docker inspect -f '{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || echo "none")
        if [ "$HEALTH" = "healthy" ]; then
            echo "  [OK]   $CONTAINER — running (healthy)"
        elif [ "$HEALTH" = "none" ]; then
            echo "  [OK]   $CONTAINER — running (no healthcheck)"
        else
            echo "  [WARN] $CONTAINER — running but health: $HEALTH"
            ISSUES=$((ISSUES + 1))
        fi
    elif [ "$STATUS" = "not_found" ]; then
        echo "  [FAIL] $CONTAINER — not found"
        ISSUES=$((ISSUES + 1))
    else
        echo "  [FAIL] $CONTAINER — status: $STATUS"
        ISSUES=$((ISSUES + 1))
    fi
done

# Check for optional containers
OPTIONAL_CONTAINERS="geekspace-picoclaw geekspace-edith-bridge geekspace-n8n"
for CONTAINER in $OPTIONAL_CONTAINERS; do
    STATUS=$(docker inspect -f '{{.State.Status}}' "$CONTAINER" 2>/dev/null | tr -d '[:space:]' || true)
    if [ "$STATUS" = "running" ]; then
        HEALTH=$(docker inspect -f '{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || echo "none")
        echo "  [OK]   $CONTAINER — running ($HEALTH)"
    elif [ -n "$STATUS" ] && [ "$STATUS" != "" ]; then
        echo "  [WARN] $CONTAINER — status: $STATUS"
    fi
done
echo ""

# ── 3. Caddy reverse proxy ─────────────
echo "-- Caddy --"

if systemctl is-active --quiet caddy 2>/dev/null; then
    echo "  [OK] Caddy is running."

    # Find Caddyfile
    CADDYFILE=""
    if [ -f /etc/caddy/Caddyfile ]; then
        CADDYFILE="/etc/caddy/Caddyfile"
    elif [ -f "$PROJECT_DIR/Caddyfile" ]; then
        CADDYFILE="$PROJECT_DIR/Caddyfile"
    fi

    if [ -n "$CADDYFILE" ]; then
        PROXY_TARGET=$(grep -oP 'reverse_proxy\s+\K\S+' "$CADDYFILE" | head -1 || true)
        if [ -n "$PROXY_TARGET" ]; then
            echo "  Caddyfile: $CADDYFILE"
            echo "  Proxy target: $PROXY_TARGET"

            # Check if proxy target port matches what's actually listening
            TARGET_PORT=$(echo "$PROXY_TARGET" | grep -oP ':\K[0-9]+' || echo "")
            if [ "$TARGET_PORT" = "3001" ]; then
                if ss -ltnp 2>/dev/null | grep -q ':3001'; then
                    echo "  [OK] Port $TARGET_PORT has a listener."
                else
                    echo "  [WARN] Caddy proxies to :$TARGET_PORT but nothing is listening there."
                    ISSUES=$((ISSUES + 1))
                fi
            fi
        fi
    else
        echo "  [WARN] Caddyfile not found at /etc/caddy/Caddyfile or repo root."
    fi
else
    echo "  [WARN] Caddy is not running (or not managed by systemd)."
fi
echo ""

# ── 4. Summary ──────────────────────────
echo "========================================"
if [ "$ISSUES" -eq 0 ]; then
    echo " ALL CLEAR — no issues found."
else
    echo " ISSUES FOUND: $ISSUES"
fi
echo "========================================"
